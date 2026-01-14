"use client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { getAllLessonPartsMetadata } from "@/lib/mdx-utils";
import { AllLessonsMetadata } from "@/lib/mdx-utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";

export default function LessonsClient({ lessons }: { lessons: AllLessonsMetadata }) {
	const [checkedTags, setCheckedTags] = useState<string[]>([]);

	const lessonsTags = lessons.reduce((acc: string[], lesson) => {
		lesson.lesson.tags.forEach((tag) => {
			if (!acc.includes(tag)) {
				acc.push(tag);
			}
		});
		return acc;
	}, []);

	const handleCheckboxChange = (tag: string) => {
		setCheckedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
	};

	const filteredLessons =
		checkedTags.length === 0
			? lessons.map((lesson) => lesson.lesson)
			: lessons
					.map((lesson) => lesson.lesson)
					.filter((lesson) =>
						checkedTags.every((checkedTag) =>
							lesson.tags.map((t) => t.toLowerCase()).includes(checkedTag.toLowerCase())
						)
					);

	// Animations for lesson cards
	const lessonsList = (
		<AnimatePresence mode="popLayout">
			{filteredLessons.map((lesson) => (
				<motion.div
					key={lesson.slug}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					transition={{
						duration: 0.3,
						ease: "easeOut",
					}}
					className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl shadow-sm overflow-hidden"
					layout
				>
					{lesson.coverImage && (
						<div>
							<img src={lesson.coverImage} alt={lesson.title} className="w-full mask-clip-border" />
						</div>
					)}
					<div className="flex flex-col gap-2 px-6">
						<div className="flex flex-wrap gap-2">
							{lesson.tags.map((tag) => (
								<Badge key={tag}>{tag}</Badge>
							))}
						</div>
						<h3>{lesson.title}</h3>
						<div className="text-sm">{lesson.description}</div>
						<div className="flex justify-between w-full text-sm text-muted-foreground">
							<span>Progress</span>
							<span>67%</span>
						</div>
						<Progress value={67} />
						<Button asChild className="w-full mt-4 mb-6">
							<Link href={`/lessons/${lesson.slug}`}>Start Lesson</Link>
						</Button>
					</div>
				</motion.div>
			))}
		</AnimatePresence>
	);

	return (
		<div className="max-w-360 mx-auto flex flex-row">
			<aside className="xl:w-1/4 relative">
				{lessonsTags.map((tag) => (
					<div key={tag} className="flex items-center gap-3 mb-2">
						<Label htmlFor={tag.toLowerCase()} className="cursor-pointer">
							<Checkbox
								id={tag.toLowerCase()}
								className="peer hidden"
								checked={checkedTags.includes(tag)}
								onCheckedChange={() => handleCheckboxChange(tag)}
							/>
							<Badge
								variant="secondary"
								className="peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground transition-colors"
							>
								{tag}
							</Badge>
						</Label>
					</div>
				))}
			</aside>
			<div className="w-full flex flex-col">
				<h1 className="mt-8 text-3xl font-bold">All Lessons</h1>
				<span className="text-muted-foreground mb-8">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</span>
				<div className="grid grid-cols-3 gap-4">{lessonsList}</div>
			</div>
		</div>
	);
}
