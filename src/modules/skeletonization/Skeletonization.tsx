"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SkeletonizationProps = {
	type: "basic";
};

type AlgorithmType = "thinning" | "distance";

type AnimationFrame =
	| {
			kind: "binary";
			mask: Uint8Array;
	  }
	| {
			kind: "distance";
			intensity: Uint8Array;
	  };

const CANVAS_SIZE = 400;

const indexAt = (x: number, y: number, width: number) => y * width + x;

const getNeighbors = (mask: Uint8Array, x: number, y: number, width: number, height: number) => {
	const p2 = y > 0 ? mask[indexAt(x, y - 1, width)] : 0;
	const p3 = y > 0 && x < width - 1 ? mask[indexAt(x + 1, y - 1, width)] : 0;
	const p4 = x < width - 1 ? mask[indexAt(x + 1, y, width)] : 0;
	const p5 = y < height - 1 && x < width - 1 ? mask[indexAt(x + 1, y + 1, width)] : 0;
	const p6 = y < height - 1 ? mask[indexAt(x, y + 1, width)] : 0;
	const p7 = y < height - 1 && x > 0 ? mask[indexAt(x - 1, y + 1, width)] : 0;
	const p8 = x > 0 ? mask[indexAt(x - 1, y, width)] : 0;
	const p9 = y > 0 && x > 0 ? mask[indexAt(x - 1, y - 1, width)] : 0;

	return [p2, p3, p4, p5, p6, p7, p8, p9] as const;
};

const transitionsCount = (neighbors: readonly number[]) => {
	let transitions = 0;
	for (let i = 0; i < neighbors.length; i += 1) {
		const current = neighbors[i];
		const next = neighbors[(i + 1) % neighbors.length];
		if (current === 0 && next === 1) {
			transitions += 1;
		}
	}
	return transitions;
};

const countOnes = (neighbors: readonly number[]) => {
	let count = 0;
	for (const value of neighbors) {
		count += value;
	}
	return count;
};

const zhangSuenStep = (inputMask: Uint8Array, width: number, height: number) => {
	const mask = new Uint8Array(inputMask);
	let changed = false;

	const subIteration = (isFirst: boolean) => {
		const toDelete: number[] = [];

		for (let y = 1; y < height - 1; y += 1) {
			for (let x = 1; x < width - 1; x += 1) {
				const idx = indexAt(x, y, width);
				if (mask[idx] === 0) {
					continue;
				}

				const [p2, p3, p4, p5, p6, p7, p8, p9] = getNeighbors(mask, x, y, width, height);
				const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9];
				const ones = countOnes(neighbors);
				if (ones < 2 || ones > 6) {
					continue;
				}

				const transitions = transitionsCount(neighbors);
				if (transitions !== 1) {
					continue;
				}

				const ruleA = isFirst ? p2 * p4 * p6 === 0 : p2 * p4 * p8 === 0;
				const ruleB = isFirst ? p4 * p6 * p8 === 0 : p2 * p6 * p8 === 0;

				if (ruleA && ruleB) {
					toDelete.push(idx);
				}
			}
		}

		for (const idx of toDelete) {
			if (mask[idx] === 1) {
				mask[idx] = 0;
				changed = true;
			}
		}
	};

	subIteration(true);
	subIteration(false);

	return { mask, changed };
};

const isBoundaryPixel = (mask: Uint8Array, x: number, y: number, width: number, height: number) => {
	if (mask[indexAt(x, y, width)] === 0) {
		return false;
	}

	const neighbors = [
		[x, y - 1],
		[x + 1, y],
		[x, y + 1],
		[x - 1, y],
	] as const;

	for (const [nx, ny] of neighbors) {
		if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
			return true;
		}
		if (mask[indexAt(nx, ny, width)] === 0) {
			return true;
		}
	}

	return false;
};

