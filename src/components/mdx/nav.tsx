"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import type { LessonMetadata, LessonPartMetadata } from "@/lib/mdx-utils";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

function getIconComponent(iconName?: string) {
	if (!iconName) return null;

	const Icon = (Icons as any)[iconName];

	if (!Icon) {
		console.warn(`Icon "${iconName}" not found in lucide-react`);
		return null;
	}

	return <Icon />;
}

export function NavClient({
	lessonSlug,
	lesson,
	parts,
}: {
	lessonSlug: string;
	lesson: LessonMetadata | null;
	parts: LessonPartMetadata[];
}) {
	const pathname = usePathname();
	const isLessonRoot = pathname === `/lessons/${lessonSlug}`;

	return (
		<motion.div
			initial={{ opacity: 0, x: -40 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.5, ease: "easeOut" }}
		>
			<div className="mt-10 mb-3">
				<motion.div
					initial={{ opacity: 0, x: -40 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.4, ease: "easeOut", delay: 0 }}
				>
					<Button asChild variant={isLessonRoot ? "default" : "ghost"} size={"sm"} className="text-lg">
						<Link href={`/lessons/${lessonSlug}`} className="flex items-center gap-2">
							{getIconComponent(lesson?.icon)}
							{lesson?.title || lessonSlug}
						</Link>
					</Button>
				</motion.div>
			</div>

			<ScrollArea className="flex-1 min-h-0 pr-2">
				<div className="flex flex-col items-start gap-1">
					{parts.map((part, idx) => (
						<motion.div
							key={part.slug}
							initial={{ opacity: 0, x: -40 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{
								duration: 0.4,
								ease: "easeOut",
								delay: (idx + 1) * 0.07, // opóźnienie dla efektu "po kolei"
							}}
						>
							<Button
								asChild
								variant={pathname === `/lessons/${lessonSlug}/${part.slug}` ? "default" : "ghost"}
								size={"sm"}
							>
								<Link href={`/lessons/${lessonSlug}/${part.slug}`} className="text-muted-foreground flex items-center">
									{getIconComponent(part.icon)}
									{part.title}
								</Link>
							</Button>
						</motion.div>
					))}
				</div>
			</ScrollArea>
		</motion.div>
	);
}
