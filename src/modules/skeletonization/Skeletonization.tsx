"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SkeletonizationProps = {
	type: "basic" | "graph";
};

type AlgorithmType = "thinning" | "distance";

type AnimationFrame =
	| {
			kind: "binary";
			mask: Uint8Array;
	  }
	| {
			kind: "distance";
			intensity: Uint8Array;
	  };

type GraphNodeType = "endpoint" | "normal" | "junction" | "isolated";

type GraphNode = {
	id: number;
	index: number;
	x: number;
	y: number;
	type: GraphNodeType;
	degree: number;
};

type GraphEdge = {
	id: number;
	from: number;
	to: number;
	path: number[];
	length: number;
};

type SkeletonGraph = {
	nodes: GraphNode[];
	edges: GraphEdge[];
	components: number;
	loops: number;
	endpoints: number;
	junctions: number;
};

const CANVAS_SIZE = 400;

const indexAt = (x: number, y: number, width: number) => y * width + x;

const getNeighbors = (mask: Uint8Array, x: number, y: number, width: number, height: number) => {
	const p2 = y > 0 ? mask[indexAt(x, y - 1, width)] : 0;
	const p3 = y > 0 && x < width - 1 ? mask[indexAt(x + 1, y - 1, width)] : 0;
	const p4 = x < width - 1 ? mask[indexAt(x + 1, y, width)] : 0;
	const p5 = y < height - 1 && x < width - 1 ? mask[indexAt(x + 1, y + 1, width)] : 0;
	const p6 = y < height - 1 ? mask[indexAt(x, y + 1, width)] : 0;
	const p7 = y < height - 1 && x > 0 ? mask[indexAt(x - 1, y + 1, width)] : 0;
	const p8 = x > 0 ? mask[indexAt(x - 1, y, width)] : 0;
	const p9 = y > 0 && x > 0 ? mask[indexAt(x - 1, y - 1, width)] : 0;

	return [p2, p3, p4, p5, p6, p7, p8, p9] as const;
};

const transitionsCount = (neighbors: readonly number[]) => {
	let transitions = 0;
	for (let i = 0; i < neighbors.length; i += 1) {
		const current = neighbors[i];
		const next = neighbors[(i + 1) % neighbors.length];
		if (current === 0 && next === 1) {
			transitions += 1;
		}
	}
	return transitions;
};

const countOnes = (neighbors: readonly number[]) => {
	let count = 0;
	for (const value of neighbors) {
		count += value;
	}
	return count;
};

const zhangSuenStep = (inputMask: Uint8Array, width: number, height: number) => {
	const mask = new Uint8Array(inputMask);
	let changed = false;

	const subIteration = (isFirst: boolean) => {
		const toDelete: number[] = [];

		for (let y = 1; y < height - 1; y += 1) {
			for (let x = 1; x < width - 1; x += 1) {
				const idx = indexAt(x, y, width);
				if (mask[idx] === 0) {
					continue;
				}

				const [p2, p3, p4, p5, p6, p7, p8, p9] = getNeighbors(mask, x, y, width, height);
				const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9];
				const ones = countOnes(neighbors);
				if (ones < 2 || ones > 6) {
					continue;
				}

				const transitions = transitionsCount(neighbors);
				if (transitions !== 1) {
					continue;
				}

				const ruleA = isFirst ? p2 * p4 * p6 === 0 : p2 * p4 * p8 === 0;
				const ruleB = isFirst ? p4 * p6 * p8 === 0 : p2 * p6 * p8 === 0;

				if (ruleA && ruleB) {
					toDelete.push(idx);
				}
			}
		}

		for (const idx of toDelete) {
			if (mask[idx] === 1) {
				mask[idx] = 0;
				changed = true;
			}
		}
	};

	subIteration(true);
	subIteration(false);

	return { mask, changed };
};

const isBoundaryPixel = (mask: Uint8Array, x: number, y: number, width: number, height: number) => {
	if (mask[indexAt(x, y, width)] === 0) {
		return false;
	}

	const neighbors = [
		[x, y - 1],
		[x + 1, y],
		[x, y + 1],
		[x - 1, y],
	] as const;

	for (const [nx, ny] of neighbors) {
		if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
			return true;
		}
		if (mask[indexAt(nx, ny, width)] === 0) {
			return true;
		}
	}

	return false;
};

