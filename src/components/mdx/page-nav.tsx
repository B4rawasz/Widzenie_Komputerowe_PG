"use client";

import type { LessonMetadata, LessonPartMetadata } from "@/lib/mdx-utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function PageNav({ lesson, parts }: { lesson: LessonMetadata; parts: LessonPartMetadata[] }) {
	const path = usePathname();

	const lessonPath = `/lessons/${lesson.slug}`;
	const pages = [
		{ slug: lessonPath, title: lesson.title },
		...parts.map((part) => ({
			slug: `${lessonPath}/${part.slug}`,
			title: part.title,
		})),
	];

	const currentIndex = pages.findIndex((page) => path === page.slug);

	const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
	const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

	return (
		<nav className="grid grid-cols-2 gap-2">
			{prevPage ? (
				<Link
					href={prevPage.slug}
					className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex flex-row gap-2 p-6 transition-all rounded-md"
				>
					<ArrowLeft />
					{prevPage.title}
				</Link>
			) : (
				<span />
			)}
			{nextPage ? (
				<Link
					href={nextPage.slug}
					className="bg-primary text-primary-foreground hover:bg-primary/80 flex flex-row gap-2 p-6 transition-all rounded-md justify-end"
				>
					{nextPage.title}
					<ArrowRight />
				</Link>
			) : (
				<span />
			)}
		</nav>
	);
}
