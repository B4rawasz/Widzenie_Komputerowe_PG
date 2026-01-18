import LessonsClient from "@/components/lessons/lessonsClient";
import { getAllLessonsMetadata } from "@/lib/mdx-utils";

export default function LessonPage() {
	const lessons = getAllLessonsMetadata();

	return <LessonsClient lessons={lessons} />;
}
