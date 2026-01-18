import { notFound } from "next/navigation";

type MDXFrontmatter = {
	title?: string;
	description?: string;
	[key: string]: any;
};

type MDXModule = {
	default: React.ComponentType;
	frontmatter: MDXFrontmatter;
};

async function getLessonData(lessonSlug: string): Promise<MDXModule | null> {
	try {
		const mod = (await import(`@/content/${lessonSlug}/page.mdx`)) as MDXModule;

		return mod;
	} catch (error) {
		console.error("Failed to load lesson part:", { lessonSlug, error });
		return null;
	}
}

export default async function LessonPage({ params }: { params: Promise<{ lessonSlug: string }> }) {
	const { lessonSlug } = await params;

	const data = await getLessonData(lessonSlug);

	if (!data) {
		notFound();
	}

	const ContentComponent = data.default;
	const metadata = data.frontmatter;

	return (
		<article className="prose lg:prose-xl max-w-4xl py-8">
			<h1>{metadata?.title || lessonSlug}</h1>

			<ContentComponent />
		</article>
	);
}
