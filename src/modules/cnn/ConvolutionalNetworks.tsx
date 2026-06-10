"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, ZoomIn } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 320;
const H = 200;

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function convolve3x3(
	src: Uint8ClampedArray,
	w: number,
	h: number,
	kernel: readonly number[],
	gain: number = 1.0,
): Uint8ClampedArray {
	const out = new Uint8ClampedArray(src.length);
	const kSum = kernel.reduce((a, b) => a + b, 0);
	const divisor = Math.abs(kSum) || 1;
	const offset = kSum === 0 ? 128 : 0;

	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			let sum = 0;
			for (let ky = -1; ky <= 1; ky++) {
				for (let kx = -1; kx <= 1; kx++) {
					const idx = ((y + ky) * w + (x + kx)) * 4;
					const gray = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
					sum += gray * kernel[(ky + 1) * 3 + (kx + 1)];
				}
			}
			const v = Math.min(255, Math.max(0, (sum / divisor) * gain + offset));
			const i = (y * w + x) * 4;
			out[i] = out[i + 1] = out[i + 2] = v;
			out[i + 3] = 255;
		}
	}
	return out;
}

function drawTestScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.fillStyle = "#111";
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = "#e2e8f0";
	ctx.fillRect(20, 20, 80, 60);
	ctx.beginPath();
	ctx.arc(200, 60, 45, 0, Math.PI * 2);
	ctx.fillStyle = "#94a3b8";
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(260, h - 20);
	ctx.lineTo(300, 20);
	ctx.lineTo(320, h - 20);
	ctx.closePath();
	ctx.fillStyle = "#cbd5e1";
	ctx.fill();
	// hatching
	ctx.strokeStyle = "rgba(255,255,255,0.12)";
	ctx.lineWidth = 2;
	for (let i = -h; i < w + h; i += 22) {
		ctx.beginPath();
		ctx.moveTo(i, 0);
		ctx.lineTo(i + h, h);
		ctx.stroke();
	}
}

// ---------------------------------------------------------------------------
// DEMO 1 — Convolution Filters
// ---------------------------------------------------------------------------

const FILTERS: { label: string; kernel: number[]; description: string }[] = [
	{
		label: "Sobel X - krawędzie pionowe",
		kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
		description: "Wykrywa pionowe krawędzie. Duże wartości tam, gdzie intensywność zmienia się poziomo.",
	},
	{
		label: "Sobel Y - krawędzie poziome",
		kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
		description: "Wykrywa poziome krawędzie. Duże wartości tam, gdzie intensywność zmienia się pionowo.",
	},
	{
		label: "Wyostrzanie",
		kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0],
		description: "Wzmacnia różnice między sąsiednimi pikselami - efekt ostrzejszego obrazu.",
	},
	{
		label: "Rozmycie Gaussowskie",
		kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1],
		description: "Uśrednia wartości sąsiednich pikseli ważone rozkładem Gaussowskim - wygładza szum.",
	},
	{
		label: "Laplacian - detektor plam",
		kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
		description: "Wykrywa izolowane punkty i krawędzie we wszystkich kierunkach jednocześnie.",
	},
	{
		label: "Emboss - relief",
		kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
		description: "Tworzy efekt reliefu przez wydobycie ukośnych krawędzi.",
	},
];

