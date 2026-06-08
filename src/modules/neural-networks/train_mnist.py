"""
train_mnist.py
==============
Trenuje MLP na MNIST (28×28 = 784 wejść → 256 → 128 → 10 klas).
Eksportuje wagi do digitWeights.json kompatybilnego z mlp.ts.

Wymagania:
    pip install torch torchvision

Użycie:
    python train_mnist.py              # trenuje od zera, zapisuje digitWeights.json
    python train_mnist.py --epochs 20  # więcej epok
    python train_mnist.py --out my_weights.json

Topologia jest konfigurowalna — zmień HIDDEN_SIZES żeby dostosować do mlp.ts.
"""

import argparse
import json
import math
import time
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms


# ── Konfiguracja ─────────────────────────────────────────────────────────────

# Musi zgadzać się z topology w mlp.ts!
# Dla MNIST 28×28: INPUT = 784
INPUT_SIZE = 784
HIDDEN_SIZES = [256, 128]
OUTPUT_SIZE = 10

BATCH_SIZE = 256
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4


# ── Model ────────────────────────────────────────────────────────────────────

class MLP(nn.Module):
    def __init__(self, topology: list[int]):
        super().__init__()
        layers = []
        for i in range(len(topology) - 1):
            layers.append(nn.Linear(topology[i], topology[i + 1]))
            if i < len(topology) - 2:
                layers.append(nn.ReLU())
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Dane ─────────────────────────────────────────────────────────────────────

def get_loaders(data_dir: str = "./mnist_data"):
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),  # MNIST mean/std
    ])
    train_ds = datasets.MNIST(data_dir, train=True,  download=True, transform=transform)
    test_ds  = datasets.MNIST(data_dir, train=False, download=True, transform=transform)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=2, pin_memory=True)
    test_loader  = DataLoader(test_ds,  batch_size=1024,        shuffle=False, num_workers=2, pin_memory=True)
    return train_loader, test_loader


# ── Trening ──────────────────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, n = 0.0, 0, 0
    for images, labels in loader:
        images = images.view(images.size(0), -1).to(device)
        labels = labels.to(device)
        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * images.size(0)
        correct += (logits.argmax(1) == labels).sum().item()
        n += images.size(0)
    return total_loss / n, correct / n


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    correct, n = 0, 0
    for images, labels in loader:
        images = images.view(images.size(0), -1).to(device)
        labels = labels.to(device)
        preds = model(images).argmax(1)
        correct += (preds == labels).sum().item()
        n += images.size(0)
    return correct / n


# ── Eksport wag ──────────────────────────────────────────────────────────────

