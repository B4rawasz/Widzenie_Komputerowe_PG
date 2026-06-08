"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Upload } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HoughMode = "lines" | "circles";

type Peak = {
	row: number;
	col: number;
	votes: number;
};

type CirclePeak = {
	cx: number;
	cy: number;
	r: number;
	votes: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_W = 320;
const CANVAS_H = 240;

const THETA_STEPS = 180; // 0..179 degrees
const RHO_STEPS = 400; // -max_rho..+max_rho

// Diagonal of the canvas
const MAX_RHO = Math.ceil(Math.sqrt(CANVAS_W * CANVAS_W + CANVAS_H * CANVAS_H));

// ---------------------------------------------------------------------------
// Utility: sobel edge detection (grayscale only)
// ---------------------------------------------------------------------------

function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
	const gray = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		const r = data[i * 4];
		const g = data[i * 4 + 1];
		const b = data[i * 4 + 2];
		gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
	}
	return gray;
}

function sobelEdges(gray: Uint8Array, w: number, h: number, threshold = 40): Uint8Array {
	const edges = new Uint8Array(w * h);
	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const idx = (r: number, c: number) => r * w + c;
			const gx =
				-gray[idx(y - 1, x - 1)] - 2 * gray[idx(y, x - 1)] - gray[idx(y + 1, x - 1)] +
				gray[idx(y - 1, x + 1)] + 2 * gray[idx(y, x + 1)] + gray[idx(y + 1, x + 1)];
			const gy =
				-gray[idx(y - 1, x - 1)] - 2 * gray[idx(y - 1, x)] - gray[idx(y - 1, x + 1)] +
				gray[idx(y + 1, x - 1)] + 2 * gray[idx(y + 1, x)] + gray[idx(y + 1, x + 1)];
			const mag = Math.sqrt(gx * gx + gy * gy);
			edges[y * w + x] = mag > threshold ? 1 : 0;
		}
	}
	return edges;
}

// ---------------------------------------------------------------------------
// Hough Line Transform
// ---------------------------------------------------------------------------

function houghLines(
	edges: Uint8Array,
	w: number,
	h: number,
): { accumulator: Int32Array; rhoSteps: number; thetaSteps: number } {
	const accumulator = new Int32Array(RHO_STEPS * THETA_STEPS);
	const thetaRad = Array.from({ length: THETA_STEPS }, (_, i) => (i * Math.PI) / THETA_STEPS);
	const cosT = thetaRad.map(Math.cos);
	const sinT = thetaRad.map(Math.sin);

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (edges[y * w + x] === 0) continue;
			for (let t = 0; t < THETA_STEPS; t++) {
				const rho = x * cosT[t] + y * sinT[t];
				// Map rho from [-MAX_RHO, MAX_RHO] to [0, RHO_STEPS-1]
				const rhoIdx = Math.round(((rho + MAX_RHO) / (2 * MAX_RHO)) * (RHO_STEPS - 1));
				if (rhoIdx >= 0 && rhoIdx < RHO_STEPS) {
					accumulator[rhoIdx * THETA_STEPS + t] += 1;
				}
			}
		}
	}
	return { accumulator, rhoSteps: RHO_STEPS, thetaSteps: THETA_STEPS };
}

// Non-maximum suppression to find peaks in the accumulator
function findLinePeaks(
	accumulator: Int32Array,
	rhoSteps: number,
	thetaSteps: number,
	minVotes: number,
	suppressRadius = 10,
): Peak[] {
	const peaks: Peak[] = [];

	// Collect all candidates
	const candidates: Peak[] = [];
	for (let r = 0; r < rhoSteps; r++) {
		for (let t = 0; t < thetaSteps; t++) {
			const votes = accumulator[r * thetaSteps + t];
			if (votes >= minVotes) {
				candidates.push({ row: r, col: t, votes });
			}
		}
	}
	candidates.sort((a, b) => b.votes - a.votes);

	const suppressed = new Uint8Array(rhoSteps * thetaSteps);
	for (const c of candidates) {
		if (suppressed[c.row * thetaSteps + c.col]) continue;
		peaks.push(c);
		// Suppress neighbourhood
		for (let dr = -suppressRadius; dr <= suppressRadius; dr++) {
			for (let dt = -suppressRadius; dt <= suppressRadius; dt++) {
				const nr = c.row + dr;
				const nt = (c.col + dt + thetaSteps) % thetaSteps;
				if (nr >= 0 && nr < rhoSteps) {
					suppressed[nr * thetaSteps + nt] = 1;
				}
			}
		}
	}
	return peaks;
}

