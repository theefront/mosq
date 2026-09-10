import type { Graph, Motor, SignalTrace, Snapshot, Stimulus } from '../types';
import { CONFIG } from '../config';
interface Input { event: Stimulus; remaining: number; channel: number; side: number; token: number; }
export class NeuralSimulation {
  readonly voltage: Float32Array;
  readonly activity: Float32Array;
  readonly firedAt: Float32Array;
  readonly firedCause: Float32Array;
  private voltageCause: Uint16Array;
  private arrivalCause: Uint16Array;
  private arrivalStrength: Float32Array;
  private token = 0;
  private traces = new Map<number, SignalTrace>();
  private refractory: Uint8Array;
  private arrivals: Float32Array;
  private slot = 0;
  private inputs: Input[] = [];
  private recentSpikeCount = 0;
  private modules = new Float32Array(8);
  private motor: Motor = { left: 0, right: 0, attraction: 0, threat: 0, arousal: 0, recovery: 0 };
  time = 0;
  totalSpikes = 0;
  causeId: string | null = null;
  constructor(readonly graph: Graph) {
    this.firedCause = new Float32Array(graph.count); this.voltageCause = new Uint16Array(graph.count); this.arrivalCause = new Uint16Array(graph.count * 64); this.arrivalStrength = new Float32Array(graph.count * 64);
    this.voltage = new Float32Array(graph.count); this.activity = new Float32Array(graph.count);
    this.firedAt = new Float32Array(graph.count).fill(-100); this.refractory = new Uint8Array(graph.count);
    this.arrivals = new Float32Array(graph.count * 64);
  }
  stimulate(event: Stimulus) {
    if (!Number.isFinite(event.intensity) || event.kind === 'quiet') return;
    const channel = ['threat','tap','shadow'].includes(event.kind) ? 1 : event.kind === 'attraction' ? 0 : 2;
    this.token = this.token % 65000 + 1;
    this.traces.set(this.token, { id: event.id, token: this.token, startedAt: this.time, sensoryAt: null, integrationAt: null, motorAt: null });
    if (this.traces.size > 64) this.traces.delete(this.traces.keys().next().value!);
    this.inputs.push({ token: this.token, event: { ...event, intensity: Math.max(0, Math.min(1, event.intensity)) }, remaining: event.kind === 'co2' ? 24 : 25 + Math.round(event.intensity * 70), channel, side: event.position ? event.position[0] < 0 ? 0 : 1 : -1 });
    this.inputs = this.inputs.slice(-CONFIG.maxStimuli); this.causeId = event.id;
  }
  clearInputs() { this.inputs = []; }
  step() {
    const g = this.graph, base = this.slot * g.count;
    this.time += CONFIG.stepMs / 1000;
    for (let m = 0; m < 8; m++) this.modules[m] *= .981;
    for (const input of this.inputs) {
      input.remaining--;
      for (let side = 0; side < 2; side++) {
        const strength = input.side === -1 || input.side === side ? 1 : .35;
        for (let i = g.starts[side]; i < g.starts[side] + g.counts[side]; i++) {
          if (g.channels[i] === input.channel && !this.refractory[i]) { this.voltage[i] += (.055 + input.event.intensity * .21) * (input.event.kind === 'co2' ? .65 : 1) * strength * (.75 + (i % 11) / 22); this.voltageCause[i] = input.token; }
        }
      }
    }
    this.inputs = this.inputs.filter(e => e.remaining > 0);
    for (let i = 0; i < g.count; i++) {
      this.activity[i] *= .955;
      const arrival = this.arrivals[base + i];
      if (arrival > .05 && this.arrivalStrength[base + i] > this.voltage[i] * .5) this.voltageCause[i] = this.arrivalCause[base + i];
      this.arrivals[base + i] = 0; this.arrivalStrength[base + i] = 0;
      if (this.refractory[i]) { this.refractory[i]--; continue; }
      this.voltage[i] = Math.max(-.65, Math.min(2, this.voltage[i] * .972 + arrival));
      if (this.voltage[i] < .94 + (i % 13) * .014) continue;
      this.voltage[i] = 0; this.refractory[i] = 12 + i % 5;
      this.activity[i] = 1; this.firedAt[i] = this.time; this.firedCause[i] = this.voltageCause[i];
      const trace = this.traces.get(this.voltageCause[i]);
      if (trace) { const m = g.moduleIds[i]; if (m < 2 && trace.sensoryAt === null) trace.sensoryAt = this.time; if (m === 4 && trace.integrationAt === null) trace.integrationAt = this.time; if ((m === 5 || m === 6) && trace.motorAt === null) trace.motorAt = this.time; }
      this.modules[g.moduleIds[i]] = Math.min(1, this.modules[g.moduleIds[i]] + 1.4 / g.counts[g.moduleIds[i]]);
      this.recentSpikeCount++; this.totalSpikes++;
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
        const index = ((this.slot + g.delays[e]) % 64) * g.count + g.targets[e];
        if (g.weights[e] > this.arrivalStrength[index]) { this.arrivalStrength[index] = g.weights[e]; this.arrivalCause[index] = this.voltageCause[i]; }
        this.arrivals[index] = Math.max(-1, Math.min(1.4, this.arrivals[index] + g.weights[e]));
      }
    }
    this.slot = (this.slot + 1) % 64;
    const targets: Motor = { left: this.modules[5], right: this.modules[6], attraction: this.modules[2], threat: this.modules[3], arousal: this.modules[4], recovery: this.modules[7] };
    for (const key of Object.keys(this.motor) as (keyof Motor)[]) this.motor[key] += (targets[key] - this.motor[key]) * .028;
  }
  snapshot(): Snapshot {
    const spikeRate = this.recentSpikeCount / (CONFIG.snapshotMs / 1000); this.recentSpikeCount = 0;
    return { time: this.time, activity: this.activity.slice(), firedAt: this.firedAt.slice(), firedCause: this.firedCause.slice(), trace: this.traces.has(this.token) ? { ...this.traces.get(this.token)! } : null, modules: Array.from(this.modules), motor: { ...this.motor }, spikeRate, totalSpikes: this.totalSpikes, causeId: this.causeId };
  }
}
