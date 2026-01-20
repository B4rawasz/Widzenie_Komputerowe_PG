"use client";

import type * as HandPoseDetectionType from "@tensorflow-models/hand-pose-detection";
import type { HandDetector } from "@tensorflow-models/hand-pose-detection";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

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
				console.log(hand.keypoints3D);
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
			<div>Hand Detection Module</div>
		</>
	);
}
