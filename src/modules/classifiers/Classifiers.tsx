"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, Plus } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type Point = { x: number; y: number; label: number };

/** Palette: four class colours */
const CLASS_COLORS = [
	"#3b82f6", // blue   – class 0
	"#ef4444", // red    – class 1
	"#22c55e", // green  – class 2
	"#f59e0b", // amber  – class 3
];

const CLASS_FILL = ["rgba(59,130,246,0.15)", "rgba(239,68,68,0.15)", "rgba(34,197,94,0.15)", "rgba(245,158,11,0.15)"];

const W = 420;
const H = 360;

function clamp(v: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, v));
}

/** Convert canvas pixel coords to logical [-1,1] space */
function toLogical(px: number, py: number): [number, number] {
	return [(px / W) * 2 - 1, (py / H) * 2 - 1];
}
function toCanvas(lx: number, ly: number): [number, number] {
	return [((lx + 1) / 2) * W, ((ly + 1) / 2) * H];
}

/** 2-D multivariate normal sample (Box-Muller) */
function randn2(mx: number, my: number, sx: number, sy: number, n: number, label: number): Point[] {
	const pts: Point[] = [];
	for (let i = 0; i < n; i++) {
		const u1 = Math.random() || 1e-10;
		const u2 = Math.random() || 1e-10;
		const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
		pts.push({ x: clamp(mx + z1 * sx, -0.98, 0.98), y: clamp(my + z2 * sy, -0.98, 0.98), label });
	}
	return pts;
}

function mean(pts: Point[]): [number, number] {
	if (!pts.length) return [0, 0];
	let sx = 0,
		sy = 0;
	for (const p of pts) {
		sx += p.x;
		sy += p.y;
	}
	return [sx / pts.length, sy / pts.length];
}

function drawGrid(ctx: CanvasRenderingContext2D) {
	ctx.strokeStyle = "rgba(128,128,128,0.12)";
	ctx.lineWidth = 1;
	for (let i = 1; i < 8; i++) {
		const x = (i / 8) * W;
		const y = (i / 8) * H;
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, H);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(W, y);
		ctx.stroke();
	}
	// axes
	ctx.strokeStyle = "rgba(128,128,128,0.3)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(W / 2, 0);
	ctx.lineTo(W / 2, H);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, H / 2);
	ctx.lineTo(W, H / 2);
	ctx.stroke();
}

