import { CONFIG, MODULES } from '../config';
import type { Graph } from '../types';
export function seeded(seed: number) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function generateGraph(seed = CONFIG.seed): Graph {
  const random = seeded(seed), counts = MODULES.map(m => m.count), starts: number[] = [];
  let count = 0;
  for (const n of counts) { starts.push(count); count += n; }
  const positions = new Float32Array(count * 3), moduleIds = new Uint8Array(count), channels = new Uint8Array(count);
  for (let m = 0; m < MODULES.length; m++) {
    const lobe = MODULES[m];
    for (let j = 0; j < lobe.count; j++) {
      const i = starts[m] + j, u = random() * 2 - 1, a = random() * Math.PI * 2, r = Math.pow(random(), .38);
      const w = Math.sqrt(1 - u * u), organic = 1 + .065 * Math.sin(a * 3 + u * 4);
      positions[i * 3] = lobe.center[0] + Math.cos(a) * w * r * lobe.radius[0] * organic;
      positions[i * 3 + 1] = lobe.center[1] + u * r * lobe.radius[1];
      positions[i * 3 + 2] = lobe.center[2] + Math.sin(a) * w * r * lobe.radius[2];
      moduleIds[i] = m; channels[i] = j % 3;
    }
  }
  const offsets = new Uint32Array(count + 1), targets: number[] = [], weights: number[] = [], delays: number[] = [];
  const add = (to: number, weight: number, delay: number) => { targets.push(to); weights.push(weight); delays.push(delay); };
  for (let i = 0; i < count; i++) {
    offsets[i] = targets.length;
    const m = moduleIds[i], candidates: { index: number; d: number }[] = [];
    for (let k = 0; k < 28; k++) {
      const j = starts[m] + Math.floor(random() * counts[m]);
      if (j === i || (m < 2 && channels[j] !== channels[i])) continue;
      const d = (positions[i * 3] - positions[j * 3]) ** 2 + (positions[i * 3 + 1] - positions[j * 3 + 1]) ** 2 + (positions[i * 3 + 2] - positions[j * 3 + 2]) ** 2;
      if (!candidates.some(c => c.index === j)) candidates.push({ index: j, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const c of candidates.slice(0, 6)) add(c.index, i % 7 === 0 ? -.17 : .13, 7 + Math.floor(Math.sqrt(c.d) * 9));
    // Designed sensory channels retain the stimulus sign until their functional lobe.
    const routes = m < 2 ? [channels[i] === 0 ? 2 : channels[i] === 1 ? 3 : 4] : m === 2 ? [4] : m === 3 ? [4, 7] : m === 4 ? [5, 6, 7] : [];
    for (const targetModule of routes) {
      for (let k = 0; k < 2; k++) {
        const j = starts[targetModule] + Math.floor(random() * counts[targetModule]);
        add(j, targetModule === 7 ? .32 : .63, 20 + Math.floor(random() * 24));
      }
    }
    if (m === 7) for (let k = 0; k < 3; k++) add(starts[4] + Math.floor(random() * counts[4]), -.22, 30);
  }
  offsets[count] = targets.length;
  return { count, edgeCount: targets.length, positions, moduleIds, channels, offsets, targets: new Uint16Array(targets), weights: new Float32Array(weights), delays: new Uint8Array(delays), starts, counts };
}
