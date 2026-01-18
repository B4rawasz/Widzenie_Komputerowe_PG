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
	order: number;
	description: string;
	tags: {
		skill_level: "beginner" | "intermediate" | "advanced";
		topic: string[];
	};
	coverImage?: string;
	icon?: string;
};

export type AllLessonsMetadata = {
	lesson: LessonMetadata;
	parts: LessonPartMetadata[];
}[];

function sanitizeSlug(input: string): string {
	let slug = String(input).replace(/[^a-zA-Z0-9-_]/g, "-");
	slug = slug.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
	if (!slug) {
		return "part";
	}
	return slug;
}

export function getAllLessonsMetadata() {
	const lessonsFolders = fs.readdirSync(CONTENT_DIR, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());

	const lessonsMetadata: AllLessonsMetadata = lessonsFolders
		.map((dirent) => {
			const lessonSlug = dirent.name;
			const lessonMetadata = getLessonMetadata(lessonSlug);
			const lessonPartsMetadata = getAllLessonPartsMetadata(lessonSlug);
			if (!lessonMetadata) {
				return {};
			}
			return {
				lesson: lessonMetadata,
				parts: lessonPartsMetadata,
			};
		})
		.filter((item) => item.lesson !== undefined) as AllLessonsMetadata;

	lessonsMetadata.sort((a, b) => a.lesson.order - b.lesson.order);

	return lessonsMetadata;
}

export function getLessonMetadata(lessonSlug: string): LessonMetadata {
	const sanitizedLessonSlug = sanitizeSlug(lessonSlug);
	const lessonPagePath = path.join(CONTENT_DIR, sanitizedLessonSlug, "page.mdx");

	if (!fs.existsSync(lessonPagePath)) {
		console.warn(`Lesson page not found: ${lessonPagePath}`);
		return {} as LessonMetadata;
	}

	const fileContents = fs.readFileSync(lessonPagePath, "utf8");
	const { data } = matter(fileContents);

	return {
		slug: sanitizedLessonSlug,
		title: (data.title as string) || sanitizedLessonSlug,
		order: (data.order as number) || 999,
		description: (data.description as string) || "",
		tags: {
			skill_level: (data.tags?.skill_level as "beginner" | "intermediate" | "advanced") || "beginner",
			topic: (data.tags?.topic as string[]) || [],
		},
		coverImage: (data.coverImage as string) || undefined,
		icon: data.icon as string | undefined,
	};
}

export function getAllLessonPartsMetadata(lessonSlug: string): LessonPartMetadata[] {
	const sanitizedLessonSlug = sanitizeSlug(lessonSlug);
	const partsDir = path.join(CONTENT_DIR, sanitizedLessonSlug, "parts");

	if (!fs.existsSync(partsDir)) {
		console.warn(`Parts directory not found: ${partsDir}`);
		return [];
	}

	const filenames = fs.readdirSync(partsDir).filter((name) => name.endsWith(".mdx"));

	const parts = filenames.map((filename) => {
		const filePath = path.join(partsDir, filename);
		const fileContents = fs.readFileSync(filePath, "utf8");

		const { data } = matter(fileContents);

		const rawSlug = filename.replace(".mdx", "");
		const slug = sanitizeSlug(rawSlug);

		return {
			slug,
			lessonSlug: sanitizedLessonSlug,
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
		lessonSlug: sanitizeSlug(lessonSlug),
	}));
}

export function generateStaticParamsForLessons() {
	const lessonSlugs = fs
		.readdirSync(CONTENT_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	const allParams: { lessonSlug: string; partSlug: string }[] = [];

	for (const lessonSlug of lessonSlugs) {
		const sanitizedLessonSlug = sanitizeSlug(lessonSlug);
		const partsDir = path.join(CONTENT_DIR, sanitizedLessonSlug, "parts");

		if (!fs.existsSync(partsDir)) {
			continue;
		}

		const filenames = fs.readdirSync(partsDir).filter((name) => name.endsWith(".mdx"));

		for (const filename of filenames) {
			const rawPartSlug = filename.replace(".mdx", "");
			const partSlug = sanitizeSlug(rawPartSlug);

			allParams.push({
				lessonSlug: sanitizedLessonSlug,
				partSlug: partSlug,
			});
		}
	}

	return allParams;
}
