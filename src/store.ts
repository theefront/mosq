import { create } from 'zustand';
import type { Behavior, FeedInfo, Graph, Motor, SignalTrace, Stimulus } from './types';
export type View = 'exhibit' | 'brain' | 'body';
export type ToolMode = 'orbit' | 'lure';
const zeroMotor: Motor = { left: 0, right: 0, attraction: 0, threat: 0, arousal: 0, recovery: 0 };
interface State {
  ready: boolean; graph: Graph | null; paused: boolean; cinema: boolean; drawer: 'about' | 'inspector' | null;
  view: View; cameraReset: number; xray: boolean; follow: boolean; tool: ToolMode; selectedModule: number | null; hoveredModule: number | null;
  quality: 'auto' | 'high' | 'medium' | 'low'; effectiveQuality: 'high' | 'medium' | 'low'; reducedMotion: boolean;
  feed: FeedInfo; product: FeedInfo['product']; demoOnly: boolean; sensitivity: number;
  behavior: Behavior; motor: Motor; modules: number[]; spikeRate: number; totalSpikes: number; simTime: number;
  reaction: Stimulus | null; trace: SignalTrace | null; latest: Stimulus | null; history: Stimulus[]; activityHistory: number[]; caption: string; captionAt: number; audio: boolean; volume: number; fps: number; discarded: number;
  patch: (value: Partial<State>) => void;
}
const params = new URLSearchParams(location.search);
const demoOnly = params.has('demo');
const requestedQuality = params.get('quality');
const initialQuality = requestedQuality === 'high' || requestedQuality === 'medium' || requestedQuality === 'low' ? requestedQuality : 'auto';
export const useStore = create<State>(set => ({
  ready: false, graph: null, paused: false, cinema: false, drawer: null, view: 'exhibit', cameraReset: 0, xray: false, follow: false, tool: 'orbit', selectedModule: null, hoveredModule: null,
  quality: initialQuality, effectiveQuality: initialQuality !== 'auto' ? initialQuality : window.innerWidth < 700 ? 'low' : 'high', reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  feed: { state: demoOnly ? 'DEMO' : 'CONNECTING', mode: 'demo', product: 'BTC-USD', reason: demoOnly ? 'Deterministic scenario · simulated stimuli' : 'Connecting to Coinbase · demo running', lastTrade: 0, lastHeartbeat: 0, observedTrades: 0, price: null, warmup: true, attempt: 0 },
  product: 'BTC-USD', demoOnly, sensitivity: 1, behavior: 'resting', motor: zeroMotor, modules: Array(8).fill(0), spikeRate: 0, totalSpikes: 0, simTime: 0,
  reaction: null, trace: null, latest: null, history: [], activityHistory: Array(48).fill(0), caption: 'Nothing happening. Practicing menace.', captionAt: 0, audio: false, volume: .18, fps: 0, discarded: 0,
  patch: value => set(value),
}));
