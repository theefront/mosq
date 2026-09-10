import { useEffect, useRef } from 'react';
import { X, ArrowUpRight, Activity, ExternalLink } from 'lucide-react';
import { MODULES } from '../config';
import { useStore } from '../store';
export function Drawer() {
  const state=useStore(),panel=useRef<HTMLElement>(null),close=()=>useStore.getState().patch({drawer:null});
  useEffect(()=>{
    if(!state.drawer)return;
    const previous=document.activeElement as HTMLElement|null;
    const element=panel.current;element?.querySelector<HTMLButtonElement>('button')?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape')close();
      if(e.key==='Tab'&&element){const items=element.querySelectorAll<HTMLElement>('button,select,input,a[href]');const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[state.drawer]);
  if(!state.drawer)return null;
  const inspected=state.latest??state.reaction;
  return <div className="drawer-backdrop" onClick={close}><aside ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={e=>e.stopPropagation()}>
    <div className="drawer-top"><span className="eyebrow">FIELD NOTES / 001</span><button className="icon-button" onClick={close} aria-label="Close drawer"><X size={19}/></button></div>
    <h2 id="drawer-title">{state.drawer==='about'?'A small nervous system.\nA very loud world.':'Inside her head.'}</h2>
    {state.drawer==='about'?<>
      <p className="drawer-intro">The internet gets on her nerves. Literally, in this little world.</p>
      <p>MOSQUITO is a living digital exhibit. Public market activity becomes a strange sensory landscape: upward movement is warmth, a sudden drop is danger, and a busy moment is a reason to take flight.</p>
      <div className="disclosure">An artistic neural simulation driven by live data; not a biological reconstruction.</div>
      <h3>One organism. One connected system.</h3><p>The enlarged projection shows the same synthetic network driving her body. {state.graph?.count.toLocaleString()||'…'} original, seeded neurons use thresholds, refractory periods, excitation, inhibition, and delayed connections. Smoothed neural readouts control designed behaviors. This is not a measured connectome, an anatomical atlas, or a claim of consciousness or learning.</p>
      <h3>Her world, translated</h3><dl className="mapping"><div><dt>Positive momentum</dt><dd>Warmth & attraction</dd></div><div><dt>Sudden negative movement</dt><dd>Threat & escape</dd></div><div><dt>Large observed trades</dt><dd>Localized sensory pulses</dd></div><div><dt>Increased activity</dt><dd>Arousal & hovering</dd></div><div><dt>A quiet moment</dt><dd>Decay & rest</dd></div></dl>
      <p>These are invented entertainment mappings. Each browser runs its own local organism. Observed Coinbase trades may contain gaps; they are not a complete market record. There are no accounts, wallets, trading actions, or paid services.</p>
      <h3>Made for a closer look</h3><p>Original procedural mosquito and neural geometry; no external model assets. Aedes-inspired visual markings, without species-level accuracy. Locally bundled type: DM Sans, IBM Plex Mono, and Instrument Serif (<a href={`${import.meta.env.BASE_URL}font-licenses.txt`} target="_blank" rel="noreferrer">SIL Open Font License</a>).</p>
      <a className="external-link" href="https://docs.cdp.coinbase.com/exchange/websocket-feed/channels" target="_blank" rel="noreferrer">Coinbase feed documentation <ExternalLink size={13}/></a>
    </>:<>
      <div className="inspector-status"><Activity size={17}/><span>{state.paused?'PAUSED':state.behavior.toUpperCase()}</span><span>{state.simTime.toFixed(2)} s</span></div>
      <h3>{state.latest?'Latest sensory input':state.reaction?'Previous input · settling':'Latest sensory input'} <span className={`source-tag ${inspected?.source}`}>{inspected?.source||'WAITING'}</span></h3>
      {inspected?<dl className="provenance"><div><dt>ID</dt><dd>{inspected.id}</dd></div><div><dt>Kind / intensity</dt><dd>{inspected.kind} / {inspected.intensity.toFixed(3)}</dd></div><div><dt>Source time</dt><dd>{new Date(inspected.sourceTimestamp).toISOString()}</dd></div><div><dt>Received</dt><dd>{new Date(inspected.receivedAt).toISOString()}</dd></div>{Object.entries(inspected.metadata).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{typeof v==='number'?Number(v.toPrecision(7)):v}</dd></div>)}</dl>:<p>Waiting for a normalized stimulus. Fresh trades establish the observed baseline before entering the network.</p>}
      <h3>Designed functional modules</h3><div className="module-grid">{MODULES.map((m,i)=><button key={m.key} className={state.selectedModule===i?'selected':''} onClick={()=>state.patch({selectedModule:state.selectedModule===i?null:i})}><span>{m.name}</span><span>{(state.modules[i]*100).toFixed(1)}%</span><i style={{width:`${state.modules[i]*100}%`}}/></button>)}</div>
      <h3>Smoothed neural outputs</h3><dl className="mapping">{Object.entries(state.motor).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v.toFixed(4)}</dd></div>)}</dl>
      <p className="microcopy">Local designed simulation · 10 ms fixed timestep · {state.graph?.edgeCount.toLocaleString()} directed connections. At-rest antenna searching is ambient motion. Bright pulses represent threshold crossings. Cyan: excitation. Violet: inhibition. Amber: attraction. Coral: threat.</p>
      <button className={`outline-button ${state.follow?'active':''}`} onClick={()=>state.patch({follow:!state.follow})}>Trace the latest signal <ArrowUpRight size={16}/></button>
    </>}
    <div className="settings"><h3>Exhibit settings</h3><p className="microcopy">Coinbase Exchange · {state.feed.product}<br/>{state.feed.state} — {state.feed.reason}<br/>{state.feed.observedTrades.toLocaleString()} observed fresh trades{state.feed.price!==null?` · Last price $${state.feed.price.toLocaleString()}`:''}</p>
      <label>Data source<select value={state.demoOnly?'demo':'live'} onChange={e=>state.patch({demoOnly:e.target.value==='demo'})}><option value="live">Coinbase · live</option><option value="demo">Deterministic demo</option></select></label>
      <label>Rendering quality<select value={state.quality} onChange={e=>{const quality=e.target.value as typeof state.quality;state.patch({quality,...quality==='auto'?{}:{effectiveQuality:quality}});}}><option value="auto">Auto · {state.effectiveQuality}</option><option value="high">High</option><option value="medium">Balanced</option><option value="low">Light</option></select></label>
      <label>Sensitivity <output>{state.sensitivity.toFixed(1)}×</output><input aria-label="Feed sensitivity" type="range" min=".3" max="2.5" step=".1" value={state.sensitivity} onChange={e=>state.patch({sensitivity:Number(e.target.value)})}/></label>
      <label>Sound volume <output>{Math.round(state.volume*100)}%</output><input aria-label="Sound volume" type="range" min="0" max=".5" step=".01" value={state.volume} onChange={e=>state.patch({volume:Number(e.target.value)})}/></label>
      <label>Gentle motion<input type="checkbox" checked={state.reducedMotion} onChange={e=>state.patch({reducedMotion:e.target.checked})}/></label>
      <p className="microcopy">Measured {state.fps||'…'} fps · {state.effectiveQuality} rendering<br/>Pause freezes the organism and network. Incoming stimuli are discarded; the feed baseline warms up again on resume. {state.discarded>0?`${state.discarded} stimuli discarded.`:''}</p>
    </div>
    <div className="key-reference"><span>SPACE pause</span><span>L heat lure</span><span>G tap glass</span><span>C cinema</span><span>R reset</span><span>1–3 views</span></div>
  </aside></div>;
}
