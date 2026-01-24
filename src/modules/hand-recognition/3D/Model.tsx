import React, { useRef, useEffect, JSX } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

type Model3DProps = {
	yaw: number;
	pitch: number;
	roll: number;
	scale: number;
};

function degToRad(deg: number) {
	return (deg * Math.PI) / 180;
}

const MyObjModel: React.FC<Model3DProps> = ({ yaw, pitch, roll, scale }) => {
	const { scene } = useGLTF("/3D/Laptop.glb");
	const baseRef = useRef<any>(null);
	const meshRef = useRef<any>(null);

	useEffect(() => {
		if (baseRef.current) {
			baseRef.current.rotation.y = degToRad(90); // base correction
		}
		if (meshRef.current) {
			meshRef.current.position.y = -1; // adjust model position
		}
	}, [scene]);

	useFrame(() => {
		if (meshRef.current) {
			meshRef.current.rotation.set(-degToRad(roll), degToRad(yaw), degToRad(pitch)); // Adjust axes as needed
			meshRef.current.scale.set(scale, scale, scale); // Uniform scaling
		}
	});

	return (
		<group ref={baseRef}>
			<primitive ref={meshRef} object={scene} />
		</group>
	);
};

export default function Laptop3D({
	yaw,
	pitch,
	roll,
	scale,
	className,
}: Model3DProps & { className?: string }): JSX.Element {
	return (
		<Canvas className={className} style={{ width: "100%", height: "100%" }}>
			<ambientLight />
			<pointLight position={[5, 5, 5]} />
			<MyObjModel yaw={yaw} pitch={pitch} roll={roll} scale={scale} />
		</Canvas>
	);
}
