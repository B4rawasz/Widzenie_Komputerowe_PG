"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TocItem {
	id: string;
	text: string;
	level: number;
}

export function TableOfContents() {
	const [headings, setHeadings] = useState<TocItem[]>([]);
	const [activeId, setActiveId] = useState<string>("");

	useEffect(() => {
		const elements = Array.from(document.querySelectorAll("h2, h3, h4"));
		const items: TocItem[] = elements.map((element) => ({
			id: element.id,
			text: element.textContent || "",
			level: parseInt(element.tagName.substring(1)),
		}));
		setHeadings(items);

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
					}
				});
			},
			{ rootMargin: "-20% 0% -35% 0%" }
		);

		elements.forEach((element) => observer.observe(element));

		return () => observer.disconnect();
	}, []);

	const handleClick = (id: string) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	if (headings.length === 0) return null;

	return (
		<nav>
			<ScrollArea className="h-[calc(100vh-200px)]">
				<ul className="text-sm my-0">
					{headings.map((heading) => (
						<li
							key={heading.id}
							style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}
							className="list-none first:mt-0"
						>
							<button
								onClick={() => handleClick(heading.id)}
								className={`text-left w-full hover:text-foreground transition-colors ${
									activeId === heading.id ? "text-foreground font-medium" : "text-muted-foreground"
								}`}
							>
								{heading.text}
							</button>
						</li>
					))}
				</ul>
			</ScrollArea>
		</nav>
	);
}
