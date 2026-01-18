import { getAllLessonPartsMetadata, getLessonMetadata } from "@/lib/mdx-utils";
import { TableOfContents } from "@/components/mdx/toc";
import { NavClient } from "@/components/mdx/nav";
import PageNav from "@/components/mdx/page-nav";

export default async function LessonLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: { lessonSlug: string };
}) {
	const { lessonSlug } = await params;

	const parts = getAllLessonPartsMetadata(lessonSlug);
	const lesson = getLessonMetadata(lessonSlug);

	return (
		<div className="max-w-360 mx-auto flex flex-row">
			<aside className="w-1/5 sticky top-16 min-h-[calc(100vh-8rem)] max-h-[calc(100vh-4rem)] px-2 flex flex-col">
				<NavClient lessonSlug={lessonSlug} lesson={lesson} parts={parts} />
			</aside>

			<main className="flex-1 mb-2 flex flex-col justify-between">
				{children}
				<PageNav lesson={lesson} parts={parts} />
			</main>

			<aside className="w-1/5 sticky top-16 min-h-[calc(100vh-8rem)] max-h-[calc(100vh-4rem)] px-2 flex flex-col pt-8">
				<TableOfContents />
			</aside>
		</div>
	);
}
