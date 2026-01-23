import React, { useRef, useEffect, JSX } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

type Cube3DProps = {
	yaw: number;
	pitch: number;
	roll: number;
	scale: number;
};

function degToRad(deg: number) {
	return (deg * Math.PI) / 180;
}

const MyObjModel: React.FC<Cube3DProps> = ({ yaw, pitch, roll, scale }) => {
	const { scene } = useGLTF("/3D/Laptop.glb");
	const baseRef = useRef<any>(null);
	const meshRef = useRef<any>(null);

	useEffect(() => {
		if (baseRef.current) {
			baseRef.current.rotation.y = degToRad(90); // korekta bazowa
		}
		if (meshRef.current) {
			meshRef.current.position.y = -1;
		}
	}, [scene]);

	useFrame(() => {
		if (meshRef.current) {
			meshRef.current.rotation.set(-degToRad(roll), degToRad(yaw), degToRad(pitch));
			meshRef.current.scale.set(scale, scale, scale);
		}
	});

	return (
		<group ref={baseRef}>
			<primitive ref={meshRef} object={scene} />
		</group>
	);
};

const Cube3D: React.FC<Cube3DProps> = ({ yaw, pitch, roll, scale }) => (
	<Canvas style={{ width: "200px", height: "200px", background: "#222" }}>
		<ambientLight />
		<pointLight position={[5, 5, 5]} />
		<MyObjModel yaw={yaw} pitch={pitch} roll={roll} scale={scale} />
	</Canvas>
);

export default Cube3D;
