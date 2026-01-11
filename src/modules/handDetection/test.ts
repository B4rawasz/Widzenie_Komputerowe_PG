export const loadHandsModule = async () => {
	if (typeof window !== "undefined") {
		const { Hands } = await import("@mediapipe/hands");
		return { Hands };
	}
	return null;
};
