import { Component, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Brain } from './Brain';
import { Mosquito } from './Mosquito';
import { Atmosphere, StimulusEffects } from './Atmosphere';
import { useStore } from '../store';
import { manualStimulus, runtime } from '../runtime';
import { QUALITY } from '../config';
function CameraRig() {
  const controls=useRef<OrbitControlsImpl>(null),transition=useRef(true),view=useStore(s=>s.view),reset=useStore(s=>s.cameraReset),tool=useStore(s=>s.tool),reduced=useStore(s=>s.reducedMotion);
  const {camera,size,invalidate}=useThree(); const mobile=size.width<700;
  const target=useRef(new THREE.Vector3()),position=useRef(new THREE.Vector3());
  useEffect(()=>{
    if(view==='brain') { target.current.set(0,2.55,-.35);position.current.set(0,3.1,mobile?12.8:7.8); }
    else if(view==='body') {target.current.set(0,-.35,.4);position.current.set(0,3.4,mobile?10.7:7.6);}
    else {target.current.set(mobile?0:-1.08,mobile?.76:.86,0);position.current.set(mobile?0:-1.08,mobile?5.3:5.2,mobile?20.5:12.1);}
    transition.current=true;invalidate();
  },[view,reset,mobile,invalidate]);
  useFrame((_,dt)=>{
    if(!controls.current)return;
    if(transition.current) {
      invalidate();
      const speed=reduced?1:1-Math.exp(-Math.min(dt,.1)*3.3);
      camera.position.lerp(position.current,speed);controls.current.target.lerp(target.current,speed);controls.current.update();
      if(camera.position.distanceTo(position.current)<.008)transition.current=false;
    }
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={.07} enabled={tool==='orbit'} minDistance={5} maxDistance={20} minPolarAngle={.6} maxPolarAngle={1.95} minAzimuthAngle={-.65} maxAzimuthAngle={.65} onStart={()=>{transition.current=false;}} />;
}
function PointerField() {
  const tool=useStore(s=>s.tool),last=useRef(-10);
  if(tool!=='lure')return null;
  return <mesh position={[0,0,1.8]} onPointerMove={e=>{if(runtime.simulationClock-last.current<1.3)return;last.current=runtime.simulationClock;manualStimulus('attraction',[THREE.MathUtils.clamp(e.point.x,-2.4,2.4),-.85,1.15]);}} onClick={e=>{e.stopPropagation();manualStimulus('attraction',[THREE.MathUtils.clamp(e.point.x,-2.4,2.4),-.85,1.15]);}}><planeGeometry args={[30,25]}/><meshBasicMaterial visible={false}/></mesh>;
}
function RenderQuality() {
  const {gl,scene,camera,size}=useThree(),quality=useStore(s=>s.effectiveQuality),reduced=useStore(s=>s.reducedMotion);
  const composer=useRef<EffectComposer|null>(null),sample=useRef({time:0,frames:0,rounds:0});
  useEffect(()=>{
    gl.setPixelRatio(Math.min(devicePixelRatio,QUALITY[quality].dpr));
    if(!QUALITY[quality].glow||reduced)return;
    const c=new EffectComposer(gl);const bloom=new UnrealBloomPass(new THREE.Vector2(size.width*.65,size.height*.65),.32,.6,.78);c.addPass(new RenderPass(scene,camera));c.addPass(bloom);c.addPass(new OutputPass());composer.current=c;
    return()=>{composer.current=null;for(const pass of c.passes)pass.dispose();c.dispose();};
  },[gl,scene,camera,quality,reduced,size.width,size.height]);
  useFrame((_,dt)=>{
    if(composer.current)composer.current.render();else gl.render(scene,camera);
    const s=sample.current;if(dt<3){s.time+=dt;s.frames++;}
    if(s.time>3){const fps=s.frames/s.time,store=useStore.getState();store.patch({fps:Math.round(fps)});s.rounds++;
      if(store.quality==='auto'&&fps<36&&s.rounds>=1&&store.effectiveQuality!=='low')store.patch({effectiveQuality:store.effectiveQuality==='high'?'medium':'low'});
      s.time=0;s.frames=0;
    }
  },1);
  return null;
}
function World() {
  const graph=useStore(s=>s.graph);
  return <>
    <color attach="background" args={['#080d0f']}/><fog attach="fog" args={['#080d0f',17,35]}/>
    <ambientLight intensity={1.15} color="#9fbdb7"/>
    <hemisphereLight args={['#dde7d4','#1c2727',1.35]}/>
    <directionalLight position={[-3,6,5]} color="#fff1d0" intensity={4.2}/>
    <directionalLight position={[3,2,-4]} color="#84d9ca" intensity={3.3}/>
    <pointLight position={[-3,-.2,3]} color="#d2e2d8" intensity={13} distance={8}/>
    {graph&&<Brain graph={graph}/>}
    <Mosquito/><Atmosphere/><StimulusEffects/><PointerField/><CameraRig/><RenderQuality/>
  </>;
}
class SceneBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state={error:false}; static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<Fallback reason="The 3D renderer could not start."/>:this.props.children;}
}
function Fallback({reason}:{reason:string}) {return <div className="webgl-fallback"><span className="eyebrow">THE EXHIBIT IS STILL THINKING</span><h2>A little more graphics power, please.</h2><p>{reason} Enable WebGL or try a recent browser. The stimulus controls and neural inspector remain available.</p><button className="text-button" onClick={()=>location.reload()}>Reload exhibit ↗</button></div>;}
function supportsWebGL() {
  try {
    const probe=document.createElement('canvas');
    const context=probe.getContext('webgl2');
    if(!context)return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  }catch{return false;}
}
export function Stage() {
  const [supported]=useState(supportsWebGL);
  const [lost,setLost]=useState(false),[hidden,setHidden]=useState(document.hidden),tool=useStore(s=>s.tool),paused=useStore(s=>s.paused);
  useEffect(()=>{const visibility=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
  const cleanup=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cleanup.current?.(),[]);
  if(!supported)return <div className="stage"><Fallback reason="WebGL is unavailable in this browser."/></div>;
  return <div className={`stage ${tool==='lure'?'lure-mode':''}`} aria-label="Interactive 3D mosquito and its enlarged synthetic neural projection">
    <SceneBoundary><Canvas frameloop={hidden?'never':paused?'demand':'always'} camera={{position:[-1.08,5.4,12.7],fov:42,near:.1,far:80}} dpr={1.4} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} fallback={<Fallback reason="WebGL is unavailable in this browser."/>} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.05;const canvas=gl.domElement;const lose=(e:Event)=>{e.preventDefault();setLost(true);};const restore=()=>{setLost(false);};canvas.addEventListener('webglcontextlost',lose);canvas.addEventListener('webglcontextrestored',restore);cleanup.current=()=>{canvas.removeEventListener('webglcontextlost',lose);canvas.removeEventListener('webglcontextrestored',restore);};}}><Suspense fallback={null}><World/></Suspense></Canvas></SceneBoundary>
    {lost&&<Fallback reason="The graphics context was interrupted. The scene will return when the browser restores it."/>}
  </div>;
}
