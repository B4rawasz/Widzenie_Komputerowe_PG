"use client";

import type * as HandPoseDetectionType from "@tensorflow-models/hand-pose-detection";
import type { HandDetector } from "@tensorflow-models/hand-pose-detection";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Cube3D from "./3D/Cube";

declare global {
	interface Window {
		handPoseDetection: typeof HandPoseDetectionType;
		tf: any;
	}
}

export default function HandRecognition() {
	const initialized = useRef(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
	const [handAngles, setHandAngles] = useState({ yaw: 0, pitch: 0, roll: 0 });
	const anglesRef = useRef({ yaw: 0, pitch: 0, roll: 0 }); // do wygładzania
	const [cubeScale, setCubeScale] = useState(1);
	const scaleRef = useRef(1);

	useEffect(() => {
		if (!isLibraryLoaded) return;

		if (initialized.current) return;
		initialized.current = true;

		let detector: HandDetector;
		let animationFrameId: number;

		const init = async () => {
			const hp = window.handPoseDetection;

			// Teraz to nie powinno się wydarzyć, bo czekamy na isLibraryLoaded
			if (!hp) {
				console.error("Hand pose detection library not found on window");
				return;
			}

			console.log("Initializing model...");

			const model = hp.SupportedModels.MediaPipeHands;
			const modelConfig: HandPoseDetectionType.MediaPipeHandsMediaPipeModelConfig = {
				runtime: "mediapipe",
				solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
				modelType: "full",
			};

			try {
				detector = await hp.createDetector(model, modelConfig);
				console.log("Detector created!");

				const stream = await navigator.mediaDevices.getUserMedia({
					video: { width: 640, height: 480 }, // Wymuszamy rozmiar dla łatwiejszego mapowania
				});

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.onloadedmetadata = () => {
						videoRef.current?.play();

						if (canvasRef.current && videoRef.current) {
							canvasRef.current.width = videoRef.current.videoWidth;
							canvasRef.current.height = videoRef.current.videoHeight;
						}

						detect();
					};
				}
			} catch (err) {
				console.error("Initialization error:", err);
			}
		};

		const detect = async () => {
			if (!videoRef.current || !detector || !canvasRef.current) return;

			// Czekamy aż wideo będzie miało dane, inaczej TF rzuca błędami o kształcie tensora
			if (videoRef.current.readyState < 2) {
				animationFrameId = requestAnimationFrame(detect);
				return;
			}

			try {
				const hands = await detector.estimateHands(videoRef.current);
				drawHands(hands, canvasRef.current);
			} catch (error) {
				console.error(error);
			}

			animationFrameId = requestAnimationFrame(detect);
		};

		init();

		// Cleanup przy odmontowaniu
		return () => {
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
			if (detector) detector.dispose();
			initialized.current = false;
		};
	}, [isLibraryLoaded]);

	const getDistance = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) => {
		const dz = (a.z ?? 0) - (b.z ?? 0);
		return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + dz ** 2);
	};

	// Pomocnicze: normalizacja kąta i najmniejsza różnica kątów
	const normalizeAngle = (deg: number) => {
		let a = deg;
		while (a > 180) a -= 360;
		while (a < -180) a += 360;
		return a;
	};
	const shortestDelta = (from: number, to: number) => {
		const df = normalizeAngle(to - from);
		return df;
	};

	// --- Stabilne kąty: yaw z normalnej (XZ), roll z osi Y (XY) ---
	const getHandEulerAngles = (keypoints3D: { x: number; y: number; z?: number }[]) => {
		const p0 = keypoints3D[0]; // nadgarstek
		const p5 = keypoints3D[5];
		const p9 = keypoints3D[9];
		const p13 = keypoints3D[13];
		const p17 = keypoints3D[17];

		const palmBase = {
			x: (p5.x + p9.x + p13.x + p17.x) / 4,
			y: (p5.y + p9.y + p13.y + p17.y) / 4,
			z: ((p5.z ?? 0) + (p9.z ?? 0) + (p13.z ?? 0) + (p17.z ?? 0)) / 4,
		};

		// Oś Y dłoni (wrist -> palm base)
		const y = { x: palmBase.x - p0.x, y: palmBase.y - p0.y, z: palmBase.z - (p0.z ?? 0) };
		const yLen = Math.hypot(y.x, y.y, y.z);
		const yNorm = { x: y.x / yLen, y: y.y / yLen, z: y.z / yLen };

		// Oś X dłoni (p5 -> p17)
		const x = { x: p17.x - p5.x, y: p17.y - p5.y, z: (p17.z ?? 0) - (p5.z ?? 0) };
		const xLen = Math.hypot(x.x, x.y, x.z);
		const xNorm = { x: x.x / xLen, y: x.y / xLen, z: x.z / xLen };

		// Normalna dłoni
		let zNorm = {
			x: xNorm.y * yNorm.z - xNorm.z * yNorm.y,
			y: xNorm.z * yNorm.x - xNorm.x * yNorm.z,
			z: xNorm.x * yNorm.y - xNorm.y * yNorm.x,
		};
		const zLen = Math.hypot(zNorm.x, zNorm.y, zNorm.z);
		zNorm = { x: zNorm.x / zLen, y: zNorm.y / zLen, z: zNorm.z / zLen };

		const isMirrored = true;

		// Yaw: 0 przodem, ~180 tyłem
		let yaw = Math.atan2(zNorm.x, -zNorm.z) * (180 / Math.PI);
		if (isMirrored) yaw = -yaw;
		yaw = normalizeAngle(yaw + 180);
		yaw = Math.abs(yaw); // [0,180]

		// Pitch: odwrócony znak (zgodnie z oczekiwaniem)
		let pitch = -Math.atan2(zNorm.y, Math.hypot(zNorm.x, zNorm.z)) * (180 / Math.PI);

		// Roll: 0 gdy palce są do góry; dodatni dla obrotu zgodnego z ekranem
		// kąt między wektorem "góra ekranu" (0, -1) a osią Y dłoni po projekcji na XY
		let roll = Math.atan2(yNorm.x, -yNorm.y) * (180 / Math.PI);
		// przy lustrzanym obrazie (scaleX(-1)) odwróć znak

		return {
			yaw,
			pitch: Math.abs(pitch) < 1e-6 ? 0 : pitch,
			roll: normalizeAngle(Math.abs(roll) < 1e-6 ? 0 : roll),
		};
	};

	// --- ADAPTACYJNE WYGŁADZANIE + deadband + ochrona przed outlierami ---
	const smoothAngles = (newAngles: { yaw: number; pitch: number; roll: number }, alphaScale = 1) => {
		const prev = anglesRef.current;

		const smoothOne = (prevVal: number, newVal: number) => {
			let d = shortestDelta(prevVal, newVal);
			const ad = Math.abs(d);

			// deadband
			if (ad < 0.5) return prevVal;
			// outlier guard
			if (ad > 40) d = Math.sign(d) * 40;

			// adaptacyjne alpha, skalowane przez alphaScale
			let alpha = (0.05 + 0.45 * Math.min(1, ad / 30)) * alphaScale;
			alpha = Math.max(0, Math.min(1, alpha));

			const blended = prevVal + alpha * d;
			return normalizeAngle(blended);
		};

		const smoothed = {
			yaw: smoothOne(prev.yaw, newAngles.yaw),
			pitch: smoothOne(prev.pitch, newAngles.pitch),
			roll: smoothOne(prev.roll, newAngles.roll),
		};
		anglesRef.current = smoothed;
		return smoothed;
	};

	const smoothScale = (newScale: number, alpha = 0.2) => {
		const prev = scaleRef.current;
		const smoothed = alpha * newScale + (1 - alpha) * prev;
		scaleRef.current = smoothed;
		return smoothed;
	};

	const drawHands = (hands: HandPoseDetectionType.Hand[], canvas: HTMLCanvasElement) => {
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Czyścimy poprzednią klatkę
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = "red";
		ctx.strokeStyle = "white";
		ctx.lineWidth = 2;

		// Definicje połączeń palców (pary indeksów punktów)
		const fingerJoints = [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4], // Kciuk
			[0, 5],
			[5, 6],
			[6, 7],
			[7, 8], // Wskazujący
			[0, 9],
			[9, 10],
			[10, 11],
			[11, 12], // Środkowy
			[0, 13],
			[13, 14],
			[14, 15],
			[15, 16], // Serdeczny
			[0, 17],
			[17, 18],
			[18, 19],
			[19, 20], // Mały
		];

		hands.forEach((hand) => {
			// 1. Rysowanie połączeń (linii)
			fingerJoints.forEach(([startIdx, endIdx]) => {
				const start = hand.keypoints[startIdx];
				const end = hand.keypoints[endIdx];
				if (hand.handedness === "Right") {
					ctx.fillStyle = "blue";
					const thumbTip2D = hand.keypoints[4];
					const indexTip2D = hand.keypoints[8];
					if (thumbTip2D && indexTip2D) {
						ctx.save();
						ctx.strokeStyle = "green";
						ctx.lineWidth = 3;
						ctx.beginPath();
						ctx.moveTo(thumbTip2D.x, thumbTip2D.y);
						ctx.lineTo(indexTip2D.x, indexTip2D.y);
						ctx.stroke();
						ctx.restore();
					}
				} else {
					ctx.fillStyle = "red";
				}
				ctx.beginPath();
				ctx.moveTo(start.x, start.y);
				ctx.lineTo(end.x, end.y);
				ctx.stroke();
			});

			// 2. Rysowanie punktów (kropek)
			hand.keypoints.forEach((keypoint) => {
				ctx.beginPath();
				ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
				ctx.fill();
			});

			if (hand.handedness === "Right" && hand.keypoints3D) {
				const thumbTip = hand.keypoints3D[4];
				const indexTip = hand.keypoints3D[8];
				const thumbTip2D = hand.keypoints[4];
				const indexTip2D = hand.keypoints[8];
				if (thumbTip && indexTip) {
					const distance = getDistance(thumbTip, indexTip) * 100;

					const minDistance = 6.0;
					const maxDistance = 12.0;

					const normalized = (distance - minDistance) / (maxDistance - minDistance);
					const clamped = Math.max(0, Math.min(1, normalized)); // zawsze w [0,1]
					const smoothedScale = smoothScale(clamped, 0.2);
					setCubeScale(smoothedScale);

					// Środek linii w 2D
					const midX = (thumbTip2D.x + indexTip2D.x) / 2;
					const midY = (thumbTip2D.y + indexTip2D.y) / 2;
					const angle = Math.atan2(indexTip2D.y - thumbTip2D.y, indexTip2D.x - thumbTip2D.x);

					// Wyświetlenie odległości na canvasie
					ctx.save();
					ctx.setTransform(-1, 0, 0, 1, canvas.width, 0); // Odwrócenie X
					ctx.translate(canvas.width - midX, midY - 10); // Przesunięcie do środka linii
					ctx.rotate(-angle); // Rotacja tekstu (minus, bo canvas jest odbity)
					ctx.font = "24px Arial";
					ctx.fillStyle = "green";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(`${clamped.toFixed(2)}`, 0, 0);
					ctx.restore();
				}
			}

			if (hand.handedness === "Left" && hand.keypoints3D) {
				const rawAngles = getHandEulerAngles(hand.keypoints3D);
				const { yaw, pitch, roll } = smoothAngles(rawAngles, 0.2); // alpha=0.2, im mniejsze tym większe wygładzenie
				setHandAngles({ yaw, pitch, roll });
				const wrist = hand.keypoints[0];
				ctx.save();
				ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
				ctx.font = "18px Arial";
				ctx.fillStyle = "yellow";
				ctx.textAlign = "center";
				ctx.fillText(`Yaw: ${yaw.toFixed(0)}°`, canvas.width - wrist.x, wrist.y - 40);
				ctx.fillText(`Pitch: ${pitch.toFixed(0)}°`, canvas.width - wrist.x, wrist.y - 20);
				ctx.fillText(`Roll: ${roll.toFixed(0)}°`, canvas.width - wrist.x, wrist.y);
				ctx.restore();
			}
		});
	};
	return (
		<>
			<Script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands"></Script>
			<Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core"></Script>
			<Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl"></Script>
			<Script
				src="https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection"
				onReady={() => {
					setIsLibraryLoaded(true);
				}}
			/>

			<div className="relative w-1/2 aspect-4/3">
				{/* Wideo pod spodem */}
				<video
					ref={videoRef}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						transform: "scaleX(-1)",
					}}
					playsInline
					muted
				/>

				{/* Canvas na wierzchu */}
				<canvas
					ref={canvasRef}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						transform: "scaleX(-1)", // Canvas też musimy odwrócić, żeby pasował do wideo
					}}
				/>

				{!isLibraryLoaded && (
					<div
						style={{
							position: "absolute",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -50%)",
							color: "white",
							background: "rgba(0,0,0,0.7)",
							padding: "10px",
						}}
					>
						Ładowanie modelu...
					</div>
				)}
			</div>
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
				<Cube3D yaw={handAngles.yaw} pitch={handAngles.pitch} roll={handAngles.roll} scale={cubeScale * 20} />
			</div>
			<div>Hand Detection Module</div>
		</>
	);
}
