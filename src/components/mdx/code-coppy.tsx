"use client";

import { HTMLAttributes, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

function extractText(children: any): string {
	if (typeof children === "string") return children;
	if (Array.isArray(children)) {
		return children.map((child) => extractText(child)).join("");
	}
	if (children?.props?.children) {
		return extractText(children.props.children);
	}
	return "";
}

export function PreWrapper({ children, className, ...props }: HTMLAttributes<HTMLPreElement>) {
	const text = extractText(children);
	return (
		<div className="relative">
			<CodeCoppy code={text} />
			<pre className={className} {...props}>
				{children}
			</pre>
		</div>
	);
}

function CodeCoppy({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button variant={"ghost"} size="icon" onClick={handleCopy} className="absolute top-2 right-2">
			{copied ? <Check /> : <Copy />}
		</Button>
	);
}