const computeDistanceTransform = (mask: Uint8Array, width: number, height: number) => {
	const total = width * height;
	const distances = new Int16Array(total);
	distances.fill(-1);

	const queue = new Int32Array(total);
	let head = 0;
	let tail = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const idx = indexAt(x, y, width);
			if (mask[idx] === 1 && isBoundaryPixel(mask, x, y, width, height)) {
				distances[idx] = 0;
				queue[tail] = idx;
				tail += 1;
			}
		}
	}

	const offsets = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0],
	] as const;

	while (head < tail) {
		const idx = queue[head];
		head += 1;
		const x = idx % width;
		const y = Math.floor(idx / width);

		for (const [dx, dy] of offsets) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
				continue;
			}

			const nIdx = indexAt(nx, ny, width);
			if (mask[nIdx] === 0 || distances[nIdx] !== -1) {
				continue;
			}

			distances[nIdx] = distances[idx] + 1;
			queue[tail] = nIdx;
			tail += 1;
		}
	}

	let maxDistance = 0;
	for (let i = 0; i < total; i += 1) {
		if (distances[i] > maxDistance) {
			maxDistance = distances[i];
		}
	}

	return { distances, maxDistance };
};

const distanceTransformSkeleton = (mask: Uint8Array, distances: Int16Array, width: number, height: number) => {
	const skeleton = new Uint8Array(mask.length);

	for (let y = 1; y < height - 1; y += 1) {
		for (let x = 1; x < width - 1; x += 1) {
			const idx = indexAt(x, y, width);
			if (mask[idx] === 0 || distances[idx] < 0) {
				continue;
			}

			const center = distances[idx];
			let hasGreaterNeighbor = false;
			let lowerNeighbors = 0;

			for (let oy = -1; oy <= 1; oy += 1) {
				for (let ox = -1; ox <= 1; ox += 1) {
					if (ox === 0 && oy === 0) {
						continue;
					}

					const neighborIdx = indexAt(x + ox, y + oy, width);
					if (mask[neighborIdx] === 0 || distances[neighborIdx] < 0) {
						continue;
					}

					if (distances[neighborIdx] > center) {
						hasGreaterNeighbor = true;
					}
					if (distances[neighborIdx] < center) {
						lowerNeighbors += 1;
					}
				}
			}

			if (!hasGreaterNeighbor && (center > 0 || lowerNeighbors >= 2)) {
				skeleton[idx] = 1;
			}
		}
	}

	return skeleton;
};

const createDistanceTransformFrames = (initialMask: Uint8Array, width: number, height: number): AnimationFrame[] => {
	const { distances, maxDistance } = computeDistanceTransform(initialMask, width, height);
	const frames: AnimationFrame[] = [
		{
			kind: "binary",
			mask: new Uint8Array(initialMask),
		},
	];

	const maxForScale = Math.max(1, maxDistance);

	for (let level = 0; level <= maxDistance; level += 1) {
		const intensity = new Uint8Array(initialMask.length);
		for (let i = 0; i < initialMask.length; i += 1) {
			if (initialMask[i] === 0 || distances[i] < 0 || distances[i] > level) {
				continue;
			}

			const normalized = distances[i] / maxForScale;
			intensity[i] = Math.round(40 + normalized * 215);
		}

		frames.push({
			kind: "distance",
			intensity,
		});
	}

	const skeleton = distanceTransformSkeleton(initialMask, distances, width, height);
	const hasSkeleton = skeleton.some((value) => value === 1);
	if (hasSkeleton) {
		frames.push({
			kind: "binary",
			mask: skeleton,
		});
	}

	return frames;
};

const createFrames = (
	initialMask: Uint8Array,
	width: number,
	height: number,
	algorithm: AlgorithmType,
): AnimationFrame[] => {
	if (algorithm === "distance") {
		return createDistanceTransformFrames(initialMask, width, height);
	}

	const frames: AnimationFrame[] = [
		{
			kind: "binary",
			mask: new Uint8Array(initialMask),
		},
	];
	let current = new Uint8Array(initialMask);

	for (let step = 0; step < 120; step += 1) {
		const result = zhangSuenStep(current, width, height);
		if (!result.changed) {
			break;
		}
		frames.push({
			kind: "binary",
			mask: new Uint8Array(result.mask),
		});
		current = result.mask;
	}

	return frames;
};

