import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateGraph } from '../src/neural/graph';
import { NeuralSimulation } from '../src/neural/simulation';
import { BehaviorController } from '../src/organism/controller';
import { CoinbaseFeed, CoinbaseParser, ObservedNormalizer } from '../src/feed/coinbase';
import type { Stimulus } from '../src/types';
const graph=generateGraph();
const stimulus=(kind:Stimulus['kind']='attraction',intensity=.9):Stimulus=>({id:'test-1',source:'manual',sourceTimestamp:1,receivedAt:1,kind,intensity,position:[-1.5,-.8,1],metadata:{}});
describe('synthetic neural network',()=>{
  it('is reproducible, bilateral, sparse and bounded',()=>{const other=generateGraph();expect(other.positions).toEqual(graph.positions);expect(other.targets).toEqual(graph.targets);expect(graph.count).toBe(2320);expect(graph.edgeCount).toBeLessThan(graph.count*24);expect(Math.min(...graph.delays)).toBeGreaterThan(0);expect(Math.max(...graph.delays)).toBeLessThan(64);expect(graph.weights.some(x=>x<0)).toBe(true);});
  it('propagates sensory spikes into motor readouts before a body reaction, then settles',()=>{
    const sim=new NeuralSimulation(graph),body=new BehaviorController(),event=stimulus();sim.stimulate(event);
    let firstSensory=-1,firstMotor=-1,firstBehavior=-1,peak=0;const behaviors=new Set<string>();
    for(let i=0;i<1600;i++){sim.step();if(i%5===4){const s=sim.snapshot();body.update(s,event);behaviors.add(body.behavior);peak=Math.max(peak,s.motor.attraction);if(firstSensory<0&&s.modules[0]>.01)firstSensory=s.time;if(firstMotor<0&&s.motor.left>.015)firstMotor=s.time;if(firstBehavior<0&&body.behavior==='approaching')firstBehavior=s.time;}}
    expect(sim.snapshot().trace?.sensoryAt).toBeGreaterThan(0);expect(sim.snapshot().trace!.integrationAt!).toBeGreaterThan(sim.snapshot().trace!.sensoryAt!);expect(sim.snapshot().trace!.motorAt!).toBeGreaterThan(sim.snapshot().trace!.integrationAt!);expect(firstSensory).toBeGreaterThan(0);expect(firstMotor).toBeGreaterThan(firstSensory);expect(firstBehavior).toBeGreaterThanOrEqual(firstMotor);expect(peak).toBeGreaterThan(.025);expect(behaviors.has('approaching')).toBe(true);expect(behaviors.has('feeding')).toBe(true);expect(body.behavior).toBe('resting');expect(sim.snapshot().modules.every(x=>x<.01)).toBe(true);
  });
  it('threat overcomes attraction and recovers; replay is deterministic',()=>{
    const a=new NeuralSimulation(graph),b=new NeuralSimulation(graph),body=new BehaviorController();let cause=stimulus();a.stimulate(cause);b.stimulate(cause);const behaviors=new Set<string>();
    for(let i=0;i<1400;i++){if(i===160){cause=stimulus('shadow',1);a.stimulate(cause);b.stimulate(cause);}a.step();b.step();if(i%5===4){const snap=a.snapshot();b.snapshot();body.update(snap,cause);if(cause.kind==='shadow'&&snap.trace?.motorAt===null)expect(body.behavior).not.toBe('startled');behaviors.add(body.behavior);}}
    expect(a.totalSpikes).toBe(b.totalSpikes);expect(a.voltage).toEqual(b.voltage);expect(behaviors.has('startled')).toBe(true);expect(behaviors.has('recovering')).toBe(true);expect(body.behavior).toBe('resting');
  });
  it('survives sustained stimulation and rejects invalid intensity',()=>{const sim=new NeuralSimulation(graph);sim.stimulate(stimulus('pulse',NaN));for(let i=0;i<100;i++)sim.step();expect(sim.totalSpikes).toBe(0);for(let i=0;i<700;i++){if(i%10===0)sim.stimulate(stimulus('shadow',5));sim.step();}expect(sim.voltage.every(Number.isFinite)).toBe(true);expect(sim.snapshot().modules.every(x=>x>=0&&x<=1)).toBe(true);});
});
describe('Coinbase event interpretation',()=>{
  const now=1780000000000;const message=(id=11)=>({type:'match',trade_id:id,product_id:'BTC-USD',time:new Date(now).toISOString(),price:'65000.5',size:'.04',side:'sell'});
  it('separates initialization, deduplicates trades and interprets maker side',()=>{const parser=new CoinbaseParser('BTC-USD');expect(parser.parse({...message(10),type:'last_match'},now)).toBeNull();expect(parser.parse(message(10),now)).toBeNull();expect(parser.parse(message(),now)?.aggressorSide).toBe('buy');expect(parser.parse(message(),now)).toBeNull();expect(parser.parse({...message(12),side:'buy'},now)?.aggressorSide).toBe('sell');expect(parser.snapshots).toBe(1);});
  it('rejects stale, wrong-product and malformed data, tolerating unknown types',()=>{const parser=new CoinbaseParser('ETH-USD');expect(parser.parse(message(),now)).toBeNull();expect(parser.parse({...message(),product_id:'ETH-USD',size:'oops'},now)).toBeNull();expect(parser.parse({...message(),product_id:'ETH-USD'},now+31000)).toBeNull();expect(parser.parse({type:'new_future_message'},now)).toBeNull();expect(parser.parse(null,now)).toBeNull();});
  it('warms up on observed trades, emits bounded stimuli, resets its baseline',()=>{const n=new ObservedNormalizer();const emitted:Stimulus[]=[];for(let i=0;i<180;i++){const t=now+i*100;const e=n.observe({id:i,product:'BTC-USD',price:65000+i*i*.08,size:.001+(i%9)*.001,sourceTimestamp:t,receivedAt:t,makerSide:'sell',aggressorSide:'buy'});if(e)emitted.push(e);if(i<80)expect(e).toBeNull();}expect(emitted.length).toBeGreaterThan(0);expect(emitted.every(e=>e.source==='live'&&e.intensity>=0&&e.intensity<=1)).toBe(true);n.reset();expect(n.warming).toBe(true);});
});
class FakeSocket {
  static OPEN=1;static CONNECTING=0;static instances:FakeSocket[]=[];readyState=0;onopen:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;onerror:(()=>void)|null=null;onclose:(()=>void)|null=null;sent:string[]=[];
  constructor(){FakeSocket.instances.push(this);}send(value:string){this.sent.push(value);}close(){this.readyState=3;this.onclose?.();}open(){this.readyState=1;this.onopen?.();}message(m:unknown){this.onmessage?.({data:JSON.stringify(m)});}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();FakeSocket.instances=[];});
describe('feed lifecycle',()=>{
  it('subscribes immediately, distinguishes heartbeat from trades, reconnects and cleans up',()=>{vi.useFakeTimers();vi.stubGlobal('WebSocket',FakeSocket);const changes:string[]=[];const feed=new CoinbaseFeed('BTC-USD',()=>{},info=>changes.push(`${info.state}/${info.mode}`),()=>{});feed.start();const socket=FakeSocket.instances[0];socket.open();expect(JSON.parse(socket.sent[0]).channels).toEqual(['matches','heartbeat']);socket.message({type:'heartbeat',product_id:'BTC-USD',time:new Date().toISOString()});expect(feed.info.mode).toBe('demo');socket.message({type:'match',product_id:'BTC-USD',time:new Date().toISOString(),trade_id:1,price:'65000',size:'.01',side:'sell'});expect(feed.info.state).toBe('LIVE');vi.advanceTimersByTime(7100);expect(changes).toContain('STALE/demo');expect(feed.info.state).toBe('RECONNECTING');vi.advanceTimersByTime(1500);expect(FakeSocket.instances.length).toBe(2);feed.dispose();vi.advanceTimersByTime(60000);expect(FakeSocket.instances.length).toBe(2);});
});
