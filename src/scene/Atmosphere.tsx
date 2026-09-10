import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { runtime } from '../runtime';
import { useStore } from '../store';
import { seeded } from '../neural/graph';
import { curveLine, v } from './geometry';
import { QUALITY } from '../config';
export function Atmosphere() {
  const quality=useStore(s=>s.effectiveQuality);
  const points=useMemo(()=>{const r=seeded(781),positions=new Float32Array(170*3);for(let i=0;i<170;i++){positions[i*3]=(r()-.5)*15;positions[i*3+1]=(r()-.5)*8;positions[i*3+2]=(r()-.5)*8-2;}return new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3));},[]);
  useEffect(()=>()=>points.dispose(),[points]);
  useEffect(()=>{points.setDrawRange(0,QUALITY[quality].particles);},[points,quality]);
  const tether=useMemo(()=>curveLine([v(0,1.2,-.2),v(.02,.78,-.18),v(-.3,.2,.2),v(-.64,-.67,.52)],90),[]);
  const strands=useMemo(()=>{const result:THREE.Vector3[]=[];for(let i=0;i<9;i++){const x=(i-4)*.016;const p=new THREE.CatmullRomCurve3([v(x,1.2,-.2),v(x+.07,.71,-.12),v(x-.4,-.1,.2),v(x-.64,-.67,.52)]).getPoints(50);for(let j=0;j<p.length-1;j++)result.push(p[j],p[j+1]);}return new THREE.BufferGeometry().setFromPoints(result);},[]);
  useEffect(()=>()=>{tether.dispose();strands.dispose();},[tether,strands]);
  const pulse=useRef<THREE.Mesh>(null),tetherLine=useRef<THREE.LineSegments>(null);
  useFrame(()=>{
    if(!pulse.current)return;
    const t=runtime.simulationClock,activity=runtime.snapshot?.motor.arousal||0,end=runtime.headPosition;
    const curvePoint=(u:number,offset=0)=>{const q=1-u;return [offset+q*q*q*0+3*q*q*u*.18+3*q*u*u*(end[0]+.25)+u*u*u*end[0],q*q*q*1.2+3*q*q*u*.55+3*q*u*u*(end[1]+.25)+u*u*u*end[1],q*q*q*(-.2)+3*q*q*u*(-.2)+3*q*u*u*end[2]+u*u*u*end[2]] as [number,number,number];};
    const data=strands.getAttribute('position');let index=0;
    for(let strand=0;strand<9;strand++)for(let step=0;step<50;step++)for(const k of [step,step+1]){const p=curvePoint(k/50,(strand-4)*.009*(1-k/55));data.setXYZ(index++,p[0],p[1],p[2]);}
    data.needsUpdate=true;
    const along=(t*.7)%1;pulse.current.position.set(...curvePoint(along));
    pulse.current.visible=activity>.025;
    if(tetherLine.current)(tetherLine.current.material as THREE.LineBasicMaterial).opacity=.075+activity*.15;
  });
  return <>
    <points geometry={points}><pointsMaterial color="#839d98" size={.012} transparent opacity={.42} sizeAttenuation depthWrite={false}/></points>
    <lineSegments ref={tetherLine} geometry={strands}><lineBasicMaterial color="#64d1b7" transparent opacity={.14} depthWrite={false}/></lineSegments>
    <mesh ref={pulse}><sphereGeometry args={[.025,8,8]}/><meshBasicMaterial color="#b6ffe5"/></mesh>
    <mesh position={[0,-1.375,.5]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[3.5,100]}/><meshBasicMaterial color="#101b1c" transparent opacity={.27} depthWrite={false}/></mesh>
    {[2.55,3.4].map((r,i)=><mesh key={r} position={[0,-1.37+i*.001,.5]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[r,r+.007,128]}/><meshBasicMaterial color="#47716b" transparent opacity={i===0?.26:.13} side={THREE.DoubleSide}/></mesh>)}
    <mesh position={[0,-1.39,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[100,100]}/><meshBasicMaterial color="#080d0f"/></mesh>
  </>;
}
export function StimulusEffects() {
  const group=useRef<THREE.Group>(null),ripple=useRef<THREE.Mesh>(null),droplet=useRef<THREE.Mesh>(null),plume=useRef<THREE.Points>(null),shadow=useRef<THREE.Mesh>(null);
  const cloud=useMemo(()=>{const r=seeded(87),p=[];for(let i=0;i<65;i++)p.push((r()-.5)*.65,r()*1.4,(r()-.5)*.65);return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3));},[]);
  useEffect(()=>()=>cloud.dispose(),[cloud]);
  useFrame(()=>{
    if(!group.current||!ripple.current||!droplet.current||!plume.current||!shadow.current)return;
    const e=runtime.effect,age=e?runtime.simulationClock-e.at:100,kind=e?.kind,state=useStore.getState();
    group.current.position.set(...(e?.position||[-1.5,-.8,1]));
    ripple.current.visible=(kind==='tap'||kind==='pulse')&&age<2;
    ripple.current.scale.setScalar(.1+age*(state.reducedMotion?.7:1.8));
    (ripple.current.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.7-age*.4);
    droplet.current.visible=kind==='attraction'&&age<8;
    droplet.current.scale.setScalar(.08+Math.sin(age*1.5)*.008);droplet.current.position.y=-.04;
    (droplet.current.material as THREE.MeshBasicMaterial).opacity=Math.min(1,Math.max(0,8-age));
    plume.current.visible=kind==='co2'&&age<3.8;plume.current.position.y=age*.21;plume.current.scale.setScalar(1+age*.28);
    (plume.current.material as THREE.PointsMaterial).opacity=Math.max(0,.5-age*.13);
    shadow.current.visible=kind==='shadow'&&age<2.5;
    shadow.current.position.x=state.reducedMotion?0:-4+age*4;shadow.current.position.y=3;
    (shadow.current.material as THREE.ShaderMaterial).uniforms.uOpacity.value=Math.max(0,(state.reducedMotion?.25:.9)-Math.abs(age-1)*.55);
  });
  return <group ref={group}>
    <mesh ref={ripple}><ringGeometry args={[.97,1,96]}/><meshBasicMaterial color="#f19a77" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false}/></mesh>
    <mesh ref={droplet}><sphereGeometry args={[1,24,20]}/><meshBasicMaterial color="#ffcc87" transparent/></mesh>
    <points ref={plume} geometry={cloud}><pointsMaterial color="#cadccd" size={.045} transparent opacity={0} depthWrite={false}/></points>
    <mesh ref={shadow} rotation={[.15,0,-.3]}><planeGeometry args={[4.5,1.6]}/><shaderMaterial transparent depthWrite={false} uniforms={{uOpacity:{value:0}}} vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="varying vec2 vUv;uniform float uOpacity;void main(){float mask=1.-smoothstep(.12,.52,length(vUv-.5));gl_FragColor=vec4(.009,.017,.015,mask*uOpacity);}"/></mesh>
  </group>;
}
