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
		<nav className="flex flex-row justify-between">
			{prevPage ? (
				<Button asChild variant="secondary">
					<Link href={prevPage.slug}>
						<ArrowLeft />
						{prevPage.title}
					</Link>
				</Button>
			) : (
				<span />
			)}
			{nextPage ? (
				<Button asChild>
					<Link href={nextPage.slug}>
						{nextPage.title}
						<ArrowRight />
					</Link>
				</Button>
			) : (
				<span />
			)}
		</nav>
	);
}
