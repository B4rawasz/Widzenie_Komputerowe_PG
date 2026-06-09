import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";

export default function Home() {
	return (
		<>
			<section className="flex flex-col items-center justify-center gap-6 p-8">
				<div className="flex flex-col items-center gap-8 text-center lg:w-220 w-full md:my-48 my-24">
					<h1 className="lg:text-6xl lg:h-33 h-fit text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">
						Odkryj kod, <br />
						który uczy maszyny widzieć
					</h1>
					<span className="lg:text-2xl text-lg w-2/3 text-muted-foreground">
						Zobacz pełną ścieżkę wizualną, od surowego piksela do predykcji, z pełną kontrolą nad każdym etapem.
					</span>
				</div>
			</section>
			<section className="flex flex-col items-center justify-center gap-12 p-8 lg:mt-32 mt-16">
				<Section>
					<SectionContent>
						<SectionTitle>Fundamenty Przetwarzania Obrazu</SectionTitle>
						<span>
							Zanim model AI zrozumie, co jest na obrazie, musi go "zobaczyć" na najbardziej podstawowym, matematycznym
							poziomie.
						</span>
						<span>
							Ta sekcja wprowadza do anatomii cyfrowego obrazu. Odkryjesz, jak obrazy są reprezentowane jako macierze pikseli i jak proste operacje matematyczne wydobywają z nich fundamentalne cechy.
						</span>
						<SectionBadges items={["Wykrywanie krawędzi", "Szkieletyzacja", "Transformacja Hougha"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/600x400.png"} alt="Fundamenty" />
				</Section>

				<Section reverse>
					<SectionContent>
						<SectionTitle>Klasyfikacja</SectionTitle>
						<span>Klasyfikacja to proces przypisywania obiektów do predefiniowanych kategorii.</span>
						<span>
							Poznasz podejścia: od metod statystycznych, przez minimalnoodległościowe, aż po zaawansowane granice liniowe i łamane, badając jak kształt granicy decyzyjnej wpływa na skuteczność modelu.
						</span>
						<SectionBadges items={["Klasyfikatory", "Perceptron", "Uczenie maszynowe"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/600x400.png"} alt="Klasyfikacja" />
				</Section>

				<Section>
					<SectionContent>
						<SectionTitle>Sieci Neuronowe</SectionTitle>
						<span>Od pojedynczego perceptronu do wielowarstwowych struktur MLP.</span>
						<span>
							Poznasz architekturę sieci, sposoby wizualizacji ich "wiedzy", działanie filtrów konwolucyjnych (CNN) oraz mechanizmy podejmowania ostatecznych decyzji przez warstwę wyjściową.
						</span>
						<SectionBadges items={["Sieci neuronowe", "CNN", "Deep Learning"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/600x400.png"} alt="Sieci Neuronowe" />
				</Section>

				<Section reverse>
					<SectionContent>
						<SectionTitle>Detekcja Obiektów</SectionTitle>
						<span>Detekcja obiektów to połączenie klasyfikacji i lokalizacji.</span>
						<span>
							Dowiesz się, jak algorytmy wyznaczają granice przedmiotów (Bounding Boxes), jak mierzyć ich dokładność (IoU) oraz jak usuwać powtarzające się predykcje za pomocą Non-Max Suppression.
						</span>
						<SectionBadges items={["Detekcja obiektów", "Bounding Boxes", "NMS"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/600x400.png"} alt="Detekcja Obiektów" />
				</Section>

				<Section>
					<SectionContent>
						<SectionTitle>Aplikacje Zaawansowane</SectionTitle>
						<span>Studium przypadku budowy kompletnej aplikacji Computer Vision w przeglądarce.</span>
						<span>
							Zastosujemy zdobytą wiedzę w praktyce: rozpoznawanie i analiza dłoni w czasie rzeczywistym, wykorzystując akcelerację GPU i zaawansowaną geometrię 3D.
						</span>
						<SectionBadges items={["Rozpoznawanie dłoni", "Interakcja 3D", "Estymacja pozy"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/600x400.png"} alt="Aplikacje" />
				</Section>
			</section>
		</>
	);
}

type SectionRootProps = React.PropsWithChildren<{
	reverse?: boolean;
	className?: string;
}>;

export function Section({ children, reverse = false, className = "", ...props }: SectionRootProps) {
	return (
		<section
			className={`flex items-center justify-center w-full gap-6 ${
				reverse ? "md:flex-row-reverse" : "md:flex-row"
			} flex-col ${className}`}
			{...props}
		>
			{children}
		</section>
	);
}

export function SectionTitle({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
	return <h3 className={`mb-4 ${className}`}>{children}</h3>;
}

export function SectionContent({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
	return (
		<div className={`xl:w-1/4 lg:w-1/3 flex flex-col items-start justify-center gap-4 ${className}`}>{children}</div>
	);
}

export function SectionBadges({ items = [] }: { items?: string[] }) {
	if (!items || items.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-2 mt-2">
			{items.map((b) => (
				<Badge key={b} variant="secondary">
					{b}
				</Badge>
			))}
		</div>
	);
}

export function SectionImage({
	src,
	alt = "section image",
	width = 400,
	height = 600,
	className = "",
}: {
	src: string;
	alt?: string;
	width?: number;
	height?: number;
	className?: string;
}) {
	return (
		<Image
			src={src}
			alt={alt}
			width={width}
			height={height}
			className={`xl:w-1/4 lg:w-1/3 h-auto rounded-2xl ${className}`}
		/>
	);
}
