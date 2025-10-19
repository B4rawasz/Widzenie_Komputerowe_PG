import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";

export default function Home() {
	return (
		<>
			<section className="flex flex-col items-center justify-center gap-6 p-8">
				<div className="flex flex-col items-center gap-8 text-center lg:w-220 w-full md:my-48 my-24">
					<h1 className="lg:h-33 h-fit text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">
						Odkryj kod, <br />
						który uczy maszyny widzieć
					</h1>
					<span className="lg:text-2xl text-lg w-2/3 text-muted-foreground">
						Zobacz pełną ścieżkę wizualną, od surowego piksela do predykcji, z pełną kontrolą nad każdym etapem.
					</span>
				</div>
			</section>
			<section className="flex flex-col items-center justify-center gap-6 lg:p-8 p-4">
				<h2 className="text-center">Wprowadzenie do Computer Vision</h2>
				<h4 className="text-muted-foreground">Jak maszyny naprawdę "widzą"?</h4>
				<div className="flex flex-col items-center justify-center gap-6 xl:w-1/2 lg:w-2/3 w-5/6 text-lg">
					<span>
						Computer Vision to nie magia, to zaawansowana dziedzina Sztucznej Inteligencji, która uczy algorytmy
						interpretowania i rozumienia obrazów cyfrowych oraz strumieni wideo.
					</span>
					<span>
						W przeciwieństwie do ludzkiego oka, które natychmiast rozpoznaje wzory i obiekty, komputer początkowo widzi
						obraz jako ogromną macierz surowych danych liczbowych. Zadaniem Computer Vision jest przetworzenie tych
						liczb w sensowne informacje.
					</span>
					<span>
						Naszym celem jest budowanie inteligentnych modeli, najczęściej Głębokich Sieci Konwolucyjnych (CNN), które
						potrafią hierarchicznie wyodrębnić cechy wizualne.
					</span>
					<ul className="ml-6 list-disc [&>li]:mt-2">
						<li>
							Niski Poziom: Wykrywanie fundamentalnych elementów, takich jak krawędzie, tekstury i punkty
							charakterystyczne. To pierwsze "spojrzenie" AI na obraz.
						</li>
						<li>
							Wysoki Poziom: Rozpoznawanie całych obiektów, ich precyzyjnej lokalizacji i kontekstu w scenie. To moment,
							gdy AI "rozumie", co widzi.
						</li>
					</ul>
					<span>
						<span className="font-bold">CVision</span> to Twoje interaktywne laboratorium, gdzie możesz zobaczyć
						algorytmy w akcji, zrozumieć ich logikę i poznać kluczowe mechanizmy CV, które napędzają autonomiczne
						pojazdy, medycynę, robotykę i zmieniają sposób, w jaki żyjemy.
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
							Ta sekcja jest Twoim wprowadzeniem do anatomii cyfrowego obrazu. Odkryjesz, jak obrazy są reprezentowane
							jako macierze pikseli i jak proste, lecz potężne operacje matematyczne wydobywają z nich fundamentalne
							cechy (krawędzie, tekstury).
						</span>
						<SectionBadges items={["Kernel", "Wykrywanie krawędzi", "Pismo ręczne"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/400x600.png"} />
				</Section>

				<Section reverse>
					<SectionContent>
						<SectionTitle>Podstawowe Zadania CV</SectionTitle>
						<span>Przechodzimy do rdzenia Computer Vision: Klasyfikacji i Detekcji.</span>
						<span>
							Nauczysz się kluczowej różnicy między pytaniem Co to jest? (Klasyfikacja) a pytaniem Gdzie to jest?
							(Detekcja). Zobaczysz, jak model przypisuje obrazowi etykietę (np. "pies") i jak jednocześnie rysuje
							precyzyjną ramkę (Bounding Box), aby zlokalizować obiekt w przestrzeni. To fundamenty algorytmów takich
							jak YOLO i ResNet.
						</span>
						<SectionBadges items={["Klasyfikacja", "Detekcja"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/400x600.png"} />
				</Section>

				<Section>
					<SectionContent>
						<SectionTitle>Przejście do Precyzji i Lokalizacji</SectionTitle>
						<span>
							Detekcja za pomocą ramek to za mało. Ta sekcja pokazuje, jak Computer Vision osiąga precyzję na poziomie
							piksela dzięki Segmentacji.
						</span>
						<span>
							Nauczysz się rozróżniać Segmentację Semantyczną (izolowanie obiektu od tła) od Segmentacji Instancyjnej
							(rozróżnianie wielu instancji tego samego obiektu). Moduły te są sercem trybu portretowego w smartfonach i
							zaawansowanej diagnostyki medycznej.
						</span>
						<SectionBadges items={["Segmentacja Semantyczna", "Segmentacja Instancyjna"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/400x600.png"} />
				</Section>

				<Section reverse>
					<SectionContent>
						<SectionTitle>Analiza Modelu i Interpretacja</SectionTitle>
						<span>
							To sekcja Głębokiej Analizy. Zrozumienie, jak działa model, jest ważne, ale kluczowe jest zrozumienie,
							dlaczego podejmuje on takie, a nie inne decyzje oraz jak optymalizować jego wyniki.
						</span>
						<span>
							Dzięki interaktywnym narzędziom przejmiesz kontrolę nad kluczowymi parametrami post-processingowymi
							(takimi jak NMS i IOU) oraz nauczysz się interpretować surowe wyniki probabilistyczne (Softmax) modelu.
						</span>
						<SectionBadges items={["Wektor Prawdopodobieństwa", "Softmax", "Ocena Lokalizacji"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/400x600.png"} />
				</Section>

				<Section>
					<SectionContent>
						<SectionTitle>Zastosowania Zaawansowane i Kontekst</SectionTitle>
						<span>
							Ostatnia sekcja łączy nabyte umiejętności w celu rozwiązania złożonych problemów z świata rzeczywistego.
							Od Estymacji Pozy (analiza geometrii i ruchu ciała) po Generowanie Opisów Obrazów (integracja CV z
							Przetwarzaniem Języka Naturalnego - NLP).
						</span>
						<span>Zobaczysz, jak różne gałęzie AI współpracują, by tworzyć zaawansowane aplikacje.</span>
						<SectionBadges items={["Analiza Geometrii Ciała", "Generowanie Opisów", "Heatmap"]} />
					</SectionContent>
					<SectionImage src={"https://placehold.co/400x600.png"} />
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
		<div className={`xl:w-1/6 lg:w-1/3 flex flex-col items-start justify-center gap-4 ${className}`}>{children}</div>
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
			className={`xl:w-1/6 lg:w-1/3 h-auto rounded-2xl ${className}`}
		/>
	);
}