const computeDistanceTransform = (mask: Uint8Array, width: number, height: number) => {
	const total = width * height;
	const distances = new Int16Array(total);
	distances.fill(-1);

	const queue = new Int32Array(total);
	let head = 0;
	let tail = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const idx = indexAt(x, y, width);
			if (mask[idx] === 1 && isBoundaryPixel(mask, x, y, width, height)) {
				distances[idx] = 0;
				queue[tail] = idx;
				tail += 1;
			}
		}
	}

	const offsets = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0],
	] as const;

	while (head < tail) {
		const idx = queue[head];
		head += 1;
		const x = idx % width;
		const y = Math.floor(idx / width);

		for (const [dx, dy] of offsets) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
				continue;
			}

			const nIdx = indexAt(nx, ny, width);
			if (mask[nIdx] === 0 || distances[nIdx] !== -1) {
				continue;
			}

			distances[nIdx] = distances[idx] + 1;
			queue[tail] = nIdx;
			tail += 1;
		}
	}

	let maxDistance = 0;
	for (let i = 0; i < total; i += 1) {
		if (distances[i] > maxDistance) {
			maxDistance = distances[i];
		}
	}

	return { distances, maxDistance };
};

const distanceTransformSkeleton = (mask: Uint8Array, distances: Int16Array, width: number, height: number) => {
	const skeleton = new Uint8Array(mask.length);

	for (let y = 1; y < height - 1; y += 1) {
		for (let x = 1; x < width - 1; x += 1) {
			const idx = indexAt(x, y, width);
			if (mask[idx] === 0 || distances[idx] < 0) {
				continue;
			}

			const center = distances[idx];
			let hasGreaterNeighbor = false;
			let lowerNeighbors = 0;

			for (let oy = -1; oy <= 1; oy += 1) {
				for (let ox = -1; ox <= 1; ox += 1) {
					if (ox === 0 && oy === 0) {
						continue;
					}

					const neighborIdx = indexAt(x + ox, y + oy, width);
					if (mask[neighborIdx] === 0 || distances[neighborIdx] < 0) {
						continue;
					}

					if (distances[neighborIdx] > center) {
						hasGreaterNeighbor = true;
					}
					if (distances[neighborIdx] < center) {
						lowerNeighbors += 1;
					}
				}
			}

			if (!hasGreaterNeighbor && (center > 0 || lowerNeighbors >= 2)) {
				skeleton[idx] = 1;
			}
		}
	}

	return skeleton;
};

const createDistanceTransformFrames = (initialMask: Uint8Array, width: number, height: number): AnimationFrame[] => {
	const { distances, maxDistance } = computeDistanceTransform(initialMask, width, height);
	const frames: AnimationFrame[] = [
		{
			kind: "binary",
			mask: new Uint8Array(initialMask),
		},
	];

	const maxForScale = Math.max(1, maxDistance);

	for (let level = 0; level <= maxDistance; level += 1) {
		const intensity = new Uint8Array(initialMask.length);
		for (let i = 0; i < initialMask.length; i += 1) {
			if (initialMask[i] === 0 || distances[i] < 0 || distances[i] > level) {
				continue;
			}

			const normalized = distances[i] / maxForScale;
			intensity[i] = Math.round(40 + normalized * 215);
		}

		frames.push({
			kind: "distance",
			intensity,
		});
	}

	const skeleton = distanceTransformSkeleton(initialMask, distances, width, height);
	const hasSkeleton = skeleton.some((value) => value === 1);
	if (hasSkeleton) {
		frames.push({
			kind: "binary",
			mask: skeleton,
		});
	}

	return frames;
};

const createFrames = (
	initialMask: Uint8Array,
	width: number,
	height: number,
	algorithm: AlgorithmType,
): AnimationFrame[] => {
	if (algorithm === "distance") {
		return createDistanceTransformFrames(initialMask, width, height);
	}

	const frames: AnimationFrame[] = [
		{
			kind: "binary",
			mask: new Uint8Array(initialMask),
		},
	];
	let current = new Uint8Array(initialMask);

	for (let step = 0; step < 120; step += 1) {
		const result = zhangSuenStep(current, width, height);
		if (!result.changed) {
			break;
		}
		frames.push({
			kind: "binary",
			mask: new Uint8Array(result.mask),
		});
		current = result.mask;
	}

	return frames;
};

const getSkeletonNeighbors = (mask: Uint8Array, idx: number, width: number, height: number) => {
	const x = idx % width;
	const y = Math.floor(idx / width);
	const neighbors: number[] = [];

	for (let oy = -1; oy <= 1; oy += 1) {
		for (let ox = -1; ox <= 1; ox += 1) {
			if (ox === 0 && oy === 0) {
				continue;
			}

			const nx = x + ox;
			const ny = y + oy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
				continue;
			}

			const nIdx = indexAt(nx, ny, width);
			if (mask[nIdx] === 1) {
				neighbors.push(nIdx);
			}
		}
	}

	return neighbors;
};

