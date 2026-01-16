"use client";
import { Label } from "@/components/ui/label";
import { AllLessonsMetadata } from "@/lib/mdx-utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function LessonsClient({ lessons }: { lessons: AllLessonsMetadata }) {
	const [checkedTags, setCheckedTags] = useState<string[]>([]);

	const lessonsTags = {
		topics: lessons.reduce((acc: string[], lesson) => {
			lesson.lesson.tags.topic.forEach((tag) => {
				if (!acc.includes(tag)) {
					acc.push(tag);
				}
			});
			return acc;
		}, []),
		skill_levels: lessons.reduce((acc: string[], lesson) => {
			if (!acc.includes(lesson.lesson.tags.skill_level)) {
				acc.push(lesson.lesson.tags.skill_level);
			}
			acc.sort((a, b) => {
				const order = ["beginner", "intermediate", "advanced"];
				return order.indexOf(a) - order.indexOf(b);
			});
			return acc;
		}, []),
	};

	const handleCheckboxChange = (tag: string) => {
		setCheckedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
	};

	const filteredLessons =
		checkedTags.length === 0
			? lessons.map((lesson) => lesson.lesson)
			: lessons
					.map((lesson) => lesson.lesson)
					.filter(
						(lesson) =>
							checkedTags.every((checkedTag) =>
								lesson.tags.skill_level.toLowerCase().includes(checkedTag.toLowerCase())
							) || lesson.tags.topic.some((tag) => checkedTags.includes(tag))
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
						duration: 0.2,
						ease: "easeOut",
					}}
					className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl shadow-sm overflow-hidden"
					layout
				>
					{lesson.coverImage && (
						<div>
							<img src={lesson.coverImage} alt={lesson.title} className="w-full mask-clip-border" />
						</div>
					)}
					<div className="flex flex-col gap-2 px-6 grow">
						<div className="flex flex-wrap gap-2">
							<Badge>{lesson.tags.skill_level}</Badge>
							{lesson.tags.topic.map((tag) => (
								<Badge key={tag}>{tag}</Badge>
							))}
						</div>
						<h3>{lesson.title}</h3>
						<div className="text-sm grow">{lesson.description}</div>
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

	function drawTags(tags: string[]) {
		return (
			<>
				{tags.map((tag) => (
					<div key={tag} className="flex">
						<Label htmlFor={tag.toLowerCase()} className="cursor-pointer w-full">
							<Checkbox
								id={tag.toLowerCase()}
								className="peer hidden"
								checked={checkedTags.includes(tag)}
								onCheckedChange={() => handleCheckboxChange(tag)}
							/>
							<Badge
								variant="secondary"
								className="peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground transition-colors w-full py-2"
							>
								{tag}
							</Badge>
						</Label>
					</div>
				))}
			</>
		);
	}

	return (
		<div className="max-w-360 mx-auto flex flex-row">
			<aside className="w-1/5 sticky top-16 min-h-[calc(100vh-8rem)] max-h-[calc(100vh-4rem)] px-2 flex flex-col">
				<h2 className="mt-8 mb-3">Filter by Tags</h2>
				<ScrollArea className="flex-1 min-h-0 pr-2">
					<div className="flex flex-col flex-wrap gap-2 pr-2">
						<h4 className="py-2 -mb-2 sticky top-0 bg-background">Skill Levels</h4>
						{drawTags(lessonsTags.skill_levels)}
						<h4 className="py-2 -mb-2 sticky top-0 bg-background">Topics</h4>
						{drawTags(lessonsTags.topics)}
					</div>
				</ScrollArea>
			</aside>
			<div className="flex-1 flex flex-col mb-4">
				<h2 className="mt-8">All Lessons</h2>
				<span className="text-muted-foreground mb-8">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</span>
				<div className="grid grid-cols-3 gap-4">{lessonsList}</div>
			</div>
		</div>
	);
}
