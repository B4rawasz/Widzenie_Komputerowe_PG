import Image from "next/image";

export default function Footer() {
	return (
		<footer className="w-full h-16 px-8 flex flex-row items-center justify-between border-t border-foreground/20">
			<Image alt="Logo" src="/logo_full.svg" width={0} height={0} className="dark:invert w-auto h-12" />
		</footer>
	);
}
