import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

export type LessonPartMetadata = {
	slug: string;
	lessonSlug: string;
	title: string;
	order: number;
};

export function getAllLessonPartsMetadata(lessonSlug: string): LessonPartMetadata[] {
	const lessonDir = path.join(CONTENT_DIR, lessonSlug);

	if (!fs.existsSync(lessonDir)) {
		console.warn(`Lesson directory not found: ${lessonDir}`);
		return [];
	}

	const filenames = fs.readdirSync(lessonDir).filter((name) => name.endsWith(".mdx"));

	const parts = filenames.map((filename) => {
		const filePath = path.join(lessonDir, filename);
		const fileContents = fs.readFileSync(filePath, "utf8");

		const { data } = matter(fileContents);

		const slug = filename.replace(".mdx", "");

		return {
			slug,
			lessonSlug,
			title: (data.title as string) || slug,
			order: (data.order as number) || 999,
		} as LessonPartMetadata;
	});

	return parts.sort((a, b) => a.order - b.order);
}

export function generateStaticParamsForLessons() {
	const lessonSlugs = fs
		.readdirSync(CONTENT_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	const allParams: { lessonSlug: string; partSlug: string }[] = [];

	for (const lessonSlug of lessonSlugs) {
		const lessonDir = path.join(CONTENT_DIR, lessonSlug);

		const filenames = fs.readdirSync(lessonDir).filter((name) => name.endsWith(".mdx"));

		for (const filename of filenames) {
			const partSlug = filename.replace(".mdx", "");

			allParams.push({
				lessonSlug: lessonSlug,
				partSlug: partSlug,
			});
		}
	}

	return allParams;
}
