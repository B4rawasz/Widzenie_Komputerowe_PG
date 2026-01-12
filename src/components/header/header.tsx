import { ThemeToggle } from "@/components/theme/theme-toggle";
import Image from "next/image";

export default function Header() {
	return (
		<div className="pb-16">
			<header className="fixed top-0 left-0 z-10 w-full h-16 px-8 flex flex-row items-center justify-between border-b border-foreground/20 bg-background/50 backdrop-blur-md">
				<Image alt="Logo" src="/logo_full.svg" width={0} height={0} className="dark:invert w-30 h-auto" />
				<ThemeToggle />
			</header>
		</div>
	);
}