// ---------------------------------------------------------------------------
// Hough Circle Transform (fixed radius)
// ---------------------------------------------------------------------------

function houghCircles(
	edges: Uint8Array,
	w: number,
	h: number,
	radius: number,
): Int32Array {
	const accumulator = new Int32Array(w * h);
	const steps = 360;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (edges[y * w + x] === 0) continue;
			for (let angle = 0; angle < steps; angle++) {
				const rad = (angle * Math.PI) / 180;
				const cx = Math.round(x - radius * Math.cos(rad));
				const cy = Math.round(y - radius * Math.sin(rad));
				if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
					accumulator[cy * w + cx] += 1;
				}
			}
		}
	}
	return accumulator;
}

function findCirclePeaks(
	accumulator: Int32Array,
	w: number,
	h: number,
	radius: number,
	minVotes: number,
	suppressRadius = 20,
): CirclePeak[] {
	const candidates: CirclePeak[] = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const votes = accumulator[y * w + x];
			if (votes >= minVotes) {
				candidates.push({ cx: x, cy: y, r: radius, votes });
			}
		}
	}
	candidates.sort((a, b) => b.votes - a.votes);

	const peaks: CirclePeak[] = [];
	const suppressed = new Uint8Array(w * h);
	for (const c of candidates) {
		if (suppressed[c.cy * w + c.cx]) continue;
		peaks.push(c);
		for (let dy = -suppressRadius; dy <= suppressRadius; dy++) {
			for (let dx = -suppressRadius; dx <= suppressRadius; dx++) {
				const nx = c.cx + dx;
				const ny = c.cy + dy;
				if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
					suppressed[ny * w + nx] = 1;
				}
			}
		}
	}
	return peaks;
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderAccumulatorLines(
	ctx: CanvasRenderingContext2D,
	accumulator: Int32Array,
	rhoSteps: number,
	thetaSteps: number,
	highlightedPeak: Peak | null,
) {
	let maxVal = 0;
	for (let i = 0; i < accumulator.length; i++) {
		if (accumulator[i] > maxVal) maxVal = accumulator[i];
	}

	const imageData = ctx.createImageData(thetaSteps, rhoSteps);
	for (let r = 0; r < rhoSteps; r++) {
		for (let t = 0; t < thetaSteps; t++) {
			const v = accumulator[r * thetaSteps + t];
			const intensity = maxVal > 0 ? Math.round((v / maxVal) * 255) : 0;
			const offset = (r * thetaSteps + t) * 4;
			imageData.data[offset] = intensity;
			imageData.data[offset + 1] = intensity;
			imageData.data[offset + 2] = intensity;
			imageData.data[offset + 3] = 255;
		}
	}
	ctx.putImageData(imageData, 0, 0);

	// Highlight the hovered peak as a red dot
	if (highlightedPeak) {
		ctx.fillStyle = "rgba(239,68,68,0.9)";
		ctx.beginPath();
		ctx.arc(highlightedPeak.col, highlightedPeak.row, 5, 0, Math.PI * 2);
		ctx.fill();
	}
}

