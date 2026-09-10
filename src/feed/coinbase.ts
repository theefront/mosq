import { CONFIG } from '../config';
import type { FeedInfo, Stimulus } from '../types';
export interface Trade { id: number; product: string; price: number; size: number; sourceTimestamp: number; receivedAt: number; makerSide: 'buy' | 'sell'; aggressorSide: 'buy' | 'sell'; }
export class CoinbaseParser {
  private seen = new Set<number>();
  snapshots = 0;
  constructor(readonly product: string) {}
  parse(raw: unknown, now = Date.now()): Trade | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    if (m.product_id !== this.product) return null;
    if (m.type === 'last_match') { this.snapshots++; if (Number.isSafeInteger(m.trade_id)) this.seen.add(m.trade_id as number); return null; }
    if (m.type !== 'match' || !Number.isSafeInteger(m.trade_id) || (m.side !== 'buy' && m.side !== 'sell')) return null;
    const price = Number(m.price), size = Number(m.size), stamp = typeof m.time === 'string' ? Date.parse(m.time) : NaN;
    if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0 || !Number.isFinite(stamp) || Math.abs(now - stamp) > 30000) return null;
    const id = m.trade_id as number;
    if (this.seen.has(id)) return null;
    this.seen.add(id);
    if (this.seen.size > 4096) this.seen.delete(this.seen.values().next().value!);
    // Coinbase's side belongs to the resting maker, not the aggressor.
    return { id, product: this.product, price, size, sourceTimestamp: stamp, receivedAt: now, makerSide: m.side, aggressorSide: m.side === 'buy' ? 'sell' : 'buy' };
  }
}
export class ObservedNormalizer {
  private trades: Trade[] = [];
  private firstAt = 0;
  private lastEmit = 0;
  private typicalMove = .000025;
  private typicalRate = 4;
  private sensitivity = 1;
  setSensitivity(value: number) { this.sensitivity = Math.max(.3, Math.min(2.5, value)); }
  reset() { this.trades = []; this.firstAt = 0; this.lastEmit = 0; this.typicalMove = .000025; this.typicalRate = 4; }
  get warming() { return !this.firstAt || !this.trades.length || this.trades[this.trades.length - 1].receivedAt - this.firstAt < CONFIG.feed.warmupMs; }
  observe(trade: Trade): Stimulus | null {
    if (!this.firstAt) this.firstAt = trade.receivedAt;
    const previous = this.trades[this.trades.length - 1];
    if (previous) this.typicalMove = this.typicalMove * .985 + Math.abs(trade.price / previous.price - 1) * .015;
    this.trades.push(trade); if (this.trades.length > CONFIG.feed.historySize) this.trades.shift();
    if (this.warming || trade.receivedAt - this.lastEmit < CONFIG.feed.emitMs) return null;
    const window = this.trades.filter(t => t.receivedAt > trade.receivedAt - 4000);
    const rate = window.length / 4; this.typicalRate += (rate - this.typicalRate) * .045;
    const momentum = trade.price / window[0].price - 1;
    const sizes = this.trades.map(t => t.size).sort((a, b) => a - b);
    const relativeSize = trade.size / Math.max(1e-8, sizes[Math.floor(sizes.length * .65)]);
    const movement = Math.abs(momentum) / Math.max(.000025, this.typicalMove * Math.sqrt(window.length) * 2.2);
    let kind: Stimulus['kind'], strength: number;
    if (movement * this.sensitivity > .85) { kind = momentum > 0 ? 'attraction' : 'threat'; strength = .35 + .55 * Math.tanh(movement * .5 * this.sensitivity); }
    else if (relativeSize * this.sensitivity > 3.5) { kind = 'pulse'; strength = .4 + .4 * Math.tanh(relativeSize / 7); }
    else if (rate / Math.max(1, this.typicalRate) * this.sensitivity > 1.65) { kind = 'arousal'; strength = .36; }
    else return null;
    this.lastEmit = trade.receivedAt;
    return { id: `cb-${trade.product}-${trade.id}`, source: 'live', sourceTimestamp: trade.sourceTimestamp, receivedAt: trade.receivedAt, kind, intensity: Math.min(1, strength), position: [momentum >= 0 ? -2 : 2, -.75, .9], metadata: { product: trade.product, tradeId: trade.id, price: trade.price, size: trade.size, makerSide: trade.makerSide, aggressorSide: trade.aggressorSide, observedWindowTrades: window.length, momentum, relativeSize } };
  }
}
export class CoinbaseFeed {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private monitor: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private parser: CoinbaseParser;
  readonly normalizer = new ObservedNormalizer();
  private connectedAt = 0;
  info: FeedInfo;
  constructor(product: FeedInfo['product'], private emit: (e: Stimulus) => void, private update: (info: FeedInfo) => void, private resumeLive: () => void) {
    this.parser = new CoinbaseParser(product);
    this.info = { state: 'CONNECTING', mode: 'demo', product, reason: 'Connecting to Coinbase · demo running', lastTrade: 0, lastHeartbeat: 0, observedTrades: 0, price: null, warmup: true, attempt: 0 };
  }
  private publish() { this.update({ ...this.info }); }
  start() {
    this.connect();
    this.monitor = setInterval(() => {
      if (this.disposed) return;
      const now = Date.now(), last = Math.max(this.info.lastHeartbeat, this.info.lastTrade, this.connectedAt);
      if (last && now - last > CONFIG.feed.staleMs && this.ws?.readyState === WebSocket.OPEN) {
        this.info.state = 'STALE'; this.info.mode = 'demo'; this.info.reason = 'Heartbeat timed out · demo running'; this.publish(); this.ws.close(4000, 'Heartbeat timeout');
      } else if (this.ws?.readyState === WebSocket.CONNECTING && now - this.connectedAt > 10000) {
        this.info.reason = 'Connection timed out · demo running'; this.ws.close();
      }
      this.publish();
    }, 1000);
  }
  private connect() {
    if (this.disposed) return;
    this.info.state = this.info.attempt ? 'RECONNECTING' : 'CONNECTING'; this.publish(); this.connectedAt = Date.now();
    const ws = new WebSocket(CONFIG.feed.endpoint); this.ws = ws;
    ws.onopen = () => { if (this.disposed) return; ws.send(JSON.stringify({ type: 'subscribe', product_ids: [this.info.product], channels: ['matches', 'heartbeat'] })); };
    ws.onmessage = event => {
      if (this.disposed || this.ws !== ws) return;
      let m: Record<string, unknown>;
      try { m = JSON.parse(event.data as string); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.type === 'error') { this.info.reason = typeof m.message === 'string' ? m.message : 'Provider rejected subscription'; this.publish(); ws.close(); return; }
      if (m.type === 'heartbeat' && m.product_id === this.info.product && typeof m.time === 'string' && Number.isFinite(Date.parse(m.time))) {
        this.info.lastHeartbeat = Date.now(); this.info.attempt = 0;
        if (this.info.mode !== 'live') this.info.reason = 'Heartbeat healthy · awaiting a fresh trade';
        this.info.state = 'LIVE';
      }
      const trade = this.parser.parse(m);
      if (!trade) return;
      if (this.info.mode !== 'live') { this.normalizer.reset(); this.resumeLive(); }
      this.info.mode = 'live'; this.info.state = 'LIVE'; this.info.attempt = 0; this.info.lastTrade = trade.receivedAt;
      this.info.observedTrades++; this.info.price = trade.price;
      const stimulus = this.normalizer.observe(trade);
      this.info.warmup = this.normalizer.warming; this.info.reason = this.info.warmup ? 'Observing baseline · warming up' : 'Fresh trades · heartbeat monitored';
      if (stimulus) this.emit(stimulus);
    };
    ws.onerror = () => { this.info.reason = 'WebSocket unavailable · demo running'; this.info.mode = 'demo'; this.publish(); };
    ws.onclose = () => {
      if (this.disposed || this.ws !== ws) return;
      this.info.mode = 'demo'; this.info.state = 'RECONNECTING'; this.info.attempt++;
      if (!this.info.reason.includes('timed out') && !this.info.reason.includes('unavailable')) this.info.reason = 'Connection interrupted · demo running';
      this.publish();
      const delay = Math.min(CONFIG.feed.retryMaxMs, 1000 * 2 ** Math.min(5, this.info.attempt - 1)) * (.8 + Math.random() * .4);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }
  dispose() { this.disposed = true; clearTimeout(this.reconnectTimer); clearInterval(this.monitor); if (this.ws) { this.ws.onclose = null; this.ws.onmessage = null; this.ws.onerror = null; this.ws.onopen = null; this.ws.close(); } }
}
