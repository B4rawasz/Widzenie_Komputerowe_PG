import { notFound } from "next/navigation";
import { generateStaticParamsForLessons } from "@/lib/mdx-utils";
import { Metadata } from "next";

type MDXFrontmatter = {
	title?: string;
	description?: string;
	[key: string]: any;
};

type MDXModule = {
	default: React.ComponentType;
	frontmatter: MDXFrontmatter;
};

async function getLessonPartData(lessonSlug: string, partSlug: string): Promise<MDXModule | null> {
	try {
		const mod = (await import(`@/content/${lessonSlug}/parts/${partSlug}.mdx`)) as MDXModule;

		return mod;
	} catch (error) {
		console.error("Failed to load lesson part:", { lessonSlug, partSlug, error });
		return null;
	}
}

export default async function LessonPartPage({
	params,
}: {
	params: Promise<{ lessonSlug: string; partSlug: string }>;
}) {
	const { lessonSlug, partSlug } = await params;

	const data = await getLessonPartData(lessonSlug, partSlug);

	if (!data) {
		notFound();
	}

	const ContentComponent = data.default;
	const metadata = data.frontmatter;

	return (
		<article id="lessonContent" className="prose lg:prose-xl max-w-4xl py-8">
			<h1 className="mb-12">{metadata?.title || partSlug}</h1>

			<ContentComponent />
		</article>
	);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lessonSlug: string; partSlug: string }>;
}): Promise<Metadata> {
	const { lessonSlug, partSlug } = await params;

	const data = await getLessonPartData(lessonSlug, partSlug);

	if (!data) {
		return { title: "Lesson Part Not Found" };
	}

	const metadata = data.frontmatter;

	return {
		title: metadata?.title || partSlug,
		description: metadata?.description || `A lesson part about ${partSlug}.`,
	};
}

export function generateStaticParams() {
	return generateStaticParamsForLessons();
}

export const dynamicParams = false;
