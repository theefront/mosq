import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeMosquito } from './mosquitoModel';
import { segmentPose } from './geometry';
import { runtime } from '../runtime';
import { useStore } from '../store';
export function Mosquito() {
  const rig = useMemo(makeMosquito, []);
  const invalidate=useThree(s=>s.invalidate);
  const xray = useStore(s=>s.xray);
  useEffect(()=>{rig.nerve.visible=xray;invalidate();},[rig,xray,invalidate]);
  useEffect(()=>()=>{ const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(); rig.root.traverse(o=>{if(o instanceof THREE.Mesh || o instanceof THREE.Line){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}}); geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());},[rig]);
  useFrame((_, delta)=>{
    const state=useStore.getState(); if(state.paused)return;
    const body=runtime.controller, t=runtime.simulationClock, flight=body.flight, reduced=state.reducedMotion;
    rig.root.position.lerp(new THREE.Vector3(...body.position),1-Math.exp(-Math.min(delta,.1)*12));
    rig.root.rotation.set(body.feeding*.025,body.heading, body.bank*(reduced?.3:1));
    rig.head.rotation.y=Math.sin(t*.67)*.075*(1-flight)*(1-body.feeding);
    rig.head.rotation.z=body.feeding*.13 + Math.sin(t*.8)*.02*(1-body.feeding);
    rig.abdomen.rotation.z=Math.sin(t*1.1)*.013 + flight*.065;
    for(let i=0;i<2;i++) {
      const side=i===0?-1:1;
      rig.antennae[i].rotation.y=Math.sin(t*1.7+i*1.9)*.12;
      rig.antennae[i].rotation.z=Math.cos(t*1.1+i)*.09+flight*.09;
      rig.wings[i].rotation.y=-side*(.53+flight*.3);
      rig.wings[i].rotation.x=side*(.04+flight*(reduced?.12:.2)+Math.sin(t*2.8)*.008);
      (rig.ghosts[i].material as THREE.MeshBasicMaterial).opacity=flight*(reduced?.02:.09);
    }
    rig.root.updateMatrixWorld(true);
    const headWorld=rig.head.getWorldPosition(new THREE.Vector3());
    runtime.headPosition=[headWorld.x,headWorld.y,headWorld.z];
    for(const leg of rig.legs) {
      const pts=leg.rest.map(p=>p.clone());
      const plantedY=-1.36-rig.root.position.y;
      pts[3].y=THREE.MathUtils.lerp(plantedY,pts[3].y,flight);
      pts[4].y=THREE.MathUtils.lerp(plantedY,pts[4].y,flight);
      pts[2].y=THREE.MathUtils.lerp(plantedY*.73,pts[2].y,flight);
      for(let j=1;j<5;j++) {
        const fold=new THREE.Vector3(pts[j].x+(.3+j*.035)*flight,pts[j].y+flight*(j*.1),pts[j].z*(1-flight*.36));
        pts[j].copy(fold);
      }
      // Resting tarsi stay in place; only the knees make small stance adjustments.
      pts[1].y+=Math.sin(t*.55+leg.index+leg.side)*.012*(1-flight);
      if(body.behavior==='sensing' && leg.index===0) { pts[2].y+=Math.sin(t*2)*.07;pts[3].y+=.07;pts[4].y+=.07; }
      for(let j=0;j<4;j++)segmentPose(leg.segments[j],pts[j],pts[j+1]);
    }
  });
  return <primitive object={rig.root} />;
}
