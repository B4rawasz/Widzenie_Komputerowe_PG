// ─────────────────────────────────────────────────────────────────────────────
// Shared MLP engine — pure TypeScript, no React
// ─────────────────────────────────────────────────────────────────────────────

export type LayerWeights = {
  W: number[][]; // [out][in]  weight matrix
  b: number[];   // [out]      bias vector
};

export type Network = {
  layers: LayerWeights[];
  topology: number[]; // [inputSize, hidden1, hidden2, ..., outputSize]
};

// ── Activations ──────────────────────────────────────────────────────────────

export function relu(x: number): number {
  return x > 0 ? x : 0;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / (sum || 1e-12));
}

export function softmaxTemp(logits: number[], temperature: number): number[] {
  const scaled = logits.map((v) => v / Math.max(temperature, 1e-6));
  return softmax(scaled);
}

// ── Weight initialisation (He) ────────────────────────────────────────────────

function randn(): number {
  const u = Math.random() || 1e-10;
  const v = Math.random() || 1e-10;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function initNetwork(topology: number[]): Network {
  const layers: LayerWeights[] = [];
  for (let i = 0; i < topology.length - 1; i++) {
    const fanIn = topology[i];
    const fanOut = topology[i + 1];
    const scale = Math.sqrt(2 / fanIn);
    const W: number[][] = Array.from({ length: fanOut }, () =>
      Array.from({ length: fanIn }, () => randn() * scale),
    );
    const b: number[] = Array.from({ length: fanOut }, () => 0);
    layers.push({ W, b });
  }
  return { layers, topology };
}

// ── Forward pass ─────────────────────────────────────────────────────────────

export type ForwardResult = {
  activations: number[][]; // one array per layer including input
  preActivations: number[][]; // z values before activation (one per non-input layer)
  logits: number[]; // final layer pre-softmax
  output: number[]; // softmax probabilities
};

export function forward(net: Network, input: number[]): ForwardResult {
  const activations: number[][] = [input];
  const preActivations: number[][] = [];

  let current = input;
  for (let l = 0; l < net.layers.length; l++) {
    const { W, b } = net.layers[l];
    const z: number[] = b.map((bi, o) => bi + W[o].reduce((s, w, i) => s + w * current[i], 0));
    preActivations.push(z);
    const isLast = l === net.layers.length - 1;
    const a = isLast ? z : z.map(relu); // hidden: ReLU, output: raw logits
    activations.push(a);
    current = a;
  }

  const logits = current;
  const output = softmax(logits);
  return { activations, preActivations, logits, output };
}

// ── Pre-trained digit network (sklearn digits dataset, ~94% CV accuracy) ─────

import { DIGIT_WEIGHTS } from "./digitWeights";

export function initDigitNetwork(): Network {
  return {
    topology: DIGIT_WEIGHTS.topology,
    layers: DIGIT_WEIGHTS.layers.map((l) => ({ W: l.W, b: l.b })),
  };
}

// ── Simple SGD step (cross-entropy + softmax) ────────────────────────────────

export function trainStep(
  net: Network,
  input: number[],
  targetLabel: number,
  lr = 0.05,
): { net: Network; loss: number } {
  const { activations, preActivations } = forward(net, input);
  const probs = softmax(activations[activations.length - 1]);
  const loss = -Math.log(Math.max(probs[targetLabel], 1e-12));

  // Backprop
  const deltas: number[][] = [];

  // Output layer delta: dL/dz = probs - one_hot
  const dOut = probs.map((p, i) => p - (i === targetLabel ? 1 : 0));
  deltas.unshift(dOut);

  // Hidden layers
  for (let l = net.layers.length - 2; l >= 0; l--) {
    const { W } = net.layers[l + 1];
    const z = preActivations[l];
    const d = z.map((zi, i) => {
      const grad = W.reduce((s, row, o) => s + row[i] * deltas[0][o], 0);
      return grad * (zi > 0 ? 1 : 0); // ReLU derivative
    });
    deltas.unshift(d);
  }

  // Update weights
  const newLayers = net.layers.map((layer, l) => {
    const inp = activations[l];
    const d = deltas[l];
    const W = layer.W.map((row, o) => row.map((w, i) => w - lr * d[o] * inp[i]));
    const b = layer.b.map((bi, o) => bi - lr * d[o]);
    return { W, b };
  });

  return { net: { ...net, layers: newLayers }, loss };
}

// ── Colour helpers ────────────────────────────────────────────────────────────

/** Map activation in [0,1] to a CSS colour string (blue → white → red heatmap) */
export function activationColor(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  if (v < 0.5) {
    const t = v * 2;
    return `rgb(${Math.round(59 + t * (248 - 59))},${Math.round(130 + t * (250 - 130))},${Math.round(246 + t * (246 - 246))})`;
  }
  const t = (v - 0.5) * 2;
  return `rgb(${Math.round(248 + t * (239 - 248))},${Math.round(250 + t * (68 - 250))},${Math.round(246 + t * (68 - 246))})`;
}

/** Weight colour: negative=blue, zero=transparent, positive=red */
export function weightColor(w: number, scale = 2): string {
  const v = Math.max(-scale, Math.min(scale, w)) / scale; // [-1, 1]
  if (v >= 0) {
    const t = v;
    return `rgba(239,68,68,${(t * 0.9).toFixed(2)})`;
  }
  const t = -v;
  return `rgba(59,130,246,${(t * 0.9).toFixed(2)})`;
}
