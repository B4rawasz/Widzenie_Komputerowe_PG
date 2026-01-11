"use client";

import dynamic from "next/dynamic";

const HandDetectionModule = dynamic(() => import("./handDetection"), { ssr: false });

export default function HandDetectionClient(props: any) {
	return <HandDetectionModule {...props} />;
}
