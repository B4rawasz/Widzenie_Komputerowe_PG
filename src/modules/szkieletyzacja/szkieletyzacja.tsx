"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Camera, Image as ImageIcon, Pencil, Trash2, Play, Pause, Download } from "lucide-react";

// Algorytm szkieletyzacji Zhang-Suen
class Skeletonizer {
	private width: number;
	private height: number;
	private pixels: Uint8Array;

	constructor(imageData: ImageData) {
		this.width = imageData.width;
		this.height = imageData.height;
		this.pixels = new Uint8Array(this.width * this.height);

		// Konwersja do binarnego obrazu z adaptacyjnym progiem
		const pixelValues: number[] = [];
		for (let i = 0; i < imageData.data.length; i += 4) {
			const idx = i / 4;
			const r = imageData.data[i];
			const g = imageData.data[i + 1];
			const b = imageData.data[i + 2];
			const a = imageData.data[i + 3];

			// Jeśli całkowicie przezroczyste, ignoruj
			if (a < 128) {
				pixelValues.push(255);
				continue;
			}

			const gray = r * 0.299 + g * 0.587 + b * 0.114;
			pixelValues.push(gray);
		}

		// Oblicz średnią jasności
		const avgBrightness = pixelValues.reduce((a, b) => a + b, 0) / pixelValues.length;

		// Konwersja z użyciem średniej jako progu
		for (let i = 0; i < pixelValues.length; i++) {
			// 1 dla czarnych pikseli, 0 dla białych
			this.pixels[i] = pixelValues[i] < avgBrightness ? 1 : 0;
		}
	}

	private getPixel(x: number, y: number): number {
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
		return this.pixels[y * this.width + x];
	}

	private setPixel(x: number, y: number, value: number): void {
		if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
			this.pixels[y * this.width + x] = value;
		}
	}

	// Liczenie czarnych sąsiadów
	private countNeighbors(x: number, y: number): number {
		let count = 0;
		const offsets = [
			[-1, -1],
			[0, -1],
			[1, -1],
			[-1, 0],
			[1, 0],
			[-1, 1],
			[0, 1],
			[1, 1],
		];
		for (const [dx, dy] of offsets) {
			if (this.getPixel(x + dx, y + dy) === 1) count++;
		}
		return count;
	}

	// Liczenie przejść 0->1
	private countTransitions(x: number, y: number): number {
		const p = [
			this.getPixel(x, y - 1), // P2
			this.getPixel(x + 1, y - 1), // P3
			this.getPixel(x + 1, y), // P4
			this.getPixel(x + 1, y + 1), // P5
			this.getPixel(x, y + 1), // P6
			this.getPixel(x - 1, y + 1), // P7
			this.getPixel(x - 1, y), // P8
			this.getPixel(x - 1, y - 1), // P9
		];

		let transitions = 0;
		for (let i = 0; i < 8; i++) {
			if (p[i] === 0 && p[(i + 1) % 8] === 1) {
				transitions++;
			}
		}
		return transitions;
	}

	// Zhang-Suen Thinning Algorithm
	public skeletonize(): ImageData {
		let hasChanged = true;
		let iteration = 0;
		const maxIterations = 50;

		while (hasChanged && iteration < maxIterations) {
			hasChanged = false;
			iteration++;

			// Krok 1
			const toRemove1: Array<[number, number]> = [];
			for (let y = 1; y < this.height - 1; y++) {
				for (let x = 1; x < this.width - 1; x++) {
					if (this.getPixel(x, y) !== 1) continue;

					const neighbors = this.countNeighbors(x, y);
					const transitions = this.countTransitions(x, y);

					const p2 = this.getPixel(x, y - 1);
					const p4 = this.getPixel(x + 1, y);
					const p6 = this.getPixel(x, y + 1);
					const p8 = this.getPixel(x - 1, y);

					// Warunki Zhang-Suen
					if (neighbors >= 2 && neighbors <= 6 && transitions === 1 && p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
						toRemove1.push([x, y]);
					}
				}
			}

			for (const [x, y] of toRemove1) {
				this.setPixel(x, y, 0);
				hasChanged = true;
			}

			// Krok 2
			const toRemove2: Array<[number, number]> = [];
			for (let y = 1; y < this.height - 1; y++) {
				for (let x = 1; x < this.width - 1; x++) {
					if (this.getPixel(x, y) !== 1) continue;

					const neighbors = this.countNeighbors(x, y);
					const transitions = this.countTransitions(x, y);

					const p2 = this.getPixel(x, y - 1);
					const p4 = this.getPixel(x + 1, y);
					const p6 = this.getPixel(x, y + 1);
					const p8 = this.getPixel(x - 1, y);

					// Warunki Zhang-Suen (zmienione dla kroku 2)
					if (neighbors >= 2 && neighbors <= 6 && transitions === 1 && p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
						toRemove2.push([x, y]);
					}
				}
			}

			for (const [x, y] of toRemove2) {
				this.setPixel(x, y, 0);
				hasChanged = true;
			}
		}

		// Konwersja z powrotem do ImageData
		const result = new ImageData(this.width, this.height);
		for (let i = 0; i < this.pixels.length; i++) {
			// Wyświetl czarne piksele (1) na białym tle
			const value = this.pixels[i] === 1 ? 0 : 255;
			result.data[i * 4] = value;
			result.data[i * 4 + 1] = value;
			result.data[i * 4 + 2] = value;
			result.data[i * 4 + 3] = 255;
		}

		return result;
	}
}

