"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, RotateCcw, Trash2 } from "lucide-react";
import {
	type Network,
	type ForwardResult,
	initNetwork,
	initDigitNetwork,
	forward,
	softmaxTemp,
	activationColor,
	weightColor,
} from "./mlp";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DIGIT_SIZE = 28;
const DIGIT_PIXELS = DIGIT_SIZE * DIGIT_SIZE;
const CANVAS_PX = 280; // displayed canvas size in px
const CELL_PX = CANVAS_PX / DIGIT_SIZE; // 20 px per cell

// ─────────────────────────────────────────────────────────────────────────────
// 1.  MLPTopology — single SVG, correct connections
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 8;
const NODE_R = 13;
const NODE_SPACING_Y = 42;
const LAYER_GAP = 72; // horizontal gap between layer centres

function MLPDiagram({
	topology,
	net,
	activations,
	selectedNeuron,
	onNeuronClick,
}: {
	topology: number[];
	net: Network;
	activations: number[][];
	selectedNeuron: { layer: number; neuron: number } | null;
	onNeuronClick: (l: number, n: number) => void;
}) {
	const numLayers = topology.length;
	const maxVisible = topology.map((s) => Math.min(s, MAX_VISIBLE));
	const svgH = Math.max(...maxVisible) * NODE_SPACING_Y + NODE_SPACING_Y;
	const svgW = (numLayers - 1) * LAYER_GAP + NODE_R * 2 + 20;

	// Centre-Y for each node in a layer
	function nodeY(layerIdx: number, nodeIdx: number): number {
		const vis = maxVisible[layerIdx];
		const totalH = vis * NODE_SPACING_Y;
		const startY = (svgH - totalH) / 2 + NODE_SPACING_Y / 2;
		return startY + nodeIdx * NODE_SPACING_Y;
	}
	// Centre-X for a layer
	function layerX(li: number): number {
		return NODE_R + 10 + li * LAYER_GAP;
	}

	return (
		<svg width={svgW} height={svgH} style={{ overflow: "visible", display: "block" }}>
			{/* ── Connections ── */}
			{topology.slice(0, -1).map((leftSize, li) => {
				const rightSize = topology[li + 1];
				const lVis = Math.min(leftSize, MAX_VISIBLE);
				const rVis = Math.min(rightSize, MAX_VISIBLE);
				const x1 = layerX(li) + NODE_R;
				const x2 = layerX(li + 1) - NODE_R;
				const lines: React.ReactNode[] = [];
				for (let r = 0; r < rVis; r++) {
					for (let l = 0; l < lVis; l++) {
						const w = net.layers[li]?.W[r]?.[l] ?? 0;
						const opacity = Math.min(0.85, Math.abs(w) * 0.5 + 0.08);
						const color = w >= 0 ? "rgb(239,68,68)" : "rgb(59,130,246)";
						const isHighlighted =
							(selectedNeuron?.layer === li && selectedNeuron?.neuron === l) ||
							(selectedNeuron?.layer === li + 1 && selectedNeuron?.neuron === r);
						lines.push(
							<line
								key={`${l}-${r}`}
								x1={x1}
								y1={nodeY(li, l)}
								x2={x2}
								y2={nodeY(li + 1, r)}
								stroke={isHighlighted ? "#f8fafc" : color}
								strokeWidth={isHighlighted ? 1.5 : 0.8}
								opacity={isHighlighted ? 0.9 : opacity}
							/>,
						);
					}
				}
				return <g key={li}>{lines}</g>;
			})}

			{/* ── Nodes ── */}
			{topology.map((size, li) => {
				const vis = Math.min(size, MAX_VISIBLE);
				const isInput = li === 0;
				const isOutput = li === topology.length - 1;
				const cx = layerX(li);

				return (
					<g key={li}>
						{Array.from({ length: vis }, (_, ni) => {
							const cy = nodeY(li, ni);
							const rawAct = activations[li]?.[ni] ?? 0;
							const normAct = isInput ? Math.max(0, Math.min(1, rawAct * 0.5 + 0.5)) : Math.max(0, Math.min(1, rawAct));
							const isSelected = selectedNeuron?.layer === li && selectedNeuron?.neuron === ni;
							return (
								<g key={ni} onClick={() => onNeuronClick(li, ni)} style={{ cursor: "pointer" }}>
									<circle
										cx={cx}
										cy={cy}
										r={NODE_R}
										fill={activationColor(normAct)}
										stroke={isSelected ? "#f8fafc" : "rgba(148,163,184,0.35)"}
										strokeWidth={isSelected ? 2.5 : 1}
									/>
									{activations[li] && (
										<text
											x={cx}
											y={cy + 4}
											textAnchor="middle"
											fontSize={7}
											fill="rgba(0,0,0,0.65)"
											fontFamily="monospace"
										>
											{rawAct.toFixed(2)}
										</text>
									)}
								</g>
							);
						})}
						{/* Truncation indicator */}
						{size > MAX_VISIBLE && (
							<text
								x={layerX(li)}
								y={nodeY(li, vis - 1) + NODE_R + 12}
								textAnchor="middle"
								fontSize={9}
								fill="rgba(148,163,184,0.7)"
							>
								+{size - MAX_VISIBLE}
							</text>
						)}
						{/* Layer label */}
						<text x={cx} y={svgH - 4} textAnchor="middle" fontSize={10} fill="rgba(148,163,184,0.8)">
							{isInput ? "In" : isOutput ? "Out" : `H${li}`}
						</text>
						<text x={cx} y={svgH - 4 + 13} textAnchor="middle" fontSize={10} fontWeight="600" fill="currentColor">
							{size}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

export function MLPTopology() {
	const [topology, setTopology] = useState([2, 4, 3, 2]);
	const [net, setNet] = useState<Network>(() => initNetwork([2, 4, 3, 2]));
	const [inputs, setInputs] = useState([0.6, -0.3]);
	const [fwd, setFwd] = useState<ForwardResult | null>(null);
	const [selectedNeuron, setSelectedNeuron] = useState<{
		layer: number;
		neuron: number;
	} | null>(null);

	useEffect(() => {
		setFwd(forward(net, inputs));
	}, [net, inputs]);

	function addLayer() {
		if (topology.length >= 7) return;
		const t = [...topology.slice(0, -1), 3, topology[topology.length - 1]];
		setTopology(t);
		setNet(initNetwork(t));
	}
	function removeLayer() {
		if (topology.length <= 3) return;
		const t = [...topology.slice(0, -2), topology[topology.length - 1]];
		setTopology(t);
		setNet(initNetwork(t));
	}
	function addNeuron(li: number) {
		if (li === 0 || li === topology.length - 1 || topology[li] >= 12) return;
		const t = topology.map((v, i) => (i === li ? v + 1 : v));
		setTopology(t);
		setNet(initNetwork(t));
	}
	function removeNeuron(li: number) {
		if (li === 0 || li === topology.length - 1 || topology[li] <= 1) return;
		const t = topology.map((v, i) => (i === li ? v - 1 : v));
		setTopology(t);
		setNet(initNetwork(t));
	}

	const selInfo = useMemo(() => {
		if (!selectedNeuron || !fwd) return null;
		const { layer, neuron } = selectedNeuron;
		const act = fwd.activations[layer]?.[neuron] ?? 0;
		const wIn = layer > 0 ? (net.layers[layer - 1]?.W[neuron] ?? null) : null;
		return { act, wIn, layer, neuron };
	}, [selectedNeuron, fwd, net]);

	return (
		<div className="flex flex-col gap-5 my-6">
			<div className="flex flex-wrap gap-2 items-center">
				<Button variant="outline" size="sm" onClick={removeLayer} disabled={topology.length <= 3}>
					<Minus className="w-4 h-4 mr-1" /> Usuń warstwę
				</Button>
				<Button variant="outline" size="sm" onClick={addLayer} disabled={topology.length >= 7}>
					<Plus className="w-4 h-4 mr-1" /> Dodaj warstwę
				</Button>
				<Button variant="outline" size="sm" onClick={() => setNet(initNetwork(topology))}>
					<RotateCcw className="w-4 h-4 mr-1" /> Losuj wagi
				</Button>
			</div>

			{/* Input sliders */}
			<div className="flex flex-wrap gap-4">
				{inputs.map((v, i) => (
					<div key={i} className="flex items-center gap-3 min-w-44">
						<Label className="text-sm whitespace-nowrap">
							x{i + 1}: <span className="font-mono text-foreground">{v.toFixed(2)}</span>
						</Label>
						<Slider
							value={[v]}
							onValueChange={(val) => setInputs((prev) => prev.map((old, j) => (j === i ? val[0] : old)))}
							min={-1}
							max={1}
							step={0.01}
							className="flex-1"
						/>
					</div>
				))}
			</div>

			{/* Network diagram */}
			<div className="overflow-x-auto pb-6">
				<MLPDiagram
					topology={topology}
					net={net}
					activations={fwd?.activations ?? topology.map(() => [])}
					selectedNeuron={selectedNeuron}
					onNeuronClick={(l, n) =>
						setSelectedNeuron((prev) => (prev?.layer === l && prev?.neuron === n ? null : { layer: l, neuron: n }))
					}
				/>
			</div>

			{/* +/- neuron buttons per hidden layer */}
			<div className="flex gap-4">
				{topology.slice(1, -1).map((_, i) => {
					const li = i + 1;
					return (
						<div key={li} className="flex flex-col items-center gap-1">
							<span className="text-xs text-muted-foreground">
								H{li} ({topology[li]})
							</span>
							<div className="flex gap-1">
								<button
									onClick={() => removeNeuron(li)}
									className="w-6 h-6 rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-white text-xs flex items-center justify-center transition-colors"
								>
									−
								</button>
								<button
									onClick={() => addNeuron(li)}
									className="w-6 h-6 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-white text-xs flex items-center justify-center transition-colors"
								>
									+
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{/* Selected neuron panel */}
			{selInfo && (
				<div className="rounded-md border border-border p-4 text-sm flex flex-col gap-2 max-w-lg">
					<span className="font-semibold">
						{selInfo.layer === 0
							? "Wejście"
							: selInfo.layer === topology.length - 1
								? "Wyjście"
								: `Warstwa ukryta ${selInfo.layer}`}{" "}
						— neuron {selInfo.neuron}
					</span>
					<span>
						Aktywacja: <span className="font-mono font-semibold">{selInfo.act.toFixed(4)}</span>
					</span>
					{selInfo.wIn && (
						<div>
							<span className="text-muted-foreground">Wagi wejściowe:</span>
							<div className="flex flex-wrap gap-1 mt-1">
								{selInfo.wIn.map((w, i) => (
									<span
										key={i}
										className="font-mono text-xs px-1.5 py-0.5 rounded"
										style={{ background: weightColor(w, 2) }}
									>
										w{i}={w.toFixed(3)}
									</span>
								))}
							</div>
						</div>
					)}
					{fwd && selInfo.layer === topology.length - 1 && (
						<span>
							Prawdopodobieństwo (softmax):{" "}
							<span className="font-mono font-semibold">{(fwd.output[selInfo.neuron] * 100).toFixed(1)}%</span>
						</span>
					)}
				</div>
			)}

			{fwd && (
				<div className="flex flex-wrap gap-2 items-center text-sm">
					<span className="text-muted-foreground">Wyjście (softmax):</span>
					{fwd.output.map((p, i) => (
						<span key={i} className="font-mono px-2 py-0.5 rounded text-xs" style={{ background: activationColor(p) }}>
							y{i}={p.toFixed(3)}
						</span>
					))}
				</div>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: drawing canvas
// ─────────────────────────────────────────────────────────────────────────────

function DigitCanvas({ onPixelsChange }: { onPixelsChange: (pixels: number[]) => void }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const isDrawing = useRef(false);

	function extractPixels() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const id = ctx.getImageData(0, 0, CANVAS_PX, CANVAS_PX);
		const pixels: number[] = [];
		for (let row = 0; row < DIGIT_SIZE; row++) {
			for (let col = 0; col < DIGIT_SIZE; col++) {
				let sum = 0;
				for (let dy = 0; dy < CELL_PX; dy++) {
					for (let dx = 0; dx < CELL_PX; dx++) {
						const idx = ((row * CELL_PX + dy) * CANVAS_PX + (col * CELL_PX + dx)) * 4;
						sum += id.data[idx]; // R channel (white on black)
					}
				}
				pixels.push(sum / (CELL_PX * CELL_PX * 255));
			}
		}
		onPixelsChange(pixels);
	}

	function getPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
		const rect = e.currentTarget.getBoundingClientRect();
		return [((e.clientX - rect.left) / rect.width) * CANVAS_PX, ((e.clientY - rect.top) / rect.height) * CANVAS_PX];
	}

	function draw(e: React.PointerEvent<HTMLCanvasElement>, erasing = false) {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		const [x, y] = getPos(e);
		// Brush = 0.4 cells → fine strokes, one cell per tap
		const r = CELL_PX * 0.8;
		ctx.fillStyle = erasing ? "#000" : "#fff";
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		extractPixels();
	}

	function clear() {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
		onPixelsChange(new Array(DIGIT_PIXELS).fill(0));
	}

	useEffect(() => {
		clear();
	}, []);

	// Draw grid overlay
	function drawGrid() {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		ctx.strokeStyle = "rgba(80,80,80,0.5)";
		ctx.lineWidth = 0.5;
		for (let i = 1; i < DIGIT_SIZE; i++) {
			ctx.beginPath();
			ctx.moveTo(i * CELL_PX, 0);
			ctx.lineTo(i * CELL_PX, CANVAS_PX);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, i * CELL_PX);
			ctx.lineTo(CANVAS_PX, i * CELL_PX);
			ctx.stroke();
		}
	}

	return (
		<div className="flex flex-col gap-1.5 items-center">
			<canvas
				ref={canvasRef}
				width={CANVAS_PX}
				height={CANVAS_PX}
				className="rounded-md border border-border cursor-crosshair select-none"
				style={{ width: CANVAS_PX, height: CANVAS_PX, background: "#000" }}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					isDrawing.current = true;
					draw(e);
					drawGrid();
				}}
				onPointerMove={(e) => {
					if (!isDrawing.current) return;
					draw(e, e.buttons === 2);
					drawGrid();
				}}
				onPointerUp={(e) => {
					if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
					isDrawing.current = false;
					drawGrid();
				}}
				onPointerLeave={() => {
					isDrawing.current = false;
				}}
				onContextMenu={(e) => e.preventDefault()}
			/>
			<p className="text-xs text-muted-foreground">LPM rysuj · PPM gumka</p>
			<Button variant="outline" size="sm" onClick={clear}>
				<Trash2 className="w-4 h-4 mr-1" /> Wyczyść
			</Button>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Digit Recognizer
// ─────────────────────────────────────────────────────────────────────────────

export function DigitRecognizer() {
	const [net] = useState<Network>(() => initDigitNetwork());
	const [pixels, setPixels] = useState<number[]>(new Array(DIGIT_PIXELS).fill(0));
	const [fwd, setFwd] = useState<ForwardResult | null>(null);

	useEffect(() => {
		setFwd(forward(net, pixels));
	}, [pixels, net]);

	const prediction = fwd ? fwd.output.indexOf(Math.max(...fwd.output)) : -1;
	const confidence = fwd ? Math.max(...fwd.output) : 0;

	return (
		<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 my-6 items-start">
			<DigitCanvas onPixelsChange={setPixels} />

			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-4">
					<div
						className="w-16 h-16 rounded-xl flex items-center justify-center text-4xl font-bold border-2 transition-all"
						style={{
							borderColor: prediction >= 0 ? "#3b82f6" : "rgba(148,163,184,0.3)",
						}}
					>
						{prediction >= 0 ? prediction : "?"}
					</div>
					<div className="flex flex-col">
						<span className="text-sm text-muted-foreground">Predykcja</span>
						<span className="font-semibold text-lg">{prediction >= 0 ? `Cyfra ${prediction}` : "—"}</span>
						<span className="text-sm text-muted-foreground">Pewność: {(confidence * 100).toFixed(1)}%</span>
					</div>
				</div>

				{fwd && (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium text-muted-foreground mb-1">Aktywacje wyjściowe</span>
						{fwd.output.map((p, i) => (
							<div key={i} className="flex items-center gap-2">
								<span className="w-4 text-xs font-mono text-muted-foreground">{i}</span>
								<div className="flex-1 h-5 rounded overflow-hidden bg-muted relative">
									<div
										className="h-full transition-all duration-100"
										style={{
											width: `${p * 100}%`,
											background: i === prediction ? "#3b82f6" : "rgba(148,163,184,0.5)",
										}}
									/>
								</div>
								<span className="w-12 text-xs font-mono text-right">{(p * 100).toFixed(1)}%</span>
							</div>
						))}
					</div>
				)}

				{fwd &&
					[1, 2].map(
						(li) =>
							fwd.activations[li] && (
								<div key={li} className="flex flex-col gap-1">
									<span className="text-sm font-medium text-muted-foreground">
										Warstwa ukryta {li} ({fwd.activations[li].length})
									</span>
									<div className="flex flex-wrap gap-0.5">
										{fwd.activations[li].map((a, i) => (
											<div
												key={i}
												title={`n${i}: ${a.toFixed(3)}`}
												className="w-4 h-4 rounded-sm"
												style={{
													background: activationColor(Math.min(1, a)),
												}}
											/>
										))}
									</div>
								</div>
							),
					)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Weight + Activation viz — with receptive field overlay on 8×8 grid
// ─────────────────────────────────────────────────────────────────────────────

const GRID_CELL = 20; // px per 8×8 cell in weight map

function WeightGrid({
	weights,
	scale,
	title,
	pixels,
}: {
	weights: number[];
	scale?: number;
	title: string;
	pixels?: number[]; // if provided, show drawn pixels under weight overlay
}) {
	const cols = weights.length === DIGIT_PIXELS ? DIGIT_SIZE : Math.ceil(Math.sqrt(weights.length));
	const rows = Math.ceil(weights.length / cols);
	const W = cols * GRID_CELL;
	const H = rows * GRID_CELL;
	const sc = scale ?? Math.max(...weights.map(Math.abs), 0.01);

	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs text-muted-foreground">{title}</span>
			<svg width={W} height={H} style={{ imageRendering: "pixelated" }}>
				{/* drawn pixels as background (dim) */}
				{pixels &&
					pixels.map((p, i) => {
						const col = i % cols;
						const row = Math.floor(i / cols);
						const v = Math.round(p * 180);
						return (
							<rect
								key={`px${i}`}
								x={col * GRID_CELL}
								y={row * GRID_CELL}
								width={GRID_CELL}
								height={GRID_CELL}
								fill={`rgb(${v},${v},${v})`}
							/>
						);
					})}
				{/* weight colour overlay */}
				{weights.map((w, i) => {
					const col = i % cols;
					const row = Math.floor(i / cols);
					const v = w / sc; // [-1, 1]
					let fill: string;
					if (v >= 0) fill = `rgba(239,68,68,${Math.min(0.92, v * 0.85)})`;
					else fill = `rgba(59,130,246,${Math.min(0.92, -v * 0.85)})`;
					return (
						<rect key={i} x={col * GRID_CELL} y={row * GRID_CELL} width={GRID_CELL} height={GRID_CELL} fill={fill} />
					);
				})}
				{/* grid lines */}
				{Array.from({ length: cols + 1 }, (_, i) => (
					<line
						key={`v${i}`}
						x1={i * GRID_CELL}
						y1={0}
						x2={i * GRID_CELL}
						y2={H}
						stroke="rgba(0,0,0,0.2)"
						strokeWidth={0.5}
					/>
				))}
				{Array.from({ length: rows + 1 }, (_, i) => (
					<line
						key={`h${i}`}
						x1={0}
						y1={i * GRID_CELL}
						x2={W}
						y2={i * GRID_CELL}
						stroke="rgba(0,0,0,0.2)"
						strokeWidth={0.5}
					/>
				))}
			</svg>
			<div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
				<span>
					max+: {Math.max(...weights).toFixed(3)} #{weights.indexOf(Math.max(...weights))}
				</span>
				<span>
					max−: {Math.min(...weights).toFixed(3)} #{weights.indexOf(Math.min(...weights))}
				</span>
			</div>
		</div>
	);
}

export function WeightActivationViz() {
	const [net] = useState<Network>(() => initDigitNetwork());
	const [pixels, setPixels] = useState<number[]>(new Array(DIGIT_PIXELS).fill(0));
	const [fwd, setFwd] = useState<ForwardResult | null>(null);
	const [selectedNeuron, setSelectedNeuron] = useState<{
		layer: number;
		neuron: number;
	} | null>(null);

	useEffect(() => {
		setFwd(forward(net, pixels));
	}, [pixels, net]);

	const weightMap = useMemo(() => {
		if (!selectedNeuron) return null;
		const { layer, neuron } = selectedNeuron;
		if (layer >= 1 && layer <= 3) return net.layers[layer - 1]?.W[neuron] ?? null;
		return null;
	}, [selectedNeuron, net]);

	const activationVal = useMemo(() => {
		if (!selectedNeuron || !fwd) return null;
		return fwd.activations[selectedNeuron.layer]?.[selectedNeuron.neuron] ?? null;
	}, [selectedNeuron, fwd]);

	// For hidden layer 1: also compute "receptive field" = how much each input pixel
	// contributes to this neuron given the current drawing
	const receptiveField = useMemo(() => {
		if (!selectedNeuron || selectedNeuron.layer !== 1 || !weightMap) return null;
		// element-wise product: weight × input pixel
		return weightMap.map((w, i) => w * (pixels[i] ?? 0));
	}, [selectedNeuron, weightMap, pixels]);

	return (
		<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 my-6 items-start">
			<DigitCanvas onPixelsChange={setPixels} />

			<div className="flex flex-col gap-5">
				<p className="text-sm text-muted-foreground">
					Kliknij neuron, aby zobaczyć mapę wag i aktywacji. Dla warstwy H1 wyświetlany jest też{" "}
					<strong className="text-foreground">receptive field</strong> — iloczyn wag i aktualnych pikseli.
				</p>

				{/* Hidden layers */}
				{fwd &&
					[1, 2].map((li) => (
						<div key={li} className="flex flex-col gap-2">
							<span className="text-sm font-medium">
								Warstwa ukryta {li} ({net.topology[li]} neuronów)
							</span>
							<div className="flex flex-wrap gap-1">
								{fwd.activations[li].map((a, i) => {
									const isSel = selectedNeuron?.layer === li && selectedNeuron?.neuron === i;
									return (
										<button
											key={i}
											title={`n${i}: ${a.toFixed(3)}`}
											onClick={() => setSelectedNeuron(isSel ? null : { layer: li, neuron: i })}
											className="w-6 h-6 rounded border-2 transition-all"
											style={{
												background: activationColor(Math.min(1, a)),
												borderColor: isSel ? "#f8fafc" : "transparent",
											}}
										/>
									);
								})}
							</div>
						</div>
					))}

				{/* Output layer */}
				{fwd && (
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium">Warstwa wyjściowa (10 neuronów)</span>
						<div className="flex flex-wrap gap-1.5">
							{fwd.output.map((p, i) => {
								const isSel = selectedNeuron?.layer === 3 && selectedNeuron?.neuron === i;
								return (
									<button
										key={i}
										title={`Klasa ${i}: ${(p * 100).toFixed(1)}%`}
										onClick={() => setSelectedNeuron(isSel ? null : { layer: 3, neuron: i })}
										className="w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-bold transition-all"
										style={{
											background: activationColor(Math.min(1, p)),
											borderColor: isSel ? "#f8fafc" : "transparent",
											color: "rgba(0,0,0,0.7)",
										}}
									>
										{i}
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Weight / receptive field panels */}
				{selectedNeuron && weightMap && (
					<div className="rounded-md border border-border p-4 flex flex-col gap-4">
						<div>
							<span className="font-semibold text-sm">
								{selectedNeuron.layer === 3
									? `Wyjście cyfra ${selectedNeuron.neuron}`
									: `Warstwa H${selectedNeuron.layer}, neuron ${selectedNeuron.neuron}`}
							</span>
							{activationVal !== null && (
								<span className="ml-3 text-sm text-muted-foreground">
									aktywacja: <span className="font-mono font-semibold text-foreground">{activationVal.toFixed(4)}</span>
								</span>
							)}
						</div>

						<div className="flex flex-wrap gap-6">
							{/* Weight map */}
							<WeightGrid
								weights={weightMap}
								title={
									selectedNeuron.layer === 1
										? "Wagi wejściowe (przestrzeń 8×8)"
										: `Wagi od ${weightMap.length} neuronów poprzedniej warstwy`
								}
								pixels={selectedNeuron.layer === 1 ? pixels : undefined}
								scale={Math.max(...weightMap.map(Math.abs), 0.01)}
							/>

							{/* Receptive field (only H1) */}
							{receptiveField && (
								<WeightGrid
									weights={receptiveField}
									title="Receptive field (waga × piksel)"
									scale={Math.max(...receptiveField.map(Math.abs), 0.001)}
								/>
							)}
						</div>

						<p className="text-xs text-muted-foreground max-w-sm">
							🔴 waga pozytywna (aktywuje neuron) · 🔵 waga negatywna (hamuje).
							{selectedNeuron.layer === 1 &&
								" Receptive field pokazuje, które piksele aktualnego rysunku najbardziej wpływają na ten neuron."}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Softmax i pewność decyzji
// ─────────────────────────────────────────────────────────────────────────────

export function SoftmaxViz() {
	const [net] = useState<Network>(() => initDigitNetwork());
	const [pixels, setPixels] = useState<number[]>(new Array(DIGIT_PIXELS).fill(0));
	const [fwd, setFwd] = useState<ForwardResult | null>(null);
	const [temperature, setTemperature] = useState(1.0);

	useEffect(() => {
		setFwd(forward(net, pixels));
	}, [pixels, net]);

	const logits = fwd?.logits ?? new Array(10).fill(0);
	const probs = useMemo(() => softmaxTemp(logits, temperature), [logits, temperature]);
	const prediction = probs.indexOf(Math.max(...probs));

	const BAR_W = 28;
	const BAR_MAX_H = 140;
	const GAP = 6;
	const SVG_W = 10 * (BAR_W + GAP) + GAP;
	const SVG_H = BAR_MAX_H + 52;

	const minL = Math.min(...logits);
	const maxL = Math.max(...logits);
	const logitRange = maxL - minL || 1;

	return (
		<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 my-6 items-start">
			<DigitCanvas onPixelsChange={setPixels} />

			<div className="flex flex-col gap-5">
				<div className="flex items-center gap-4 max-w-xs">
					<Label className="whitespace-nowrap text-sm">
						Temperatura: <span className="font-mono font-semibold">{temperature.toFixed(2)}</span>
					</Label>
					<Slider
						value={[temperature]}
						onValueChange={(v) => setTemperature(v[0])}
						min={0.1}
						max={5}
						step={0.05}
						className="flex-1"
					/>
				</div>
				<p className="text-xs text-muted-foreground max-w-sm">
					T&lt;1 → rozkład ostry (pewny). T&gt;1 → płaski (niepewny). T→0 → argmax.
				</p>

				<svg width={SVG_W} height={SVG_H} className="overflow-visible">
					{logits.map((logit, i) => {
						const prob = probs[i];
						const barH = Math.max(prob * BAR_MAX_H, 2);
						const logitH = ((logit - minL) / logitRange) * (BAR_MAX_H * 0.55);
						const x = GAP + i * (BAR_W + GAP);
						const isTop = i === prediction;

						return (
							<g key={i}>
								<rect
									x={x + BAR_W * 0.2}
									y={BAR_MAX_H - logitH}
									width={BAR_W * 0.6}
									height={Math.max(logitH, 2)}
									fill="rgba(148,163,184,0.2)"
									rx={2}
								/>
								<rect
									x={x}
									y={BAR_MAX_H - barH}
									width={BAR_W}
									height={barH}
									fill={isTop ? "#3b82f6" : "rgba(148,163,184,0.45)"}
									rx={3}
								/>
								<text
									x={x + BAR_W / 2}
									y={BAR_MAX_H + 14}
									textAnchor="middle"
									fontSize={12}
									fill="currentColor"
									fontFamily="monospace"
									opacity={0.8}
								>
									{i}
								</text>
								<text
									x={x + BAR_W / 2}
									y={BAR_MAX_H - barH - 3}
									textAnchor="middle"
									fontSize={9}
									fill="currentColor"
									fontFamily="monospace"
									opacity={0.7}
								>
									{(prob * 100).toFixed(0)}%
								</text>
								<text
									x={x + BAR_W / 2}
									y={SVG_H - 2}
									textAnchor="middle"
									fontSize={8}
									fill="rgba(148,163,184,0.7)"
									fontFamily="monospace"
								>
									{logit.toFixed(1)}
								</text>
							</g>
						);
					})}
					<rect x={0} y={BAR_MAX_H + 22} width={10} height={6} fill="rgba(148,163,184,0.2)" rx={1} />
					<text x={14} y={BAR_MAX_H + 29} fontSize={9} fill="rgba(148,163,184,0.8)" fontFamily="monospace">
						logit
					</text>
					<rect x={46} y={BAR_MAX_H + 22} width={10} height={6} fill="#3b82f6" rx={1} />
					<text x={60} y={BAR_MAX_H + 29} fontSize={9} fill="rgba(148,163,184,0.8)" fontFamily="monospace">
						softmax
					</text>
				</svg>

				{(() => {
					const entropy = -probs.reduce((s, p) => s + (p > 1e-12 ? p * Math.log2(p) : 0), 0);
					const maxH = Math.log2(10);
					return (
						<div className="flex flex-col gap-1 text-sm max-w-xs">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Entropia Shannona</span>
								<span className="font-mono font-semibold">{entropy.toFixed(3)} bit</span>
							</div>
							<div className="w-full h-2 bg-muted rounded overflow-hidden">
								<div className="h-full bg-amber-400 transition-all" style={{ width: `${(entropy / maxH) * 100}%` }} />
							</div>
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>0 (pewny)</span>
								<span>{maxH.toFixed(2)} bit (max)</span>
							</div>
							<div className="flex justify-between mt-1">
								<span className="text-muted-foreground">Predykcja</span>
								<span className="font-semibold">
									cyfra {prediction} ({(probs[prediction] * 100).toFixed(1)}%)
								</span>
							</div>
						</div>
					);
				})()}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export type NNType = "mlp-topology" | "digit-recognizer" | "weight-viz" | "softmax-viz";

export function NeuralNetwork({ type }: { type: NNType }) {
	if (type === "mlp-topology") return <MLPTopology />;
	if (type === "digit-recognizer") return <DigitRecognizer />;
	if (type === "weight-viz") return <WeightActivationViz />;
	if (type === "softmax-viz") return <SoftmaxViz />;
	return null;
}