export function ConvolutionFiltersDemo() {
	const srcRef = useRef<HTMLCanvasElement>(null);
	const outRef = useRef<HTMLCanvasElement>(null);
	const [filterIdx, setFilterIdx] = useState(0);
	const [alpha, setAlpha] = useState(70);

	useEffect(() => {
		const ctx = srcRef.current?.getContext("2d");
		if (!ctx) return;
		drawTestScene(ctx, W, H);
	}, []);

	const apply = useCallback(() => {
		const srcCtx = srcRef.current?.getContext("2d");
		const outCtx = outRef.current?.getContext("2d");
		if (!srcCtx || !outCtx) return;

		const srcData = srcCtx.getImageData(0, 0, W, H);
		const filtered = convolve3x3(srcData.data, W, H, FILTERS[filterIdx].kernel);

		// Draw source as base
		outCtx.drawImage(srcRef.current!, 0, 0);

		// Overlay filtered result
		const tmp = document.createElement("canvas");
		tmp.width = W;
		tmp.height = H;
		const tCtx = tmp.getContext("2d")!;
		const imgData = tCtx.createImageData(W, H);
		imgData.data.set(filtered);
		tCtx.putImageData(imgData, 0, 0);
		// Tint orange-red
		tCtx.globalCompositeOperation = "multiply";
		tCtx.fillStyle = "#ff5500";
		tCtx.fillRect(0, 0, W, H);

		outCtx.globalAlpha = alpha / 100;
		outCtx.globalCompositeOperation = "screen";
		outCtx.drawImage(tmp, 0, 0);
		outCtx.globalAlpha = 1;
		outCtx.globalCompositeOperation = "source-over";
	}, [filterIdx, alpha]);

	useEffect(() => {
		apply();
	}, [apply]);

	const filter = FILTERS[filterIdx];
	const km = filter.kernel;

	return (
		<div className="flex flex-col gap-4 my-6">
			{/* Filter selector */}
			<div className="flex flex-row flex-wrap gap-2">
				{FILTERS.map((f, i) => (
					<Button key={i} size="sm" variant={filterIdx === i ? "default" : "outline"} onClick={() => setFilterIdx(i)}>
						{f.label.split(" — ")[0]}
					</Button>
				))}
			</div>

			{/* Alpha slider */}
			<div className="flex items-center gap-4 max-w-xs">
				<Label className="whitespace-nowrap text-sm">
					Nakładka: <span className="font-semibold">{alpha}%</span>
				</Label>
				<Slider value={[alpha]} onValueChange={(v) => setAlpha(v[0])} min={0} max={100} step={5} className="flex-1" />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
				{/* Source */}
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Obraz wejściowy</span>
					<canvas ref={srcRef} width={W} height={H} className="rounded-md border border-border w-full h-auto" />
				</div>

				{/* Output */}
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Odpowiedź filtra</span>
					<canvas ref={outRef} width={W} height={H} className="rounded-md border border-border w-full h-auto" />
				</div>

				{/* Kernel + description */}
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Jądro 3×3</span>
						<div className="grid grid-cols-3 gap-0.5 w-fit font-mono text-xs">
							{km.map((v, i) => (
								<div
									key={i}
									className="w-9 h-9 flex items-center justify-center rounded text-white font-semibold"
									style={{
										background:
											v > 0
												? `rgba(59,130,246,${Math.min(1, Math.abs(v) / 8)})`
												: v < 0
													? `rgba(239,68,68,${Math.min(1, Math.abs(v) / 8)})`
													: "rgba(100,100,100,0.25)",
									}}
								>
									{v}
								</div>
							))}
						</div>
					</div>
					<p className="text-sm text-muted-foreground">{filter.description}</p>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DEMO 2 — Feature Maps
// ---------------------------------------------------------------------------

const FEATURE_KERNELS: { name: string; kernel: number[]; tint: string }[] = [
	{ name: "Krawędź V", kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1], tint: "#3b82f6" },
	{ name: "Krawędź H", kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1], tint: "#ef4444" },
	{ name: "Ukos ╲", kernel: [2, 1, 0, 1, 0, -1, 0, -1, -2], tint: "#10b981" },
	{ name: "Ukos ╱", kernel: [0, 1, 2, -1, 0, 1, -2, -1, 0], tint: "#f59e0b" },
	{ name: "Laplacian", kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], tint: "#8b5cf6" },
	{ name: "Rozmycie", kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1], tint: "#06b6d4" },
	{ name: "Gradient ↗", kernel: [-2, -1, 0, -1, 0, 1, 0, 1, 2], tint: "#f97316" },
	{ name: "Wyostrzanie", kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0], tint: "#ec4899" },
];

