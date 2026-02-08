"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Pause, Play, Trash2 } from "lucide-react";
import { createContext, ReactNode, use, useContext, useEffect, useRef, useState } from "react";

type PerceptronProps = {
	type: "basic" | "training" | "full";
};

type PerceptronContextType = {
	x1Value: number;
	setX1Value: (value: number | ((prev: number) => number)) => void;
	x2Value: number;
	setX2Value: (value: number | ((prev: number) => number)) => void;
	w1Value: number;
	setW1Value: (value: number | ((prev: number) => number)) => void;
	w2Value: number;
	setW2Value: (value: number | ((prev: number) => number)) => void;
	biasValue: number;
	setBiasValue: (value: number | ((prev: number) => number)) => void;
	outputValue: number;
	predictedOutValue: number;
	setPredictedOutValue: (value: number | ((prev: number) => number)) => void;
	training: boolean;
	setTraining: (value: boolean | ((prev: boolean) => boolean)) => void;
	selectedClass: number;
	setSelectedClass: (value: number | ((prev: number) => number)) => void;
	points2d: { x: number; y: number; label: number }[];
	setPoints2d: (
		value:
			| { x: number; y: number; label: number }[]
			| ((prev: { x: number; y: number; label: number }[]) => { x: number; y: number; label: number }[]),
	) => void;
	speedValue: number;
	setSpeedValue: (value: number | ((prev: number) => number)) => void;
};

// Context for sharing perceptron values across components
// This allows us to have a single source of truth for the perceptron state and easily access it from any component within the provider.
const PerceptronContext = createContext<PerceptronContextType | undefined>(undefined);

export function PerceptronProvider({ children }: { children: ReactNode }) {
	const [x1Value, setX1Value] = useState(-0.5);
	const [x2Value, setX2Value] = useState(0.75);
	const [w1Value, setW1Value] = useState(0.5);
	const [w2Value, setW2Value] = useState(-0.25);
	const [biasValue, setBiasValue] = useState(0);
	const [outputValue, setOutputValue] = useState(x1Value * w1Value + x2Value * w2Value + biasValue >= 0 ? 1 : 0);
	const [predictedOutValue, setPredictedOutValue] = useState(1);
	const [training, setTraining] = useState(false);
	const [selectedClass, setSelectedClass] = useState(0);
	const [points2d, setPoints2d] = useState<{ x: number; y: number; label: number }[]>([]);
	const [speedValue, setSpeedValue] = useState(0);
	// Recalculate output whenever any of the perceptron parameters change
	useEffect(() => {
		const output = x1Value * w1Value + x2Value * w2Value + biasValue >= 0 ? 1 : 0;
		setOutputValue(output);
	}, [x1Value, x2Value, w1Value, w2Value, biasValue]);

	return (
		<PerceptronContext.Provider
			value={{
				x1Value,
				setX1Value,
				x2Value,
				setX2Value,
				w1Value,
				setW1Value,
				w2Value,
				setW2Value,
				biasValue,
				setBiasValue,
				outputValue,
				predictedOutValue,
				setPredictedOutValue,
				training,
				setTraining,
				selectedClass,
				setSelectedClass,
				points2d,
				setPoints2d,
				speedValue,
				setSpeedValue,
			}}
		>
			{children}
		</PerceptronContext.Provider>
	);
}

export function usePerceptron() {
	const context = useContext(PerceptronContext);
	if (!context) {
		throw new Error("usePerceptron must be used within PerceptronProvider");
	}
	return context;
}

