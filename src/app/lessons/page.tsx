import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { getAllLessonPartsMetadata, getAllLessonsMetadata } from "@/lib/mdx-utils";
import Link from "next/link";

export default function LessonPage() {
	const data = getAllLessonsMetadata();

	data.sort((a, b) => a.order - b.order);

	const partsSlug = data.map((lesson) => lesson.slug);

	const parts = partsSlug.map((slug) => {
		return getAllLessonPartsMetadata(slug);
	});

	const lessonsWithParts = data.map((lesson, idx) => ({
		...lesson,
		parts: parts[idx],
	}));

	const lessonsList = lessonsWithParts.map((lesson) => (
		<Card key={lesson.slug}>
			<CardHeader>
				<Button asChild variant="ghost" size={"sm"} className="text-lg">
					<Link href={`/lessons/${lesson.slug}`} className="flex items-center gap-2">
						{lesson.title}
					</Link>
				</Button>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				{lesson.coverImage && (
					<img src={lesson.coverImage} alt={`${lesson.title} cover`} className="w-full h-auto rounded-md" />
				)}
				<p>{lesson.description}</p>
				{lesson.parts.map((part: any) => (
					<Button asChild variant="ghost" size={"sm"} key={part.slug}>
						<Link href={`/lessons/${lesson.slug}/${part.slug}`} className="text-muted-foreground">
							{part.title}
						</Link>
					</Button>
				))}
			</CardContent>
		</Card>
	));

	return (
		<div className="w-full flex flex-col items-center">
			<div className="xl:w-2/3 grid grid-cols-3 gap-4">{lessonsList}</div>
		</div>
	);
}
