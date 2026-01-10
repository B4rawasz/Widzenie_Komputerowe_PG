import Link from "next/link";
import { getAllLessonPartsMetadata, getLessonMetadata } from "@/lib/mdx-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import { TableOfContents } from "@/components/mdx/toc";

function getIconComponent(iconName?: string) {
	if (!iconName) return null;

	const Icon = (Icons as any)[iconName];

	if (!Icon) {
		console.warn(`Icon "${iconName}" not found in lucide-react`);
		return null;
	}

	return <Icon />;
}

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
		<div className="flex flex-row">
			<aside className="xl:w-1/4 relative">
				<nav className="p-10 flex flex-col items-end sticky top-16 h-fit">
					<span className="w-2/3 mb-2">
						<Button asChild variant="ghost" size={"sm"} className="text-lg">
							<Link href={`/lessons/${lessonSlug}`} className="flex items-center gap-2">
								{getIconComponent(lesson?.icon)}
								{lesson?.title || lessonSlug}
							</Link>
						</Button>
					</span>
					<ScrollArea className="w-2/3 h-[75vh]">
						<div className="flex flex-col items-start gap-1">
							{parts.map((part) => (
								<Button asChild variant="ghost" size={"sm"} key={part.slug}>
									<Link href={`/lessons/${lessonSlug}/${part.slug}`} className="text-muted-foreground">
										{getIconComponent(part.icon)}
										{part.title}
									</Link>
								</Button>
							))}
						</div>
					</ScrollArea>
				</nav>
			</aside>

			<main className="xl:w-1/2">{children}</main>

			<aside className="hidden lg:block xl:w-1/4 sticky top-16 h-fit p-10">
				<TableOfContents />
			</aside>
		</div>
	);
}