const collectComponents = (mask: Uint8Array, width: number, height: number) => {
	const visited = new Uint8Array(mask.length);
	const components: number[][] = [];

	for (let idx = 0; idx < mask.length; idx += 1) {
		if (mask[idx] === 0 || visited[idx] === 1) {
			continue;
		}

		const queue: number[] = [idx];
		visited[idx] = 1;
		const component: number[] = [];

		for (let head = 0; head < queue.length; head += 1) {
			const current = queue[head];
			component.push(current);

			for (const neighbor of getSkeletonNeighbors(mask, current, width, height)) {
				if (visited[neighbor] === 1) {
					continue;
				}
				visited[neighbor] = 1;
				queue.push(neighbor);
			}
		}

		components.push(component);
	}

	return components;
};

const segmentKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const extractGraphFromSkeleton = (mask: Uint8Array, width: number, height: number): SkeletonGraph => {
	const components = collectComponents(mask, width, height);
	if (components.length === 0) {
		return {
			nodes: [],
			edges: [],
			components: 0,
			loops: 0,
			endpoints: 0,
			junctions: 0,
		};
	}

	const neighborMap = new Map<number, number[]>();
	const endpointSet = new Set<number>();
	const junctionPixelSet = new Set<number>();

	for (const component of components) {
		for (const idx of component) {
			const neighbors = getSkeletonNeighbors(mask, idx, width, height);
			neighborMap.set(idx, neighbors);
			if (neighbors.length <= 1) {
				endpointSet.add(idx);
			} else if (neighbors.length >= 3) {
				junctionPixelSet.add(idx);
			}
		}
	}

	const nodes: GraphNode[] = [];
	const pixelToNodeId = new Map<number, number>();
	const nodeAnchors = new Map<number, number[]>();

	const visitedJunction = new Set<number>();
	for (const start of junctionPixelSet) {
		if (visitedJunction.has(start)) {
			continue;
		}

		const queue = [start];
		visitedJunction.add(start);
		const cluster: number[] = [];

		for (let head = 0; head < queue.length; head += 1) {
			const current = queue[head];
			cluster.push(current);
			for (const neighbor of neighborMap.get(current) ?? []) {
				if (!junctionPixelSet.has(neighbor) || visitedJunction.has(neighbor)) {
					continue;
				}
				visitedJunction.add(neighbor);
				queue.push(neighbor);
			}
		}

		let sumX = 0;
		let sumY = 0;
		for (const idx of cluster) {
			sumX += idx % width;
			sumY += Math.floor(idx / width);
		}
		const centerX = sumX / cluster.length;
		const centerY = sumY / cluster.length;

		let representative = cluster[0];
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const idx of cluster) {
			const dx = (idx % width) - centerX;
			const dy = Math.floor(idx / width) - centerY;
			const distance = dx * dx + dy * dy;
			if (distance < bestDistance) {
				bestDistance = distance;
				representative = idx;
			}
		}

		const nodeId = nodes.length;
		nodes.push({
			id: nodeId,
			index: representative,
			x: representative % width,
			y: Math.floor(representative / width),
			type: "junction",
			degree: 0,
		});
		nodeAnchors.set(nodeId, cluster);
		for (const idx of cluster) {
			pixelToNodeId.set(idx, nodeId);
		}
	}

	for (const idx of endpointSet) {
		if (pixelToNodeId.has(idx)) {
			continue;
		}
		const nodeId = nodes.length;
		nodes.push({
			id: nodeId,
			index: idx,
			x: idx % width,
			y: Math.floor(idx / width),
			type: "endpoint",
			degree: 0,
		});
		nodeAnchors.set(nodeId, [idx]);
		pixelToNodeId.set(idx, nodeId);
	}

	for (const component of components) {
		const hasNode = component.some((idx) => pixelToNodeId.has(idx));
		if (hasNode || component.length === 0) {
			continue;
		}
		const idx = component[0];
		const nodeId = nodes.length;
		nodes.push({
			id: nodeId,
			index: idx,
			x: idx % width,
			y: Math.floor(idx / width),
			type: "isolated",
			degree: 0,
		});
		nodeAnchors.set(nodeId, [idx]);
		pixelToNodeId.set(idx, nodeId);
	}

	const edges: GraphEdge[] = [];
	const visitedSegments = new Set<string>();

	for (const node of nodes) {
		const startAnchors = nodeAnchors.get(node.id) ?? [node.index];
		for (const startIndex of startAnchors) {
			const startNeighbors = neighborMap.get(startIndex) ?? [];
			for (const neighborIndex of startNeighbors) {
				if (pixelToNodeId.get(neighborIndex) === node.id) {
					continue;
				}

				const firstKey = segmentKey(startIndex, neighborIndex);
				if (visitedSegments.has(firstKey)) {
					continue;
				}

				const path = [startIndex, neighborIndex];
				visitedSegments.add(firstKey);

				let prev = startIndex;
				let current = neighborIndex;
				let guard = 0;

				while (guard < width * height) {
					guard += 1;
					const nodeAtCurrent = pixelToNodeId.get(current);
					if (nodeAtCurrent !== undefined && nodeAtCurrent !== node.id) {
						break;
					}

					const options = (neighborMap.get(current) ?? []).filter(
						(idx) => idx !== prev && pixelToNodeId.get(idx) !== node.id,
					);
					if (options.length === 0) {
						break;
					}

					const next = options.find((candidate) => !visitedSegments.has(segmentKey(current, candidate))) ?? options[0];
					visitedSegments.add(segmentKey(current, next));
					prev = current;
					current = next;
					path.push(current);
				}

				let endNodeId = pixelToNodeId.get(current);
				if (endNodeId === undefined) {
					const fallbackId = nodes.length;
					nodes.push({
						id: fallbackId,
						index: current,
						x: current % width,
						y: Math.floor(current / width),
						type: "endpoint",
						degree: 0,
					});
					nodeAnchors.set(fallbackId, [current]);
					pixelToNodeId.set(current, fallbackId);
					endNodeId = fallbackId;
				}

				if (endNodeId === node.id) {
					continue;
				}

				edges.push({
					id: edges.length,
					from: node.id,
					to: endNodeId,
					path,
					length: Math.max(0, path.length - 1),
				});
			}
		}
	}

	const degreeMap = new Map<number, number>();
	for (const edge of edges) {
		degreeMap.set(edge.from, (degreeMap.get(edge.from) ?? 0) + 1);
		degreeMap.set(edge.to, (degreeMap.get(edge.to) ?? 0) + 1);
	}

	for (const node of nodes) {
		const degree = degreeMap.get(node.id) ?? 0;
		node.degree = degree;
		if (degree <= 0) {
			node.type = "isolated";
		} else if (degree === 1) {
			node.type = "endpoint";
		} else if (degree === 2) {
			node.type = "normal";
		} else {
			node.type = "junction";
		}
	}

	const endpoints = nodes.filter((node) => node.type === "endpoint").length;
	const junctions = nodes.filter((node) => node.type === "junction").length;
	const loops = Math.max(0, edges.length - nodes.length + components.length);

	return {
		nodes,
		edges,
		components: components.length,
		loops,
		endpoints,
		junctions,
	};
};

