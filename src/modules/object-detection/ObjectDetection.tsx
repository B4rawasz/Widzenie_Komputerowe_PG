"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import { Play, Pause, RotateCcw } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BBox = {
  x: number; // left (px, relative to image)
  y: number; // top
  w: number; // width
  h: number; // height
  score: number; // confidence [0,1]
  label: string;
  color: string;
};

declare global {
  interface Window {
    tf: any;
    cocoSsd: any;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  person: "#ef4444",
  car: "#3b82f6",
  cat: "#f59e0b",
  dog: "#22c55e",
  bicycle: "#a855f7",
  bottle: "#06b6d4",
  chair: "#f97316",
  laptop: "#ec4899",
  default: "#94a3b8",
};

function classColor(label: string): string {
  return CLASS_COLORS[label] ?? CLASS_COLORS.default;
}

function iou(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const unionArea = a.w * a.h + b.w * b.h - inter;
  return inter / unionArea;
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  box: BBox,
  alpha = 1,
  lineWidth = 2,
  showLabel = true,
  mirrored = false,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = box.color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  if (showLabel) {
    const text = `${box.label} ${(box.score * 100).toFixed(0)}%`;
    ctx.font = "bold 12px ui-sans-serif,sans-serif";
    const tw = ctx.measureText(text).width;

    if (mirrored) {
      // In mirrored mode (CSS scale-x-[-1]), the "visual left" of the box 
      // on screen is actually the "right edge" (x + w) on the pixel canvas.
      const visualLeftX = box.x + box.w;

      ctx.save();
      // Draw background rect (from visual left towards visual right on screen)
      ctx.fillStyle = box.color;
      ctx.fillRect(visualLeftX - (tw + 8), box.y - 18, tw + 8, 18);

      // Draw text (mirrored on canvas so it looks normal on screen)
      ctx.translate(visualLeftX - 4, box.y - 4);
      ctx.scale(-1, 1);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = box.color;
      ctx.fillRect(box.x, box.y - 18, tw + 8, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, box.x + 4, box.y - 4);
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Bounding Boxes & IoU
// ─────────────────────────────────────────────────────────────────────────────

// Static demo image + synthetic boxes to illustrate IoU without needing a model
const DEMO_BOXES: BBox[] = [
  { x: 60,  y: 40,  w: 180, h: 220, score: 0.92, label: "person", color: classColor("person") },
  { x: 110, y: 80,  w: 160, h: 200, score: 0.76, label: "person", color: classColor("person") },
  { x: 300, y: 90,  w: 140, h: 160, score: 0.88, label: "car",    color: classColor("car") },
  { x: 320, y: 110, w: 120, h: 130, score: 0.61, label: "car",    color: classColor("car") },
  { x: 160, y: 280, w: 100, h: 80,  score: 0.55, label: "bottle", color: classColor("bottle") },
];

const CANVAS_W = 480;
const CANVAS_H = 360;

export function BoundingBoxIoU() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [selectedPair, setSelectedPair] = useState<[number, number] | null>([0, 1]);

  useEffect(() => {
    render();
  }, [threshold, selectedPair]);

  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background — simple gradient scene
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines (simulate ground)
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    const filtered = DEMO_BOXES.filter((b) => b.score >= threshold);
    const suppressed = new Set<number>();

    // Compute which boxes pass NMS (simple greedy) to show dim suppressed ones
    const sorted = [...filtered].sort((a, b) => b.score - a.score);
    const kept = new Set<BBox>();
    for (const box of sorted) {
      if ([...kept].every((k) => iou(k, box) < 0.45)) kept.add(box);
    }

    for (const box of filtered) {
      const dim = !kept.has(box);
      drawBox(ctx, box, dim ? 0.3 : 1, 2);
    }

    // IoU visualisation for selected pair
    if (selectedPair) {
      const [ai, bi] = selectedPair;
      const a = DEMO_BOXES[ai];
      const b = DEMO_BOXES[bi];
      if (a && b) {
        // Intersection rect
        const ix = Math.max(a.x, b.x);
        const iy = Math.max(a.y, b.y);
        const ix2 = Math.min(a.x + a.w, b.x + b.w);
        const iy2 = Math.min(a.y + a.h, b.y + b.h);
        const iw = Math.max(0, ix2 - ix);
        const ih = Math.max(0, iy2 - iy);

        if (iw > 0 && ih > 0) {
          ctx.save();
          ctx.fillStyle = "rgba(250,204,21,0.35)";
          ctx.fillRect(ix, iy, iw, ih);
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(ix, iy, iw, ih);
          ctx.setLineDash([]);

          const score = iou(a, b);
          ctx.font = "bold 13px monospace";
          ctx.fillStyle = "#facc15";
          ctx.fillText(`IoU = ${score.toFixed(3)}`, ix + iw / 2 - 34, iy + ih / 2 + 5);
          ctx.restore();
        }
      }
    }

    // Threshold line indicator
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(148,163,184,0.8)";
    ctx.fillText(`Score threshold: ${threshold.toFixed(2)}  |  widoczne: ${filtered.length}/${DEMO_BOXES.length}`, 8, CANVAS_H - 8);
  }

  return (
    <div className="flex flex-col gap-4 my-6">
      <div className="flex items-center gap-4 max-w-xs">
        <Label className="whitespace-nowrap text-sm">
          Score threshold:{" "}
          <span className="font-mono font-semibold">{threshold.toFixed(2)}</span>
        </Label>
        <Slider
          value={[threshold]}
          onValueChange={(v) => setThreshold(v[0])}
          min={0} max={1} step={0.01} className="flex-1"
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground">Podświetl parę do IoU:</span>
        {[[0,1],[2,3]].map(([a,b]) => (
          <button
            key={`${a}-${b}`}
            onClick={() => setSelectedPair(selectedPair?.[0]===a && selectedPair?.[1]===b ? null : [a,b])}
            className={`px-2 py-1 rounded border text-xs transition-colors ${selectedPair?.[0]===a && selectedPair?.[1]===b ? "bg-yellow-500/20 border-yellow-500 text-yellow-400" : "border-border text-muted-foreground hover:border-foreground"}`}
          >
            Box {a+1} ↔ Box {b+1}
          </button>
        ))}
        <button
          onClick={() => setSelectedPair(null)}
          className="px-2 py-1 rounded border border-border text-muted-foreground hover:border-foreground text-xs"
        >
          Wyczyść
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-md border border-border w-full h-auto"
      />

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>🟡 żółty obszar = część wspólna (intersection)</span>
        <span>🔲 wyblakłe boxy = odfiltrowane przez NMS</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Non-Max Suppression — animowana
// ─────────────────────────────────────────────────────────────────────────────

const NMS_BOXES: BBox[] = [
  { x: 55,  y: 45,  w: 185, h: 215, score: 0.95, label: "person", color: classColor("person") },
  { x: 75,  y: 60,  w: 175, h: 205, score: 0.87, label: "person", color: classColor("person") },
  { x: 65,  y: 50,  w: 170, h: 195, score: 0.78, label: "person", color: classColor("person") },
  { x: 90,  y: 80,  w: 150, h: 180, score: 0.62, label: "person", color: classColor("person") },
  { x: 110, y: 95,  w: 130, h: 160, score: 0.51, label: "person", color: classColor("person") },
  { x: 300, y: 85,  w: 145, h: 165, score: 0.91, label: "car",    color: classColor("car") },
  { x: 315, y: 100, w: 130, h: 150, score: 0.73, label: "car",    color: classColor("car") },
  { x: 330, y: 115, w: 110, h: 130, score: 0.58, label: "car",    color: classColor("car") },
];

type NmsStep = {
  type: "pick" | "suppress" | "done";
  pickedIdx: number;
  suppressedIdxs?: number[];
  currentBoxes: number[]; // indices still active
  message: string;
};

function computeNmsSteps(boxes: BBox[], iouThresh: number): NmsStep[] {
  const steps: NmsStep[] = [];
  const sorted = [...boxes.keys()].sort((a, b) => boxes[b].score - boxes[a].score);
  const remaining = new Set(sorted);
  const kept: number[] = [];

  while (remaining.size > 0) {
    const [best] = remaining;
    remaining.delete(best);
    kept.push(best);

    const toSuppress: number[] = [];
    for (const idx of remaining) {
      if (iou(boxes[best], boxes[idx]) >= iouThresh) {
        toSuppress.push(idx);
      }
    }

    steps.push({
      type: "pick",
      pickedIdx: best,
      currentBoxes: [...remaining, ...kept],
      message: `Wybieram box #${best+1} (score=${boxes[best].score.toFixed(2)}) — najwyższy wynik`,
    });

    if (toSuppress.length > 0) {
      toSuppress.forEach((i) => remaining.delete(i));
      steps.push({
        type: "suppress",
        pickedIdx: best,
        suppressedIdxs: toSuppress,
        currentBoxes: [...remaining, ...kept],
        message: `Usuwam ${toSuppress.length} box(ów) z IoU ≥ ${iouThresh.toFixed(2)}: #${toSuppress.map(i=>i+1).join(", #")}`,
      });
    }
  }

  steps.push({
    type: "done",
    pickedIdx: -1,
    currentBoxes: kept,
    message: `NMS zakończony — zostało ${kept.length} boxów`,
  });

  return steps;
}

export function NonMaxSuppression() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [iouThresh, setIouThresh] = useState(0.45);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [steps, setSteps] = useState<NmsStep[]>(() => computeNmsSteps(NMS_BOXES, 0.45));

  useEffect(() => {
    const s = computeNmsSteps(NMS_BOXES, iouThresh);
    setSteps(s);
    setStepIdx(0);
    setPlaying(false);
  }, [iouThresh]);

  useEffect(() => {
    render(steps[Math.min(stepIdx, steps.length - 1)]);
  }, [stepIdx, steps]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setStepIdx((prev) => {
          if (prev >= steps.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 900);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, steps]);

  function render(step: NmsStep | undefined) {
    if (!step) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw all boxes with state-dependent styling
    NMS_BOXES.forEach((box, i) => {
      const isActive = step.currentBoxes.includes(i);
      const isPicked = step.pickedIdx === i;
      const isSuppressed = step.suppressedIdxs?.includes(i) ?? false;

      if (isSuppressed) {
        // Animated red cross-out
        drawBox(ctx, box, 0.15, 1.5, false);
        ctx.save();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(box.x, box.y);
        ctx.lineTo(box.x + box.w, box.y + box.h);
        ctx.moveTo(box.x + box.w, box.y);
        ctx.lineTo(box.x, box.y + box.h);
        ctx.stroke();
        ctx.restore();
      } else if (!isActive) {
        drawBox(ctx, box, 0.12, 1, false);
      } else if (isPicked) {
        // Bright picked box
        ctx.save();
        ctx.shadowColor = box.color;
        ctx.shadowBlur = 12;
        drawBox(ctx, box, 1, 3);
        ctx.restore();
      } else {
        drawBox(ctx, box, 0.65, 1.5);
      }

      // Score badge
      if (isActive && !isSuppressed) {
        ctx.font = "10px monospace";
        ctx.fillStyle = isPicked ? "#facc15" : "rgba(248,250,252,0.7)";
        ctx.fillText(`${(box.score * 100).toFixed(0)}%`, box.x + 3, box.y + box.h - 4);
      }
    });
  }

  const currentStep = steps[Math.min(stepIdx, steps.length - 1)];

  return (
    <div className="flex flex-col gap-4 my-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3 min-w-48">
          <Label className="whitespace-nowrap text-sm">
            IoU threshold:{" "}
            <span className="font-mono font-semibold">{iouThresh.toFixed(2)}</span>
          </Label>
          <Slider
            value={[iouThresh]}
            onValueChange={(v) => setIouThresh(v[0])}
            min={0.1} max={0.9} step={0.05} className="w-32"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setStepIdx(0); setPlaying(false); }}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pauza" : "Odtwórz"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStepIdx((p) => Math.min(p + 1, steps.length - 1))} disabled={stepIdx >= steps.length - 1}>
            Krok →
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => { setStepIdx(i); setPlaying(false); }}
            className={`h-1.5 flex-1 rounded-full transition-all ${i === stepIdx ? "bg-blue-400" : i < stepIdx ? "bg-blue-400/40" : "bg-muted"}`}
          />
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-md border border-border w-full h-auto"
      />

      {/* Step description */}
      {currentStep && (
        <div className={`rounded-md px-4 py-2.5 text-sm font-medium border transition-colors ${
          currentStep.type === "pick" ? "border-blue-500/40 bg-blue-500/10 text-blue-300" :
          currentStep.type === "suppress" ? "border-red-500/40 bg-red-500/10 text-red-300" :
          "border-green-500/40 bg-green-500/10 text-green-300"
        }`}>
          <span className="text-xs font-mono opacity-60 mr-2">
            [{stepIdx + 1}/{steps.length}]
          </span>
          {currentStep.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lekki detektor — kamerka + COCO-SSD przez TF.js CDN
// ─────────────────────────────────────────────────────────────────────────────

type LoadState = "idle" | "loading" | "ready" | "error";

export function LiveDetector({ isLibraryLoaded }: { isLibraryLoaded: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const initialized = useRef(false);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [threshold, setThreshold] = useState(0.45);
  const [fps, setFps] = useState(0);
  const [detections, setDetections] = useState<{ label: string; score: number }[]>([]);
  const lastTime = useRef(0);
  const thresholdRef = useRef(threshold);

  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  useEffect(() => {
    if (!isLibraryLoaded || initialized.current) return;
    initialized.current = true;
    setLoadState("loading");
    loadModel();

    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      initialized.current = false;
    };
  }, [isLibraryLoaded]);

  async function loadModel() {
    try {
      const model = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
      modelRef.current = model;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          setLoadState("ready");
          detect();
        };
      }
    } catch (err) {
      console.error("LiveDetector init error:", err);
      setLoadState("error");
    }
  }

  async function detect() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;
    if (!video || !canvas || !model) return;
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

    try {
      const predictions: { bbox: [number,number,number,number]; class: string; score: number }[] =
        await model.detect(video);

      const now = performance.now();
      const dt = now - lastTime.current;
      if (dt > 0) setFps(Math.round(1000 / dt));
      lastTime.current = now;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const thresh = thresholdRef.current;

        const dets: { label: string; score: number }[] = [];
        for (const p of predictions) {
          if (p.score < thresh) continue;
          const [x, y, w, h] = p.bbox;
          const box: BBox = { x, y, w, h, score: p.score, label: p.class, color: classColor(p.class) };
          drawBox(ctx, box, 1, 2.5, true, true);
          dets.push({ label: p.class, score: p.score });
        }
        setDetections(dets);
      }
    } catch (err) {
      console.error("Detect error:", err);
    }

    rafRef.current = requestAnimationFrame(detect);
  }

  return (
    <div className="flex flex-col gap-4 my-6">
      <div className="flex items-center gap-4 max-w-xs">
        <Label className="whitespace-nowrap text-sm">
          Score threshold:{" "}
          <span className="font-mono font-semibold">{threshold.toFixed(2)}</span>
        </Label>
        <Slider
          value={[threshold]}
          onValueChange={(v) => setThreshold(v[0])}
          min={0.1} max={0.95} step={0.05} className="flex-1"
        />
      </div>

      <div className="relative rounded-md overflow-hidden border border-border bg-black aspect-video w-full max-w-2xl">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          playsInline muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {loadState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-sm text-muted-foreground gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            Ładowanie COCO-SSD…
          </div>
        )}
        {loadState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-red-400">
            Błąd inicjalizacji kamery lub modelu
          </div>
        )}
        {loadState === "ready" && (
          <div className="absolute top-2 right-2 bg-black/60 text-xs font-mono text-green-400 px-2 py-1 rounded">
            {fps} FPS
          </div>
        )}
      </div>

      {/* Detection list */}
      {detections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {detections.map((d, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ background: classColor(d.label) + "33", color: classColor(d.label), border: `1px solid ${classColor(d.label)}66` }}
            >
              {d.label} {(d.score * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Model: COCO-SSD MobileNetV2 Lite — 80 klas COCO, działa w przeglądarce przez TensorFlow.js.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component — ładuje skrypty raz, przekazuje isLibraryLoaded
// ─────────────────────────────────────────────────────────────────────────────

export type ObjectDetectionType = "bbox-iou" | "nms" | "live-detector";

export function ObjectDetection({ type }: { type: ObjectDetectionType }) {
  const [isTfLoaded, setIsTfLoaded] = useState(false);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

  if (type === "bbox-iou") return <BoundingBoxIoU />;
  if (type === "nms") return <NonMaxSuppression />;

  if (type === "live-detector") {
    return (
      <>
        <Script
          src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"
          strategy="afterInteractive"
          onReady={() => setIsTfLoaded(true)}
        />
        {isTfLoaded && (
          <Script
            src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
            strategy="afterInteractive"
            onReady={() => setIsLibraryLoaded(true)}
          />
        )}
        <LiveDetector isLibraryLoaded={isLibraryLoaded} />
      </>
    );
  }

  return null;
}