def export_weights(model: MLP, topology: list[int], out_path: str, normalize: bool):
    """
    Eksportuje wagi do formatu oczekiwanego przez mlp.ts:
    {
      topology: [784, 256, 128, 10],
      layers: [{ W: [[...]], b: [...] }, ...]
    }

    Opcja normalize=True przeskalowuje wagi warstwy wejściowej z powrotem do
    przestrzeni [0,1] (odwraca normalizację MNIST mean/std), dzięki czemu
    można przekazywać piksele [0,1] bezpośrednio z canvasa bez dodatkowej
    normalizacji po stronie JS.
    """
    layers_out = []
    linear_layers = [m for m in model.net if isinstance(m, nn.Linear)]

    mean = 0.1307
    std  = 0.3081

    for idx, layer in enumerate(linear_layers):
        W = layer.weight.detach().cpu().float()  # [out, in]
        b = layer.bias.detach().cpu().float()    # [out]

        if normalize and idx == 0:
            # x_norm = (x - mean) / std
            # W @ x_norm + b = W/std @ x + (b - W @ mean/std * ones)
            # Absorb mean/std into first layer so JS passes raw [0,1] pixels
            W_adj = W / std
            b_adj = b - (W / std).sum(dim=1) * mean
            W = W_adj
            b = b_adj

        layers_out.append({
            "W": W.tolist(),
            "b": b.tolist(),
        })

    payload = {
        "topology": topology,
        "layers": layers_out,
    }

    with open(out_path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    size_kb = Path(out_path).stat().st_size / 1024
    print(f"\n✓ Zapisano {out_path}  ({size_kb:.1f} KB)")
    print(f"  Topologia: {' → '.join(map(str, topology))}")
    for i, l in enumerate(layers_out):
        print(f"  Warstwa {i}: W={len(l['W'])}×{len(l['W'][0])}, b={len(l['b'])}")


# ── Konwersja JSON → TS literal (opcjonalna) ─────────────────────────────────

def json_to_ts(json_path: str):
    """Opakuj JSON w TypeScript eksport identyczny z digitWeights.ts."""
    ts_path = json_path.replace(".json", ".ts")
    with open(json_path) as f:
        raw = f.read()
    ts = (
        "// Auto-generated by train_mnist.py\n"
        "// Do not edit manually.\n\n"
        "export type PretrainedLayer = { W: number[][]; b: number[] };\n"
        "export type PretrainedWeights = { topology: number[]; layers: PretrainedLayer[] };\n\n"
        f"export const DIGIT_WEIGHTS: PretrainedWeights = {raw};\n"
    )
    with open(ts_path, "w") as f:
        f.write(ts)
    size_kb = Path(ts_path).stat().st_size / 1024
    print(f"✓ Zapisano {ts_path}  ({size_kb:.1f} KB)")
    return ts_path


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Trenuj MLP na MNIST i eksportuj wagi do JSON/TS")
    parser.add_argument("--epochs",    type=int,   default=15,                    help="Liczba epok (domyślnie 15)")
    parser.add_argument("--lr",        type=float, default=LEARNING_RATE,         help="Learning rate (domyślnie 1e-3)")
    parser.add_argument("--hidden",    type=int,   nargs="+", default=HIDDEN_SIZES, help="Rozmiary warstw ukrytych (domyślnie 256 128)")
    parser.add_argument("--out",       type=str,   default="digitWeights.json",   help="Ścieżka wyjściowa JSON")
    parser.add_argument("--ts",        action="store_true",                        help="Również wygeneruj plik .ts")
    parser.add_argument("--no-norm",   action="store_true",                        help="Nie absorbuj normalizacji MNIST do wag")
    parser.add_argument("--data-dir",  type=str,   default="./mnist_data",        help="Katalog z danymi MNIST")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Urządzenie: {device}")

    topology = [INPUT_SIZE] + args.hidden + [OUTPUT_SIZE]
    print(f"Topologia: {' → '.join(map(str, topology))}")

    # Model
    model = MLP(topology).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"Parametry: {n_params:,}")

    # Dane
    print("\nPobieranie danych MNIST…")
    train_loader, test_loader = get_loaders(args.data_dir)

    # Optymalizator + scheduler
    optimizer = optim.Adam(model.parameters(), lr=args.lr, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.CrossEntropyLoss()

    # Trening
    print(f"\n{'Epoka':>6}  {'Loss':>8}  {'Train acc':>10}  {'Test acc':>10}  {'Czas':>7}")
    print("─" * 52)
    best_test_acc = 0.0
    best_state = None

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        test_acc = evaluate(model, test_loader, device)
        scheduler.step()
        elapsed = time.time() - t0

        print(f"{epoch:>6}  {train_loss:>8.4f}  {train_acc:>9.2%}  {test_acc:>9.2%}  {elapsed:>6.1f}s")

        if test_acc > best_test_acc:
            best_test_acc = test_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    print(f"\n✓ Najlepsza dokładność testowa: {best_test_acc:.2%}")

    # Załaduj najlepsze wagi
    if best_state:
        model.load_state_dict(best_state)

    # Eksport
    print()
    export_weights(model, topology, args.out, normalize=not args.no_norm)

    if args.ts:
        json_to_ts(args.out)


if __name__ == "__main__":
    main()
