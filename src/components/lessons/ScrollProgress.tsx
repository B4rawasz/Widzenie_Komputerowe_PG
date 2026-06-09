"use client";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
	const { scrollYProgress } = useScroll();
	const scaleX = useSpring(scrollYProgress, {
		stiffness: 100,
		damping: 30,
		restDelta: 0.001,
	});

	const [bottomOffset, setBottomOffset] = useState(0);

	useEffect(() => {
		const handleScroll = () => {
			const footer = document.querySelector("footer");
			if (!footer) return;

			const footerRect = footer.getBoundingClientRect();
			const windowHeight = window.innerHeight;

			// If footer is visible in the viewport, adjust the offset to sit above it
			if (footerRect.top < windowHeight) {
				setBottomOffset(Math.max(0, windowHeight - footerRect.top));
			} else {
				setBottomOffset(0);
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<motion.div
			className="fixed left-0 right-0 h-1.5 bg-primary origin-left z-50"
			style={{ scaleX, bottom: bottomOffset }}
		/>
	);
}
