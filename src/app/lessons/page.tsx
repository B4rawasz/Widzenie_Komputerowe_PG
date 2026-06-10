import LessonsClient from "@/components/lessons/lessonsClient";
import { getAllLessonsMetadata } from "@/lib/mdx-utils";
import { Suspense } from "react";

export default function LessonPage() {
	const lessons = getAllLessonsMetadata();

	return (
		<Suspense fallback={<div>Ładowanie lekcji...</div>}>
			<LessonsClient lessons={lessons} />
		</Suspense>
	);
}
