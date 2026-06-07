"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Upload } from "lucide-react";
import { ChangeEvent, createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

const CANVAS_SIZE = 400;

type SourceId = "preset-a" | "preset-b" | "upload";

type PresetImage = { id: "preset-a" | "preset-b"; label: string; src: string };

const DEFAULT_PRESETS: PresetImage[] = [
	{ id: "preset-a", label: "Zdjęcie 1", src: "/stock/test_img_1.jpg" },
	{ id: "preset-b", label: "Zdjęcie 2", src: "/stock/test_img_2.jpg" },
];

type LoGDoGContextType = {
	presets: PresetImage[];
	selectedSourceId: SourceId;
	setSelectedSourceId: (v: SourceId) => void;
	uploadedImageUrl: string | null;
	handleUpload: (e: ChangeEvent<HTMLInputElement>) => void;
	openUploadDialog: () => void;
	sourcePreviewUrl: string | null;
	logPreviewUrl: string | null;
	dogPreviewUrl: string | null;
	logBlurPreviewUrl: string | null;
	laplacianPreviewUrl: string | null;
	dogBlurAPreviewUrl: string | null;
	dogBlurBPreviewUrl: string | null;
	dogDiffPreviewUrl: string | null;
	loGSize: number;
	loGSigma: number;
	dogSizeA: number;
	dogSigmaA: number;
	dogSizeB: number;
	dogSigmaB: number;
	setLoGSize: (v: number) => void;
	setLoGSigma: (v: number) => void;
	setDogSizeA: (v: number) => void;
	setDogSigmaA: (v: number) => void;
	setDogSizeB: (v: number) => void;
	setDogSigmaB: (v: number) => void;
	isProcessing: boolean;
};

const LoGDoGContext = createContext<LoGDoGContextType | undefined>(undefined);

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

const gaussianKernel = (size: number, sigma: number) => {
	const kernel: number[] = [];
	const half = Math.floor(size / 2);
	const sigma2 = sigma * sigma;
	let sum = 0;

	for (let y = -half; y <= half; y += 1) {
		for (let x = -half; x <= half; x += 1) {
			const value = Math.exp(-(x * x + y * y) / (2 * sigma2));
			kernel.push(value);
			sum += value;
		}
	}

	return kernel.map((value) => value / sum);
};

const convolve = (input: Float32Array, width: number, height: number, kernel: number[], kSize: number) => {
	const half = Math.floor(kSize / 2);
	const output = new Float32Array(width * height);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let acc = 0;
			for (let ky = -half; ky <= half; ky += 1) {
				for (let kx = -half; kx <= half; kx += 1) {
					const ix = x + kx;
					const iy = y + ky;
					if (ix < 0 || iy < 0 || ix >= width || iy >= height) continue;
					const idx = iy * width + ix;
					const kVal = kernel[(ky + half) * kSize + (kx + half)];
					acc += input[idx] * kVal;
				}
			}
			output[y * width + x] = acc;
		}
	}

	return output;
};

const laplacian3x3 = (input: Float32Array, width: number, height: number) => {
	const output = new Float32Array(width * height);
	const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
	const half = 1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let acc = 0;
			for (let ky = -half; ky <= half; ky += 1) {
				for (let kx = -half; kx <= half; kx += 1) {
					const ix = x + kx;
					const iy = y + ky;
					if (ix < 0 || iy < 0 || ix >= width || iy >= height) continue;
					const idx = iy * width + ix;
					const kVal = kernel[(ky + half) * 3 + (kx + half)];
					acc += input[idx] * kVal;
				}
			}
			output[y * width + x] = acc;
		}
	}

	return output;
};

const absArray = (arr: Float32Array) => {
	const out = new Float32Array(arr.length);
	for (let i = 0; i < arr.length; i += 1) {
		out[i] = Math.abs(arr[i]);
	}
	return out;
};

const toDataUrlFromGray = (arr: Float32Array, width: number, height: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Unable to create output canvas context");
	}

	const image = ctx.createImageData(width, height);
	let min = Infinity;
	let max = -Infinity;
	for (let i = 0; i < arr.length; i += 1) {
		const value = arr[i];
		if (value < min) min = value;
		if (value > max) max = value;
	}
	const range = max - min || 1;

	for (let i = 0; i < arr.length; i += 1) {
		const normalized = Math.min(255, Math.max(0, ((arr[i] - min) / range) * 255));
		const offset = i * 4;
		image.data[offset] = normalized;
		image.data[offset + 1] = normalized;
		image.data[offset + 2] = normalized;
		image.data[offset + 3] = 255;
	}

	ctx.putImageData(image, 0, 0);
	return canvas.toDataURL("image/png");
};

