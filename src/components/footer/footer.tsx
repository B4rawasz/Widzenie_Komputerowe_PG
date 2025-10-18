import Image from "next/image";

export default function Footer() {
	return (
		<footer className="w-full py-4 border-t border-primary/20">
			<Image alt="Logo" src="/logo_full.svg" width={220} height={0} className="dark:invert" />
		</footer>
	);
}
