export type Vec3 = [number, number, number];
export type StimulusKind = 'attraction' | 'threat' | 'pulse' | 'arousal' | 'co2' | 'shadow' | 'tap' | 'quiet';
export type Source = 'live' | 'manual' | 'demo';
export interface Stimulus { id: string; source: Source; sourceTimestamp: number; receivedAt: number; kind: StimulusKind; intensity: number; position?: Vec3; metadata: Record<string, string | number>; }
export type Behavior = 'resting' | 'sensing' | 'approaching' | 'hovering' | 'feeding' | 'startled' | 'recovering';
export interface Motor { left: number; right: number; attraction: number; threat: number; arousal: number; recovery: number; }
export interface SignalTrace { id: string; token: number; startedAt: number; sensoryAt: number | null; integrationAt: number | null; motorAt: number | null; }
export interface Snapshot { time: number; activity: Float32Array; firedAt: Float32Array; firedCause: Float32Array; trace: SignalTrace | null; modules: number[]; motor: Motor; spikeRate: number; totalSpikes: number; causeId: string | null; }
export interface Graph { positions: Float32Array; moduleIds: Uint8Array; channels: Uint8Array; offsets: Uint32Array; targets: Uint16Array; weights: Float32Array; delays: Uint8Array; counts: number[]; starts: number[]; count: number; edgeCount: number; }
export type FeedState = 'CONNECTING' | 'LIVE' | 'STALE' | 'RECONNECTING' | 'DEMO';
export interface FeedInfo { state: FeedState; mode: 'live' | 'demo'; product: 'BTC-USD' | 'ETH-USD'; reason: string; lastTrade: number; lastHeartbeat: number; observedTrades: number; price: number | null; warmup: boolean; attempt: number; }
