import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";

export default function Home() {
	return (
		<>
			<section className="flex flex-col items-center justify-center gap-6 p-8">
				<div className="flex flex-col items-center gap-8 text-center md:w-220 w-full md:my-48 my-24">
					<h1 className="md:text-6xl text-4xl md:h-33 h-fit font-bold text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">
						Odkryj kod, <br />
						który uczy maszyny widzieć
					</h1>
					<span className="md:text-2xl text-lg w-2/3 text-muted-foreground">
						Zobacz pełną ścieżkę wizualną, od surowego piksela do predykcji, z pełną kontrolą nad każdym etapem.
					</span>
				</div>
			</section>
			<section className="flex flex-col items-center justify-center gap-6 md:p-8 p-4">
				<h2 className="md:text-4xl text-3xl font-bold text-center">Wprowadzenie do Computer Vision</h2>
				<h3 className="md:text-xl text-lg text-muted-foreground">Jak maszyny naprawdę "widzą"?</h3>
				<div className="flex flex-col items-center justify-center gap-6 md:w-1/2 w-5/6 text-lg">
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
						<span className="font-bold">Computer Vision PG</span> to Twoje interaktywne laboratorium, gdzie możesz
						zobaczyć algorytmy w akcji, zrozumieć ich logikę i poznać kluczowe mechanizmy CV, które napędzają
						autonomiczne pojazdy, medycynę, robotykę i zmieniają sposób, w jaki żyjemy.
					</span>
				</div>
			</section>
			<section className="flex flex-col items-center justify-center gap-12 p-8 md:mt-32 mt-16">
				<section className="flex flex-row items-center justify-center w-full gap-6">
					<div className="md:w-1/6 flex flex-col items-start justify-center gap-4">
						<h3 className="text-2xl font-bold mb-4">Fundamenty Przetwarzania Obrazu</h3>
						<span>
							Zanim model AI zrozumie, co jest na obrazie, musi go "zobaczyć" na najbardziej podstawowym, matematycznym
							poziomie.
						</span>
						<span>
							Ta sekcja jest Twoim wprowadzeniem do anatomii cyfrowego obrazu. Odkryjesz, jak obrazy są reprezentowane
							jako macierze pikseli i jak proste, lecz potężne operacje matematyczne wydobywają z nich fundamentalne
							cechy (krawędzie, tekstury).
						</span>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">Kernel</Badge>
							<Badge variant="secondary">Wykrywanie krawędzi</Badge>
							<Badge variant="secondary">Pismo ręczne</Badge>
						</div>
					</div>
					<Image
						src={"https://placehold.co/400x600.png"}
						alt="placeholder"
						width={400}
						height={600}
						className="w-1/6 h-auto rounded-2xl md:block hidden"
					/>
				</section>
				<section className="flex flex-row items-center justify-center w-full gap-6">
					<Image
						src={"https://placehold.co/400x600.png"}
						alt="placeholder"
						width={400}
						height={600}
						className="w-1/6 h-auto rounded-2xl md:block hidden"
					/>
					<div className="md:w-1/6 flex flex-col items-start justify-center gap-4">
						<h3 className="text-2xl font-bold mb-4">Podstawowe Zadania CV</h3>
						<span>Przechodzimy do rdzenia Computer Vision: Klasyfikacji i Detekcji.</span>
						<span>
							Nauczysz się kluczowej różnicy między pytaniem Co to jest? (Klasyfikacja) a pytaniem Gdzie to jest?
							(Detekcja). Zobaczysz, jak model przypisuje obrazowi etykietę (np. "pies") i jak jednocześnie rysuje
							precyzyjną ramkę (Bounding Box), aby zlokalizować obiekt w przestrzeni. To fundamenty algorytmów takich
							jak YOLO i ResNet.
						</span>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">Klasyfikacja</Badge>
							<Badge variant="secondary">Detekcja</Badge>
						</div>
					</div>
				</section>
				<section className="flex flex-row items-center justify-center w-full gap-6">
					<div className="md:w-1/6 flex flex-col items-start justify-center gap-4">
						<h3 className="text-2xl font-bold mb-4">Przejście do Precyzji i Lokalizacji</h3>
						<span>
							Detekcja za pomocą ramek to za mało. Ta sekcja pokazuje, jak Computer Vision osiąga precyzję na poziomie
							piksela dzięki Segmentacji.
						</span>
						<span>
							Nauczysz się rozróżniać Segmentację Semantyczną (izolowanie obiektu od tła) od Segmentacji Instancyjnej
							(rozróżnianie wielu instancji tego samego obiektu). Moduły te są sercem trybu portretowego w smartfonach i
							zaawansowanej diagnostyki medycznej.
						</span>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">Segmentację Semantyczną</Badge>
							<Badge variant="secondary">Segmentacja Instancyjna</Badge>
						</div>
					</div>
					<Image
						src={"https://placehold.co/400x600.png"}
						alt="placeholder"
						width={400}
						height={600}
						className="w-1/6 h-auto rounded-2xl md:block hidden"
					/>
				</section>
				<section className="flex flex-row items-center justify-center w-full gap-6">
					<Image
						src={"https://placehold.co/400x600.png"}
						alt="placeholder"
						width={400}
						height={600}
						className="w-1/6 h-auto rounded-2xl md:block hidden"
					/>
					<div className="md:w-1/6 flex flex-col items-start justify-center gap-4">
						<h3 className="text-2xl font-bold mb-4">Analiza Modelu i Interpretacja</h3>
						<span>
							To sekcja Głębokiej Analizy. Zrozumienie, jak działa model, jest ważne, ale kluczowe jest zrozumienie,
							dlaczego podejmuje on takie, a nie inne decyzje oraz jak optymalizować jego wyniki.
						</span>
						<span>
							Dzięki interaktywnym narzędziom przejmiesz kontrolę nad kluczowymi parametrami post-processingowymi
							(takimi jak NMS i IOU) oraz nauczysz się interpretować surowe wyniki probabilistyczne (Softmax) modelu.
						</span>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">Wektor Prawdopodobieństwa</Badge>
							<Badge variant="secondary">Softmax</Badge>
							<Badge variant="secondary">Ocena Lokalizacji</Badge>
						</div>
					</div>
				</section>
				<section className="flex flex-row items-center justify-center w-full gap-6">
					<div className="md:w-1/6 flex flex-col items-start justify-center gap-4">
						<h3 className="text-2xl font-bold mb-4">Zastosowania Zaawansowane i Kontekst</h3>
						<span>
							Ostatnia sekcja łączy nabyte umiejętności w celu rozwiązania złożonych problemów z świata rzeczywistego.
							Od Estymacji Pozy (analiza geometrii i ruchu ciała) po Generowanie Opisów Obrazów (integracja CV z
							Przetwarzaniem Języka Naturalnego – NLP).
						</span>
						<span>Zobaczysz, jak różne gałęzie AI współpracują, by tworzyć zaawansowane aplikacje.</span>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">Analiza Geometrii Ciała</Badge>
							<Badge variant="secondary">Generowanie Opisów</Badge>
							<Badge variant="secondary">Heatmap</Badge>
						</div>
					</div>
					<Image
						src={"https://placehold.co/400x600.png"}
						alt="placeholder"
						width={400}
						height={600}
						className="w-1/6 h-auto rounded-2xl md:block hidden"
					/>
				</section>
			</section>
		</>
	);
}
