import Link from "next/link";
// 💡 This utility function uses fs.readdirSync and a metadata parser (e.g., gray-matter)
import { getAllLessonPartsMetadata } from "@/lib/mdx-utils";

export default async function LessonLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: { lessonSlug: string };
}) {
	const { lessonSlug } = await params;

	// 1. Fetch metadata for ALL parts in this lesson
	const parts = getAllLessonPartsMetadata(lessonSlug);

	console.log("Lesson parts metadata:", parts);

	return (
		<div style={{ display: "flex" }}>
			{/* === SIDEBAR (Navigation) === */}
			<aside>
				<nav>
					{parts.map((part) => (
						<li key={part.slug}>
							{/* Link to the specific page.tsx */}
							<Link href={`/lessons/${lessonSlug}/${part.slug}`}>{part.title}</Link>
						</li>
					))}
				</nav>
			</aside>

			{/* === MAIN CONTENT (Page.tsx) === */}
			<main>{children}</main>
		</div>
	);
}
