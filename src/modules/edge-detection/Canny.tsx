"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Upload } from "lucide-react";
import { ChangeEvent, createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

const CANVAS_SIZE = 400;

const DEFAULT_PRESETS: PresetImage[] = [
	{ id: "preset-a", label: "Zdjęcie 1", src: "/stock/test_img_1.jpg" },
	{ id: "preset-b", label: "Zdjęcie 2", src: "/stock/test_img_3.jpg" },
];

type SourceId = "preset-a" | "preset-b" | "upload";

type PresetImage = {
	id: "preset-a" | "preset-b";
	label: string;
	src: string;
};

type CannyContextType = {
	presets: PresetImage[];
	selectedSourceId: SourceId;
	setSelectedSourceId: (value: SourceId) => void;
	uploadedImageUrl: string | null;
	handleUpload: (event: ChangeEvent<HTMLInputElement>) => void;
	openUploadDialog: () => void;
	sourcePreviewUrl: string | null;
	edgesPreviewUrl: string | null;
	lowerThreshold: number;
	upperThreshold: number;
	setLowerThreshold: (value: number) => void;
	setUpperThreshold: (value: number) => void;
	isProcessing: boolean;
};

const CannyContext = createContext<CannyContextType | undefined>(undefined);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Unable to load source image"));
		img.src = src;
	});

const drawCenteredSquareImage = (image: HTMLImageElement, canvas: HTMLCanvasElement) => {
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Unable to create canvas context");
	}

	const size = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
	const sx = Math.floor(((image.naturalWidth || image.width) - size) / 2);
	const sy = Math.floor(((image.naturalHeight || image.height) - size) / 2);

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(image, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
};

const gaussianBlur3x3 = (input: Float32Array, width: number, height: number) => {
	const output = new Float32Array(width * height);
	const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];

	for (let y = 1; y < height - 1; y += 1) {
		for (let x = 1; x < width - 1; x += 1) {
			let sum = 0;
			let k = 0;
			for (let ky = -1; ky <= 1; ky += 1) {
				for (let kx = -1; kx <= 1; kx += 1) {
					const idx = (y + ky) * width + (x + kx);
					sum += input[idx] * kernel[k];
					k += 1;
				}
			}
			output[y * width + x] = sum / 16;
		}
	}

	return output;
};

