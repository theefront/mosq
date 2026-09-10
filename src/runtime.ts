import { useStore } from './store';
import { BehaviorController } from './organism/controller';
import { CoinbaseFeed } from './feed/coinbase';
import type { Graph, Snapshot, Stimulus, StimulusKind, Vec3 } from './types';
export const runtime: { graph: Graph | null; snapshot: Snapshot | null; controller: BehaviorController; effect: { kind: StimulusKind; at: number; position: Vec3 } | null; simulationClock: number; headPosition: Vec3 } = { graph: null, snapshot: null, controller: new BehaviorController(), effect: null, simulationClock: 0, headPosition: [-.65,-.25,.5] };
declare global { interface Window { __MOSQUITO__?: { state: typeof useStore.getState; runtime: typeof runtime }; } }
if (import.meta.env.DEV) window.__MOSQUITO__ = { state: useStore.getState, runtime };
let worker: Worker | null = null;
let feed: CoinbaseFeed | null = null;
let serial = 0, demoCycle = -1, demoPhase = -1, telemetryAt = -1, lastTap = -10, manualUntil = 0;
const events = new Map<string, Stimulus>();
const scenario: [number, StimulusKind, number, Vec3][] = [[.8,'co2',.48,[-1.4,-.8,1]],[5.5,'attraction',.78,[-1.8,-.8,1]],[11,'attraction',.7,[-1.8,-.8,1]],[16,'arousal',.76,[1,-.8,.7]],[22,'shadow',.93,[2,-.6,.7]],[29,'quiet',.1,[0,-.9,.7]]];
export const descriptions: Record<StimulusKind, string> = { attraction: 'Warm lure detected', threat: 'Observed downward move', pulse: 'Unusually large observed trade', arousal: 'Observed activity surge', co2: 'CO₂ in the air', shadow: 'A shadow passes overhead', tap: 'A tap on the glass', quiet: 'The world grows quiet' };
const captions: Partial<Record<StimulusKind, string[]>> = { co2: ['Someone exhaled. Interesting.', 'My antennae have a lead.'], attraction: ['Is that a warm thought?', 'Just one tiny sip.'], shadow: ['Absolutely not.', 'My antennae have concerns.'], tap: ['I heard that.', 'We agreed: look, don’t tap.'], threat: ['The vibes have deteriorated.'], arousal: ['A lot to process. Very little brain.'], quiet: ['Nothing happening. Practicing menace.'] };
export function dispatchStimulus(event: Stimulus) {
  const state = useStore.getState();
  if (state.paused || document.hidden) { state.patch({ discarded: state.discarded + 1 }); return; }
  if (!Number.isFinite(event.intensity)) return;
  event.intensity = Math.max(0, Math.min(1, event.intensity));
  if (event.source === 'manual') manualUntil = runtime.simulationClock + 7;
  events.set(event.id, event); if (events.size > 64) events.delete(events.keys().next().value!);
  worker?.postMessage({ type: 'stimulus', event });
  runtime.effect = { kind: event.kind, at: runtime.simulationClock, position: event.position || [-1.6,-.8,1] };
  const patch: Parameters<typeof state.patch>[0] = { trace: null, latest: event, history: [event, ...state.history].slice(0, 12) };
  if (runtime.simulationClock - state.captionAt > 7 || state.captionAt === 0 || (['shadow','tap','threat'].includes(event.kind) && runtime.simulationClock - state.captionAt > 2)) {
    const options = captions[event.kind];
    if (options) { patch.caption = options[serial % options.length]; patch.captionAt = runtime.simulationClock; }
  }
  state.patch(patch);
}
export function manualStimulus(kind: StimulusKind, position?: Vec3): boolean {
  if (useStore.getState().paused) return false;
  if ((kind === 'tap' || kind === 'shadow') && runtime.simulationClock - lastTap < 3) return false;
  if (kind === 'tap' || kind === 'shadow') lastTap = runtime.simulationClock;
  const now = Date.now();
  dispatchStimulus({ id: `manual-${++serial}`, source: 'manual', sourceTimestamp: now, receivedAt: now, kind, intensity: kind === 'shadow' ? .98 : kind === 'tap' ? .82 : kind === 'attraction' ? .78 : .58, position: position || [-1.5,-.8,1.2], metadata: { interaction: kind } });
  return true;
}
function connectFeed() {
  feed?.dispose(); feed = null;
  const state = useStore.getState();
  events.clear(); state.patch({ latest: null, history: [], activityHistory: Array(48).fill(0) });
  if (state.demoOnly) {
    state.patch({ feed: { ...state.feed, state: 'DEMO', mode: 'demo', reason: 'Deterministic scenario · simulated stimuli', product: state.product, lastTrade: 0, lastHeartbeat: 0, observedTrades: 0, price: null } });
    demoCycle = -1; demoPhase = -1;
    return;
  }
  feed = new CoinbaseFeed(state.product, dispatchStimulus, info => {
    const previous = useStore.getState();
    if (previous.feed.mode !== info.mode) { previous.patch({ history: [], latest: null, activityHistory: Array(48).fill(0) }); demoPhase = -1; demoCycle = -1; }
    previous.patch({ feed: info });
  }, () => { useStore.getState().patch({ history: [], latest: null, activityHistory: Array(48).fill(0) }); });
  feed.normalizer.setSensitivity(state.sensitivity); feed.start();
}
export function startRuntime() {
  worker = new Worker(new URL('./neural/worker.ts', import.meta.url), { type: 'module' });
  runtime.controller = new BehaviorController();
  worker.onmessage = (message: MessageEvent<{ type: string; graph?: Graph; snapshot?: Snapshot }>) => {
    if (message.data.type === 'graph' && message.data.graph) { runtime.graph = message.data.graph; useStore.getState().patch({ ready: true, graph: runtime.graph }); }
    const snapshot = message.data.snapshot;
    if (!snapshot || useStore.getState().paused || document.hidden) return;
    runtime.snapshot = snapshot; runtime.simulationClock = snapshot.time;
    runtime.controller.update(snapshot, snapshot.causeId ? events.get(snapshot.causeId) : undefined);
    const state = useStore.getState();
    if (state.feed.mode === 'demo' && snapshot.time > manualUntil) {
      const cycle = Math.floor(snapshot.time / 36), time = snapshot.time % 36;
      if (cycle !== demoCycle) { demoCycle = cycle; demoPhase = -1; }
      let phase = -1;
      for (let i = 0; i < scenario.length; i++) if (time >= scenario[i][0]) phase = i;
      if (phase > demoPhase) {
        demoPhase = phase;
        const [, kind, intensity, position] = scenario[phase], now = Date.now();
        dispatchStimulus({ id: `demo-${cycle}-${phase}`, source: 'demo', sourceTimestamp: now, receivedAt: now, kind, intensity, position, metadata: { scenario: '36-second designed cycle', phase, cycle } });
      }
    }
    if (snapshot.time - telemetryAt >= .2) {
      telemetryAt = snapshot.time;
      const activity = snapshot.modules.reduce((a, b) => a + b, 0) / 8;
      state.patch({ reaction: activity > .003 || runtime.controller.behavior !== 'resting' ? (snapshot.causeId ? events.get(snapshot.causeId) || state.reaction : null) : null, trace: snapshot.trace, behavior: runtime.controller.behavior, motor: snapshot.motor, modules: snapshot.modules, spikeRate: snapshot.spikeRate, totalSpikes: snapshot.totalSpikes, simTime: snapshot.time, activityHistory: [...state.activityHistory.slice(1), activity] });
    }
  };
  worker.onerror = () => useStore.getState().patch({ caption: 'The neural worker could not start. Please reload the exhibit.' });
  connectFeed();
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (state.paused !== previous.paused) { worker?.postMessage({ type: 'pause', value: state.paused || document.hidden }); feed?.normalizer.reset(); }
    if (state.product !== previous.product || state.demoOnly !== previous.demoOnly) connectFeed();
    if (state.sensitivity !== previous.sensitivity) feed?.normalizer.setSensitivity(state.sensitivity);
  });
  const visibility = () => { worker?.postMessage({ type: 'pause', value: document.hidden || useStore.getState().paused }); if (!document.hidden) feed?.normalizer.reset(); };
  document.addEventListener('visibilitychange', visibility);
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = () => useStore.getState().patch({ reducedMotion: media.matches }); media.addEventListener('change', motion);
  return () => { worker?.terminate(); worker = null; feed?.dispose(); unsubscribe(); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
}
