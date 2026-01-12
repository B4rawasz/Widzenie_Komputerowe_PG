import Image from "next/image";

export default function Footer() {
	return (
		<footer className="w-full p-4 border-t border-foreground/20">
			<Image alt="Logo" src="/logo_full.svg" width={0} height={0} className="dark:invert w-30 h-auto" />
		</footer>
	);
}
