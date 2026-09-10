export const CONFIG = {
  seed: 7319,
  stepMs: 10,
  snapshotMs: 50,
  maxStimuli: 32,
  feed: { endpoint: 'wss://ws-feed.exchange.coinbase.com', warmupMs: 8000, staleMs: 6500, retryMaxMs: 30000, emitMs: 4200, historySize: 600 },
};
export const MODULES = [
  { name: 'Sensory · left', key: 'sensory-left', center: [-1.93, .1, 0], radius: [1.13, .94, .82], count: 420 },
  { name: 'Sensory · right', key: 'sensory-right', center: [1.93, .1, 0], radius: [1.13, .94, .82], count: 420 },
  { name: 'Attraction', key: 'attraction', center: [-.73, .6, -.04], radius: [.81, .77, .69], count: 260 },
  { name: 'Threat', key: 'threat', center: [.73, .6, -.04], radius: [.81, .77, .69], count: 260 },
  { name: 'Integration', key: 'integration', center: [0, -.14, .2], radius: [.93, .57, .67], count: 340 },
  { name: 'Motor · left', key: 'motor-left', center: [-.72, -.75, .08], radius: [.67, .55, .52], count: 230 },
  { name: 'Motor · right', key: 'motor-right', center: [.72, -.75, .08], radius: [.67, .55, .52], count: 230 },
  { name: 'Recovery', key: 'recovery', center: [0, -1.13, .08], radius: [.42, .5, .4], count: 160 },
] as const;
export const QUALITY = { high: { dpr: 1.4, fibers: 1, particles: 170, glow: true }, medium: { dpr: 1.15, fibers: .75, particles: 95, glow: true }, low: { dpr: 1, fibers: .5, particles: 45, glow: false } };
