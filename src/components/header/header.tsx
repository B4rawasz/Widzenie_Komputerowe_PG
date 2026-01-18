"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import Image from "next/image";
import { useIsMobile } from "@/components/hooks/use-mobile";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import Link from "next/link";

export default function Header() {
	const isMobile = useIsMobile();

	return (
		<div className="pb-16">
			<header className="fixed top-0 left-0 z-10 w-full h-16 px-8 flex flex-row items-center justify-between border-b border-foreground/20 bg-background/50 backdrop-blur-md">
				<div className="flex flex-row items-center h-full gap-8">
					<Link href="/">
						<Image alt="Logo" src="/logo_full.svg" width={0} height={0} className="dark:invert w-auto h-12" />
					</Link>
					<NavigationMenu viewport={isMobile}>
						<NavigationMenuList className="flex-wrap">
							<NavigationMenuItem>
								<NavigationMenuTrigger className="bg-transparent">Lessons</NavigationMenuTrigger>
								<NavigationMenuContent>
									<div className="flex flex-row">
										<NavigationMenuLink asChild>
											<Link href="/lessons" className="w-64 p-8 flex flex-col justify-end">
												<h2>Lessons</h2>
												<span className="text-muted-foreground">Learn at your own pace and track your progress.</span>
											</Link>
										</NavigationMenuLink>
										<div>
											<NavigationMenuLink asChild>
												<Link href="/lessons?l=beginner" className="p-3 w-48">
													<span className="font-bold leading-none">Beginner</span>
													<span className="text-muted-foreground leading-none">Start your journey</span>
												</Link>
											</NavigationMenuLink>
											<NavigationMenuLink asChild>
												<Link href="/lessons?l=intermediate" className="p-3 w-48">
													<span className="font-bold leading-none">Intermediate</span>
													<span className="text-muted-foreground leading-none">Level up your skills</span>
												</Link>
											</NavigationMenuLink>
											<NavigationMenuLink asChild>
												<Link href="/lessons?l=advanced" className="p-3 w-48">
													<span className="font-bold leading-none">Advanced</span>
													<span className="text-muted-foreground leading-none">Master the concepts</span>
												</Link>
											</NavigationMenuLink>
										</div>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>
						</NavigationMenuList>
					</NavigationMenu>
				</div>
				<ThemeToggle />
			</header>
		</div>
	);
}

function ListItem({ title, children, href, ...props }: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
	return (
		<li {...props}>
			<NavigationMenuLink asChild>
				<Link href={href}>
					<div className="text-sm leading-none font-medium">{title}</div>
					<p className="text-muted-foreground line-clamp-2 text-sm leading-snug">{children}</p>
				</Link>
			</NavigationMenuLink>
		</li>
	);
}