const pruneSkeletonBranches = (inputMask: Uint8Array, width: number, height: number, threshold: number) => {
	if (threshold <= 0) {
		return new Uint8Array(inputMask);
	}

	const mask = new Uint8Array(inputMask);
	const graph = extractGraphFromSkeleton(mask, width, height);
	if (graph.edges.length === 0) {
		return mask;
	}

	const nodeById = new Map<number, GraphNode>();
	for (const node of graph.nodes) {
		nodeById.set(node.id, node);
	}

	const removableEdges = graph.edges.filter((edge) => {
		if (edge.length >= threshold) {
			return false;
		}
		const fromType = nodeById.get(edge.from)?.type;
		const toType = nodeById.get(edge.to)?.type;
		return fromType === "endpoint" || toType === "endpoint";
	});

	for (const edge of removableEdges) {
		const fromNode = nodeById.get(edge.from);
		const toNode = nodeById.get(edge.to);
		if (!fromNode || !toNode) {
			continue;
		}

		for (let i = 0; i < edge.path.length; i += 1) {
			const pixelIndex = edge.path[i];
			const keepFromJunction = i === 0 && fromNode.type !== "endpoint";
			const keepToJunction = i === edge.path.length - 1 && toNode.type !== "endpoint";
			if (keepFromJunction || keepToJunction) {
				continue;
			}

			if (mask[pixelIndex] === 1) {
				mask[pixelIndex] = 0;
			}
		}
	}

	return mask;
};

