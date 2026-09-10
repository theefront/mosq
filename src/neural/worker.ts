/// <reference lib="webworker" />
import { generateGraph } from './graph';
import { NeuralSimulation } from './simulation';
import { CONFIG } from '../config';
import type { Stimulus } from '../types';
const graph = generateGraph();
const sim = new NeuralSimulation(graph);
postMessage({ type: 'graph', graph });
let paused = false, last = performance.now(), accumulator = 0, steps = 0;
self.onmessage = (e: MessageEvent<{ type: string; event?: Stimulus; value?: boolean }>) => {
  if (e.data.type === 'stimulus' && !paused && e.data.event) sim.stimulate(e.data.event);
  if (e.data.type === 'pause') { paused = !!e.data.value; last = performance.now(); accumulator = 0; }
};
setInterval(() => {
  const now = performance.now(), elapsed = Math.min(100, now - last); last = now;
  if (paused) return;
  accumulator += elapsed;
  while (accumulator >= CONFIG.stepMs) {
    sim.step(); accumulator -= CONFIG.stepMs; steps++;
    if (steps % (CONFIG.snapshotMs / CONFIG.stepMs) === 0) {
      const snapshot = sim.snapshot();
      postMessage({ type: 'snapshot', snapshot }, { transfer: [snapshot.activity.buffer, snapshot.firedAt.buffer, snapshot.firedCause.buffer] });
    }
  }
}, CONFIG.stepMs);