function renderTinted(
	canvas: HTMLCanvasElement,
	srcData: Uint8ClampedArray,
	kernel: readonly number[],
	tint: string,
	gain: number = 1.0,
) {
	const ctx = canvas.getContext("2d")!;
	const filtered = convolve3x3(srcData, W, H, kernel, gain);
	const imgData = ctx.createImageData(W, H);
	imgData.data.set(filtered);
	ctx.putImageData(imgData, 0, 0);
	ctx.globalCompositeOperation = "multiply";
	ctx.globalAlpha = 0.55;
	ctx.fillStyle = tint;
	ctx.fillRect(0, 0, W, H);
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
}

export function FeatureMapsDemo() {
	const srcRef = useRef<HTMLCanvasElement>(null);
	const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([]);
	const zoomRef = useRef<HTMLCanvasElement>(null);
	const [srcPixels, setSrcPixels] = useState<Uint8ClampedArray | null>(null);
	const [selected, setSelected] = useState<number | null>(null);

	useEffect(() => {
		const ctx = srcRef.current?.getContext("2d");
		if (!ctx) return;
		drawTestScene(ctx, W, H);
		setSrcPixels(new Uint8ClampedArray(ctx.getImageData(0, 0, W, H).data));
	}, []);

	useEffect(() => {
		if (!srcPixels) return;
		thumbRefs.current.forEach((c, i) => {
			if (!c) return;
			renderTinted(c, srcPixels, FEATURE_KERNELS[i].kernel, FEATURE_KERNELS[i].tint);
		});
	}, [srcPixels]);

	useEffect(() => {
		if (selected === null || !srcPixels || !zoomRef.current) return;
		renderTinted(zoomRef.current, srcPixels, FEATURE_KERNELS[selected].kernel, FEATURE_KERNELS[selected].tint);
	}, [selected, srcPixels]);

	return (
		<div className="flex flex-col gap-4 my-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Source */}
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Obraz wejściowy</span>
					<canvas ref={srcRef} width={W} height={H} className="rounded-md border border-border w-full h-auto" />
				</div>

				{/* Zoom */}
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
						{selected !== null ? `Powiększenie — ${FEATURE_KERNELS[selected].name}` : "Kliknij mapę, aby powiększyć"}
					</span>
					<canvas ref={zoomRef} width={W} height={H} className="rounded-md border border-border w-full h-auto" />
				</div>
			</div>

			{/* Thumbnail grid */}
			<div className="grid grid-cols-4 md:grid-cols-8 gap-2">
				{FEATURE_KERNELS.map((fk, i) => (
					<button key={i} title={fk.name} onClick={() => setSelected(i)} className="flex flex-col gap-1 group">
						<canvas
							ref={(el) => {
								thumbRefs.current[i] = el;
							}}
							width={W}
							height={H}
							className="rounded-md w-full h-auto"
							style={{
								border: `2px solid ${selected === i ? fk.tint : "transparent"}`,
								outline: selected === i ? `1px solid ${fk.tint}` : "none",
							}}
						/>
						<span className="text-[10px] text-muted-foreground truncate w-full text-center">{fk.name}</span>
					</button>
				))}
			</div>

			<p className="text-sm text-muted-foreground">
				Każda mapa cech odpowiada jednemu filtrowi. Jasne obszary oznaczają silną aktywację — sieć &quot;widzi&quot; tam
				daną cechę.
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DEMO 3 — Feature Hierarchy (conv1 vs conv2)
// ---------------------------------------------------------------------------

const LAYER_DEFS = {
	conv1: {
		label: "conv1 - wczesna warstwa",
		description: "Proste cechy: krawędzie i gradienty. Silna odpowiedź wzdłuż konturów obiektów.",
		color: "#3b82f6",
		kernels: [
			{ name: "Krawędź V", kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1] },
			{ name: "Krawędź H", kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1] },
			{ name: "Ukos ╲", kernel: [2, 1, 0, 1, 0, -1, 0, -1, -2] },
			{ name: "Laplacian", kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] },
		],
	},
	conv2: {
		label: "conv2 - głębsza warstwa",
		description: "Złożone wzorce: narożniki, skrzyżowania krawędzi. Wejściem są mapy cech conv1.",
		color: "#10b981",
		kernels: [
			{ name: "Narożnik ↘", kernel: [-2, -1, 0, -1, 0, 1, 0, 1, 2] },
			{ name: "Narożnik ↗", kernel: [0, -1, -2, 1, 0, -1, 2, 1, 0] },
			{ name: "Pierścień", kernel: [1, 1, 1, 1, -8, 1, 1, 1, 1] },
			{ name: "Krzyż", kernel: [-1, 2, -1, 2, -4, 2, -1, 2, -1] },
		],
	},
} as const;

