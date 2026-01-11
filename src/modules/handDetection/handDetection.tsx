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

export default function HandDetectionModule() {
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
		});
	};

	return (
		<>
			<Script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands"></Script>
			<Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core"></Script>

			<Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl"></Script>

			{/* Sama biblioteka detekcji - onReady ustawia nam flagę */}
			<Script
				src="https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection"
				onReady={() => {
					console.log("Script loaded");
					setIsLibraryLoaded(true);
				}}
			/>
			<div style={{ position: "relative", width: 640, height: 480 }}>
				{/* Wideo pod spodem */}
				<video
					ref={videoRef}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						transform: "scaleX(-1)", // Lustrzane odbicie wideo
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