const computeLoGDoGOutputs = async (
	src: string,
	loGSize: number,
	loGSigma: number,
	dogSizeA: number,
	dogSigmaA: number,
	dogSizeB: number,
	dogSigmaB: number,
) => {
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

	const gaussLoG = gaussianKernel(loGSize, loGSigma);
	const blurredLoG = convolve(gray, CANVAS_SIZE, CANVAS_SIZE, gaussLoG, loGSize);
	const lap = laplacian3x3(blurredLoG, CANVAS_SIZE, CANVAS_SIZE);

	const gaA = gaussianKernel(dogSizeA, dogSigmaA);
	const gaB = gaussianKernel(dogSizeB, dogSigmaB);
	const blurA = convolve(gray, CANVAS_SIZE, CANVAS_SIZE, gaA, dogSizeA);
	const blurB = convolve(gray, CANVAS_SIZE, CANVAS_SIZE, gaB, dogSizeB);
	const dog = new Float32Array(CANVAS_SIZE * CANVAS_SIZE);
	for (let i = 0; i < dog.length; i += 1) {
		dog[i] = blurA[i] - blurB[i];
	}

	return {
		sourceUrl: sourceCanvas.toDataURL("image/png"),
		logUrl: toDataUrlFromGray(absArray(lap), CANVAS_SIZE, CANVAS_SIZE),
		dogUrl: toDataUrlFromGray(absArray(dog), CANVAS_SIZE, CANVAS_SIZE),
		logBlurUrl: toDataUrlFromGray(blurredLoG, CANVAS_SIZE, CANVAS_SIZE),
		lapUrl: toDataUrlFromGray(lap, CANVAS_SIZE, CANVAS_SIZE),
		blurAUrl: toDataUrlFromGray(blurA, CANVAS_SIZE, CANVAS_SIZE),
		blurBUrl: toDataUrlFromGray(blurB, CANVAS_SIZE, CANVAS_SIZE),
		dogDiffUrl: toDataUrlFromGray(dog, CANVAS_SIZE, CANVAS_SIZE),
	};
};

