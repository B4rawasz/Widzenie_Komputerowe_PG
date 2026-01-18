"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

interface TocItem {
	id: string;
	text: string;
	level: number;
}

export function TableOfContents() {
	const [headings, setHeadings] = useState<TocItem[]>([]);
	const [activeId, setActiveId] = useState<string>("");
	const [blobStyle, setBlobStyle] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
	const pathname = usePathname();
	const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const textRefs = useRef<Record<string, HTMLSpanElement | null>>({});
	const listRef = useRef<HTMLUListElement | null>(null);

	useEffect(() => {
		const elements = Array.from(document.querySelectorAll("h2, h3, h4"));
		const items: TocItem[] = elements.map((element) => ({
			id: element.id,
			text: element.textContent || "",
			level: parseInt(element.tagName.substring(1)),
		}));
		setHeadings(items);

		const handleScroll = () => {
			const scrollPosition = window.scrollY + 128;
			let currentId = items[0]?.id ?? "";
			for (const heading of items) {
				const el = document.getElementById(heading.id);
				if (el && el.offsetTop <= scrollPosition) {
					currentId = heading.id;
				}
			}
			setActiveId(currentId);
		};

		window.addEventListener("scroll", handleScroll);
		handleScroll();

		return () => window.removeEventListener("scroll", handleScroll);
	}, [pathname]);

	useEffect(() => {
		if (!activeId || !textRefs.current[activeId] || !listRef.current) {
			setBlobStyle(null);
			return;
		}
		const el = textRefs.current[activeId];
		const listRect = listRef.current.getBoundingClientRect();
		const rect = el!.getBoundingClientRect();
		setBlobStyle({
			top: rect.top - listRect.top - 2,
			left: rect.left - listRect.left - 8,
			width: rect.width + 16,
			height: rect.height + 4,
		});
	}, [activeId, headings]);

	const handleClick = (id: string) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	if (headings.length === 0) return null;

	return (
		<ScrollArea className="flex-1 min-h-0 pl-2 relative">
			<div className="relative ml-4">
				<ul className="text-sm my-0 relative" ref={listRef}>
					{blobStyle && (
						<motion.div
							layout
							transition={{
								type: "spring",
								stiffness: 250,
								damping: 40,
								mass: 1.5,
							}}
							style={{
								top: blobStyle.top,
								left: blobStyle.left,
								width: blobStyle.width,
								height: blobStyle.height,
								borderRadius: "9999px",
								zIndex: 0,
							}}
							className="absolute bg-primary rounded-full pointer-events-none"
						/>
					)}
					{headings.map((heading) => (
						<li
							key={heading.id}
							style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}
							className="list-none first:mt-0 relative"
						>
							<button
								ref={(el) => {
									itemRefs.current[heading.id] = el;
								}}
								onClick={() => handleClick(heading.id)}
								className={`text-left w-full hover:text-foreground transition-colors relative z-10 ${
									activeId === heading.id ? "text-foreground font-medium" : "text-muted-foreground"
								}`}
							>
								<span
									ref={(el) => {
										textRefs.current[heading.id] = el;
									}}
									className="inline-block"
								>
									{heading.text}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</ScrollArea>
	);
}
