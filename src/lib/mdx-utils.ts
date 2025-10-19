import fs from "fs";
import path from "path";
import matter from "gray-matter"; // 💡 The dependency for quick frontmatter extraction

// Define the root content directory
const CONTENT_DIR = path.join(process.cwd(), "src", "content");

// Define the expected structure of the metadata you need
export type LessonPartMetadata = {
	slug: string;
	lessonSlug: string;
	title: string;
	order: number; // Used for sorting the sidebar items
};

/**
 * Scans a specific lesson directory and uses 'gray-matter' to quickly extract
 * the YAML frontmatter (metadata) from all MDX files for building a sidebar.
 * * This avoids running the full MDX compilation pipeline, making it very fast.
 */
export function getAllLessonPartsMetadata(lessonSlug: string): LessonPartMetadata[] {
	const lessonDir = path.join(CONTENT_DIR, lessonSlug);

	// 1. Check if the directory exists
	if (!fs.existsSync(lessonDir)) {
		console.warn(`Lesson directory not found: ${lessonDir}`);
		return [];
	}

	// 2. Read all .mdx files in that directory
	const filenames = fs.readdirSync(lessonDir).filter((name) => name.endsWith(".mdx"));

	const parts = filenames.map((filename) => {
		const filePath = path.join(lessonDir, filename);
		const fileContents = fs.readFileSync(filePath, "utf8");

		// 3. Use gray-matter to separate the metadata (data) from the content
		const { data } = matter(fileContents);

		// 4. Extract the slug and construct the metadata object
		const slug = filename.replace(".mdx", "");

		// We type-cast the metadata to ensure we return the expected structure
		// with sensible fallbacks (e.g., if title/order is missing).
		return {
			slug,
			lessonSlug,
			title: (data.title as string) || slug,
			order: (data.order as number) || 999, // Lower number means earlier in the list
		} as LessonPartMetadata;
	});

	// 5. Sort the parts based on the 'order' field extracted from frontmatter
	return parts.sort((a, b) => a.order - b.order);
}