export function Skeletonization({ type }: SkeletonizationProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const isDrawingRef = useRef(false);
	const lastPointRef = useRef<{ x: number; y: number } | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const framesRef = useRef<AnimationFrame[]>([]);
	const sourceMaskRef = useRef<Uint8Array | null>(null);

	const [isAnimating, setIsAnimating] = useState(false);
	const [algorithm, setAlgorithm] = useState<AlgorithmType>("thinning");
	const [brushSize, setBrushSize] = useState(8);
	const [speed, setSpeed] = useState(0.5);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [frameCount, setFrameCount] = useState(0);
	const [drawColor, setDrawColor] = useState("#ffffff");

	const delay = useMemo(() => Math.round(40 + (1 - speed) * 500), [speed]);

	useEffect(() => {
		if (type !== "basic") {
			return;
		}

		const updateColor = () => {
			const foreground = getComputedStyle(document.documentElement).getPropertyValue("--color-foreground").trim();
			if (foreground.length > 0) {
				setDrawColor(foreground);
			}
		};

		updateColor();

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes" && mutation.attributeName === "class") {
					updateColor();
				}
			}
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			observer.disconnect();
		};
	}, [type]);

	const getContext = () => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return null;
		}
		return canvas.getContext("2d");
	};

	const clearAnimationInterval = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	};

	const renderMask = (mask: Uint8Array) => {
		const ctx = getContext();
		if (!ctx) {
			return;
		}

		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		ctx.fillStyle = drawColor;
		for (let y = 0; y < CANVAS_SIZE; y += 1) {
			for (let x = 0; x < CANVAS_SIZE; x += 1) {
				if (mask[indexAt(x, y, CANVAS_SIZE)] === 1) {
					ctx.fillRect(x, y, 1, 1);
				}
			}
		}
	};

	const renderDistance = (intensity: Uint8Array) => {
		const ctx = getContext();
		if (!ctx) {
			return;
		}

		const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
		for (let i = 0; i < intensity.length; i += 1) {
			const value = intensity[i];
			const offset = i * 4;
			imageData.data[offset] = value;
			imageData.data[offset + 1] = value;
			imageData.data[offset + 2] = value;
			imageData.data[offset + 3] = value === 0 ? 0 : 255;
		}

		ctx.putImageData(imageData, 0, 0);
	};

	const renderFrame = (frame: AnimationFrame) => {
		if (frame.kind === "binary") {
			renderMask(frame.mask);
			return;
		}

		renderDistance(frame.intensity);
	};

	const extractMask = () => {
		const ctx = getContext();
		if (!ctx) {
			return null;
		}

		const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		const mask = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
		for (let i = 0; i < imageData.data.length; i += 4) {
			mask[i / 4] = imageData.data[i + 3] > 20 ? 1 : 0;
		}

		return mask;
	};

	const stopAnimation = () => {
		setIsAnimating(false);
		clearAnimationInterval();
	};

	const resetToSource = () => {
		stopAnimation();
		if (!sourceMaskRef.current) {
			return;
		}
		renderMask(sourceMaskRef.current);
		setCurrentFrame(0);
	};

	const clearCanvas = () => {
		stopAnimation();
		const ctx = getContext();
		if (!ctx) {
			return;
		}
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		framesRef.current = [];
		sourceMaskRef.current = null;
		setCurrentFrame(0);
		setFrameCount(0);
	};

	const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE;
		const y = ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE;
		return { x, y };
	};

	const drawSegment = (start: { x: number; y: number }, end: { x: number; y: number }) => {
		const ctx = getContext();
		if (!ctx) {
			return;
		}

		ctx.strokeStyle = drawColor;
		ctx.lineWidth = brushSize;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	};

	const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (isAnimating) {
			return;
		}

		event.currentTarget.setPointerCapture(event.pointerId);
		const point = pointerPosition(event);
		isDrawingRef.current = true;
		lastPointRef.current = point;
		drawSegment(point, point);
	};

	const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (!isDrawingRef.current || isAnimating) {
			return;
		}

		const point = pointerPosition(event);
		if (!lastPointRef.current) {
			lastPointRef.current = point;
			return;
		}

		drawSegment(lastPointRef.current, point);
		lastPointRef.current = point;
	};

	const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		isDrawingRef.current = false;
		lastPointRef.current = null;
	};

	const buildAndPlayAnimation = () => {
		const initialMask = extractMask();
		if (!initialMask) {
			return;
		}

		const hasForeground = initialMask.some((value) => value === 1);
		if (!hasForeground) {
			stopAnimation();
			setCurrentFrame(0);
			setFrameCount(0);
			return;
		}

		sourceMaskRef.current = new Uint8Array(initialMask);
		const frames = createFrames(initialMask, CANVAS_SIZE, CANVAS_SIZE, algorithm);
		framesRef.current = frames;
		setFrameCount(frames.length);
		setCurrentFrame(0);
		renderFrame(frames[0]);

		if (frames.length <= 1) {
			setIsAnimating(false);
			return;
		}

		setIsAnimating(true);
		let frameIndex = 0;
		clearAnimationInterval();
		intervalRef.current = setInterval(() => {
			frameIndex += 1;
			if (frameIndex >= frames.length) {
				clearAnimationInterval();
				setIsAnimating(false);
				setCurrentFrame(frames.length - 1);
				return;
			}

			renderFrame(frames[frameIndex]);
			setCurrentFrame(frameIndex);
		}, delay);
	};

	useEffect(() => {
		return () => {
			clearAnimationInterval();
		};
	}, []);

	if (type !== "basic") {
		return null;
	}

	return (
		<div className="grid grid-cols-2 gap-4 my-6">
			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="flex flex-row justify-center gap-2">
					<ToggleGroup
						type="single"
						variant="outline"
						spacing={2}
						value={algorithm}
						onValueChange={(value) => {
							if (value === "thinning" || value === "distance") {
								setAlgorithm(value);
							}
						}}
					>
						<ToggleGroupItem value="thinning">Thinning</ToggleGroupItem>
						<ToggleGroupItem value="distance">Distance Transform</ToggleGroupItem>
					</ToggleGroup>
					<Button variant="outline" size="icon" onClick={clearCanvas}>
						<Trash2 />
					</Button>
					<Button size="icon" onClick={buildAndPlayAnimation} disabled={isAnimating}>
						<Play />
					</Button>
					<Button variant="outline" size="icon" onClick={stopAnimation} disabled={!isAnimating}>
						<Pause />
					</Button>
					<Button variant="outline" size="icon" onClick={resetToSource}>
						<RotateCcw />
					</Button>
				</div>

				<div className="flex-1 relative flex items-center justify-center min-h-0">
					<canvas
						ref={canvasRef}
						width={CANVAS_SIZE}
						height={CANVAS_SIZE}
						className="w-auto h-full aspect-square bg-card rounded-md border border-border cursor-crosshair"
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerLeave={onPointerUp}
					/>
				</div>
			</div>

			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="mx-auto grid w-full max-w-xs gap-2">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor="brush-slider">Brush size</Label>
						<span className="text-muted-foreground text-sm">{brushSize.toFixed(0)}</span>
					</div>
					<Slider
						id="brush-slider"
						value={[brushSize]}
						onValueChange={(value) => setBrushSize(value[0])}
						min={1}
						max={24}
						step={1}
					/>
				</div>

				<div className="mx-auto grid w-full max-w-xs gap-2">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor="speed-slider">Animation speed</Label>
						<span className="text-muted-foreground text-sm">{speed.toFixed(2)}</span>
					</div>
					<Slider
						id="speed-slider"
						value={[speed]}
						onValueChange={(value) => setSpeed(value[0])}
						min={0}
						max={1}
						step={0.01}
					/>
				</div>

				<div className="mx-auto grid w-full max-w-xs gap-1 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Status</span>
						<span>{isAnimating ? "Animating" : "Idle"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Algorithm</span>
						<span className="capitalize">{algorithm}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Frame</span>
						<span>
							{frameCount === 0 ? 0 : currentFrame + 1}/{frameCount}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Delay</span>
						<span>{delay} ms</span>
					</div>
				</div>
			</div>
		</div>
	);
}
