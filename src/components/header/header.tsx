import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Header() {
	return (
		<div className="pb-16">
			<header className="fixed top-0 left-0 z-10 w-full h-16 px-8 flex flex-row items-center justify-between border-b border-primary/20 bg-background/50 backdrop-blur-md">
				<h1 className="text-xl font-bold">Computer Vision PG</h1>
				<ThemeToggle />
			</header>
		</div>
	);
}
