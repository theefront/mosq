import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MODULES, QUALITY } from '../config';
import { runtime } from '../runtime';
import { useStore } from '../store';
import type { Graph } from '../types';
import { seeded } from '../neural/graph';
const lookup = `vec4 neuron(float id) { return texture2D(uNeurons, vec2((mod(id,256.)+.5)/256.,(floor(id/256.)+.5)/uRows)); }`;
const pointVertex = `attribute float aIndex; attribute float aModule; uniform sampler2D uNeurons; uniform float uRows; uniform float uPixelRatio; uniform float uGentle; uniform float uSelected; varying float vActivity; varying float vModule; varying float vSelected; ${lookup}
void main(){vec4 n=neuron(aIndex);vActivity=n.g;vModule=aModule;vSelected=1.-step(.1,abs(aModule-uSelected));vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp((2.3+vActivity*(11.-uGentle*6.)+vSelected*1.8)*uPixelRatio*10./-p.z,1.3,22.);}`;
const pointFragment = `varying float vActivity;varying float vModule;varying float vSelected;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 color=mix(vec3(.39,.7,.66),vec3(.49,1.,.88),vActivity);if(abs(vModule-3.)<.1)color=mix(color,vec3(1.,.43,.31),vActivity*.83);if(abs(vModule-2.)<.1)color=mix(color,vec3(1.,.79,.43),vActivity*.62);float core=exp(-r*r*22.);float halo=exp(-r*r*3.)*.26;gl_FragColor=vec4(color,(core+halo)*(.44+vActivity*.76+vSelected*.18));}`;
const fiberVertex = `attribute float aFrom;attribute float aTo;attribute float aAlong;attribute float aDelay;attribute float aInhib;attribute float aModule;attribute float aTargetModule;
uniform sampler2D uNeurons;uniform float uRows;uniform float uTime;uniform float uSelected;uniform float uFollow;uniform float uCauseToken;uniform float uGentle;
varying float vPulse;varying float vInhib;varying float vModule;varying float vSelected;varying float vActivity;varying float vLocal; ${lookup}
void main(){vec4 n=neuron(aFrom);float age=uTime-n.r;vPulse=max(0.,1.-abs(age-aAlong*aDelay)*17.)*step(0.,age)*step(age,aDelay+.1);vPulse*=(1.-uGentle*.5);vPulse*=mix(1.,1.-step(.1,abs(n.b-uCauseToken)),uFollow);vActivity=n.g;vLocal=1.-step(.1,abs(aModule-aTargetModule));vInhib=aInhib;vModule=aModule;vSelected=max(1.-step(.1,abs(aModule-uSelected)),1.-step(.1,abs(aTargetModule-uSelected)));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fiberFragment = `varying float vPulse;varying float vInhib;varying float vModule;varying float vSelected;varying float vActivity;varying float vLocal;uniform float uFollow;uniform float uStructure;
void main(){vec3 color=vec3(.29,.71,.64);vec3 signalColor=vec3(.38,1.,.81);if(abs(vModule-3.)<.1)signalColor=vec3(1.,.42,.3);if(abs(vModule-2.)<.1)signalColor=vec3(.88,.76,.44);if(vInhib>.5)signalColor=vec3(.53,.48,.67);float pulse=vPulse*(.65+uFollow*.7);color=mix(color,signalColor,min(1.,pulse+vSelected*.4));float opacity=mix(.009,.055,vLocal)*uStructure+vActivity*.01+pulse*.21+vSelected*.075;gl_FragColor=vec4(color,opacity);}`;
function brainBuffers(graph: Graph) {
  const positions: number[]=[],from:number[]=[],to:number[]=[],along:number[]=[],delay:number[]=[],inhib:number[]=[],module:number[]=[],targetModule:number[]=[];
  const g=graph;
  const edges: [number,number][]=[];
  for(let i=0;i<g.count;i++)for(let e=g.offsets[i];e<g.offsets[i+1];e++)edges.push([i,e]);
  const random=seeded(121);
  for(let k=edges.length-1;k>0;k--){const j=Math.floor(random()*(k+1));[edges[k],edges[j]]=[edges[j],edges[k]];}
  for(const [i,e] of edges) {
    const j=g.targets[e],a=new THREE.Vector3().fromArray(g.positions,i*3),b=new THREE.Vector3().fromArray(g.positions,j*3);
    const same=g.moduleIds[i]===g.moduleIds[j];
    if(!same && e%3!==0)continue;
    const mid=a.clone().lerp(b,.5);
    mid.y+=(same?.09:.25)*Math.sin(e*1.7);mid.z+=(same?.12:.3)*Math.sin(e*.9);
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b),steps=same?4:7;
    for(let k=0;k<steps;k++)for(const t of [k/steps,(k+1)/steps]) {
      positions.push(...curve.getPoint(t).toArray());from.push(i);to.push(j);along.push(t);delay.push(g.delays[e]*.01);inhib.push(g.weights[e]<0?1:0);module.push(g.moduleIds[i]);targetModule.push(g.moduleIds[j]);
    }
  }
  const fibers=new THREE.BufferGeometry();
  for(const [name,array,size] of [['position',positions,3],['aFrom',from,1],['aTo',to,1],['aAlong',along,1],['aDelay',delay,1],['aInhib',inhib,1],['aModule',module,1],['aTargetModule',targetModule,1]] as [string,number[],number][]) fibers.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
  const points=new THREE.BufferGeometry();points.setAttribute('position',new THREE.BufferAttribute(g.positions,3));points.setAttribute('aIndex',new THREE.Float32BufferAttribute(Array.from({length:g.count},(_,i)=>i),1));points.setAttribute('aModule',new THREE.Float32BufferAttribute(g.moduleIds,1));
  return {fibers,points};
}
export function Brain({ graph }: { graph: Graph }) {
  const quality=useStore(s=>s.effectiveQuality),selected=useStore(s=>s.selectedModule),follow=useStore(s=>s.follow);
  const buffers=useMemo(()=>brainBuffers(graph),[graph]);
  const lastSnapshot=useRef<unknown>(null);
  const texture=useMemo(()=>{ const rows=Math.ceil(graph.count/256);const texture=new THREE.DataTexture(new Float32Array(256*rows*4),256,rows,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;return texture;},[graph]);
  const uniforms=useMemo(()=>({uNeurons:{value:texture},uRows:{value:Math.ceil(graph.count/256)},uTime:{value:0},uPixelRatio:{value:1.5},uSelected:{value:-1},uFollow:{value:0},uCauseToken:{value:0},uGentle:{value:0},uStructure:{value:1}}),[graph,texture]);
  const materials=useMemo(()=>({points:new THREE.ShaderMaterial({uniforms,vertexShader:pointVertex,fragmentShader:pointFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),fibers:new THREE.ShaderMaterial({uniforms,vertexShader:fiberVertex,fragmentShader:fiberFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})}),[uniforms]);
  useEffect(()=>{ uniforms.uStructure.value=quality==='high'?.24:quality==='medium'?.32:1;const count=buffers.fibers.getAttribute('position').count;buffers.fibers.setDrawRange(0,Math.floor(count*QUALITY[quality].fibers/2)*2);},[quality,buffers,uniforms]);
  useEffect(()=>{uniforms.uSelected.value=selected??-1;uniforms.uFollow.value=follow?1:0;},[uniforms,selected,follow]);
  useEffect(()=>()=>{buffers.fibers.dispose();buffers.points.dispose();texture.dispose();materials.points.dispose();materials.fibers.dispose();},[buffers,texture,materials]);
  useFrame(({gl},delta)=>{
    const snapshot=runtime.snapshot;if(!snapshot)return;
    uniforms.uTime.value=runtime.simulationClock;
    uniforms.uCauseToken.value=snapshot.trace?.token??0;
    uniforms.uPixelRatio.value=gl.getPixelRatio();
    uniforms.uGentle.value=useStore.getState().reducedMotion?1:0;
    const data=texture.image.data as Float32Array;
    const a=1-Math.exp(-Math.min(delta,.1)*18);
    for(let i=0;i<graph.count;i++){data[i*4]=snapshot.firedAt[i];data[i*4+2]=snapshot.firedCause[i];data[i*4+1]+=(snapshot.activity[i]-data[i*4+1])*a;}
    texture.needsUpdate=true;lastSnapshot.current=snapshot;
  });
  return <group position={[0,2.68,-.35]} rotation={[.06,-.08,.025]} scale={1.08}>
    <lineSegments geometry={buffers.fibers} material={materials.fibers}/>
    <points geometry={buffers.points} material={materials.points}/>
    {MODULES.map((m,i)=><mesh key={m.key} position={[...m.center]} scale={[...m.radius]} onPointerOver={e=>{e.stopPropagation();useStore.getState().patch({hoveredModule:i});}} onPointerOut={()=>useStore.getState().patch({hoveredModule:null})} onClick={e=>{e.stopPropagation();useStore.getState().patch({selectedModule:selected===i?null:i});}}><sphereGeometry args={[1,14,12]}/><meshBasicMaterial visible={false}/></mesh>)}
  </group>;
}