function renderAccumulatorCircles(
	ctx: CanvasRenderingContext2D,
	accumulator: Int32Array,
	w: number,
	h: number,
	highlightedPeak: CirclePeak | null,
) {
	let maxVal = 0;
	for (let i = 0; i < accumulator.length; i++) {
		if (accumulator[i] > maxVal) maxVal = accumulator[i];
	}

	const imageData = ctx.createImageData(w, h);
	for (let i = 0; i < w * h; i++) {
		const v = accumulator[i];
		const intensity = maxVal > 0 ? Math.round((v / maxVal) * 255) : 0;
		// Colour: blue-ish heatmap
		imageData.data[i * 4] = 0;
		imageData.data[i * 4 + 1] = Math.round(intensity * 0.4);
		imageData.data[i * 4 + 2] = intensity;
		imageData.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(imageData, 0, 0);

	// Highlight hovered peak
	if (highlightedPeak) {
		ctx.fillStyle = "rgba(239,68,68,0.9)";
		ctx.beginPath();
		ctx.arc(highlightedPeak.cx, highlightedPeak.cy, 6, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawLineFromPeak(
	ctx: CanvasRenderingContext2D,
	peak: Peak,
	w: number,
	h: number,
	color = "rgba(239,68,68,0.9)",
) {
	const rho = (peak.row / (RHO_STEPS - 1)) * 2 * MAX_RHO - MAX_RHO;
	const theta = (peak.col * Math.PI) / THETA_STEPS;
	const cosT = Math.cos(theta);
	const sinT = Math.sin(theta);

	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.beginPath();

	// Parametrize: x cos θ + y sin θ = ρ  →  two points on the line
	const pts: [number, number][] = [];
	if (Math.abs(sinT) > 1e-6) {
		// y = (rho - x*cosT) / sinT
		const y0 = (rho - 0 * cosT) / sinT;
		const y1 = (rho - (w - 1) * cosT) / sinT;
		pts.push([0, y0], [w - 1, y1]);
	} else {
		// x = rho / cosT
		const x0 = rho / cosT;
		pts.push([x0, 0], [x0, h - 1]);
	}
	if (pts.length >= 2) {
		ctx.moveTo(pts[0][0], pts[0][1]);
		ctx.lineTo(pts[1][0], pts[1][1]);
		ctx.stroke();
	}
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type LineHoughProps = object;

function LineHough(_props: LineHoughProps) {
	const imageCanvasRef = useRef<HTMLCanvasElement>(null);
	const edgeCanvasRef = useRef<HTMLCanvasElement>(null);
	const accCanvasRef = useRef<HTMLCanvasElement>(null);

	const [minVotes, setMinVotes] = useState(60);
	const [processed, setProcessed] = useState(false);
	const [peaks, setPeaks] = useState<Peak[]>([]);
	const [hoveredPeak, setHoveredPeak] = useState<Peak | null>(null);
	const [accData, setAccData] = useState<{
		accumulator: Int32Array;
		rhoSteps: number;
		thetaSteps: number;
	} | null>(null);
	const [edgeData, setEdgeData] = useState<{ edges: Uint8Array; w: number; h: number } | null>(null);

	// Load default image (building / grid pattern painted on canvas)
	useEffect(() => {
		const canvas = imageCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		drawDefaultLineScene(ctx, CANVAS_W, CANVAS_H);
	}, []);

	function drawDefaultLineScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
		ctx.fillStyle = "#111";
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = 2;
		// Horizontal lines
		for (const y of [60, 120, 180]) {
			ctx.beginPath();
			ctx.moveTo(20, y);
			ctx.lineTo(w - 20, y);
			ctx.stroke();
		}
		// Diagonal line
		ctx.beginPath();
		ctx.moveTo(20, 20);
		ctx.lineTo(w - 20, h - 20);
		ctx.stroke();
		// Another diagonal
		ctx.beginPath();
		ctx.moveTo(w - 20, 20);
		ctx.lineTo(20, h - 20);
		ctx.stroke();
	}

	function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			const canvas = imageCanvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
			ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
			URL.revokeObjectURL(url);
		};
		img.src = url;
		setProcessed(false);
	}

	function handleProcess() {
		const imgCanvas = imageCanvasRef.current;
		if (!imgCanvas) return;
		const imgCtx = imgCanvas.getContext("2d");
		if (!imgCtx) return;

		const imgData = imgCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
		const gray = toGrayscale(imgData.data, CANVAS_W, CANVAS_H);
		const edges = sobelEdges(gray, CANVAS_W, CANVAS_H, 40);

		// Draw edges
		const edgeCanvas = edgeCanvasRef.current;
		if (edgeCanvas) {
			const edgeCtx = edgeCanvas.getContext("2d");
			if (edgeCtx) {
				const ed = edgeCtx.createImageData(CANVAS_W, CANVAS_H);
				for (let i = 0; i < edges.length; i++) {
					const v = edges[i] ? 255 : 0;
					ed.data[i * 4] = v;
					ed.data[i * 4 + 1] = v;
					ed.data[i * 4 + 2] = v;
					ed.data[i * 4 + 3] = 255;
				}
				edgeCtx.putImageData(ed, 0, 0);
			}
		}

		const result = houghLines(edges, CANVAS_W, CANVAS_H);
		setAccData(result);
		setEdgeData({ edges, w: CANVAS_W, h: CANVAS_H });
		setProcessed(true);

		const newPeaks = findLinePeaks(result.accumulator, result.rhoSteps, result.thetaSteps, minVotes);
		setPeaks(newPeaks);
		renderAcc(result, newPeaks, null);
	}

	function renderAcc(
		data: { accumulator: Int32Array; rhoSteps: number; thetaSteps: number },
		currentPeaks: Peak[],
		highlight: Peak | null,
	) {
		const canvas = accCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		renderAccumulatorLines(ctx, data.accumulator, data.rhoSteps, data.thetaSteps, highlight);

		// Draw all peaks as small yellow dots
		for (const p of currentPeaks) {
			ctx.fillStyle = "rgba(250,204,21,0.8)";
			ctx.beginPath();
			ctx.arc(p.col, p.row, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// Re-compute peaks when minVotes changes
	useEffect(() => {
		if (!accData) return;
		const newPeaks = findLinePeaks(accData.accumulator, accData.rhoSteps, accData.thetaSteps, minVotes);
		setPeaks(newPeaks);
		renderAcc(accData, newPeaks, hoveredPeak);
	}, [minVotes, accData]);

	// Re-draw acc when hovered peak changes
	useEffect(() => {
		if (!accData) return;
		renderAcc(accData, peaks, hoveredPeak);
	}, [hoveredPeak]);

	// Draw detected lines on image overlay
	useEffect(() => {
		if (!edgeData) return;
		const edgeCanvas = edgeCanvasRef.current;
		if (!edgeCanvas) return;
		const edgeCtx = edgeCanvas.getContext("2d");
		if (!edgeCtx) return;

		// Re-draw edge image
		const ed = edgeCtx.createImageData(CANVAS_W, CANVAS_H);
		for (let i = 0; i < edgeData.edges.length; i++) {
			const v = edgeData.edges[i] ? 255 : 0;
			ed.data[i * 4] = v;
			ed.data[i * 4 + 1] = v;
			ed.data[i * 4 + 2] = v;
			ed.data[i * 4 + 3] = 255;
		}
		edgeCtx.putImageData(ed, 0, 0);

		// Draw all detected lines
		for (const p of peaks) {
			if (p === hoveredPeak) continue;
			drawLineFromPeak(edgeCtx, p, CANVAS_W, CANVAS_H, "rgba(250,204,21,0.7)");
		}
		if (hoveredPeak) {
			drawLineFromPeak(edgeCtx, hoveredPeak, CANVAS_W, CANVAS_H, "rgba(239,68,68,0.95)");
		}
	}, [peaks, hoveredPeak, edgeData]);

	// Accumulator hover: map mouse to (rho, theta), find nearest peak
	function handleAccHover(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!accData || !processed) return;
		const canvas = accCanvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = ((e.clientX - rect.left) / rect.width) * THETA_STEPS;
		const my = ((e.clientY - rect.top) / rect.height) * RHO_STEPS;

		// Find closest peak within 15px
		let closest: Peak | null = null;
		let minDist = 15;
		for (const p of peaks) {
			const dx = p.col - mx;
			const dy = p.row - my;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < minDist) {
				minDist = dist;
				closest = p;
			}
		}
		setHoveredPeak(closest);
	}

	function handleReset() {
		const canvas = imageCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		drawDefaultLineScene(ctx, CANVAS_W, CANVAS_H);
		setProcessed(false);
		setPeaks([]);
		setAccData(null);
		setEdgeData(null);
		setHoveredPeak(null);
		// Clear other canvases
		const edgeCanvas = edgeCanvasRef.current;
		if (edgeCanvas) {
			const eCtx = edgeCanvas.getContext("2d");
			if (eCtx) eCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
		}
		const accCanvas = accCanvasRef.current;
		if (accCanvas) {
			const aCtx = accCanvas.getContext("2d");
			if (aCtx) aCtx.clearRect(0, 0, THETA_STEPS, RHO_STEPS);
		}
	}

	return (
		<div className="flex flex-col gap-4 my-6">
			<div className="flex flex-row flex-wrap gap-2 items-center">
				<label className="cursor-pointer">
					<Button variant="outline" size="sm" asChild>
						<span>
							<Upload className="w-4 h-4 mr-2" />
							Wczytaj obraz
						</span>
					</Button>
					<input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
				</label>
				<Button size="sm" onClick={handleProcess}>
					<Play className="w-4 h-4 mr-2" />
					Wykryj proste
				</Button>
				<Button variant="outline" size="sm" onClick={handleReset}>
					<RotateCcw className="w-4 h-4 mr-2" />
					Reset
				</Button>
			</div>

			<div className="flex items-center gap-4 max-w-xs">
				<Label htmlFor="votes-line" className="whitespace-nowrap text-sm">
					Min. głosów: <span className="font-semibold">{minVotes}</span>
				</Label>
				<Slider
					id="votes-line"
					value={[minVotes]}
					onValueChange={(v) => setMinVotes(v[0])}
					min={5}
					max={200}
					step={1}
					className="flex-1"
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Obraz wejściowy</span>
					<canvas
						ref={imageCanvasRef}
						width={CANVAS_W}
						height={CANVAS_H}
						className="rounded-md border border-border w-full h-auto"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
						Krawędzie + wykryte proste
					</span>
					<canvas
						ref={edgeCanvasRef}
						width={CANVAS_W}
						height={CANVAS_H}
						className="rounded-md border border-border w-full h-auto"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
						Akumulator (θ × ρ) — najedź na peak
					</span>
					<canvas
						ref={accCanvasRef}
						width={THETA_STEPS}
						height={RHO_STEPS}
						className="rounded-md border border-border w-full h-auto cursor-crosshair"
						onMouseMove={handleAccHover}
						onMouseLeave={() => setHoveredPeak(null)}
					/>
					{hoveredPeak && (
						<span className="text-xs text-muted-foreground">
							θ={((hoveredPeak.col * 180) / THETA_STEPS).toFixed(1)}° &nbsp; ρ=
							{(((hoveredPeak.row / (RHO_STEPS - 1)) * 2 - 1) * MAX_RHO).toFixed(1)}px &nbsp; głosów={hoveredPeak.votes}
						</span>
					)}
				</div>
			</div>

			<p className="text-sm text-muted-foreground">
				Wykryto <span className="font-semibold text-foreground">{peaks.length}</span> prostych. Najedź kursorem na jasny
				punkt (peak) w akumulatorze, aby podświetlić odpowiadającą mu prostą.
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Circle Hough sub-component
// ---------------------------------------------------------------------------

function CircleHough() {
	const imageCanvasRef = useRef<HTMLCanvasElement>(null);
	const edgeCanvasRef = useRef<HTMLCanvasElement>(null);
	const accCanvasRef = useRef<HTMLCanvasElement>(null);

	const [minVotes, setMinVotes] = useState(40);
	const [radius, setRadius] = useState(40);
	const [processed, setProcessed] = useState(false);
	const [peaks, setPeaks] = useState<CirclePeak[]>([]);
	const [hoveredPeak, setHoveredPeak] = useState<CirclePeak | null>(null);
	const [accData, setAccData] = useState<{ accumulator: Int32Array; w: number; h: number } | null>(null);
	const [edgeData, setEdgeData] = useState<{ edges: Uint8Array; w: number; h: number } | null>(null);

	useEffect(() => {
		const canvas = imageCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		drawDefaultCircleScene(ctx, CANVAS_W, CANVAS_H);
	}, []);

	function drawDefaultCircleScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
		ctx.fillStyle = "#111";
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = 2;
		const circles: [number, number, number][] = [
			[80, 80, 45],
			[230, 100, 55],
			[150, 180, 38],
		];
		for (const [cx, cy, r] of circles) {
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.stroke();
		}
	}

	function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			const canvas = imageCanvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
			ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
			URL.revokeObjectURL(url);
		};
		img.src = url;
		setProcessed(false);
	}

	function handleProcess() {
		const imgCanvas = imageCanvasRef.current;
		if (!imgCanvas) return;
		const imgCtx = imgCanvas.getContext("2d");
		if (!imgCtx) return;

		const imgData = imgCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
		const gray = toGrayscale(imgData.data, CANVAS_W, CANVAS_H);
		const edges = sobelEdges(gray, CANVAS_W, CANVAS_H, 30);
		setEdgeData({ edges, w: CANVAS_W, h: CANVAS_H });

		drawEdges(edges);

		const acc = houghCircles(edges, CANVAS_W, CANVAS_H, radius);
		const data = { accumulator: acc, w: CANVAS_W, h: CANVAS_H };
		setAccData(data);
		setProcessed(true);

		const newPeaks = findCirclePeaks(acc, CANVAS_W, CANVAS_H, radius, minVotes);
		setPeaks(newPeaks);
		renderCircleAcc(data, newPeaks, null);
		drawCirclesOnEdge(edges, newPeaks, null);
	}

	function drawEdges(edges: Uint8Array) {
		const edgeCanvas = edgeCanvasRef.current;
		if (!edgeCanvas) return;
		const edgeCtx = edgeCanvas.getContext("2d");
		if (!edgeCtx) return;
		const ed = edgeCtx.createImageData(CANVAS_W, CANVAS_H);
		for (let i = 0; i < edges.length; i++) {
			const v = edges[i] ? 255 : 0;
			ed.data[i * 4] = v;
			ed.data[i * 4 + 1] = v;
			ed.data[i * 4 + 2] = v;
			ed.data[i * 4 + 3] = 255;
		}
		edgeCtx.putImageData(ed, 0, 0);
	}

	function renderCircleAcc(
		data: { accumulator: Int32Array; w: number; h: number },
		currentPeaks: CirclePeak[],
		highlight: CirclePeak | null,
	) {
		const canvas = accCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		renderAccumulatorCircles(ctx, data.accumulator, data.w, data.h, highlight);
		for (const p of currentPeaks) {
			ctx.fillStyle = "rgba(250,204,21,0.8)";
			ctx.beginPath();
			ctx.arc(p.cx, p.cy, 4, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function drawCirclesOnEdge(edges: Uint8Array, currentPeaks: CirclePeak[], highlight: CirclePeak | null) {
		const edgeCanvas = edgeCanvasRef.current;
		if (!edgeCanvas) return;
		const edgeCtx = edgeCanvas.getContext("2d");
		if (!edgeCtx) return;

		drawEdges(edges);

		for (const p of currentPeaks) {
			if (p === highlight) continue;
			edgeCtx.strokeStyle = "rgba(250,204,21,0.8)";
			edgeCtx.lineWidth = 2;
			edgeCtx.beginPath();
			edgeCtx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
			edgeCtx.stroke();
		}
		if (highlight) {
			edgeCtx.strokeStyle = "rgba(239,68,68,0.95)";
			edgeCtx.lineWidth = 2.5;
			edgeCtx.beginPath();
			edgeCtx.arc(highlight.cx, highlight.cy, highlight.r, 0, Math.PI * 2);
			edgeCtx.stroke();
			// Draw center
			edgeCtx.fillStyle = "rgba(239,68,68,0.9)";
			edgeCtx.beginPath();
			edgeCtx.arc(highlight.cx, highlight.cy, 4, 0, Math.PI * 2);
			edgeCtx.fill();
		}
	}

	useEffect(() => {
		if (!accData || !edgeData) return;
		const newPeaks = findCirclePeaks(accData.accumulator, accData.w, accData.h, radius, minVotes);
		setPeaks(newPeaks);
		renderCircleAcc(accData, newPeaks, hoveredPeak);
		drawCirclesOnEdge(edgeData.edges, newPeaks, hoveredPeak);
	}, [minVotes, accData]);

	useEffect(() => {
		if (!accData || !edgeData) return;
		renderCircleAcc(accData, peaks, hoveredPeak);
		drawCirclesOnEdge(edgeData.edges, peaks, hoveredPeak);
	}, [hoveredPeak]);

	function handleAccHover(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!accData || !processed) return;
		const canvas = accCanvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
		const my = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

		let closest: CirclePeak | null = null;
		let minDist = 20;
		for (const p of peaks) {
			const dx = p.cx - mx;
			const dy = p.cy - my;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < minDist) {
				minDist = dist;
				closest = p;
			}
		}
		setHoveredPeak(closest);
	}

	function handleReset() {
		const canvas = imageCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		drawDefaultCircleScene(ctx, CANVAS_W, CANVAS_H);
		setProcessed(false);
		setPeaks([]);
		setAccData(null);
		setEdgeData(null);
		setHoveredPeak(null);
		[edgeCanvasRef, accCanvasRef].forEach((ref) => {
			const c = ref.current;
			if (c) c.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
		});
	}

	// Re-run when radius changes only if already processed
	useEffect(() => {
		if (!processed) return;
		handleProcess();
	}, [radius]);

	return (
		<div className="flex flex-col gap-4 my-6">
			<div className="flex flex-row flex-wrap gap-2 items-center">
				<label className="cursor-pointer">
					<Button variant="outline" size="sm" asChild>
						<span>
							<Upload className="w-4 h-4 mr-2" />
							Wczytaj obraz
						</span>
					</Button>
					<input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
				</label>
				<Button size="sm" onClick={handleProcess}>
					<Play className="w-4 h-4 mr-2" />
					Wykryj okręgi
				</Button>
				<Button variant="outline" size="sm" onClick={handleReset}>
					<RotateCcw className="w-4 h-4 mr-2" />
					Reset
				</Button>
			</div>

			<div className="flex flex-col sm:flex-row gap-6 max-w-sm">
				<div className="flex items-center gap-4 flex-1">
					<Label htmlFor="votes-circle" className="whitespace-nowrap text-sm">
						Min. głosów: <span className="font-semibold">{minVotes}</span>
					</Label>
					<Slider
						id="votes-circle"
						value={[minVotes]}
						onValueChange={(v) => setMinVotes(v[0])}
						min={5}
						max={200}
						step={1}
						className="flex-1"
					/>
				</div>
				<div className="flex items-center gap-4 flex-1">
					<Label htmlFor="radius-circle" className="whitespace-nowrap text-sm">
						Promień: <span className="font-semibold">{radius}px</span>
					</Label>
					<Slider
						id="radius-circle"
						value={[radius]}
						onValueChange={(v) => setRadius(v[0])}
						min={5}
						max={120}
						step={1}
						className="flex-1"
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Obraz wejściowy</span>
					<canvas
						ref={imageCanvasRef}
						width={CANVAS_W}
						height={CANVAS_H}
						className="rounded-md border border-border w-full h-auto"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
						Krawędzie + wykryte okręgi
					</span>
					<canvas
						ref={edgeCanvasRef}
						width={CANVAS_W}
						height={CANVAS_H}
						className="rounded-md border border-border w-full h-auto"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
						Akumulator (przestrzeń cx×cy) — najedź na peak
					</span>
					<canvas
						ref={accCanvasRef}
						width={CANVAS_W}
						height={CANVAS_H}
						className="rounded-md border border-border w-full h-auto cursor-crosshair"
						onMouseMove={handleAccHover}
						onMouseLeave={() => setHoveredPeak(null)}
					/>
					{hoveredPeak && (
						<span className="text-xs text-muted-foreground">
							środek=({hoveredPeak.cx}, {hoveredPeak.cy}) &nbsp; r={hoveredPeak.r}px &nbsp; głosów={hoveredPeak.votes}
						</span>
					)}
				</div>
			</div>

			<p className="text-sm text-muted-foreground">
				Wykryto <span className="font-semibold text-foreground">{peaks.length}</span> okręgów. Najedź na jasny punkt w
				akumulatorze, aby podświetlić odpowiadający okrąg. Zmień suwak promienia, aby szukać okręgów różnych rozmiarów.
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

type HoughTransformProps = {
	type: "lines" | "circles";
};

export function HoughTransform({ type }: HoughTransformProps) {
	if (type === "lines") return <LineHough />;
	if (type === "circles") return <CircleHough />;
	return null;
}