type LayerKey = keyof typeof LAYER_DEFS;

export function FeatureHierarchyDemo() {
	const srcRef = useRef<HTMLCanvasElement>(null);
	const mapRefs = useRef<(HTMLCanvasElement | null)[]>([]);
	const [srcPixels, setSrcPixels] = useState<Uint8ClampedArray | null>(null);
	const [activeLayer, setActiveLayer] = useState<LayerKey>("conv1");

	useEffect(() => {
		const ctx = srcRef.current?.getContext("2d");
		if (!ctx) return;
		drawTestScene(ctx, W, H);
		setSrcPixels(new Uint8ClampedArray(ctx.getImageData(0, 0, W, H).data));
	}, []);

	useEffect(() => {
		if (!srcPixels) return;
		const layer = LAYER_DEFS[activeLayer];
		// conv2: pre-smooth once to simulate depth
		let base = srcPixels;
		if (activeLayer === "conv2") {
			base = convolve3x3(srcPixels, W, H, [1, 2, 1, 2, 4, 2, 1, 2, 1]);
		}
		mapRefs.current.forEach((c, i) => {
			if (!c || !layer.kernels[i]) return;
			renderTinted(c, base, layer.kernels[i].kernel, layer.color, activeLayer === "conv2" ? 3.0 : 1.0);
		});
	}, [srcPixels, activeLayer]);

	const layer = LAYER_DEFS[activeLayer];

	return (
		<div className="flex flex-col gap-4 my-6">
			{/* Layer toggle */}
			<div className="flex flex-row gap-2 items-center">
				{(Object.keys(LAYER_DEFS) as LayerKey[]).map((lk) => (
					<Button
						key={lk}
						size="sm"
						variant={activeLayer === lk ? "default" : "outline"}
						onClick={() => setActiveLayer(lk)}
						style={activeLayer === lk ? { background: LAYER_DEFS[lk].color, borderColor: LAYER_DEFS[lk].color } : {}}
					>
						{lk}
					</Button>
				))}
				<span className="text-sm text-muted-foreground ml-2">{layer.description}</span>
			</div>

			{/* Source + 4 maps */}
			<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wejście</span>
					<canvas ref={srcRef} width={W} height={H} className="rounded-md border border-border w-full h-auto" />
				</div>
				{layer.kernels.map((k, i) => (
					<div key={i} className="flex flex-col gap-1">
						<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.name}</span>
						<canvas
							ref={(el) => {
								mapRefs.current[i] = el;
							}}
							width={W}
							height={H}
							className="rounded-md border border-border w-full h-auto"
						/>
					</div>
				))}
			</div>

			<p className="text-sm text-muted-foreground">
				Warstwy głębsze reagują na bardziej złożone i abstrakcyjne wzorce niż warstwy płytkie.
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DEMO 4 — CNN vs MLP
// ---------------------------------------------------------------------------

function drawDigit7(ctx: CanvasRenderingContext2D, offsetX: number) {
	const cw = 200,
		ch = 200;
	ctx.fillStyle = "#111";
	ctx.fillRect(0, 0, cw, ch);
	const cx = cw / 2 + offsetX;
	ctx.strokeStyle = "#f8fafc";
	ctx.lineWidth = 14;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.beginPath();
	ctx.moveTo(cx - 45, 45);
	ctx.lineTo(cx + 45, 45);
	ctx.lineTo(cx + 10, 165);
	ctx.stroke();
}

export function CnnVsMlpDemo() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [offset, setOffset] = useState(0);
	const MAX = 55;

	useEffect(() => {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		drawDigit7(ctx, offset);
	}, [offset]);

	const mlpConf = Math.max(3, Math.round(Math.exp(-9 * (offset / MAX) ** 2) * 100));
	const cnnConf = Math.max(10, Math.round(Math.exp(-2.2 * (offset / MAX) ** 2) * 100));

	return (
		<div className="flex flex-col gap-4 my-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
				{/* Digit canvas + slider */}
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
							Cyfra &quot;7&quot;
						</span>
						<canvas
							ref={canvasRef}
							width={200}
							height={200}
							className="rounded-md border border-border"
							style={{ width: 200, height: 200 }}
						/>
					</div>
					<div className="flex items-center gap-4 max-w-xs">
						<Label className="whitespace-nowrap text-sm">
							Przesunięcie:{" "}
							<span className="font-semibold">
								{offset > 0 ? "+" : ""}
								{offset}px
							</span>
						</Label>
						<Slider
							value={[offset]}
							onValueChange={(v) => setOffset(v[0])}
							min={-MAX}
							max={MAX}
							step={1}
							className="flex-1"
						/>
					</div>
				</div>

				{/* Confidence bars */}
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<div className="flex justify-between text-sm">
							<span className="font-medium">MLP</span>
							<span className="font-mono" style={{ color: "#ef4444" }}>
								{mlpConf}%
							</span>
						</div>
						<div className="h-3 rounded-full bg-muted overflow-hidden">
							<div
								className="h-full rounded-full transition-all duration-150"
								style={{ width: `${mlpConf}%`, background: "#ef4444" }}
							/>
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<div className="flex justify-between text-sm">
							<span className="font-medium">CNN</span>
							<span className="font-mono" style={{ color: "#10b981" }}>
								{cnnConf}%
							</span>
						</div>
						<div className="h-3 rounded-full bg-muted overflow-hidden">
							<div
								className="h-full rounded-full transition-all duration-150"
								style={{ width: `${cnnConf}%`, background: "#10b981" }}
							/>
						</div>
					</div>

					<p className="text-sm text-muted-foreground mt-2">
						{Math.abs(offset) < 15
							? "Cyfra wyśrodkowana - oba modele klasyfikują poprawnie."
							: Math.abs(offset) < 35
								? "MLP traci pewność - wzorzec pikseli odbiega od danych treningowych. CNN utrzymuje wysoką pewność dzięki poolingowi."
								: "Duże przesunięcie - MLP niemal niedziała. CNN wciąż rozpoznaje cyfrę dzięki niezmienności na translację."}
					</p>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DEMO 5 — Grad-CAM
// ---------------------------------------------------------------------------

type GradClass = {
	label: string;
	description: string;
	regions: [number, number, number, number][]; // cx, cy, r, intensity (0-1, normalised)
	conf: number;
	color: string;
	drawBg: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

const GRAD_CLASSES: GradClass[] = [
	{
		label: "Cyfra 0",
		description: "Uwaga skupiona na owalnym konturze - zamknięta pętla charakterystyczna dla zera.",
		regions: [
			[0.5, 0.5, 0.35, 1],
			[0.5, 0.18, 0.12, 0.55],
			[0.5, 0.82, 0.12, 0.55],
		],
		conf: 91,
		color: "#3b82f6",
		drawBg: (ctx, w, h) => {
			ctx.fillStyle = "#0f172a";
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = "#e2e8f0";
			ctx.lineWidth = 10;
			ctx.beginPath();
			ctx.ellipse(w / 2, h / 2, w * 0.28, h * 0.38, 0, 0, Math.PI * 2);
			ctx.stroke();
		},
	},
	{
		label: "Cyfra 1",
		description: "Uwaga skupiona na pionowej kresce - długa wąska aktywacja.",
		regions: [
			[0.5, 0.5, 0.07, 1],
			[0.5, 0.28, 0.06, 0.7],
			[0.5, 0.72, 0.06, 0.7],
		],
		conf: 87,
		color: "#10b981",
		drawBg: (ctx, w, h) => {
			ctx.fillStyle = "#0f172a";
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = "#e2e8f0";
			ctx.lineWidth = 10;
			ctx.lineCap = "round";
			ctx.beginPath();
			ctx.moveTo(w / 2, h * 0.12);
			ctx.lineTo(w / 2, h * 0.88);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(w * 0.38, h * 0.22);
			ctx.lineTo(w / 2, h * 0.12);
			ctx.stroke();
		},
	},
	{
		label: "Cyfra 7",
		description: "Uwaga na poziomym pasie u góry i przekątnej - cechy charakterystyczne siódemki.",
		regions: [
			[0.5, 0.17, 0.27, 1],
			[0.63, 0.52, 0.18, 0.8],
			[0.43, 0.78, 0.13, 0.45],
		],
		conf: 79,
		color: "#f59e0b",
		drawBg: (ctx, w, h) => {
			ctx.fillStyle = "#0f172a";
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = "#e2e8f0";
			ctx.lineWidth = 10;
			ctx.lineCap = "round";
			ctx.beginPath();
			ctx.moveTo(w * 0.22, h * 0.15);
			ctx.lineTo(w * 0.78, h * 0.15);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(w * 0.78, h * 0.15);
			ctx.lineTo(w * 0.38, h * 0.88);
			ctx.stroke();
		},
	},
	{
		label: "Cyfra 8",
		description: "Dwa obszary aktywacji odpowiadają górnej i dolnej pętli ósemki.",
		regions: [
			[0.5, 0.3, 0.2, 0.9],
			[0.5, 0.7, 0.23, 1],
			[0.5, 0.5, 0.08, 0.5],
		],
		conf: 83,
		color: "#8b5cf6",
		drawBg: (ctx, w, h) => {
			ctx.fillStyle = "#0f172a";
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = "#e2e8f0";
			ctx.lineWidth = 8;
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.31, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.69, w * 0.23, h * 0.22, 0, 0, Math.PI * 2);
			ctx.stroke();
		},
	},
];

const GW = 200;
const GH = 200;

function renderGradCam(canvas: HTMLCanvasElement, cls: GradClass, heatAlpha: number) {
	const ctx = canvas.getContext("2d")!;
	cls.drawBg(ctx, GW, GH);

	// Build heatmap in low-res grid
	const GR = 28;
	const heat = new Float32Array(GR * GR);
	for (const [cx, cy, r, intensity] of cls.regions) {
		for (let gy = 0; gy < GR; gy++) {
			for (let gx = 0; gx < GR; gx++) {
				const dx = gx / GR - cx,
					dy = gy / GR - cy;
				const d = Math.sqrt(dx * dx + dy * dy);
				heat[gy * GR + gx] += intensity * Math.max(0, 1 - d / r);
			}
		}
	}
	const mx = Math.max(...heat) || 1;
	for (let i = 0; i < heat.length; i++) heat[i] /= mx;

	// Jet colormap RGBA
	const tmp = document.createElement("canvas");
	tmp.width = GR;
	tmp.height = GR;
	const tCtx = tmp.getContext("2d")!;
	const id = tCtx.createImageData(GR, GR);
	for (let i = 0; i < GR * GR; i++) {
		const v = heat[i];
		let r = 0,
			g = 0,
			b = 0;
		if (v < 0.25) {
			b = 1;
			g = v / 0.25;
		} else if (v < 0.5) {
			b = 1 - (v - 0.25) / 0.25;
			g = 1;
		} else if (v < 0.75) {
			g = 1;
			r = (v - 0.5) / 0.25;
		} else {
			r = 1;
			g = 1 - (v - 0.75) / 0.25;
		}
		id.data[i * 4] = Math.round(r * 255);
		id.data[i * 4 + 1] = Math.round(g * 255);
		id.data[i * 4 + 2] = Math.round(b * 255);
		id.data[i * 4 + 3] = Math.round(v * (heatAlpha / 100) * 255);
	}
	tCtx.putImageData(id, 0, 0);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(tmp, 0, 0, GW, GH);
}

export function GradCamDemo() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const legendRef = useRef<HTMLCanvasElement>(null);
	const [classIdx, setClassIdx] = useState(0);
	const [heatAlpha, setHeatAlpha] = useState(65);

	useEffect(() => {
		if (!canvasRef.current) return;
		renderGradCam(canvasRef.current, GRAD_CLASSES[classIdx], heatAlpha);
	}, [classIdx, heatAlpha]);

	// Draw legend once
	useEffect(() => {
		const c = legendRef.current;
		if (!c) return;
		const ctx = c.getContext("2d")!;
		for (let x = 0; x < 120; x++) {
			const v = x / 120;
			let r = 0,
				g = 0,
				b = 0;
			if (v < 0.25) {
				b = 1;
				g = v / 0.25;
			} else if (v < 0.5) {
				b = 1 - (v - 0.25) / 0.25;
				g = 1;
			} else if (v < 0.75) {
				g = 1;
				r = (v - 0.5) / 0.25;
			} else {
				r = 1;
				g = 1 - (v - 0.75) / 0.25;
			}
			ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
			ctx.fillRect(x, 0, 1, 12);
		}
	}, []);

	const cls = GRAD_CLASSES[classIdx];

	return (
		<div className="flex flex-col gap-4 my-6">
			{/* Class selector */}
			<div className="flex flex-row flex-wrap gap-2">
				{GRAD_CLASSES.map((c, i) => (
					<Button
						key={i}
						size="sm"
						variant={classIdx === i ? "default" : "outline"}
						onClick={() => setClassIdx(i)}
						style={classIdx === i ? { background: c.color, borderColor: c.color } : {}}
					>
						{c.label}
					</Button>
				))}
			</div>

			{/* Alpha slider */}
			<div className="flex items-center gap-4 max-w-xs">
				<Label className="whitespace-nowrap text-sm">
					Heatmapa: <span className="font-semibold">{heatAlpha}%</span>
				</Label>
				<Slider
					value={[heatAlpha]}
					onValueChange={(v) => setHeatAlpha(v[0])}
					min={10}
					max={100}
					step={5}
					className="flex-1"
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
				{/* Canvas */}
				<div className="flex flex-col gap-2">
					<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
						Obraz + heatmapa uwagi
					</span>
					<canvas
						ref={canvasRef}
						width={GW}
						height={GH}
						className="rounded-md border border-border"
						style={{ width: GW, height: GH }}
					/>
					{/* Legend */}
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">niska uwaga</span>
						<canvas ref={legendRef} width={120} height={12} className="rounded" style={{ width: 80, height: 8 }} />
						<span className="text-xs text-muted-foreground">wysoka uwaga</span>
					</div>
				</div>

				{/* Info */}
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pewność predykcji</span>
						<div className="flex items-center gap-3">
							<div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
								<div
									className="h-full rounded-full transition-all"
									style={{ width: `${cls.conf}%`, background: cls.color }}
								/>
							</div>
							<span className="font-mono text-sm font-semibold" style={{ color: cls.color }}>
								{cls.conf}%
							</span>
						</div>
					</div>
					<p className="text-sm text-muted-foreground">{cls.description}</p>
					<p className="text-sm text-muted-foreground">
						Czerwone obszary w heatmapie wskazują miejsca o największym wpływie na decyzję sieci. Grad-CAM pomaga
						zrozumieć <em>dlaczego</em> model podjął daną decyzję i wykryć błędy w uczeniu.
					</p>
				</div>
			</div>
		</div>
	);
}
