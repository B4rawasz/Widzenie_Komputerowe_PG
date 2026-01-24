"use client";

import type * as HandPoseDetectionType from "@tensorflow-models/hand-pose-detection";
import type { HandDetector } from "@tensorflow-models/hand-pose-detection";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Laptop3D from "./3D/Model";

declare global {
	interface Window {
		handPoseDetection: typeof HandPoseDetectionType;
		tf: any;
	}
}

export default function HandRecognition() {
	const initialized = useRef(false); //check if already initialized
	const videoRef = useRef<HTMLVideoElement>(null); //video element
	const canvasRef = useRef<HTMLCanvasElement>(null); //canvas for drawing
	const streamRef = useRef<MediaStream | null>(null); //media stream
	const [isLibraryLoaded, setIsLibraryLoaded] = useState(false); //loading state
	const [handAngles, setHandAngles] = useState({ yaw: 0, pitch: 0, roll: 0 }); //hand angles state
	const anglesRef = useRef({ yaw: 0, pitch: 0, roll: 0 }); //for smoothing
	const [cubeScale, setCubeScale] = useState(1); //cube scale state
	const scaleRef = useRef(1); //for smoothing

	useEffect(() => {
		if (!isLibraryLoaded) return; // wait until library is loaded

		if (initialized.current) return; // already initialized
		initialized.current = true;

		let detector: HandDetector;
		let animationFrameId: number;

		// Model initialization
		const init = async () => {
			const hp = window.handPoseDetection; // hand pose detection library

			if (!hp) {
				console.error("Hand pose detection library not found on window");
				return;
			}

			console.log("Initializing model...");

			const model = hp.SupportedModels.MediaPipeHands;
			const modelConfig: HandPoseDetectionType.MediaPipeHandsMediaPipeModelConfig = {
				runtime: "mediapipe", // mediapipe for native performance
				solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
				modelType: "full",
			};

			try {
				detector = await hp.createDetector(model, modelConfig);
				console.log("Detector created!");

				const stream = await navigator.mediaDevices.getUserMedia({
					video: { width: 640, height: 480 }, // set desired video resolution
					audio: false,
				});

				streamRef.current = stream;

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

		// Detection loop
		const detect = async () => {
			if (!videoRef.current || !detector || !canvasRef.current) return; // safety check

			// Wait until video is ready, otherwise TF throws shape errors
			if (videoRef.current.readyState < 2) {
				animationFrameId = requestAnimationFrame(detect);
				return;
			}

			try {
				const hands = await detector.estimateHands(videoRef.current); // detect hands
				drawHands(hands, canvasRef.current); // draw results
			} catch (error) {
				console.error(error);
			}

			animationFrameId = requestAnimationFrame(detect); // continue the loop
		};

		init();

		// Cleanup
		return () => {
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
			if (detector) detector.dispose();
			// Stop media stream
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
				streamRef.current = null;
			}
			// Clear video srcObject
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}

			initialized.current = false;
		};
	}, [isLibraryLoaded]);

	// 3D distance helper
	const getDistance = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) => {
		const dz = (a.z ?? 0) - (b.z ?? 0);
		return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + dz ** 2);
	};

	// Helpers: angle normalization and shortest angle difference
	const normalizeAngle = (deg: number) => {
		let a = deg;
		while (a > 180) a -= 360;
		while (a < -180) a += 360;
		return a;
	};

	// shortest difference from "from" to "to"
	const shortestDelta = (from: number, to: number) => {
		const df = normalizeAngle(to - from);
		return df;
	};

	// Stable angles: yaw from normal (XZ), roll from Y axis (XY) pitch from normal (YZ)
	const getHandEulerAngles = (keypoints3D: { x: number; y: number; z?: number }[]) => {
		const p0 = keypoints3D[0]; // wrist
		const p5 = keypoints3D[5]; // base of index finger
		const p9 = keypoints3D[9]; // base of middle finger
		const p13 = keypoints3D[13]; // base of ring finger
		const p17 = keypoints3D[17]; // base of pinky finger

		const palmBase = {
			x: (p5.x + p9.x + p13.x + p17.x) / 4,
			y: (p5.y + p9.y + p13.y + p17.y) / 4,
			z: ((p5.z ?? 0) + (p9.z ?? 0) + (p13.z ?? 0) + (p17.z ?? 0)) / 4,
		};

		// Y axis of the hand (wrist -> palm base)
		const y = { x: palmBase.x - p0.x, y: palmBase.y - p0.y, z: palmBase.z - (p0.z ?? 0) };
		const yLen = Math.hypot(y.x, y.y, y.z);
		const yNorm = { x: y.x / yLen, y: y.y / yLen, z: y.z / yLen };

		// X axis of the hand (p5 -> p17)
		const x = { x: p17.x - p5.x, y: p17.y - p5.y, z: (p17.z ?? 0) - (p5.z ?? 0) };
		const xLen = Math.hypot(x.x, x.y, x.z);
		const xNorm = { x: x.x / xLen, y: x.y / xLen, z: x.z / xLen };

		// Normal of the hand
		let zNorm = {
			x: xNorm.y * yNorm.z - xNorm.z * yNorm.y,
			y: xNorm.z * yNorm.x - xNorm.x * yNorm.z,
			z: xNorm.x * yNorm.y - xNorm.y * yNorm.x,
		};

		const zLen = Math.hypot(zNorm.x, zNorm.y, zNorm.z);
		zNorm = { x: zNorm.x / zLen, y: zNorm.y / zLen, z: zNorm.z / zLen };

		const isMirrored = true;

		// Yaw: 0 front, ~180 back
		let yaw = Math.atan2(zNorm.x, -zNorm.z) * (180 / Math.PI);
		if (isMirrored) yaw = -yaw;
		yaw = normalizeAngle(yaw + 180);
		yaw = Math.abs(yaw); // [0,180]

		// Pitch: inverted sign
		let pitch = -Math.atan2(zNorm.y, Math.hypot(zNorm.x, zNorm.z)) * (180 / Math.PI);

		// Roll: 0 when fingers are up; positive for clockwise rotation
		// angle between "screen up" vector (0, -1) and hand Y axis projected on XY
		let roll = Math.atan2(yNorm.x, -yNorm.y) * (180 / Math.PI);

		return {
			yaw,
			pitch: Math.abs(pitch) < 1e-6 ? 0 : pitch,
			roll: normalizeAngle(Math.abs(roll) < 1e-6 ? 0 : roll),
		};
	};

	// ADAPTIVE SMOOTHING + deadband + outlier protection
	const smoothAngles = (newAngles: { yaw: number; pitch: number; roll: number }, alphaScale = 1) => {
		const prev = anglesRef.current;

		const smoothOne = (prevVal: number, newVal: number) => {
			let d = shortestDelta(prevVal, newVal);
			const ad = Math.abs(d);

			// deadband
			if (ad < 0.5) return prevVal;
			// outlier guard
			if (ad > 40) d = Math.sign(d) * 40;

			// adaptive alpha, scaled by alphaScale
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

		// Clear the previous frame
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = "red";
		ctx.strokeStyle = "white";
		ctx.lineWidth = 2;

		// Definitions of finger connections (pairs of point indices)
		const fingerJoints = [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4], // Thumb
			[0, 5],
			[5, 6],
			[6, 7],
			[7, 8], // Index
			[0, 9],
			[9, 10],
			[10, 11],
			[11, 12], // Middle
			[0, 13],
			[13, 14],
			[14, 15],
			[15, 16], // Ring
			[0, 17],
			[17, 18],
			[18, 19],
			[19, 20], // Pinky
		];

		hands.forEach((hand) => {
			// 1. Drawing connections (lines)
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

			// 2. Drawing points (dots)
			hand.keypoints.forEach((keypoint) => {
				ctx.beginPath();
				ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
				ctx.fill();
			});

			// 3. Scale calculation for right hand (thumb-index distance)
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
					const clamped = Math.max(0, Math.min(1, normalized)); // always in [0,1]
					const smoothedScale = smoothScale(clamped, 0.2);
					setCubeScale(smoothedScale);

					// Center of the line in 2D
					const midX = (thumbTip2D.x + indexTip2D.x) / 2;
					const midY = (thumbTip2D.y + indexTip2D.y) / 2;
					const angle = Math.atan2(indexTip2D.y - thumbTip2D.y, indexTip2D.x - thumbTip2D.x);

					// Displaying the distance on the canvas
					ctx.save();
					ctx.setTransform(-1, 0, 0, 1, canvas.width, 0); // Mirror for right hand
					ctx.translate(canvas.width - midX, midY - 10); // Midpoint position
					ctx.rotate(-angle); // Rotation of text (negative because canvas is mirrored)
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
				const { yaw, pitch, roll } = smoothAngles(rawAngles, 0.2); // alpha=0.2, the smaller the smoother
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

			<div className="grid grid-cols-2 gap-4 my-6">
				<div className="relative w-full aspect-4/3 rounded-md overflow-hidden">
					{/* Video element for webcam feed */}
					<video ref={videoRef} className="absolute top-0 left-0 w-full h-full scale-x-[-1]" playsInline muted />
					{/* Canvas for drawing hand landmarks */}
					<canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full scale-x-[-1]" />
					{/* Loading indicator */}
					{!isLibraryLoaded && <div className="absolute top-1/2 left-1/2 translate-[-50%]">Ładowanie modelu...</div>}
				</div>
				{/* 3D Laptop Model */}
				<Laptop3D
					yaw={handAngles.yaw}
					pitch={handAngles.pitch}
					roll={handAngles.roll}
					scale={cubeScale * 15}
					className="bg-card aspect-4/3 rounded-md"
				/>
			</div>
		</>
	);
}
