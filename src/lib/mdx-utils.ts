import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

export type LessonPartMetadata = {
	slug: string;
	lessonSlug: string;
	title: string;
	order: number;
	icon?: string;
};

export type LessonMetadata = {
	slug: string;
	title: string;
	icon?: string;
};

export function getLessonMetadata(lessonSlug: string): LessonMetadata | null {
	const lessonPagePath = path.join(CONTENT_DIR, lessonSlug, "page.mdx");

	if (!fs.existsSync(lessonPagePath)) {
		console.warn(`Lesson page not found: ${lessonPagePath}`);
		return null;
	}

	const fileContents = fs.readFileSync(lessonPagePath, "utf8");
	const { data } = matter(fileContents);

	return {
		slug: lessonSlug,
		title: (data.title as string) || lessonSlug,
		icon: data.icon as string | undefined,
	};
}

export function getAllLessonPartsMetadata(lessonSlug: string): LessonPartMetadata[] {
	const partsDir = path.join(CONTENT_DIR, lessonSlug, "parts");

	if (!fs.existsSync(partsDir)) {
		console.warn(`Parts directory not found: ${partsDir}`);
		return [];
	}

	const filenames = fs.readdirSync(partsDir).filter((name) => name.endsWith(".mdx"));

	const parts = filenames.map((filename) => {
		const filePath = path.join(partsDir, filename);
		const fileContents = fs.readFileSync(filePath, "utf8");

		const { data } = matter(fileContents);

		const slug = filename.replace(".mdx", "");

		return {
			slug,
			lessonSlug,
			title: (data.title as string) || slug,
			order: (data.order as number) || 999,
			icon: data.icon as string | undefined,
		} as LessonPartMetadata;
	});

	return parts.sort((a, b) => a.order - b.order);
}

export function generateStaticParamsForLessonPages() {
	const lessonSlugs = fs
		.readdirSync(CONTENT_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	return lessonSlugs.map((lessonSlug) => ({
		lessonSlug: lessonSlug,
	}));
}

export function generateStaticParamsForLessons() {
	const lessonSlugs = fs
		.readdirSync(CONTENT_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	const allParams: { lessonSlug: string; partSlug: string }[] = [];

	for (const lessonSlug of lessonSlugs) {
		const partsDir = path.join(CONTENT_DIR, lessonSlug, "parts");

		if (!fs.existsSync(partsDir)) {
			continue;
		}

		const filenames = fs.readdirSync(partsDir).filter((name) => name.endsWith(".mdx"));

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