function drawPoints(ctx: CanvasRenderingContext2D, pts: Point[], testPoint?: Point | null) {
	for (const p of pts) {
		const [cx, cy] = toCanvas(p.x, p.y);
		ctx.beginPath();
		ctx.arc(cx, cy, 5, 0, Math.PI * 2);
		ctx.fillStyle = CLASS_COLORS[p.label] ?? "#888";
		ctx.fill();
		ctx.strokeStyle = "rgba(255,255,255,0.6)";
		ctx.lineWidth = 1;
		ctx.stroke();
	}
	if (testPoint) {
		const [cx, cy] = toCanvas(testPoint.x, testPoint.y);
		ctx.beginPath();
		ctx.arc(cx, cy, 8, 0, Math.PI * 2);
		ctx.fillStyle = "#fff";
		ctx.fill();
		ctx.strokeStyle = CLASS_COLORS[testPoint.label] ?? "#888";
		ctx.lineWidth = 3;
		ctx.stroke();
		// cross inside
		ctx.strokeStyle = CLASS_COLORS[testPoint.label] ?? "#888";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(cx - 4, cy);
		ctx.lineTo(cx + 4, cy);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(cx, cy - 4);
		ctx.lineTo(cx, cy + 4);
		ctx.stroke();
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Klasyfikator statystyczny (Bayes naiwny: elipsy + próbka testowa)
// ─────────────────────────────────────────────────────────────────────────────

type ClassStats = {
	mx: number;
	my: number;
	sx: number;
	sy: number;
	label: number;
};

function computeStats(pts: Point[], label: number): ClassStats | null {
	const cls = pts.filter((p) => p.label === label);
	if (cls.length < 2) return null;
	const [mx, my] = mean(cls);
	const sx = Math.sqrt(cls.reduce((a, p) => a + (p.x - mx) ** 2, 0) / cls.length) || 0.05;
	const sy = Math.sqrt(cls.reduce((a, p) => a + (p.y - my) ** 2, 0) / cls.length) || 0.05;
	return { mx, my, sx, sy, label };
}

function gaussianPdf(x: number, y: number, s: ClassStats): number {
	const dx = (x - s.mx) / s.sx;
	const dy = (y - s.my) / s.sy;
	return Math.exp(-0.5 * (dx * dx + dy * dy)) / (2 * Math.PI * s.sx * s.sy);
}

function classifyBayes(lx: number, ly: number, stats: ClassStats[]): number {
	let best = -1,
		bestP = -Infinity;
	for (const s of stats) {
		const p = gaussianPdf(lx, ly, s);
		if (p > bestP) {
			bestP = p;
			best = s.label;
		}
	}
	return best;
}

function drawEllipse(ctx: CanvasRenderingContext2D, s: ClassStats, sigma = 2) {
	const [cx, cy] = toCanvas(s.mx, s.my);
	const rx = ((s.sx * sigma) / 2) * W;
	const ry = ((s.sy * sigma) / 2) * H;
	ctx.beginPath();
	ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
	ctx.strokeStyle = CLASS_COLORS[s.label];
	ctx.lineWidth = 2;
	ctx.setLineDash([5, 4]);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = CLASS_FILL[s.label];
	ctx.fill();
}

export function StatisticalClassifier() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [numClasses, setNumClasses] = useState(2);
	const [testPt, setTestPt] = useState<Point>({ x: 0, y: 0, label: 0 });
	const [pts, setPts] = useState<Point[]>([]);
	const isDragging = useRef(false);

	const initialPoints = useCallback((n: number): Point[] => {
		const centers: [number, number][] = [
			[-0.4, -0.3],
			[0.4, 0.3],
			[-0.35, 0.4],
			[0.4, -0.35],
		];
		const result: Point[] = [];
		for (let c = 0; c < n; c++) {
			result.push(...randn2(centers[c][0], centers[c][1], 0.18, 0.15, 24, c));
		}
		return result;
	}, []);

	useEffect(() => {
		const newPts = initialPoints(numClasses);
		setPts(newPts);
		setTestPt({ x: 0.05, y: 0.05, label: 0 });
	}, [numClasses, initialPoints]);

	useEffect(() => {
		render();
	}, [pts, testPt, numClasses]);

	function render() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, W, H);
		drawGrid(ctx);

		const stats: ClassStats[] = [];
		for (let c = 0; c < numClasses; c++) {
			const s = computeStats(pts, c);
			if (s) {
				drawEllipse(ctx, s, 2);
				stats.push(s);
			}
		}

		// Classify test point
		const assignedLabel = stats.length ? classifyBayes(testPt.x, testPt.y, stats) : 0;
		const classified = { ...testPt, label: assignedLabel >= 0 ? assignedLabel : 0 };

		drawPoints(ctx, pts);
		drawPoints(ctx, [], classified);
	}

	function pointerToLogical(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
		const rect = e.currentTarget.getBoundingClientRect();
		return toLogical(((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H);
	}

	function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
		e.currentTarget.setPointerCapture(e.pointerId);
		isDragging.current = true;
		const [lx, ly] = pointerToLogical(e);
		setTestPt((prev) => ({ ...prev, x: lx, y: ly }));
	}
	function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
		if (!isDragging.current) return;
		const [lx, ly] = pointerToLogical(e);
		setTestPt((prev) => ({ ...prev, x: lx, y: ly }));
	}
	function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
		if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
		isDragging.current = false;
	}

	function reset() {
		const newPts = initialPoints(numClasses);
		setPts(newPts);
		setTestPt({ x: 0.05, y: 0.05, label: 0 });
	}

	// Determine current class of test point for display
	const stats: ClassStats[] = [];
	for (let c = 0; c < numClasses; c++) {
		const s = computeStats(pts, c);
		if (s) stats.push(s);
	}
	const currentLabel = stats.length ? classifyBayes(testPt.x, testPt.y, stats) : 0;
	const labelName = ["A", "B", "C", "D"][currentLabel] ?? "?";

	return (
		<div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 my-6 items-start">
			<div className="flex flex-col gap-3">
				<canvas
					ref={canvasRef}
					width={W}
					height={H}
					className="rounded-md border border-border w-full h-auto cursor-crosshair select-none"
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerLeave={onPointerUp}
				/>
				<p className="text-sm text-muted-foreground">
					Przeciągnij <strong className="text-foreground">białe kółko</strong> po przestrzeni — automatycznie zmienia
					klasę (aktualnie:{" "}
					<span className="font-semibold" style={{ color: CLASS_COLORS[currentLabel] }}>
						Klasa {labelName}
					</span>
					).
				</p>
			</div>

			<div className="flex flex-col gap-4 min-w-48">
				<div>
					<Label className="text-sm mb-2 block">Liczba klas</Label>
					<ToggleGroup
						type="single"
						variant="outline"
						value={String(numClasses)}
						onValueChange={(v) => {
							if (v) setNumClasses(Number(v));
						}}
					>
						{[2, 3, 4].map((n) => (
							<ToggleGroupItem key={n} value={String(n)}>
								{n}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				<Button variant="outline" size="sm" onClick={reset}>
					<RotateCcw className="w-4 h-4 mr-2" /> Reset
				</Button>

				<div className="flex flex-col gap-1 text-sm">
					<span className="text-muted-foreground font-medium">Legenda</span>
					{Array.from({ length: numClasses }, (_, i) => (
						<div key={i} className="flex items-center gap-2">
							<span
								className="inline-block w-3 h-3 rounded-full border"
								style={{ background: CLASS_COLORS[i], borderColor: CLASS_COLORS[i] }}
							/>
							<span>Klasa {["A", "B", "C", "D"][i]}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Klasyfikator minimalnoodległościowy (nearest centroid)
// ─────────────────────────────────────────────────────────────────────────────

export function NearestCentroidClassifier() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [numClasses, setNumClasses] = useState(2);
	const [pts, setPts] = useState<Point[]>([]);
	const [testPt, setTestPt] = useState<Point>({ x: 0, y: 0, label: 0 });
	const [showRegions, setShowRegions] = useState(true);
	const isDragging = useRef(false);
	const regionCache = useRef<ImageData | null>(null);
	const regionKey = useRef("");

	const initPoints = useCallback((n: number): Point[] => {
		const centers: [number, number][] = [
			[-0.4, -0.3],
			[0.45, 0.3],
			[-0.3, 0.42],
			[0.42, -0.38],
		];
		const result: Point[] = [];
		for (let c = 0; c < n; c++) {
			result.push(...randn2(centers[c][0], centers[c][1], 0.18, 0.15, 20, c));
		}
		return result;
	}, []);

	useEffect(() => {
		setPts(initPoints(numClasses));
		setTestPt({ x: 0.05, y: 0.05, label: 0 });
		regionCache.current = null;
	}, [numClasses, initPoints]);

	const getCentroids = useCallback(
		(points: Point[], n: number) =>
			Array.from({ length: n }, (_, c) => {
				const cls = points.filter((p) => p.label === c);
				const [mx, my] = mean(cls);
				return { x: mx, y: my, label: c };
			}),
		[],
	);

	const classify = useCallback(
		(lx: number, ly: number, centroids: { x: number; y: number; label: number }[]): number => {
			let best = 0,
				bestD = Infinity;
			for (const c of centroids) {
				const d = (lx - c.x) ** 2 + (ly - c.y) ** 2;
				if (d < bestD) {
					bestD = d;
					best = c.label;
				}
			}
			return best;
		},
		[],
	);

	useEffect(() => {
		render();
	}, [pts, testPt, numClasses, showRegions]);

	function render() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const centroids = getCentroids(pts, numClasses);
		const key = JSON.stringify(centroids) + showRegions + numClasses;

		ctx.clearRect(0, 0, W, H);

		// Background regions
		if (showRegions) {
			if (regionCache.current && regionKey.current === key) {
				ctx.putImageData(regionCache.current, 0, 0);
			} else {
				const id = ctx.createImageData(W, H);
				for (let py = 0; py < H; py++) {
					for (let px = 0; px < W; px++) {
						const [lx, ly] = toLogical(px, py);
						const lbl = classify(lx, ly, centroids);
						const col = CLASS_FILL[lbl] ?? "rgba(128,128,128,0.1)";
						// Parse rgba string manually → just use class index
						const rgb: [number, number, number][] = [
							[59, 130, 246],
							[239, 68, 68],
							[34, 197, 94],
							[245, 158, 11],
						];
						const [r, g, b] = rgb[lbl] ?? [128, 128, 128];
						const off = (py * W + px) * 4;
						id.data[off] = r;
						id.data[off + 1] = g;
						id.data[off + 2] = b;
						id.data[off + 3] = 40;
					}
				}
				ctx.putImageData(id, 0, 0);
				regionCache.current = id;
				regionKey.current = key;
			}
		}

		drawGrid(ctx);

		// Voronoi-like boundary lines via thin overlay (already done via regions)

		// Draw centroids as big diamonds
		for (const c of centroids) {
			const [cx, cy] = toCanvas(c.x, c.y);
			ctx.save();
			ctx.translate(cx, cy);
			ctx.rotate(Math.PI / 4);
			ctx.beginPath();
			ctx.rect(-8, -8, 16, 16);
			ctx.fillStyle = CLASS_COLORS[c.label];
			ctx.fill();
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.restore();
		}

		drawPoints(ctx, pts);

		// Test point
		const assignedLabel = classify(testPt.x, testPt.y, centroids);
		const classified = { ...testPt, label: assignedLabel };
		drawPoints(ctx, [], classified);

		// Line from test point to nearest centroid
		const nearest = centroids[assignedLabel];
		if (nearest) {
			const [tx, ty] = toCanvas(testPt.x, testPt.y);
			const [nx, ny] = toCanvas(nearest.x, nearest.y);
			ctx.strokeStyle = CLASS_COLORS[assignedLabel];
			ctx.lineWidth = 1.5;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(nx, ny);
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}

	function pointerToLogical(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
		const rect = e.currentTarget.getBoundingClientRect();
		return toLogical(((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H);
	}

	function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
		e.currentTarget.setPointerCapture(e.pointerId);
		isDragging.current = true;
		const [lx, ly] = pointerToLogical(e);
		setTestPt((prev) => ({ ...prev, x: lx, y: ly }));
	}
	function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
		if (!isDragging.current) return;
		const [lx, ly] = pointerToLogical(e);
		setTestPt((prev) => ({ ...prev, x: lx, y: ly }));
	}
	function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
		if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
		isDragging.current = false;
	}

	const centroids = getCentroids(pts, numClasses);
	const currentLabel = classify(testPt.x, testPt.y, centroids);

	return (
		<div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 my-6 items-start">
			<div className="flex flex-col gap-3">
				<canvas
					ref={canvasRef}
					width={W}
					height={H}
					className="rounded-md border border-border w-full h-auto cursor-crosshair select-none"
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerLeave={onPointerUp}
				/>
				<p className="text-sm text-muted-foreground">
					Przeciągnij białe kółko — kolor zmienia się według najbliższego centroidu (◆). Aktualnie:{" "}
					<span className="font-semibold" style={{ color: CLASS_COLORS[currentLabel] }}>
						Klasa {["A", "B", "C", "D"][currentLabel]}
					</span>
					, odległość do centroidu:{" "}
					{Math.sqrt(
						(testPt.x - (centroids[currentLabel]?.x ?? 0)) ** 2 + (testPt.y - (centroids[currentLabel]?.y ?? 0)) ** 2,
					).toFixed(3)}
				</p>
			</div>

			<div className="flex flex-col gap-4 min-w-48">
				<div>
					<Label className="text-sm mb-2 block">Liczba klas</Label>
					<ToggleGroup
						type="single"
						variant="outline"
						value={String(numClasses)}
						onValueChange={(v) => {
							if (v) setNumClasses(Number(v));
						}}
					>
						{[2, 3, 4].map((n) => (
							<ToggleGroupItem key={n} value={String(n)}>
								{n}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				<div>
					<Label className="text-sm mb-2 block">Obszary decyzyjne</Label>
					<ToggleGroup
						type="single"
						variant="outline"
						value={showRegions ? "on" : "off"}
						onValueChange={(v) => {
							if (v) setShowRegions(v === "on");
						}}
					>
						<ToggleGroupItem value="on">Włącz</ToggleGroupItem>
						<ToggleGroupItem value="off">Wyłącz</ToggleGroupItem>
					</ToggleGroup>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						setPts(initPoints(numClasses));
						setTestPt({ x: 0.05, y: 0.05, label: 0 });
						regionCache.current = null;
					}}
				>
					<RotateCcw className="w-4 h-4 mr-2" /> Reset
				</Button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Klasyfikator liniowy (granica decyzyjna jako prosta)
// ─────────────────────────────────────────────────────────────────────────────

/** Line defined by ax + by + c = 0 in logical [-1,1] space */
type LineParams = { a: number; b: number; c: number };

function signedDist(p: Point, l: LineParams): number {
	return l.a * p.x + l.b * p.y + l.c;
}

export function LinearClassifier() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Line as angle + offset
	const [angle, setAngle] = useState(30); // degrees
	const [offset, setOffset] = useState(0); // perpendicular offset in logical units
	const [pts, setPts] = useState<Point[]>([]);

	const initPoints = useCallback(
		(): Point[] => [...randn2(-0.45, -0.3, 0.22, 0.2, 30, 0), ...randn2(0.45, 0.3, 0.22, 0.2, 30, 1)],
		[],
	);

	useEffect(() => {
		setPts(initPoints());
	}, [initPoints]);
	useEffect(() => {
		render();
	}, [pts, angle, offset]);

	function getLine(): LineParams {
		const rad = (angle * Math.PI) / 180;
		// Normal vector: (cos(rad), sin(rad)), offset along normal
		return { a: Math.cos(rad), b: Math.sin(rad), c: -offset };
	}

	function render() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, W, H);

		const line = getLine();

		// Background regions
		const id = ctx.createImageData(W, H);
		const rgbs: [number, number, number][] = [
			[59, 130, 246],
			[239, 68, 68],
		];
		for (let py = 0; py < H; py++) {
			for (let px = 0; px < W; px++) {
				const [lx, ly] = toLogical(px, py);
				const lbl = signedDist({ x: lx, y: ly, label: 0 }, line) >= 0 ? 0 : 1;
				const [r, g, b] = rgbs[lbl];
				const off = (py * W + px) * 4;
				id.data[off] = r;
				id.data[off + 1] = g;
				id.data[off + 2] = b;
				id.data[off + 3] = 35;
			}
		}
		ctx.putImageData(id, 0, 0);

		drawGrid(ctx);

		// Draw decision boundary
		const rad = (angle * Math.PI) / 180;
		// direction along line: perpendicular to normal
		const dx = -Math.sin(rad);
		const dy = Math.cos(rad);
		// a point on the line: offset * normal
		const px0 = offset * Math.cos(rad);
		const py0 = offset * Math.sin(rad);
		const t = 2;
		const [x1, y1] = toCanvas(px0 + dx * t, py0 + dy * t);
		const [x2, y2] = toCanvas(px0 - dx * t, py0 - dy * t);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.strokeStyle = "#f8fafc";
		ctx.lineWidth = 2.5;
		ctx.stroke();

		// Count errors
		let errors = 0;
		for (const p of pts) {
			const d = signedDist(p, line);
			const predicted = d >= 0 ? 0 : 1;
			if (predicted !== p.label) errors++;
		}

		drawPoints(ctx, pts);

		// Annotation
		ctx.fillStyle = "rgba(255,255,255,0.85)";
		ctx.font = "12px ui-monospace,monospace";
		ctx.fillText(`Błędy: ${errors}/${pts.length}`, 8, 18);
	}

	function reset() {
		setPts(initPoints());
		setAngle(30);
		setOffset(0);
	}

	const line = getLine();
	const errors = pts.filter((p) => {
		const predicted = signedDist(p, line) >= 0 ? 0 : 1;
		return predicted !== p.label;
	}).length;

	return (
		<div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 my-6 items-start">
			<div className="flex flex-col gap-3">
				<canvas
					ref={canvasRef}
					width={W}
					height={H}
					className="rounded-md border border-border w-full h-auto select-none"
				/>
				<p className="text-sm text-muted-foreground">
					Ustaw granicę decyzyjną suwakami. <span className="font-semibold text-foreground">{errors}</span> z{" "}
					<span className="font-semibold text-foreground">{pts.length}</span> punktów jest źle sklasyfikowanych.
				</p>
			</div>

			<div className="flex flex-col gap-5 min-w-52">
				<div className="grid gap-2">
					<div className="flex justify-between text-sm">
						<Label htmlFor="angle-slider">Kąt</Label>
						<span className="text-muted-foreground">{angle}°</span>
					</div>
					<Slider
						id="angle-slider"
						value={[angle]}
						onValueChange={(v) => setAngle(v[0])}
						min={-180}
						max={180}
						step={1}
					/>
				</div>

				<div className="grid gap-2">
					<div className="flex justify-between text-sm">
						<Label htmlFor="offset-slider">Przesunięcie</Label>
						<span className="text-muted-foreground">{offset.toFixed(2)}</span>
					</div>
					<Slider
						id="offset-slider"
						value={[offset]}
						onValueChange={(v) => setOffset(v[0])}
						min={-0.9}
						max={0.9}
						step={0.01}
					/>
				</div>

				<Button variant="outline" size="sm" onClick={reset}>
					<RotateCcw className="w-4 h-4 mr-2" /> Reset
				</Button>

				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						setPts((prev) => [
							...prev,
							...randn2(-0.45 + Math.random() * 0.2, -0.3 + Math.random() * 0.2, 0.22, 0.2, 10, 0),
							...randn2(0.45 - Math.random() * 0.2, 0.3 - Math.random() * 0.2, 0.22, 0.2, 10, 1),
						]);
					}}
				>
					<Plus className="w-4 h-4 mr-2" /> Dodaj punkty
				</Button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Klasyfikator odcinkowo-liniowy (piecewise linear)
// ─────────────────────────────────────────────────────────────────────────────

type Seg = { x1: number; y1: number; x2: number; y2: number };

/** Check which side of a closed piecewise polygon a point is on.
 *  Uses winding number / ray casting to determine interior/exterior. */
function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
	let inside = false;
	const n = poly.length;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function nearestSegmentDist(x: number, y: number, segs: Seg[]): number {
	let minD = Infinity;
	for (const s of segs) {
		const dx = s.x2 - s.x1,
			dy = s.y2 - s.y1;
		const len2 = dx * dx + dy * dy;
		const t = len2 > 0 ? clamp(((x - s.x1) * dx + (y - s.y1) * dy) / len2, 0, 1) : 0;
		const px = s.x1 + t * dx - x,
			py = s.y1 + t * dy - y;
		minD = Math.min(minD, px * px + py * py);
	}
	return Math.sqrt(minD);
}

const INITIAL_SEGS: Seg[] = [
	{ x1: -0.05, y1: -0.9, x2: -0.05, y2: -0.3 },
	{ x1: -0.05, y1: -0.3, x2: 0.4, y2: 0.1 },
	{ x1: 0.4, y1: 0.1, x2: 0.1, y2: 0.9 },
];

export function PiecewiseLinearClassifier() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [segs, setSegs] = useState<Seg[]>(INITIAL_SEGS);
	const [pts, setPts] = useState<Point[]>([]);
	const [dragging, setDragging] = useState<null | {
		segIdx: number;
		endpoint: "start" | "end";
	}>(null);
	const [hoveredHandle, setHoveredHandle] = useState<{ segIdx: number; endpoint: "start" | "end" } | null>(null);

	const initPoints = useCallback(
		(): Point[] => [...randn2(-0.45, 0.1, 0.28, 0.35, 35, 0), ...randn2(0.48, -0.05, 0.28, 0.35, 35, 1)],
		[],
	);

	useEffect(() => {
		setPts(initPoints());
	}, [initPoints]);
	useEffect(() => {
		render();
	}, [pts, segs, hoveredHandle]);

	/** Build polygon by extending boundary to canvas edges */
	function buildRegionPolygon(segments: Seg[]): [number, number][] {
		if (!segments.length) return [];
		const poly: [number, number][] = [];
		// Start cap: go along left edge from top
		poly.push([-1, -1]);
		poly.push([segments[0].x1, segments[0].y1]);
		for (const s of segments) {
			poly.push([s.x2, s.y2]);
		}
		// End cap: right edge and bottom
		poly.push([1, -1]);
		poly.push([1, 1]);
		poly.push([-1, 1]);
		return poly;
	}

	function render() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, W, H);

		const poly = buildRegionPolygon(segs);

		// Background regions
		if (poly.length > 2) {
			const id = ctx.createImageData(W, H);
			const rgb0: [number, number, number] = [59, 130, 246];
			const rgb1: [number, number, number] = [239, 68, 68];
			for (let py = 0; py < H; py++) {
				for (let px = 0; px < W; px++) {
					const [lx, ly] = toLogical(px, py);
					const inside = pointInPolygon(lx, ly, poly);
					const [r, g, b] = inside ? rgb0 : rgb1;
					const off = (py * W + px) * 4;
					id.data[off] = r;
					id.data[off + 1] = g;
					id.data[off + 2] = b;
					id.data[off + 3] = 38;
				}
			}
			ctx.putImageData(id, 0, 0);
		}

		drawGrid(ctx);

		// Draw boundary segments
		ctx.strokeStyle = "#f8fafc";
		ctx.lineWidth = 2.5;
		for (let i = 0; i < segs.length; i++) {
			const s = segs[i];
			const [x1c, y1c] = toCanvas(s.x1, s.y1);
			const [x2c, y2c] = toCanvas(s.x2, s.y2);
			ctx.beginPath();
			ctx.moveTo(x1c, y1c);
			ctx.lineTo(x2c, y2c);
			ctx.stroke();
		}

		// Draw handles
		const handleRadius = 7;
		for (let i = 0; i < segs.length; i++) {
			const s = segs[i];
			// Only draw start handle for first seg; share endpoint handles between consecutive
			const pts2: Array<["start" | "end", number, number]> = [
				["start", s.x1, s.y1],
				["end", s.x2, s.y2],
			];
			for (const [ep, lx, ly] of pts2) {
				const [cx, cy] = toCanvas(lx, ly);
				const isHovered = hoveredHandle?.segIdx === i && hoveredHandle.endpoint === ep;
				ctx.beginPath();
				ctx.arc(cx, cy, handleRadius, 0, Math.PI * 2);
				ctx.fillStyle = isHovered ? "#fff" : "rgba(255,255,255,0.5)";
				ctx.fill();
				ctx.strokeStyle = "#94a3b8";
				ctx.lineWidth = 1.5;
				ctx.stroke();
			}
		}

		// Count errors
		let errors = 0;
		for (const p of pts) {
			const inside = pointInPolygon(p.x, p.y, poly);
			const predicted = inside ? 0 : 1;
			if (predicted !== p.label) errors++;
		}

		drawPoints(ctx, pts);

		ctx.fillStyle = "rgba(255,255,255,0.85)";
		ctx.font = "12px ui-monospace,monospace";
		ctx.fillText(`Błędy: ${errors}/${pts.length}`, 8, 18);
	}

	function pointerToLogical(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
		const rect = e.currentTarget.getBoundingClientRect();
		return toLogical(((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H);
	}

	function findHandle(lx: number, ly: number): { segIdx: number; endpoint: "start" | "end" } | null {
		const threshold = 0.06;
		for (let i = 0; i < segs.length; i++) {
			const s = segs[i];
			if (Math.hypot(lx - s.x1, ly - s.y1) < threshold) return { segIdx: i, endpoint: "start" };
			if (Math.hypot(lx - s.x2, ly - s.y2) < threshold) return { segIdx: i, endpoint: "end" };
		}
		return null;
	}

	function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
		const [lx, ly] = pointerToLogical(e);
		const handle = findHandle(lx, ly);
		if (!handle) return;
		e.currentTarget.setPointerCapture(e.pointerId);
		setDragging(handle);
	}

	function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
		const [lx, ly] = pointerToLogical(e);
		if (!dragging) {
			setHoveredHandle(findHandle(lx, ly));
			return;
		}
		setSegs((prev) => {
			const next = prev.map((s, i) => {
				if (i !== dragging.segIdx) return s;
				if (dragging.endpoint === "start") return { ...s, x1: lx, y1: ly };
				return { ...s, x2: lx, y2: ly };
			});

			// Keep consecutive segments connected
			if (dragging.endpoint === "end" && dragging.segIdx < prev.length - 1) {
				return next.map((s, i) => {
					if (i === dragging.segIdx + 1) return { ...s, x1: next[dragging.segIdx].x2, y1: next[dragging.segIdx].y2 };
					return s;
				});
			}
			if (dragging.endpoint === "start" && dragging.segIdx > 0) {
				return next.map((s, i) => {
					if (i === dragging.segIdx - 1) return { ...s, x2: next[dragging.segIdx].x1, y2: next[dragging.segIdx].y1 };
					return s;
				});
			}
			return next;
		});
	}

	function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
		if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
		setDragging(null);
	}

	function addSegment() {
		setSegs((prev) => {
			const last = prev[prev.length - 1];
			return [...prev, { x1: last.x2, y1: last.y2, x2: last.x2 + 0.2, y2: last.y2 - 0.2 }];
		});
	}

	function removeLastSegment() {
		setSegs((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
	}

	const poly = buildRegionPolygon(segs);
	const errors = pts.filter((p) => {
		const inside = pointInPolygon(p.x, p.y, poly);
		return (inside ? 0 : 1) !== p.label;
	}).length;

	return (
		<div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 my-6 items-start">
			<div className="flex flex-col gap-3">
				<canvas
					ref={canvasRef}
					width={W}
					height={H}
					className="rounded-md border border-border w-full h-auto select-none"
					style={{ cursor: dragging ? "grabbing" : hoveredHandle ? "grab" : "default" }}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerLeave={onPointerUp}
				/>
				<p className="text-sm text-muted-foreground">
					Przeciągaj <strong className="text-foreground">białe uchwyty</strong> na granicy decyzyjnej. Błędy
					klasyfikacji: <span className="font-semibold text-foreground">{errors}</span>/{pts.length}.
				</p>
			</div>

			<div className="flex flex-col gap-4 min-w-48">
				<div className="flex flex-col gap-2">
					<Button variant="outline" size="sm" onClick={addSegment}>
						<Plus className="w-4 h-4 mr-2" /> Dodaj segment
					</Button>
					<Button variant="outline" size="sm" onClick={removeLastSegment} disabled={segs.length <= 1}>
						Usuń ostatni
					</Button>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						setPts(initPoints());
						setSegs(INITIAL_SEGS);
					}}
				>
					<RotateCcw className="w-4 h-4 mr-2" /> Reset
				</Button>

				<div className="text-sm text-muted-foreground flex flex-col gap-1">
					<span>
						Segmentów: <strong className="text-foreground">{segs.length}</strong>
					</span>
					<div className="flex items-center gap-2">
						<span className="inline-block w-3 h-3 rounded-sm" style={{ background: CLASS_COLORS[0] }} />
						Klasa A (lewa)
					</div>
					<div className="flex items-center gap-2">
						<span className="inline-block w-3 h-3 rounded-sm" style={{ background: CLASS_COLORS[1] }} />
						Klasa B (prawa)
					</div>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported entry point
// ─────────────────────────────────────────────────────────────────────────────

export type ClassifierType = "statistical" | "nearest-centroid" | "linear" | "piecewise";

export function Classifier({ type }: { type: ClassifierType }) {
	if (type === "statistical") return <StatisticalClassifier />;
	if (type === "nearest-centroid") return <NearestCentroidClassifier />;
	if (type === "linear") return <LinearClassifier />;
	if (type === "piecewise") return <PiecewiseLinearClassifier />;
	return null;
}
