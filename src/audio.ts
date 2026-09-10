import { useEffect } from 'react';
import { useStore } from './store';
import { runtime } from './runtime';
let context: AudioContext | null=null;
export function enableAudio() {
  const state=useStore.getState();
  if(!state.audio){context??=new AudioContext();void context.resume();}
  state.patch({audio:!state.audio});
}
export function useExhibitAudio() {
  const audio=useStore(s=>s.audio);
  useEffect(()=>{
    if(!audio||!context)return;
    const ctx=context,osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    osc.type='triangle';osc.frequency.value=390;filter.type='lowpass';filter.frequency.value=700;gain.gain.value=0;
    osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();
    let lastSpike=0,lastClick=0;
    const timer=setInterval(()=>{const s=useStore.getState(),muted=s.paused||document.hidden;gain.gain.setTargetAtTime(muted?0:runtime.controller.flight*s.volume*.028,ctx.currentTime,.15);osc.frequency.setTargetAtTime(350+runtime.controller.flight*110,ctx.currentTime,.2);
      if(!muted&&runtime.snapshot&&runtime.snapshot.totalSpikes>lastSpike+30&&ctx.currentTime-lastClick>.8){const click=ctx.createOscillator(),g=ctx.createGain();click.frequency.value=1250;g.gain.setValueAtTime(s.volume*.035,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.025);click.connect(g);g.connect(ctx.destination);click.start();click.stop(ctx.currentTime+.035);click.onended=()=>{click.disconnect();g.disconnect();};lastClick=ctx.currentTime;lastSpike=runtime.snapshot.totalSpikes;}
    },100);
    return()=>{clearInterval(timer);osc.stop();osc.disconnect();filter.disconnect();gain.disconnect();};
  },[audio]);
}
