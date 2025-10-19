import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ lessonSlug: string; partSlug: string }> }) {
	const { lessonSlug, partSlug } = await params;
	const { MDXelement, metadata } = await import(`@/content/${lessonSlug}/${partSlug}.mdx`)
		.then((mod) => ({ MDXelement: mod.default, metadata: mod.frontmatter }))
		.catch(() => ({ MDXelement: null, metadata: null }));

	if (!MDXelement) {
		return notFound();
	}

	console.log("Metadata:", metadata);

	return <MDXelement />;
}

/*export function generateStaticParams() {
  return [
    { lessonSlug: 'welcome', partSlug: 'intro' },
    { lessonSlug: 'about', partSlug: 'team' }
  ]
}
 
export const dynamicParams = false*/
