"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function FaviconUpdater() {
	const { theme, systemTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const currentTheme = mounted ? (theme === "system" ? systemTheme : theme) : undefined;

	useEffect(() => {
		if (!currentTheme || typeof document === "undefined") return;

		const href = currentTheme === "dark" ? "/logo_cv_64_64_b_dark.svg" : "/logo_cv_64_64_b_light.svg";

		document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());

		const link = document.createElement("link");
		link.rel = "icon";

		link.href = href;
		document.head.appendChild(link);
	}, [currentTheme]);

	return null;
}