export function Perceptron({ type }: PerceptronProps) {
	// Perceptron values
	const {
		x1Value,
		setX1Value,
		x2Value,
		setX2Value,
		w1Value,
		setW1Value,
		w2Value,
		setW2Value,
		biasValue,
		setBiasValue,
		outputValue,
		predictedOutValue,
		setPredictedOutValue,
		training,
		setTraining,
		selectedClass,
		setSelectedClass,
		points2d,
		setPoints2d,
		speedValue,
		setSpeedValue,
	} = usePerceptron();

	// Colors
	const [foreground, setForeground] = useState("#ffffff");
	const [primary, setPrimary] = useState("#000000");
	const [destructive, setDestructive] = useState("#000000");

	useEffect(() => {
		const updateColors = () => {
			const fg = getComputedStyle(document.documentElement).getPropertyValue("--color-foreground").trim();
			const primary = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
			const destructive = getComputedStyle(document.documentElement).getPropertyValue("--color-destructive").trim();
			setForeground(fg);
			setPrimary(primary);
			setDestructive(destructive);
		};

		// Ustaw kolory początkowe
		updateColors();

		// Nasłuchuj zmian klasy na elemencie html
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === "attributes" && mutation.attributeName === "class") {
					updateColors();
				}
			});
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	// Motion values for animations
	const x1Motion = useMotionValue(x1Value);
	const x1Stroke = useTransform(x1Motion, [-1, 0, 1], [destructive, foreground, primary]);
	const x2Motion = useMotionValue(x2Value);
	const x2Stroke = useTransform(x2Motion, [-1, 0, 1], [destructive, foreground, primary]);
	const w1Motion = useMotionValue(w1Value);
	const w1Stroke = useTransform(w1Motion, [-2, 0, 2], [destructive, foreground, primary]);
	const w2Motion = useMotionValue(w2Value);
	const w2Stroke = useTransform(w2Motion, [-2, 0, 2], [destructive, foreground, primary]);
	const biasMotion = useMotionValue(biasValue);
	const biasStroke = useTransform(biasMotion, [-1, 0, 1], [destructive, foreground, primary]);
	const outputMotion = useMotionValue(outputValue);
	const outputStroke = useTransform(outputMotion, [0, 1], [destructive, primary]);

	useEffect(() => {
		x1Motion.set(x1Value);
	}, [x1Value, x1Motion]);

	useEffect(() => {
		x2Motion.set(x2Value);
	}, [x2Value, x2Motion]);

	useEffect(() => {
		w1Motion.set(w1Value);
	}, [w1Value, w1Motion]);

	useEffect(() => {
		w2Motion.set(w2Value);
	}, [w2Value, w2Motion]);

	useEffect(() => {
		biasMotion.set(biasValue);
	}, [biasValue, biasMotion]);

	useEffect(() => {
		outputMotion.set(outputValue);
	}, [outputValue, outputMotion]);

	// Training logic

	const outputValueRef = useRef(outputValue);

	useEffect(() => {
		outputValueRef.current = outputValue;
	}, [outputValue]);

	const trainPerceptron = () => {
		setTraining(true);

		const learningRate = 0.1;

		const step = () => {
			const error = predictedOutValue - outputValueRef.current;
			setW1Value((prev) => prev + learningRate * error * x1Value);
			setW2Value((prev) => prev + learningRate * error * x2Value);
			setBiasValue((prev) => prev + learningRate * error);

			if (error == 0) {
				setTraining(false);
				return;
			}

			setTimeout(() => {
				step();
			}, 1000);
		};

		setTimeout(() => {
			step();
		}, 1000);
	};

	// 2D

	const circleVariants = {
		initial: { opacity: 0, r: 0 },
		animate: {
			opacity: 1,
			r: 8,
			transition: {
				type: "spring" as const,
				mass: 2,
				damping: 15,
				stiffness: 150,
			},
		},
		exit: {
			opacity: 0,
			r: 0,
			transition: {
				duration: 0.3,
				ease: "easeIn" as const,
			},
		},
	};

	const addPoint = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
		const label = selectedClass;

		setPoints2d((prev) => [...prev, { x, y, label }]);

		console.log([...points2d, { x, y, label }]);
	};

	const clearPoints = () => {
		setPoints2d([]);
	};

	const w1ValueRef = useRef(w1Value);
	const w2ValueRef = useRef(w2Value);
	const biasValueRef = useRef(biasValue);
	const points2dRef = useRef(points2d);
	const speedValueRef = useRef(speedValue);
	const trainingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isTrainingRef = useRef(false);

	useEffect(() => {
		w1ValueRef.current = w1Value;
	}, [w1Value]);

	useEffect(() => {
		w2ValueRef.current = w2Value;
	}, [w2Value]);

	useEffect(() => {
		biasValueRef.current = biasValue;
	}, [biasValue]);

	useEffect(() => {
		points2dRef.current = points2d;
	}, [points2d]);

	useEffect(() => {
		speedValueRef.current = speedValue;
	}, [speedValue]);

	const [focusCircleCords, setFocusCircleCords] = useState({ cx: 0, cy: 0 });
	const [showFocusCircle, setShowFocusCircle] = useState(false);

	const train2d = () => {
		setTraining(true);
		isTrainingRef.current = true;

		const learningRate = 0.1;

		const step = async () => {
			let globalError = 0;
			for (const point of points2dRef.current) {
				if (!isTrainingRef.current) return;

				setFocusCircleCords({ cx: ((point.x + 1) / 2) * 400, cy: ((point.y + 1) / 2) * 400 });
				setX1Value(point.x);
				setX2Value(point.y);
				setShowFocusCircle(true);

				await new Promise((resolve) => setTimeout(resolve, 1000 * (1 - speedValueRef.current)));

				if (!isTrainingRef.current) return;

				const output = point.x * w1ValueRef.current + point.y * w2ValueRef.current + biasValueRef.current >= 0 ? 1 : 0;
				const error = point.label - output;
				globalError += Math.abs(error);

				if (error !== 0) {
					setW1Value((prev) => prev + learningRate * error * point.x);
					setW2Value((prev) => prev + learningRate * error * point.y);
					setBiasValue((prev) => prev + learningRate * error);
				}

				setShowFocusCircle(false);

				await new Promise((resolve) => setTimeout(resolve, 550 * (1 - speedValueRef.current)));
			}

			if (globalError === 0) {
				setTraining(false);
				isTrainingRef.current = false;
				return;
			}

			await new Promise((resolve) => {
				trainingTimeoutRef.current = setTimeout(resolve, 200 * (1 - speedValueRef.current));
			});

			step();
		};

		trainingTimeoutRef.current = setTimeout(
			() => {
				step();
			},
			1000 * (1 - speedValueRef.current),
		);
	};

	const pauseTraining = () => {
		setTraining(false);
		isTrainingRef.current = false;
		if (trainingTimeoutRef.current) {
			clearTimeout(trainingTimeoutRef.current);
			trainingTimeoutRef.current = null;
		}
		setShowFocusCircle(false);
	};

	useEffect(() => {
		return () => {
			isTrainingRef.current = false;
			if (trainingTimeoutRef.current) {
				clearTimeout(trainingTimeoutRef.current);
			}
		};
	}, []);

	// Draw decision boundary
	const map = useRef<SVGSVGElement | null>(null);
	const [lineCoords, setLineCoords] = useState({ x1: 0, y1: 0, x2: 0, y2: 400 });

	useEffect(() => {
		if (!map.current) return;

		const viewBoxWidth = 400;
		const viewBoxHeight = 400;

		if (w2Value === 0) {
			const x = -biasValue / w1Value;
			const mappedX = ((x + 1) / 2) * viewBoxWidth;
			setLineCoords({
				x1: mappedX,
				y1: 0,
				x2: mappedX,
				y2: viewBoxHeight,
			});
		} else {
			function f(x: number) {
				return -(w1Value / w2Value) * x - biasValue / w2Value;
			}

			const x1 = -1;
			const y1 = f(x1);
			const x2 = 1;
			const y2 = f(x2);

			setLineCoords({
				x1: ((x1 + 1) / 2) * viewBoxWidth,
				y1: ((y1 + 1) / 2) * viewBoxHeight,
				x2: ((x2 + 1) / 2) * viewBoxWidth,
				y2: ((y2 + 1) / 2) * viewBoxHeight,
			});
		}
	}, [w1Value, w2Value, biasValue]);

	// Element
	return (
		<div className="grid grid-cols-2 gap-4 my-6">
			{/* Manual Inputs */}
			{type === "basic" && (
				<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="x1-slider">x1</Label>
							<span className="text-muted-foreground text-sm">{x1Value.toFixed(2)}</span>
						</div>
						<Slider
							id="x1-slider"
							value={[x1Value]}
							onValueChange={(value) => setX1Value(value[0])}
							max={1}
							min={-1}
							step={0.01}
						/>
					</div>
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="x2-slider">x2</Label>
							<span className="text-muted-foreground text-sm">{x2Value.toFixed(2)}</span>
						</div>
						<Slider
							id="x2-slider"
							value={[x2Value]}
							onValueChange={(value) => setX2Value(value[0])}
							max={1}
							min={-1}
							step={0.01}
						/>
					</div>
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="w1-slider">w1</Label>
							<span className="text-muted-foreground text-sm">{w1Value.toFixed(2)}</span>
						</div>
						<Slider
							id="w1-slider"
							value={[w1Value]}
							onValueChange={(value) => setW1Value(value[0])}
							max={2}
							min={-2}
							step={0.01}
						/>
					</div>
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="w2-slider">w2</Label>
							<span className="text-muted-foreground text-sm">{w2Value.toFixed(2)}</span>
						</div>
						<Slider
							id="w2-slider"
							value={[w2Value]}
							onValueChange={(value) => setW2Value(value[0])}
							max={2}
							min={-2}
							step={0.01}
						/>
					</div>
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="bias-slider">bias</Label>
							<span className="text-muted-foreground text-sm">{biasValue.toFixed(2)}</span>
						</div>
						<Slider
							id="bias-slider"
							value={[biasValue]}
							onValueChange={(value) => setBiasValue(value[0])}
							max={1}
							min={-1}
							step={0.01}
						/>
					</div>
				</div>
			)}
			{/* Auto training */}
			{type === "training" && (
				<AnimatePresence mode="wait">
					{!training && (
						<motion.div
							className="w-full aspect-4/3 flex flex-col justify-center gap-4"
							key="training-controls"
							exit={{ opacity: 0 }}
							initial={{ opacity: 1 }}
						>
							<div className="mx-auto grid w-full max-w-xs gap-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="x1-slider">x1</Label>
									<span className="text-muted-foreground text-sm">{x1Value.toFixed(2)}</span>
								</div>
								<Slider
									id="x1-slider"
									value={[x1Value]}
									onValueChange={(value) => setX1Value(value[0])}
									max={1}
									min={-1}
									step={0.01}
								/>
							</div>
							<div className="mx-auto grid w-full max-w-xs gap-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="x2-slider">x2</Label>
									<span className="text-muted-foreground text-sm">{x2Value.toFixed(2)}</span>
								</div>
								<Slider
									id="x2-slider"
									value={[x2Value]}
									onValueChange={(value) => setX2Value(value[0])}
									max={1}
									min={-1}
									step={0.01}
								/>
							</div>
							<div className="mx-auto grid w-full max-w-xs gap-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="predictedOut-slider">Predicted output</Label>
									<span className="text-muted-foreground text-sm">{predictedOutValue.toFixed(0)}</span>
								</div>
								<Slider
									id="predictedOut-slider"
									value={[predictedOutValue]}
									onValueChange={(value) => setPredictedOutValue(value[0])}
									max={1}
									min={0}
									step={1}
								/>
							</div>
							<div className="mx-auto grid w-full max-w-xs gap-2">
								<Button onClick={trainPerceptron} disabled={training}>
									Train
									<Play />
								</Button>
							</div>
						</motion.div>
					)}
					{training && (
						<motion.div
							className="w-full aspect-4/3 flex flex-col items-center justify-center gap-1"
							key="training-state"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
						>
							<span>Training in progress...</span>
							<span>w1: {w1Value.toFixed(2)}</span>
							<span>w2: {w2Value.toFixed(2)}</span>
							<span>bias: {biasValue.toFixed(2)}</span>
							<span>learning rate: 0.01</span>
							<span>error = {(predictedOutValue - outputValue).toFixed(2)}</span>
							<span>
								new w1:{" "}
								<span
									className={
										w1Value + 0.01 * (predictedOutValue - outputValue) * x1Value > w1Value
											? "text-primary"
											: "text-destructive"
									}
								>
									{(w1Value + 0.01 * (predictedOutValue - outputValue) * x1Value).toFixed(2)}
								</span>
							</span>
							<span>
								new w2:{" "}
								<span
									className={
										w2Value + 0.01 * (predictedOutValue - outputValue) * x2Value > w2Value
											? "text-primary"
											: "text-destructive"
									}
								>
									{(w2Value + 0.01 * (predictedOutValue - outputValue) * x2Value).toFixed(2)}
								</span>
							</span>
							<span>
								new bias:{" "}
								<span
									className={
										biasValue + 0.01 * (predictedOutValue - outputValue) > biasValue
											? "text-primary"
											: "text-destructive"
									}
								>
									{(biasValue + 0.01 * (predictedOutValue - outputValue)).toFixed(2)}
								</span>
							</span>
						</motion.div>
					)}
				</AnimatePresence>
			)}
			{/* 2D visualization */}
			{type === "full" && (
				<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
					<div className="flex flex-row justify-center gap-2">
						<ToggleGroup
							type="single"
							variant="outline"
							spacing={2}
							value={`class${selectedClass}`}
							onValueChange={(value) => setSelectedClass(Number(value.replace("class", "")))}
						>
							<ToggleGroupItem value="class0" className="data-[state=on]:bg-destructive">
								Class 0
							</ToggleGroupItem>
							<ToggleGroupItem value="class1" className="data-[state=on]:bg-primary">
								Class 1
							</ToggleGroupItem>
						</ToggleGroup>
						<Button variant="outline" size="icon" onClick={clearPoints}>
							<Trash2 />
						</Button>
						<Button size="icon" onClick={train2d} disabled={training}>
							<Play />
						</Button>
						<Button variant="outline" size="icon" onClick={pauseTraining} disabled={!training}>
							<Pause />
						</Button>
					</div>
					<div className="flex-1 relative flex items-center justify-center min-h-0">
						<motion.svg
							className="w-auto h-full aspect-square bg-card rounded-md border border-border cursor-crosshair"
							viewBox="0 0 400 400"
							ref={map}
							onClick={addPoint}
						>
							<AnimatePresence>
								<motion.line
									key="decision-boundary"
									animate={{
										x1: lineCoords.x1,
										y1: lineCoords.y1,
										x2: lineCoords.x2,
										y2: lineCoords.y2,
									}}
									stroke={foreground}
									strokeWidth={2}
									transition={{
										duration: 0.5,
										ease: "easeInOut",
									}}
								/>
								{showFocusCircle && (
									<motion.circle
										key="focus-circle"
										cx={focusCircleCords.cx}
										cy={focusCircleCords.cy}
										r={15}
										fill="transparent"
										stroke={foreground}
										strokeWidth={3}
										initial={{ opacity: 0, r: 0 }}
										animate={{ opacity: 1, r: 15, transition: { duration: 0.2 } }}
									/>
								)}
								{points2d.map((point, index) => (
									<motion.circle
										key={index}
										cx={((point.x + 1) / 2) * 400}
										cy={((point.y + 1) / 2) * 400}
										r={8}
										fill={point.label === 0 ? destructive : primary}
										variants={circleVariants}
										initial="initial"
										animate="animate"
										exit="exit"
									/>
								))}
							</AnimatePresence>
						</motion.svg>
					</div>
					<div className="flex flex-row justify-center gap-2">
						<div className="mx-auto grid w-full max-w-xs gap-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="speed-slider">Speed</Label>
								<span className="text-muted-foreground text-sm">{speedValue.toFixed(2)}</span>
							</div>
							<Slider
								id="speed-slider"
								value={[speedValue]}
								onValueChange={(value) => setSpeedValue(value[0])}
								max={1}
								min={0}
								step={0.01}
							/>
						</div>
					</div>
				</div>
			)}
			<div className="w-full aspect-4/3">
				<motion.svg className="w-full h-full" viewBox="0 0 400 300">
					{/* X1 */}
					<motion.circle
						r={30}
						cx={40}
						cy={80}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: x1Stroke }}
					/>

					<motion.line x1={68} y1={97} x2={109} y2={125} stroke={x1Stroke} strokeWidth={5} strokeLinecap={"round"} />

					<text
						x={40}
						y={80}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						{x1Value.toFixed(2)}
					</text>

					<text
						x={40}
						y={35}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						x1
					</text>

					{/* X2 */}
					<motion.circle
						r={30}
						cx={40}
						cy={220}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: x2Stroke }}
					/>

					<motion.line x1={68} y1={203} x2={109} y2={170} stroke={x2Stroke} strokeWidth={5} strokeLinecap={"round"} />

					<text
						x={40}
						y={220}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						{x2Value.toFixed(2)}
					</text>

					<text
						x={40}
						y={265}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						x2
					</text>

					{/* W1 */}
					<motion.rect
						x={140}
						y={10}
						width={50}
						height={40}
						rx={10}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: w1Stroke }}
					/>

					<motion.line x1={165} y1={50} x2={180} y2={94} stroke={w1Stroke} strokeWidth={5} strokeLinecap={"round"} />

					<text
						x={165}
						y={30}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						{w1Value.toFixed(2)}
					</text>

					<text
						x={120}
						y={30}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						w1
					</text>

					{/* W2 */}
					<motion.rect
						x={210}
						y={10}
						width={50}
						height={40}
						rx={10}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: w2Stroke }}
					/>

					<motion.line x1={235} y1={50} x2={220} y2={94} stroke={w2Stroke} strokeWidth={5} strokeLinecap={"round"} />

					<text
						x={235}
						y={30}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						{w2Value.toFixed(2)}
					</text>

					<text
						x={280}
						y={30}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						w2
					</text>

					{/* Bias */}
					<motion.rect
						x={175}
						y={250}
						width={50}
						height={40}
						rx={10}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: biasStroke }}
					/>

					<motion.line
						x1={200}
						y1={206}
						x2={200}
						y2={249}
						stroke={biasStroke}
						strokeWidth={5}
						strokeLinecap={"round"}
					/>

					<text
						x={200}
						y={270}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						{biasValue.toFixed(2)}
					</text>

					<text
						x={250}
						y={270}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						bias
					</text>

					{/* Output */}
					<motion.circle
						r={30}
						cx={360}
						cy={150}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: outputStroke }}
					/>

					<motion.line
						x1={330}
						y1={150}
						x2={291}
						y2={150}
						stroke={outputStroke}
						strokeWidth={5}
						strokeLinecap={"round"}
					/>

					<text
						x={360}
						y={150}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						{outputValue.toFixed(0)}
					</text>

					<text
						x={360}
						y={105}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						output
					</text>

					{/* Perceptron */}
					<motion.rect
						x={110}
						y={95}
						width={180}
						height={110}
						rx={15}
						fill="transparent"
						strokeWidth={5}
						strokeLinecap={"round"}
						style={{ stroke: "var(--color-foreground)" }}
					/>

					<text
						x={120}
						y={115}
						textAnchor="start"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						<tspan>
							&nbsp;&nbsp;&nbsp;{x1Value.toFixed(2)} * {w1Value.toFixed(2)}
						</tspan>
						<tspan x={120} dy={20}>
							+ {x2Value.toFixed(2)} * {w2Value.toFixed(2)}
						</tspan>
						<tspan x={120} dy={20}>
							+ {biasValue.toFixed(2)} = {(x1Value * w1Value + x2Value * w2Value + biasValue).toFixed(2)}
						</tspan>
					</text>

					<motion.rect x={233} y={103} width={50} height={45} rx={10} fill={foreground} opacity={0.1} strokeWidth={0} />

					<text
						x={275}
						y={115}
						textAnchor="end"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						<tspan fill={x1Value * w1Value >= 0 ? primary : destructive}>{(x1Value * w1Value).toFixed(2)}</tspan>
						<tspan x={275} dy={20} fill={x2Value * w2Value >= 0 ? primary : destructive}>
							{(x2Value * w2Value).toFixed(2)}
						</tspan>
					</text>

					<text
						x={200}
						y={185}
						textAnchor="middle"
						dominantBaseline="central"
						fill={foreground}
						fontSize={16}
						fontWeight="bold"
					>
						<tspan>
							{(x1Value * w1Value + x2Value * w2Value + biasValue).toFixed(2)} {">"}= 0 ?
						</tspan>
						<tspan fill={outputValue == 1 ? primary : foreground}> 1</tspan>
						<tspan> : </tspan>
						<tspan fill={outputValue == 0 ? destructive : foreground}>0</tspan>
					</text>
				</motion.svg>
			</div>
		</div>
	);
}