const mergeGraphNodes = (graph: SkeletonGraph, mergeRadius: number): SkeletonGraph => {
	if (mergeRadius <= 0 || graph.nodes.length <= 1) {
		return graph;
	}

	const parent = graph.nodes.map((_, index) => index);
	const find = (node: number): number => {
		let root = node;
		while (parent[root] !== root) {
			root = parent[root];
		}
		let current = node;
		while (parent[current] !== current) {
			const next = parent[current];
			parent[current] = root;
			current = next;
		}
		return root;
	};
	const union = (a: number, b: number) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) {
			parent[rb] = ra;
		}
	};

	const radiusSq = mergeRadius * mergeRadius;
	for (let i = 0; i < graph.nodes.length; i += 1) {
		for (let j = i + 1; j < graph.nodes.length; j += 1) {
			const dx = graph.nodes[i].x - graph.nodes[j].x;
			const dy = graph.nodes[i].y - graph.nodes[j].y;
			if (dx * dx + dy * dy <= radiusSq) {
				union(i, j);
			}
		}
	}

	const groups = new Map<number, number[]>();
	for (let i = 0; i < graph.nodes.length; i += 1) {
		const root = find(i);
		const arr = groups.get(root) ?? [];
		arr.push(i);
		groups.set(root, arr);
	}

	const oldToNew = new Map<number, number>();
	const mergedNodes: GraphNode[] = [];

	for (const members of groups.values()) {
		let sumX = 0;
		let sumY = 0;
		let sumIndex = 0;
		for (const member of members) {
			const node = graph.nodes[member];
			sumX += node.x;
			sumY += node.y;
			sumIndex += node.index;
		}

		const nodeId = mergedNodes.length;
		for (const member of members) {
			oldToNew.set(graph.nodes[member].id, nodeId);
		}

		mergedNodes.push({
			id: nodeId,
			index: Math.round(sumIndex / members.length),
			x: sumX / members.length,
			y: sumY / members.length,
			type: "isolated",
			degree: 0,
		});
	}

	const edgeMap = new Map<string, GraphEdge>();
	for (const edge of graph.edges) {
		const from = oldToNew.get(edge.from);
		const to = oldToNew.get(edge.to);
		if (from === undefined || to === undefined || from === to) {
			continue;
		}

		const a = Math.min(from, to);
		const b = Math.max(from, to);
		const key = `${a}-${b}`;
		const existing = edgeMap.get(key);
		if (!existing || edge.length < existing.length) {
			edgeMap.set(key, {
				id: -1,
				from: a,
				to: b,
				path: edge.path,
				length: edge.length,
			});
		}
	}

	const mergedEdges = Array.from(edgeMap.values()).map((edge, index) => ({ ...edge, id: index }));

	const degreeMap = new Map<number, number>();
	for (const edge of mergedEdges) {
		degreeMap.set(edge.from, (degreeMap.get(edge.from) ?? 0) + 1);
		degreeMap.set(edge.to, (degreeMap.get(edge.to) ?? 0) + 1);
	}

	for (const node of mergedNodes) {
		const degree = degreeMap.get(node.id) ?? 0;
		node.degree = degree;
		node.type = degree <= 0 ? "isolated" : degree === 1 ? "endpoint" : degree === 2 ? "normal" : "junction";
	}

	let components = 0;
	const visited = new Set<number>();
	const adjacency = new Map<number, number[]>();
	for (const node of mergedNodes) {
		adjacency.set(node.id, []);
	}
	for (const edge of mergedEdges) {
		adjacency.get(edge.from)?.push(edge.to);
		adjacency.get(edge.to)?.push(edge.from);
	}
	for (const node of mergedNodes) {
		if (visited.has(node.id)) {
			continue;
		}
		components += 1;
		const queue = [node.id];
		visited.add(node.id);
		for (let head = 0; head < queue.length; head += 1) {
			const current = queue[head];
			for (const neighbor of adjacency.get(current) ?? []) {
				if (visited.has(neighbor)) {
					continue;
				}
				visited.add(neighbor);
				queue.push(neighbor);
			}
		}
	}

	const endpoints = mergedNodes.filter((node) => node.type === "endpoint").length;
	const junctions = mergedNodes.filter((node) => node.type === "junction").length;
	const loops = Math.max(0, mergedEdges.length - mergedNodes.length + components);

	return {
		nodes: mergedNodes,
		edges: mergedEdges,
		components,
		loops,
		endpoints,
		junctions,
	};
};