const computeCannyOutputs = async (src: string, lowerThreshold: number, upperThreshold: number) => {
	const image = await loadImage(src);

	const sourceCanvas = document.createElement("canvas");
	sourceCanvas.width = CANVAS_SIZE;
	sourceCanvas.height = CANVAS_SIZE;
	drawCenteredSquareImage(image, sourceCanvas);

	const sourceCtx = sourceCanvas.getContext("2d");
	if (!sourceCtx) {
		throw new Error("Unable to create source canvas context");
	}

	const sourceData = sourceCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
	const gray = new Float32Array(CANVAS_SIZE * CANVAS_SIZE);

	for (let i = 0; i < sourceData.data.length; i += 4) {
		const r = sourceData.data[i];
		const g = sourceData.data[i + 1];
		const b = sourceData.data[i + 2];
		gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
	}

	const blurred = gaussianBlur3x3(gray, CANVAS_SIZE, CANVAS_SIZE);
	const magnitude = new Float32Array(CANVAS_SIZE * CANVAS_SIZE);
	const direction = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);

	for (let y = 1; y < CANVAS_SIZE - 1; y += 1) {
		for (let x = 1; x < CANVAS_SIZE - 1; x += 1) {
			const idx = y * CANVAS_SIZE + x;
			const p00 = blurred[idx - CANVAS_SIZE - 1];
			const p01 = blurred[idx - CANVAS_SIZE];
			const p02 = blurred[idx - CANVAS_SIZE + 1];
			const p10 = blurred[idx - 1];
			const p12 = blurred[idx + 1];
			const p20 = blurred[idx + CANVAS_SIZE - 1];
			const p21 = blurred[idx + CANVAS_SIZE];
			const p22 = blurred[idx + CANVAS_SIZE + 1];

			const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
			const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

			magnitude[idx] = Math.hypot(gx, gy);

			const angle = (Math.atan2(gy, gx) * 180) / Math.PI;
			const normalizedAngle = (((angle + 180) % 180) + 180) % 180;
			if ((normalizedAngle >= 0 && normalizedAngle < 22.5) || normalizedAngle >= 157.5) {
				direction[idx] = 0;
			} else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
				direction[idx] = 1;
			} else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
				direction[idx] = 2;
			} else {
				direction[idx] = 3;
			}
		}
	}

	const nms = new Float32Array(CANVAS_SIZE * CANVAS_SIZE);
	for (let y = 1; y < CANVAS_SIZE - 1; y += 1) {
		for (let x = 1; x < CANVAS_SIZE - 1; x += 1) {
			const idx = y * CANVAS_SIZE + x;
			const current = magnitude[idx];

			let neighborA = 0;
			let neighborB = 0;
			const angleClass = direction[idx];

			if (angleClass === 0) {
				neighborA = magnitude[idx - 1];
				neighborB = magnitude[idx + 1];
			} else if (angleClass === 1) {
				neighborA = magnitude[idx - CANVAS_SIZE + 1];
				neighborB = magnitude[idx + CANVAS_SIZE - 1];
			} else if (angleClass === 2) {
				neighborA = magnitude[idx - CANVAS_SIZE];
				neighborB = magnitude[idx + CANVAS_SIZE];
			} else {
				neighborA = magnitude[idx - CANVAS_SIZE - 1];
				neighborB = magnitude[idx + CANVAS_SIZE + 1];
			}

			nms[idx] = current >= neighborA && current >= neighborB ? current : 0;
		}
	}

	const low = Math.min(lowerThreshold, upperThreshold);
	const high = Math.max(lowerThreshold, upperThreshold);
	const classified = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);

	for (let i = 0; i < nms.length; i += 1) {
		const value = nms[i];
		if (value >= high) {
			classified[i] = 2;
		} else if (value >= low) {
			classified[i] = 1;
		}
	}

	const stack: number[] = [];
	for (let y = 1; y < CANVAS_SIZE - 1; y += 1) {
		for (let x = 1; x < CANVAS_SIZE - 1; x += 1) {
			const idx = y * CANVAS_SIZE + x;
			if (classified[idx] === 2) {
				stack.push(idx);
			}
		}
	}

	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) {
			continue;
		}

		const y = Math.floor(current / CANVAS_SIZE);
		const x = current % CANVAS_SIZE;

		for (let ny = -1; ny <= 1; ny += 1) {
			for (let nx = -1; nx <= 1; nx += 1) {
				if (nx === 0 && ny === 0) {
					continue;
				}
				const px = x + nx;
				const py = y + ny;
				if (px < 1 || py < 1 || px >= CANVAS_SIZE - 1 || py >= CANVAS_SIZE - 1) {
					continue;
				}
				const neighbor = py * CANVAS_SIZE + px;
				if (classified[neighbor] === 1) {
					classified[neighbor] = 2;
					stack.push(neighbor);
				}
			}
		}
	}

	const edgesCanvas = document.createElement("canvas");
	edgesCanvas.width = CANVAS_SIZE;
	edgesCanvas.height = CANVAS_SIZE;
	const edgesCtx = edgesCanvas.getContext("2d");
	if (!edgesCtx) {
		throw new Error("Unable to create output canvas context");
	}

	const edgeImage = edgesCtx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
	for (let i = 0; i < classified.length; i += 1) {
		const edge = classified[i] === 2 ? 255 : 0;
		const offset = i * 4;
		edgeImage.data[offset] = edge;
		edgeImage.data[offset + 1] = edge;
		edgeImage.data[offset + 2] = edge;
		edgeImage.data[offset + 3] = 255;
	}

	edgesCtx.putImageData(edgeImage, 0, 0);

	return {
		sourceUrl: sourceCanvas.toDataURL("image/png"),
		edgesUrl: edgesCanvas.toDataURL("image/png"),
	};
};

