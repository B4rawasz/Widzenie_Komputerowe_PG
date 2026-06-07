"use client";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Upload } from "lucide-react";
import { ChangeEvent, createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

const CANVAS_SIZE = 400;

const DEFAULT_PRESETS: PresetImage[] = [
	{ id: "preset-a", label: "Zdjęcie 1", src: "/stock/test_img_1.jpg" },
	{ id: "preset-b", label: "Zdjęcie 2", src: "/stock/test_img_2.jpg" },
];

type PresetImage = {
	id: "preset-a" | "preset-b";
	label: string;
	src: string;
};

type SobelContextType = {
	presets: PresetImage[];
	selectedSourceId: "preset-a" | "preset-b" | "upload";
	setSelectedSourceId: (value: "preset-a" | "preset-b" | "upload") => void;
	uploadedImageUrl: string | null;
	handleUpload: (event: ChangeEvent<HTMLInputElement>) => void;
	openUploadDialog: () => void;
	sourcePreviewUrl: string | null;
	magnitudePreviewUrl: string | null;
	directionPreviewUrl: string | null;
	isProcessing: boolean;
};

const SobelContext = createContext<SobelContextType | undefined>(undefined);

const hsvToRgb = (h: number, s: number, v: number) => {
	const c = v * s;
	const hh = h / 60;
	const x = c * (1 - Math.abs((hh % 2) - 1));

	let r = 0;
	let g = 0;
	let b = 0;

	if (hh >= 0 && hh < 1) {
		r = c;
		g = x;
	} else if (hh >= 1 && hh < 2) {
		r = x;
		g = c;
	} else if (hh >= 2 && hh < 3) {
		g = c;
		b = x;
	} else if (hh >= 3 && hh < 4) {
		g = x;
		b = c;
	} else if (hh >= 4 && hh < 5) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}

	const m = v - c;
	return {
		r: Math.round((r + m) * 255),
		g: Math.round((g + m) * 255),
		b: Math.round((b + m) * 255),
	};
};

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

const computeSobelOutputs = async (src: string) => {
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

	const magnitudeCanvas = document.createElement("canvas");
	magnitudeCanvas.width = CANVAS_SIZE;
	magnitudeCanvas.height = CANVAS_SIZE;
	const directionCanvas = document.createElement("canvas");
	directionCanvas.width = CANVAS_SIZE;
	directionCanvas.height = CANVAS_SIZE;

	const magnitudeCtx = magnitudeCanvas.getContext("2d");
	const directionCtx = directionCanvas.getContext("2d");
	if (!magnitudeCtx || !directionCtx) {
		throw new Error("Unable to create output canvas context");
	}

	const magnitudeImage = magnitudeCtx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
	const directionImage = directionCtx.createImageData(CANVAS_SIZE, CANVAS_SIZE);

	for (let y = 1; y < CANVAS_SIZE - 1; y += 1) {
		for (let x = 1; x < CANVAS_SIZE - 1; x += 1) {
			const idx = y * CANVAS_SIZE + x;
			const p00 = gray[idx - CANVAS_SIZE - 1];
			const p01 = gray[idx - CANVAS_SIZE];
			const p02 = gray[idx - CANVAS_SIZE + 1];
			const p10 = gray[idx - 1];
			const p12 = gray[idx + 1];
			const p20 = gray[idx + CANVAS_SIZE - 1];
			const p21 = gray[idx + CANVAS_SIZE];
			const p22 = gray[idx + CANVAS_SIZE + 1];

			const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
			const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

			const magnitude = Math.min(255, Math.hypot(gx, gy));
			const angle = Math.atan2(gy, gx);
			const hue = ((angle + Math.PI) / (2 * Math.PI)) * 360;
			const strength = magnitude / 255;
			const { r, g, b } = hsvToRgb(hue, 1, Math.max(0.1, strength));

			const offset = idx * 4;

			magnitudeImage.data[offset] = magnitude;
			magnitudeImage.data[offset + 1] = magnitude;
			magnitudeImage.data[offset + 2] = magnitude;
			magnitudeImage.data[offset + 3] = 255;

			directionImage.data[offset] = r;
			directionImage.data[offset + 1] = g;
			directionImage.data[offset + 2] = b;
			directionImage.data[offset + 3] = 255;
		}
	}

	magnitudeCtx.putImageData(magnitudeImage, 0, 0);
	directionCtx.putImageData(directionImage, 0, 0);

	return {
		sourceUrl: sourceCanvas.toDataURL("image/png"),
		magnitudeUrl: magnitudeCanvas.toDataURL("image/png"),
		directionUrl: directionCanvas.toDataURL("image/png"),
	};
};

