import createMDX from "@next/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
	images: {
		remotePatterns: [new URL("https://placehold.co/**")],
	},
};

/** @type {import('rehype-pretty-code').Options} */
const options = {
	theme: {
		light: "github-light",
		dark: "github-dark",
	},
};

const withMDX = createMDX({
	options: {
		remarkPlugins: [
			"remark-frontmatter",
			"remark-mdx-frontmatter",
			"remark-gfm",
			"remark-math",
			["remark-github-blockquote-alert", { legacyTitle: true }],
		],
		rehypePlugins: [["rehype-pretty-code", options], "rehype-katex"],
	},
});

export default withMDX(nextConfig);