export function LoGDoGProvider({ children }: { children: ReactNode }) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const presets = DEFAULT_PRESETS;
	const [selectedSourceId, setSelectedSourceId] = useState<SourceId>("preset-a");
	const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
	const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
	const [logPreviewUrl, setLogPreviewUrl] = useState<string | null>(null);
	const [dogPreviewUrl, setDogPreviewUrl] = useState<string | null>(null);
	const [logBlurPreviewUrl, setLogBlurPreviewUrl] = useState<string | null>(null);
	const [laplacianPreviewUrl, setLaplacianPreviewUrl] = useState<string | null>(null);
	const [dogBlurAPreviewUrl, setDogBlurAPreviewUrl] = useState<string | null>(null);
	const [dogBlurBPreviewUrl, setDogBlurBPreviewUrl] = useState<string | null>(null);
	const [dogDiffPreviewUrl, setDogDiffPreviewUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const [loGSize, setLoGSize] = useState(5);
	const [loGSigma, setLoGSigma] = useState(1.0);
	const [dogSizeA, setDogSizeA] = useState(3);
	const [dogSigmaA, setDogSigmaA] = useState(0.8);
	const [dogSizeB, setDogSizeB] = useState(9);
	const [dogSigmaB, setDogSigmaB] = useState(2.0);

	const sourceUrl = useMemo(() => {
		if (selectedSourceId === "upload" && uploadedImageUrl) {
			return uploadedImageUrl;
		}

		const fallbackId = selectedSourceId === "upload" ? "preset-a" : selectedSourceId;
		return presets.find((preset) => preset.id === fallbackId)?.src ?? null;
	}, [presets, selectedSourceId, uploadedImageUrl]);

	useEffect(() => {
		if (!uploadedImageUrl) return;
		return () => URL.revokeObjectURL(uploadedImageUrl);
	}, [uploadedImageUrl]);

	useEffect(() => {
		let cancelled = false;

		const process = async () => {
			if (!sourceUrl) {
				setSourcePreviewUrl(null);
				setLogPreviewUrl(null);
				setDogPreviewUrl(null);
				setLogBlurPreviewUrl(null);
				setLaplacianPreviewUrl(null);
				setDogBlurAPreviewUrl(null);
				setDogBlurBPreviewUrl(null);
				setDogDiffPreviewUrl(null);
				return;
			}

			setIsProcessing(true);
			try {
				const outputs = await computeLoGDoGOutputs(
					sourceUrl,
					loGSize,
					loGSigma,
					dogSizeA,
					dogSigmaA,
					dogSizeB,
					dogSigmaB,
				);
				if (cancelled) return;
				setSourcePreviewUrl(outputs.sourceUrl);
				setLogPreviewUrl(outputs.logUrl);
				setDogPreviewUrl(outputs.dogUrl);
				setLogBlurPreviewUrl(outputs.logBlurUrl);
				setLaplacianPreviewUrl(outputs.lapUrl);
				setDogBlurAPreviewUrl(outputs.blurAUrl);
				setDogBlurBPreviewUrl(outputs.blurBUrl);
				setDogDiffPreviewUrl(outputs.dogDiffUrl);
			} catch {
				if (!cancelled) {
					setSourcePreviewUrl(null);
					setLogPreviewUrl(null);
					setDogPreviewUrl(null);
					setLogBlurPreviewUrl(null);
					setLaplacianPreviewUrl(null);
					setDogBlurAPreviewUrl(null);
					setDogBlurBPreviewUrl(null);
					setDogDiffPreviewUrl(null);
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
	}, [sourceUrl, loGSize, loGSigma, dogSizeA, dogSigmaA, dogSizeB, dogSigmaB]);

	const openUploadDialog = () => fileInputRef.current?.click();

	const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file || !file.type.startsWith("image/")) return;

		setUploadedImageUrl((previous) => {
			if (previous) URL.revokeObjectURL(previous);
			return URL.createObjectURL(file);
		});
		setSelectedSourceId("upload");
		event.target.value = "";
	};

	return (
		<LoGDoGContext.Provider
			value={{
				presets,
				selectedSourceId,
				setSelectedSourceId,
				uploadedImageUrl,
				handleUpload,
				openUploadDialog,
				sourcePreviewUrl,
				logPreviewUrl,
				dogPreviewUrl,
				logBlurPreviewUrl,
				laplacianPreviewUrl,
				dogBlurAPreviewUrl,
				dogBlurBPreviewUrl,
				dogDiffPreviewUrl,
				loGSize,
				loGSigma,
				dogSizeA,
				dogSigmaA,
				dogSizeB,
				dogSigmaB,
				setLoGSize,
				setLoGSigma,
				setDogSizeA,
				setDogSigmaA,
				setDogSizeB,
				setDogSigmaB,
				isProcessing,
			}}
		>
			<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
			{children}
		</LoGDoGContext.Provider>
	);
}

export function useLoGDoG() {
	const context = useContext(LoGDoGContext);
	if (!context) {
		throw new Error("useLoGDoG must be used within LoGDoGProvider");
	}
	return context;
}

export function LoGSource() {
	const {
		presets,
		selectedSourceId,
		setSelectedSourceId,
		uploadedImageUrl,
		openUploadDialog,
		sourcePreviewUrl,
		isProcessing,
	} = useLoGDoG();
	return (
		<div className="w-full flex flex-col gap-4">
			<div className="flex flex-row items-center justify-center gap-2 flex-wrap">
				<div>
					<div className="flex items-center gap-2">
						<div className="text-sm font-medium">Źródło</div>
					</div>
					<div className="mt-2 flex items-center gap-2">
						<ToggleGroup
							type="single"
							variant="outline"
							spacing={2}
							value={selectedSourceId}
							onValueChange={(value) => {
								if (value === "preset-a" || value === "preset-b") setSelectedSourceId(value);
								if (value === "upload" && uploadedImageUrl) setSelectedSourceId("upload");
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
				</div>
			</div>

			<div className="aspect-4/3 flex flex-col justify-center">
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
								Processing LoG/DoG...
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function LoGParams() {
	const { loGSize, loGSigma, setLoGSize, setLoGSigma } = useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-4">
			<div className="grid gap-3">
				<div>
					<div className="flex items-center justify-between">
						<Label>LoG kernel size</Label>
						<span className="text-sm text-muted-foreground">{loGSize}</span>
					</div>
					<Slider
						min={3}
						max={15}
						step={2}
						value={[loGSize]}
						onValueChange={(value) => setLoGSize(Number(Array.isArray(value) ? value[0] : value))}
					/>
				</div>

				<div>
					<div className="flex items-center justify-between">
						<Label>LoG sigma</Label>
						<span className="text-sm text-muted-foreground">{loGSigma.toFixed(2)}</span>
					</div>
					<Slider
						min={0.1}
						max={5}
						step={0.1}
						value={[loGSigma]}
						onValueChange={(value) => setLoGSigma(Number(Array.isArray(value) ? value[0] : value))}
					/>
				</div>
			</div>
		</div>
	);
}

export function DoGParams() {
	const { dogSizeA, dogSigmaA, dogSizeB, dogSigmaB, setDogSizeA, setDogSigmaA, setDogSizeB, setDogSigmaB } =
		useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-4">
			<div className="grid gap-3">
				<div className="grid sm:grid-cols-2 gap-3">
					<div>
						<div className="flex items-center justify-between">
							<Label>DoG size A</Label>
							<span className="text-sm text-muted-foreground">{dogSizeA}</span>
						</div>
						<Slider
							min={3}
							max={15}
							step={2}
							value={[dogSizeA]}
							onValueChange={(value) => setDogSizeA(Number(Array.isArray(value) ? value[0] : value))}
						/>
					</div>
					<div>
						<div className="flex items-center justify-between">
							<Label>DoG sigma A</Label>
							<span className="text-sm text-muted-foreground">{dogSigmaA.toFixed(2)}</span>
						</div>
						<Slider
							min={0.1}
							max={5}
							step={0.1}
							value={[dogSigmaA]}
							onValueChange={(value) => setDogSigmaA(Number(Array.isArray(value) ? value[0] : value))}
						/>
					</div>
				</div>

				<div className="grid sm:grid-cols-2 gap-3">
					<div>
						<div className="flex items-center justify-between">
							<Label>DoG size B</Label>
							<span className="text-sm text-muted-foreground">{dogSizeB}</span>
						</div>
						<Slider
							min={3}
							max={31}
							step={2}
							value={[dogSizeB]}
							onValueChange={(value) => setDogSizeB(Number(Array.isArray(value) ? value[0] : value))}
						/>
					</div>
					<div>
						<div className="flex items-center justify-between">
							<Label>DoG sigma B</Label>
							<span className="text-sm text-muted-foreground">{dogSigmaB.toFixed(2)}</span>
						</div>
						<Slider
							min={0.1}
							max={8}
							step={0.1}
							value={[dogSigmaB]}
							onValueChange={(value) => setDogSigmaB(Number(Array.isArray(value) ? value[0] : value))}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

export function LoGBlurPreview() {
	const { logBlurPreviewUrl } = useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-2">
			<div className="text-sm font-medium mb-2 text-center">LoG Blur</div>
			<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
				{logBlurPreviewUrl ? (
					<img src={logBlurPreviewUrl} className="w-full h-full object-cover" />
				) : (
					<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No preview</div>
				)}
			</div>
		</div>
	);
}

export function LoGLaplacianPreview() {
	const { laplacianPreviewUrl } = useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-2">
			<div className="text-sm font-medium mb-2 text-center">Laplacian</div>
			<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
				{laplacianPreviewUrl ? (
					<img src={laplacianPreviewUrl} className="w-full h-full object-cover" />
				) : (
					<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No preview</div>
				)}
			</div>
		</div>
	);
}

export function DoGBlurAPreview() {
	const { dogBlurAPreviewUrl } = useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-2">
			<div className="text-sm font-medium mb-2 text-center">DoG Blur A</div>
			<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
				{dogBlurAPreviewUrl ? (
					<img src={dogBlurAPreviewUrl} className="w-full h-full object-cover" />
				) : (
					<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No preview</div>
				)}
			</div>
		</div>
	);
}

export function DoGBlurBPreview() {
	const { dogBlurBPreviewUrl } = useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-2">
			<div className="text-sm font-medium mb-2 text-center">DoG Blur B</div>
			<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
				{dogBlurBPreviewUrl ? (
					<img src={dogBlurBPreviewUrl} className="w-full h-full object-cover" />
				) : (
					<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No preview</div>
				)}
			</div>
		</div>
	);
}

export function DoGDiffPreview() {
	const { dogDiffPreviewUrl } = useLoGDoG();
	return (
		<div className="rounded-md border border-border bg-card p-2">
			<div className="text-sm font-medium mb-2 text-center">DoG Difference</div>
			<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
				{dogDiffPreviewUrl ? (
					<img src={dogDiffPreviewUrl} className="w-full h-full object-cover" />
				) : (
					<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No diff</div>
				)}
			</div>
		</div>
	);
}

export function LoGOutputs() {
	const { logPreviewUrl, dogPreviewUrl, isProcessing } = useLoGDoG();
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<div className="rounded-md border border-border bg-card p-2">
				<div className="text-sm font-medium mb-2 text-center">Laplacian of Gaussian (LoG)</div>
				<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
					{logPreviewUrl ? (
						<img src={logPreviewUrl} className="w-full h-full object-cover" />
					) : (
						<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No LoG</div>
					)}
				</div>
			</div>
			<div className="rounded-md border border-border bg-card p-2">
				<div className="text-sm font-medium mb-2 text-center">Difference of Gaussians (DoG)</div>
				<div className="aspect-square rounded-sm border border-border overflow-hidden bg-background">
					{dogPreviewUrl ? (
						<img src={dogPreviewUrl} className="w-full h-full object-cover" />
					) : (
						<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No DoG</div>
					)}
				</div>
			</div>
			{isProcessing && (
				<div className="sm:col-span-2 text-sm text-muted-foreground text-center mt-2">Processing...</div>
			)}
		</div>
	);
}