export function SobelProvider({ children }: { children: ReactNode }) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const presets = DEFAULT_PRESETS;
	const [selectedSourceId, setSelectedSourceId] = useState<"preset-a" | "preset-b" | "upload">("preset-a");
	const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
	const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
	const [magnitudePreviewUrl, setMagnitudePreviewUrl] = useState<string | null>(null);
	const [directionPreviewUrl, setDirectionPreviewUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const sourceUrl = useMemo(() => {
		if (selectedSourceId === "upload" && uploadedImageUrl) {
			return uploadedImageUrl;
		}

		const fallbackId = selectedSourceId === "upload" ? "preset-a" : selectedSourceId;
		return presets.find((preset) => preset.id === fallbackId)?.src ?? null;
	}, [presets, selectedSourceId, uploadedImageUrl]);

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
				setMagnitudePreviewUrl(null);
				setDirectionPreviewUrl(null);
				return;
			}

			setIsProcessing(true);
			try {
				const outputs = await computeSobelOutputs(sourceUrl);
				if (cancelled) {
					return;
				}
				setSourcePreviewUrl(outputs.sourceUrl);
				setMagnitudePreviewUrl(outputs.magnitudeUrl);
				setDirectionPreviewUrl(outputs.directionUrl);
			} catch {
				if (!cancelled) {
					setSourcePreviewUrl(null);
					setMagnitudePreviewUrl(null);
					setDirectionPreviewUrl(null);
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
	}, [sourceUrl]);

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
		<SobelContext.Provider
			value={{
				presets,
				selectedSourceId,
				setSelectedSourceId,
				uploadedImageUrl,
				handleUpload,
				openUploadDialog,
				sourcePreviewUrl,
				magnitudePreviewUrl,
				directionPreviewUrl,
				isProcessing,
			}}
		>
			<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
			{children}
		</SobelContext.Provider>
	);
}

export function useSobel() {
	const context = useContext(SobelContext);
	if (!context) {
		throw new Error("useSobel must be used within SobelProvider");
	}
	return context;
}

export function Sobel() {
	const {
		presets,
		selectedSourceId,
		setSelectedSourceId,
		uploadedImageUrl,
		openUploadDialog,
		sourcePreviewUrl,
		magnitudePreviewUrl,
		directionPreviewUrl,
		isProcessing,
	} = useSobel();

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
								Processing Sobel...
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="rounded-md border border-border bg-card p-2">
						<div className="text-sm font-medium mb-2 text-center">Gradient Magnitude</div>
						<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
							{magnitudePreviewUrl ? (
								<img src={magnitudePreviewUrl} alt="Gradient magnitude" className="w-full h-full object-cover" />
							) : (
								<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground px-3 text-center">
									No magnitude result yet.
								</div>
							)}
						</div>
					</div>

					<div className="rounded-md border border-border bg-card p-2">
						<div className="text-sm font-medium mb-2 text-center">Gradient Direction</div>
						<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
							{directionPreviewUrl ? (
								<img src={directionPreviewUrl} alt="Gradient direction" className="w-full h-full object-cover" />
							) : (
								<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground px-3 text-center">
									No direction result yet.
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