export function Skeletonization({ type }: SkeletonizationProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const isDrawingRef = useRef(false);
	const lastPointRef = useRef<{ x: number; y: number } | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const framesRef = useRef<AnimationFrame[]>([]);
	const sourceMaskRef = useRef<Uint8Array | null>(null);
	const thinningMaskRef = useRef<Uint8Array | null>(null);

	const [isAnimating, setIsAnimating] = useState(false);
	const [algorithm, setAlgorithm] = useState<AlgorithmType>("thinning");
	const [brushSize, setBrushSize] = useState(8);
	const [speed, setSpeed] = useState(0.5);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [frameCount, setFrameCount] = useState(0);
	const [drawColor, setDrawColor] = useState("#ffffff");
	const [primaryColor, setPrimaryColor] = useState("#3b82f6");
	const [destructiveColor, setDestructiveColor] = useState("#ef4444");
	const [pruningLength, setPruningLength] = useState(8);
	const [nodeMergeRadius, setNodeMergeRadius] = useState(8);
	const [graphData, setGraphData] = useState<SkeletonGraph | null>(null);

	const delay = useMemo(() => Math.round(40 + (1 - speed) * 500), [speed]);
	const isGraphMode = type === "graph";

	useEffect(() => {
		const updateColor = () => {
			const foreground = getComputedStyle(document.documentElement).getPropertyValue("--color-foreground").trim();
			const primary = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
			const destructive = getComputedStyle(document.documentElement).getPropertyValue("--color-destructive").trim();
			if (foreground.length > 0) {
				setDrawColor(foreground);
			}
			if (primary.length > 0) {
				setPrimaryColor(primary);
			}
			if (destructive.length > 0) {
				setDestructiveColor(destructive);
			}
		};

		updateColor();

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes" && mutation.attributeName === "class") {
					updateColor();
				}
			}
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			observer.disconnect();
		};
	}, []);

	const getContext = () => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return null;
		}
		return canvas.getContext("2d");
	};

	const clearAnimationInterval = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	};

	const renderMask = (mask: Uint8Array) => {
		const ctx = getContext();
		if (!ctx) {
			return;
		}

		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		ctx.fillStyle = drawColor;
		for (let y = 0; y < CANVAS_SIZE; y += 1) {
			for (let x = 0; x < CANVAS_SIZE; x += 1) {
				if (mask[indexAt(x, y, CANVAS_SIZE)] === 1) {
					ctx.fillRect(x, y, 1, 1);
				}
			}
		}
	};

	const renderDistance = (intensity: Uint8Array) => {
		const ctx = getContext();
		if (!ctx) {
			return;
		}

		const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
		for (let i = 0; i < intensity.length; i += 1) {
			const value = intensity[i];
			const offset = i * 4;
			imageData.data[offset] = value;
			imageData.data[offset + 1] = value;
			imageData.data[offset + 2] = value;
			imageData.data[offset + 3] = value === 0 ? 0 : 255;
		}

		ctx.putImageData(imageData, 0, 0);
	};

	const renderFrame = (frame: AnimationFrame) => {
		if (frame.kind === "binary") {
			renderMask(frame.mask);
			return;
		}

		renderDistance(frame.intensity);
	};

	const applyPruningAndBuildGraph = (baseSkeleton: Uint8Array) => {
		const pruned = pruneSkeletonBranches(baseSkeleton, CANVAS_SIZE, CANVAS_SIZE, pruningLength);
		renderMask(pruned);
		const rawGraph = extractGraphFromSkeleton(pruned, CANVAS_SIZE, CANVAS_SIZE);
		setGraphData(mergeGraphNodes(rawGraph, nodeMergeRadius));
	};

	const extractMask = () => {
		const ctx = getContext();
		if (!ctx) {
			return null;
		}

		const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		const mask = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
		for (let i = 0; i < imageData.data.length; i += 4) {
			mask[i / 4] = imageData.data[i + 3] > 20 ? 1 : 0;
		}

		return mask;
	};

	const stopAnimation = () => {
		setIsAnimating(false);
		clearAnimationInterval();
	};

	const resetToSource = () => {
		stopAnimation();
		setGraphData(null);
		thinningMaskRef.current = null;
		if (!sourceMaskRef.current) {
			return;
		}
		renderMask(sourceMaskRef.current);
		setCurrentFrame(0);
	};

	const clearCanvas = () => {
		stopAnimation();
		const ctx = getContext();
		if (!ctx) {
			return;
		}
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		framesRef.current = [];
		sourceMaskRef.current = null;
		thinningMaskRef.current = null;
		setGraphData(null);
		setCurrentFrame(0);
		setFrameCount(0);
	};

	const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE;
		const y = ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE;
		return { x, y };
	};

	const drawSegment = (start: { x: number; y: number }, end: { x: number; y: number }) => {
		const ctx = getContext();
		if (!ctx) {
			return;
		}

		ctx.strokeStyle = drawColor;
		ctx.lineWidth = brushSize;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	};

	const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (isAnimating) {
			return;
		}

		event.currentTarget.setPointerCapture(event.pointerId);
		const point = pointerPosition(event);
		isDrawingRef.current = true;
		lastPointRef.current = point;
		drawSegment(point, point);
	};

	const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (!isDrawingRef.current || isAnimating) {
			return;
		}

		const point = pointerPosition(event);
		if (!lastPointRef.current) {
			lastPointRef.current = point;
			return;
		}

		drawSegment(lastPointRef.current, point);
		lastPointRef.current = point;
	};

	const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		isDrawingRef.current = false;
		lastPointRef.current = null;
	};

	const buildAndPlayAnimation = () => {
		const initialMask = extractMask();
		if (!initialMask) {
			return;
		}

		const hasForeground = initialMask.some((value) => value === 1);
		if (!hasForeground) {
			stopAnimation();
			setGraphData(null);
			thinningMaskRef.current = null;
			setCurrentFrame(0);
			setFrameCount(0);
			return;
		}

		sourceMaskRef.current = new Uint8Array(initialMask);
		setGraphData(null);
		thinningMaskRef.current = null;
		const selectedAlgorithm: AlgorithmType = isGraphMode ? "thinning" : algorithm;
		const frames = createFrames(initialMask, CANVAS_SIZE, CANVAS_SIZE, selectedAlgorithm);
		framesRef.current = frames;
		setFrameCount(frames.length);
		setCurrentFrame(0);
		renderFrame(frames[0]);

		if (frames.length <= 1) {
			setIsAnimating(false);
			if (isGraphMode && frames[0]?.kind === "binary") {
				thinningMaskRef.current = new Uint8Array(frames[0].mask);
				applyPruningAndBuildGraph(frames[0].mask);
			}
			return;
		}

		setIsAnimating(true);
		let frameIndex = 0;
		clearAnimationInterval();
		intervalRef.current = setInterval(() => {
			frameIndex += 1;
			if (frameIndex >= frames.length) {
				clearAnimationInterval();
				setIsAnimating(false);
				setCurrentFrame(frames.length - 1);
				const finalFrame = frames[frames.length - 1];
				if (isGraphMode && finalFrame?.kind === "binary") {
					thinningMaskRef.current = new Uint8Array(finalFrame.mask);
					applyPruningAndBuildGraph(finalFrame.mask);
				}
				return;
			}

			renderFrame(frames[frameIndex]);
			setCurrentFrame(frameIndex);
		}, delay);
	};

	useEffect(() => {
		if (!isGraphMode || isAnimating || !thinningMaskRef.current) {
			return;
		}

		applyPruningAndBuildGraph(thinningMaskRef.current);
	}, [pruningLength, nodeMergeRadius, isGraphMode, isAnimating]);

	useEffect(() => {
		return () => {
			clearAnimationInterval();
		};
	}, []);

	if (type !== "basic" && type !== "graph") {
		return null;
	}

	const graphNodeMap = useMemo(() => {
		if (!graphData) {
			return new Map<number, GraphNode>();
		}
		return new Map(graphData.nodes.map((node) => [node.id, node]));
	}, [graphData]);

	return (
		<div className="grid grid-cols-2 gap-4 my-6 items-center">
			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="flex flex-row justify-center gap-2">
					{!isGraphMode && (
						<ToggleGroup
							type="single"
							variant="outline"
							spacing={2}
							value={algorithm}
							onValueChange={(value) => {
								if (value === "thinning" || value === "distance") {
									setAlgorithm(value);
								}
							}}
						>
							<ToggleGroupItem value="thinning">Thinning</ToggleGroupItem>
							<ToggleGroupItem value="distance">Distance Transform</ToggleGroupItem>
						</ToggleGroup>
					)}
					<Button variant="outline" size="icon" onClick={clearCanvas}>
						<Trash2 />
					</Button>
					<Button size="icon" onClick={buildAndPlayAnimation} disabled={isAnimating}>
						<Play />
					</Button>
					<Button variant="outline" size="icon" onClick={stopAnimation} disabled={!isAnimating}>
						<Pause />
					</Button>
					<Button variant="outline" size="icon" onClick={resetToSource}>
						<RotateCcw />
					</Button>
				</div>

				<div className="flex-1 relative flex items-center justify-center min-h-0">
					<div className="relative w-auto h-full aspect-square">
						<canvas
							ref={canvasRef}
							width={CANVAS_SIZE}
							height={CANVAS_SIZE}
							className="w-full h-full bg-card rounded-md border border-border cursor-crosshair"
							onPointerDown={onPointerDown}
							onPointerMove={onPointerMove}
							onPointerUp={onPointerUp}
							onPointerLeave={onPointerUp}
						/>
						{isGraphMode && graphData && !isAnimating && (
							<motion.svg
								key={`graph-${graphData.nodes.length}-${graphData.edges.length}`}
								viewBox="0 0 400 400"
								className="pointer-events-none absolute inset-0 w-full h-full"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.25 }}
							>
								{graphData.edges.map((edge) => (
									<motion.line
										key={edge.id}
										x1={graphNodeMap.get(edge.from)?.x ?? 0}
										y1={graphNodeMap.get(edge.from)?.y ?? 0}
										x2={graphNodeMap.get(edge.to)?.x ?? 0}
										y2={graphNodeMap.get(edge.to)?.y ?? 0}
										stroke={primaryColor}
										strokeWidth={2}
										opacity={0.8}
										initial={{ pathLength: 0, opacity: 0 }}
										animate={{ pathLength: 1, opacity: 0.8 }}
										transition={{ duration: 0.35, delay: Math.min(edge.id * 0.015, 0.25) }}
									/>
								))}
								{graphData.nodes.map((node) => (
									<motion.circle
										key={node.id}
										cx={node.x}
										cy={node.y}
										r={4}
										fill={node.type === "junction" ? destructiveColor : primaryColor}
										initial={{ scale: 0, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ type: "spring", stiffness: 280, damping: 20, delay: Math.min(node.id * 0.015, 0.25) }}
									/>
								))}
							</motion.svg>
						)}
					</div>
				</div>
			</div>

			<div className="w-full aspect-4/3 flex flex-col justify-center gap-4">
				<div className="mx-auto grid w-full max-w-xs gap-2">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor="brush-slider">Brush size</Label>
						<span className="text-muted-foreground text-sm">{brushSize.toFixed(0)}</span>
					</div>
					<Slider
						id="brush-slider"
						value={[brushSize]}
						onValueChange={(value) => setBrushSize(value[0])}
						min={1}
						max={24}
						step={1}
					/>
				</div>

				<div className="mx-auto grid w-full max-w-xs gap-2">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor="speed-slider">Animation speed</Label>
						<span className="text-muted-foreground text-sm">{speed.toFixed(2)}</span>
					</div>
					<Slider
						id="speed-slider"
						value={[speed]}
						onValueChange={(value) => setSpeed(value[0])}
						min={0}
						max={1}
						step={0.01}
					/>
				</div>

				{isGraphMode && (
					<div className="mx-auto grid w-full max-w-xs gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="pruning-slider">Pruning length</Label>
							<span className="text-muted-foreground text-sm">{pruningLength.toFixed(0)}</span>
						</div>
						<Slider
							id="pruning-slider"
							value={[pruningLength]}
							onValueChange={(value) => setPruningLength(value[0])}
							min={0}
							max={60}
							step={1}
						/>
						<div className="flex items-center justify-between gap-2 mt-2">
							<Label htmlFor="merge-slider">Node merge radius</Label>
							<span className="text-muted-foreground text-sm">{nodeMergeRadius.toFixed(0)}</span>
						</div>
						<Slider
							id="merge-slider"
							value={[nodeMergeRadius]}
							onValueChange={(value) => setNodeMergeRadius(value[0])}
							min={0}
							max={30}
							step={1}
						/>
					</div>
				)}

				<div className="mx-auto grid w-full max-w-xs gap-1 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Status</span>
						<span>{isAnimating ? "Animating" : "Idle"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Algorithm</span>
						<span className="capitalize">{isGraphMode ? "thinning + pruning + graph" : algorithm}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Frame</span>
						<span>
							{frameCount === 0 ? 0 : currentFrame + 1}/{frameCount}
						</span>
					</div>
					{isGraphMode && (
						<>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Nodes</span>
								<span>{graphData?.nodes.length ?? 0}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Intersections</span>
								<span>{graphData?.junctions ?? 0}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Edges</span>
								<span>{graphData?.edges.length ?? 0}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Components</span>
								<span>{graphData?.components ?? 0}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Loops</span>
								<span>{graphData?.loops ?? 0}</span>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
