import createMDX from "@next/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
	images: {
		remotePatterns: [new URL("https://placehold.co/**")],
	},
};

const withMDX = createMDX({
	options: {
		remarkPlugins: ["remark-frontmatter", "remark-mdx-frontmatter"],
	},
});

export default withMDX(nextConfig);
