"use client";

import { JSX, useState } from "react";
import { Check, Link } from "lucide-react";

interface HeadingProps {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	children: React.ReactNode;
	id?: string;
}

export function Heading({ level, children, id }: HeadingProps) {
	const [copied, setCopied] = useState(false);
	const Tag = `h${level}` as keyof JSX.IntrinsicElements;

	const headingId = id || generateId(children);

	const handleClick = async () => {
		const url = `${window.location.origin}${window.location.pathname}#${headingId}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Tag
			id={headingId}
			className="group relative scroll-mt-20 transition-colors cursor-pointer flex items-baseline my-6"
			onClick={handleClick}
		>
			{children}
			<button
				className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
				aria-label="Copy link to heading"
			>
				{copied ? (
					<Check className="w-[0.75em] h-[0.75em] text-green-500" />
				) : (
					<Link className="w-[0.75em] h-[0.75em]" />
				)}
			</button>
		</Tag>
	);
}

function generateId(children: React.ReactNode): string {
	const text = typeof children === "string" ? children : extractText(children);

	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function extractText(node: React.ReactNode): string {
	if (typeof node === "string") return node;
	if (typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(extractText).join("");
	if (node && typeof node === "object" && "props" in node) {
		return extractText((node as { props: { children: React.ReactNode } }).props.children);
	}
	return "";
}