type Mode = "camera" | "draw" | "example";

export default function Szkieletyzacja() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const drawCanvasRef = useRef<HTMLCanvasElement>(null);
	const resultCanvasRef = useRef<HTMLCanvasElement>(null);

	const [mode, setMode] = useState<Mode>("draw");
	const [isProcessing, setIsProcessing] = useState(false);
	const [cameraActive, setCameraActive] = useState(false);
	const [isDrawing, setIsDrawing] = useState(false);
	const [hasDrawing, setHasDrawing] = useState(false);
	const [brushSize, setBrushSize] = useState(15);

	// Uruchomienie kamery
	const startCamera = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 640 },
					height: { ideal: 480 },
					facingMode: "user",
				},
			});
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				setCameraActive(true);
			}
		} catch (err) {
			console.error("Błąd dostępu do kamery:", err);
			alert("Nie można uzyskać dostępu do kamery. Spróbuj użyć trybu rysowania lub przykładów.");
		}
	};

	// Zatrzymanie kamery
	const stopCamera = () => {
		if (videoRef.current && videoRef.current.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream;
			stream.getTracks().forEach((track) => track.stop());
			videoRef.current.srcObject = null;
			setCameraActive(false);
		}
	};

	// Przechwycenie klatki z kamery
	const captureFromCamera = () => {
		if (!videoRef.current || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		canvas.width = videoRef.current.videoWidth;
		canvas.height = videoRef.current.videoHeight;
		ctx.drawImage(videoRef.current, 0, 0);

		processImage(canvas);
	};

	// Przetwarzanie obrazu
	const processImage = (sourceCanvas: HTMLCanvasElement) => {
		if (!resultCanvasRef.current) return;

		const ctx = sourceCanvas.getContext("2d");
		if (!ctx) return;

		let imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

		// Zwiększ kontrast aby lepiej zidentyfikować obiekty
		imageData = increaseContrast(imageData, 1.5);

		// Szkieletyzacja
		const skeletonizer = new Skeletonizer(imageData);
		const skeletonData = skeletonizer.skeletonize();

		// Wyświetlenie wyniku
		const resultCanvas = resultCanvasRef.current;
		resultCanvas.width = sourceCanvas.width;
		resultCanvas.height = sourceCanvas.height;
		const resultCtx = resultCanvas.getContext("2d");
		if (resultCtx) {
			resultCtx.putImageData(skeletonData, 0, 0);
		}
	};

	// Zwiększanie kontrastu obrazu
	const increaseContrast = (imageData: ImageData, factor: number): ImageData => {
		const data = imageData.data;
		const intercept = 128 * (1 - factor);

		for (let i = 0; i < data.length; i += 4) {
			data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept)); // R
			data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept)); // G
			data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept)); // B
			// Alpha bez zmian
		}

		return imageData;
	};

	// Rysowanie
	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
		setIsDrawing(true);
		const canvas = drawCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Ustawienia pędzla
		ctx.lineWidth = brushSize;
		ctx.strokeStyle = "#000000";
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// Współrzędne względem canvas, bez skalowania
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) * (canvas.width / rect.width);
		const y = (e.clientY - rect.top) * (canvas.height / rect.height);

		ctx.beginPath();
		ctx.moveTo(x, y);
	};

	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!isDrawing) return;

		const canvas = drawCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Współrzędne względem canvas, bez skalowania
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) * (canvas.width / rect.width);
		const y = (e.clientY - rect.top) * (canvas.height / rect.height);

		ctx.lineTo(x, y);
		ctx.stroke();
		setHasDrawing(true);
	};

	const stopDrawing = () => {
		setIsDrawing(false);
	};

	const clearDrawing = () => {
		const canvas = drawCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Białe tło
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		setHasDrawing(false);

		// Wyczyść też wynik
		if (resultCanvasRef.current) {
			const resultCtx = resultCanvasRef.current.getContext("2d");
			if (resultCtx) {
				resultCtx.clearRect(0, 0, resultCanvasRef.current.width, resultCanvasRef.current.height);
			}
		}
	};

	const processDrawing = () => {
		if (!drawCanvasRef.current) return;
		processImage(drawCanvasRef.current);
	};

	// Przykładowe obrazy
	const loadExample = (type: "star" | "hand" | "text" | "tree") => {
		const canvas = drawCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Białe tło
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = "#000000";
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 20;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		switch (type) {
			case "star":
				// Rysowanie gwiazdy
				ctx.beginPath();
				for (let i = 0; i < 5; i++) {
					const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
					const x = 320 + Math.cos(angle) * 150;
					const y = 240 + Math.sin(angle) * 150;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);

					const innerAngle = angle + Math.PI / 5;
					const innerX = 320 + Math.cos(innerAngle) * 60;
					const innerY = 240 + Math.sin(innerAngle) * 60;
					ctx.lineTo(innerX, innerY);
				}
				ctx.closePath();
				ctx.fill();
				break;

			case "hand":
				// Uproszczona dłoń
				ctx.fillRect(270, 300, 100, 150); // dłoń
				// palce
				ctx.fillRect(250, 250, 20, 60); // kciuk
				ctx.fillRect(280, 220, 20, 90); // palec wskazujący
				ctx.fillRect(310, 210, 20, 100); // palec środkowy
				ctx.fillRect(340, 220, 20, 90); // palec serdeczny
				ctx.fillRect(370, 250, 20, 60); // mały palec
				break;

			case "text":
				// Tekst
				ctx.font = "bold 100px Arial";
				ctx.fillText("AI", 220, 300);
				break;

			case "tree":
				// Drzewo
				ctx.fillRect(300, 350, 40, 100); // pień
				ctx.beginPath();
				ctx.arc(320, 320, 80, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(280, 280, 60, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(360, 280, 60, 0, Math.PI * 2);
				ctx.fill();
				break;
		}

		setHasDrawing(true);
		setTimeout(() => processDrawing(), 100);
	};

	// Inicjalizacja canvas do rysowania
	useEffect(() => {
		const canvas = drawCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 15;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// Białe tło
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}, []);

	// Czyszczenie przy zmianie trybu
	useEffect(() => {
		if (mode === "camera") {
			startCamera();
		} else {
			stopCamera();
		}

		return () => {
			stopCamera();
		};
	}, [mode]);

	// Pobieranie wyniku
	const downloadResult = () => {
		if (!resultCanvasRef.current) return;

		const link = document.createElement("a");
		link.download = "szkieletyzacja.png";
		link.href = resultCanvasRef.current.toDataURL();
		link.click();
	};

	return (
		<div className="w-full max-w-7xl mx-auto p-6 space-y-6">
			<Card className="p-6">
				<h2 className="text-2xl font-bold mb-4">Szkieletyzacja obrazu (Zhang-Suen)</h2>
				<p className="text-muted-foreground mb-6">
					Algorytm szkieletyzacji redukuje obiekty do ich reprezentacji szkieletowej - cienkiej linii przechodzącej
					przez środek kształtu, zachowując topologię.
				</p>

				{/* Wybór trybu */}
				<div className="flex gap-2 mb-6">
					<Button
						variant={mode === "draw" ? "default" : "outline"}
						onClick={() => setMode("draw")}
						className="flex items-center gap-2"
					>
						<Pencil className="w-4 h-4" />
						Rysuj
					</Button>
					<Button
						variant={mode === "example" ? "default" : "outline"}
						onClick={() => setMode("example")}
						className="flex items-center gap-2"
					>
						<ImageIcon className="w-4 h-4" />
						Przykłady
					</Button>
					<Button
						variant={mode === "camera" ? "default" : "outline"}
						onClick={() => setMode("camera")}
						className="flex items-center gap-2"
					>
						<Camera className="w-4 h-4" />
						Kamera
					</Button>
				</div>

				<Separator className="my-6" />

				{/* Tryb rysowania */}
				{mode === "draw" && (
					<div className="space-y-4">
						<div className="flex gap-4 mb-4 items-center flex-wrap">
							<div className="flex gap-2">
								<Button onClick={clearDrawing} variant="outline" size="sm">
									<Trash2 className="w-4 h-4 mr-2" />
									Wyczyść
								</Button>
								<Button onClick={processDrawing} disabled={!hasDrawing} size="sm">
									<Play className="w-4 h-4 mr-2" />
									Przetwórz
								</Button>
								{hasDrawing && (
									<Button onClick={downloadResult} variant="outline" size="sm">
										<Download className="w-4 h-4 mr-2" />
										Pobierz
									</Button>
								)}
							</div>
							<div className="flex items-center gap-3">
								<label className="text-sm font-medium whitespace-nowrap">Rozmiar pędzla:</label>
								<input
									type="range"
									min="5"
									max="80"
									value={brushSize}
									onChange={(e) => setBrushSize(Number(e.target.value))}
									className="w-32"
								/>
								<span className="text-sm font-medium w-12 text-right">{brushSize}px</span>
							</div>
							<div>
								<h3 className="text-sm font-medium mb-2">Oryginalny rysunek</h3>
								<canvas
									ref={drawCanvasRef}
									width={640}
									height={480}
									className="border rounded-lg w-full cursor-crosshair bg-white"
									onMouseDown={startDrawing}
									onMouseMove={draw}
									onMouseUp={stopDrawing}
									onMouseLeave={stopDrawing}
								/>
							</div>
							<div>
								<h3 className="text-sm font-medium mb-2">Szkielet</h3>
								<canvas ref={resultCanvasRef} width={640} height={480} className="border rounded-lg w-full bg-white" />
							</div>
						</div>
					</div>
				)}

				{/* Tryb przykładów */}
				{mode === "example" && (
					<div className="space-y-4">
						<div>
							<h3 className="text-sm font-medium mb-3">Wybierz przykład:</h3>
							<div className="flex gap-2 mb-4">
								<Button onClick={() => loadExample("star")} variant="outline" size="sm">
									⭐ Gwiazda
								</Button>
								<Button onClick={() => loadExample("hand")} variant="outline" size="sm">
									✋ Dłoń
								</Button>
								<Button onClick={() => loadExample("text")} variant="outline" size="sm">
									📝 Tekst
								</Button>
								<Button onClick={() => loadExample("tree")} variant="outline" size="sm">
									🌳 Drzewo
								</Button>
							</div>
						</div>

						<div className="flex gap-2 mb-4">
							<Button onClick={clearDrawing} variant="outline" size="sm">
								<Trash2 className="w-4 h-4 mr-2" />
								Wyczyść
							</Button>
							{hasDrawing && (
								<Button onClick={downloadResult} variant="outline" size="sm">
									<Download className="w-4 h-4 mr-2" />
									Pobierz
								</Button>
							)}
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<h3 className="text-sm font-medium mb-2">Przykładowy obraz</h3>
								<canvas ref={drawCanvasRef} width={640} height={480} className="border rounded-lg w-full bg-white" />
							</div>
							<div>
								<h3 className="text-sm font-medium mb-2">Szkielet</h3>
								<canvas ref={resultCanvasRef} width={640} height={480} className="border rounded-lg w-full bg-white" />
							</div>
						</div>
					</div>
				)}

				{/* Tryb kamery */}
				{mode === "camera" && (
					<div className="space-y-4">
						<div className="flex gap-2 mb-4">
							<Button onClick={captureFromCamera} disabled={!cameraActive} size="sm">
								<Camera className="w-4 h-4 mr-2" />
								Przechwyt i przetwórz
							</Button>
							<Button onClick={downloadResult} variant="outline" size="sm">
								<Download className="w-4 h-4 mr-2" />
								Pobierz
							</Button>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<h3 className="text-sm font-medium mb-2">Obraz z kamery</h3>
								<video ref={videoRef} autoPlay playsInline className="border rounded-lg w-full" />
								<canvas ref={canvasRef} className="hidden" />
							</div>
							<div>
								<h3 className="text-sm font-medium mb-2">Szkielet</h3>
								<canvas ref={resultCanvasRef} width={640} height={480} className="border rounded-lg w-full bg-white" />
							</div>
						</div>
					</div>
				)}
			</Card>

			{/* Informacje o algorytmie */}
			<Card className="p-6">
				<h3 className="text-xl font-semibold mb-3">Algorytm Zhang-Suen</h3>
				<div className="space-y-2 text-sm text-muted-foreground">
					<p>
						Algorytm Zhang-Suen to iteracyjny algorytm szkieletyzacji, który usuwa piksele z krawędzi obiektu w taki
						sposób, aby:
					</p>
					<ul className="list-disc list-inside space-y-1 ml-4">
						<li>Zachować topologię obiektu (nie tworzyć dziur ani rozłączeń)</li>
						<li>Uzyskać szkielet o grubości 1 piksela</li>
						<li>Zachować punkty końcowe i rozgałęzienia</li>
					</ul>
					<p className="mt-3">Algorytm działa w dwóch poditeracjach, sprawdzając dla każdego piksela:</p>
					<ul className="list-disc list-inside space-y-1 ml-4">
						<li>Liczbę czarnych sąsiadów (2-6)</li>
						<li>Liczbę przejść 0→1 w sąsiedztwie (równa 1)</li>
						<li>Dodatkowe warunki topologiczne</li>
					</ul>
				</div>
			</Card>
		</div>
	);
}