export function CannyProvider({ children }: { children: ReactNode }) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const presets = DEFAULT_PRESETS;
	const [selectedSourceId, setSelectedSourceId] = useState<SourceId>("preset-a");
	const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
	const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
	const [edgesPreviewUrl, setEdgesPreviewUrl] = useState<string | null>(null);
	const [lowerThreshold, setLowerThresholdState] = useState(60);
	const [upperThreshold, setUpperThresholdState] = useState(140);
	const [isProcessing, setIsProcessing] = useState(false);

	const sourceUrl = useMemo(() => {
		if (selectedSourceId === "upload" && uploadedImageUrl) {
			return uploadedImageUrl;
		}

		const fallbackId = selectedSourceId === "upload" ? "preset-a" : selectedSourceId;
		return presets.find((preset) => preset.id === fallbackId)?.src ?? null;
	}, [presets, selectedSourceId, uploadedImageUrl]);

	const setLowerThreshold = (value: number) => {
		const nextLower = clamp(Math.round(value), 0, 255);
		setLowerThresholdState(nextLower);
		setUpperThresholdState((prevUpper) => Math.max(prevUpper, nextLower));
	};

	const setUpperThreshold = (value: number) => {
		const nextUpper = clamp(Math.round(value), 0, 255);
		setUpperThresholdState(nextUpper);
		setLowerThresholdState((prevLower) => Math.min(prevLower, nextUpper));
	};

	useEffect(() => {
		if (!uploadedImageUrl) {
			return;
		}

		return () => {
			URL.revokeObjectURL(uploadedImageUrl);
		};
	}, [uploadedImageUrl]);

	useEffect(() => {
		let cancelled = false;

		const process = async () => {
			if (!sourceUrl) {
				setSourcePreviewUrl(null);
				setEdgesPreviewUrl(null);
				return;
			}

			setIsProcessing(true);
			try {
				const outputs = await computeCannyOutputs(sourceUrl, lowerThreshold, upperThreshold);
				if (cancelled) {
					return;
				}
				setSourcePreviewUrl(outputs.sourceUrl);
				setEdgesPreviewUrl(outputs.edgesUrl);
			} catch {
				if (!cancelled) {
					setSourcePreviewUrl(null);
					setEdgesPreviewUrl(null);
				}
			} finally {
				if (!cancelled) {
					setIsProcessing(false);
				}
			}
		};

		process();

		return () => {
			cancelled = true;
		};
	}, [sourceUrl, lowerThreshold, upperThreshold]);

	const openUploadDialog = () => {
		fileInputRef.current?.click();
	};

	const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file || !file.type.startsWith("image/")) {
			return;
		}

		setUploadedImageUrl((previous) => {
			if (previous) {
				URL.revokeObjectURL(previous);
			}
			return URL.createObjectURL(file);
		});
		setSelectedSourceId("upload");
		event.target.value = "";
	};

	return (
		<CannyContext.Provider
			value={{
				presets,
				selectedSourceId,
				setSelectedSourceId,
				uploadedImageUrl,
				handleUpload,
				openUploadDialog,
				sourcePreviewUrl,
				edgesPreviewUrl,
				lowerThreshold,
				upperThreshold,
				setLowerThreshold,
				setUpperThreshold,
				isProcessing,
			}}
		>
			<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
			{children}
		</CannyContext.Provider>
	);
}

export function useCanny() {
	const context = useContext(CannyContext);
	if (!context) {
		throw new Error("useCanny must be used within CannyProvider");
	}
	return context;
}

export function Canny() {
	const {
		presets,
		selectedSourceId,
		setSelectedSourceId,
		uploadedImageUrl,
		openUploadDialog,
		sourcePreviewUrl,
		edgesPreviewUrl,
		lowerThreshold,
		upperThreshold,
		setLowerThreshold,
		setUpperThreshold,
		isProcessing,
	} = useCanny();

	return (
		<div className="grid grid-cols-1 gap-4 my-6 items-center lg:grid-cols-2">
			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="flex flex-row justify-center gap-2 flex-wrap">
					<ToggleGroup
						type="single"
						variant="outline"
						spacing={2}
						value={selectedSourceId}
						onValueChange={(value) => {
							if (value === "preset-a" || value === "preset-b") {
								setSelectedSourceId(value);
							}
							if (value === "upload" && uploadedImageUrl) {
								setSelectedSourceId("upload");
							}
						}}
					>
						{presets.map((preset) => (
							<ToggleGroupItem key={preset.id} value={preset.id}>
								{preset.label}
							</ToggleGroupItem>
						))}
						{uploadedImageUrl && <ToggleGroupItem value="upload">Upload</ToggleGroupItem>}
					</ToggleGroup>
					<Button variant="outline" onClick={openUploadDialog}>
						Upload
						<Upload />
					</Button>
				</div>

				<div className="flex-1 relative flex items-center justify-center min-h-0">
					<div className="relative w-auto h-full aspect-square">
						{sourcePreviewUrl ? (
							<img
								src={sourcePreviewUrl}
								alt="Input preview"
								className="w-full h-full object-cover bg-card rounded-md border border-border"
							/>
						) : (
							<div className="w-full h-full bg-card rounded-md border border-border flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
								Load a source image to preview input.
							</div>
						)}
						{isProcessing && (
							<div className="absolute inset-0 bg-background/60 rounded-md border border-border flex items-center justify-center text-sm font-medium">
								Processing Canny...
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="flex flex-row justify-center gap-2">
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="speed-slider">Próg</Label>
							<span className="text-muted-foreground text-sm">
								{lowerThreshold}-{upperThreshold}
							</span>
						</div>
						<Slider
							min={0}
							max={255}
							step={1}
							value={[lowerThreshold, upperThreshold]}
							onValueChange={(values) => {
								const nextValueLow = values[0];
								const nextValueHigh = values[1];
								if (nextValueLow !== undefined) {
									setLowerThreshold(nextValueLow);
								}
								if (nextValueHigh !== undefined) {
									setUpperThreshold(nextValueHigh);
								}
							}}
						/>
					</div>
				</div>
				<div className="flex-1 relative flex items-center justify-center min-h-0">
					<div className="relative w-auto h-full aspect-square">
						{edgesPreviewUrl ? (
							<img
								src={edgesPreviewUrl}
								alt="Canny edge map"
								className="w-full h-full object-cover bg-card rounded-md border border-border"
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground px-3 text-center">
								No Canny result yet.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
