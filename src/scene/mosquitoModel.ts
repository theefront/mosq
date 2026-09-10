import * as THREE from 'three';
import { curveLine, segmentPose, taperedTube, v } from './geometry';
import { seeded } from '../neural/graph';
export interface LegRig { segments: THREE.Group[]; rest: THREE.Vector3[]; side: number; index: number; }
export interface MosquitoRig { root: THREE.Group; head: THREE.Group; abdomen: THREE.Group; wings: THREE.Group[]; ghosts: THREE.Mesh[]; antennae: THREE.Group[]; legs: LegRig[]; nerve: THREE.Group; }
export function makeMosquito(): MosquitoRig {
  const root = new THREE.Group(); root.name = 'Mosquito · six articulated legs · two wings';
  const shell = new THREE.MeshPhysicalMaterial({ color: '#262a29', roughness: .38, metalness: .4, clearcoat: .48 });
  const dark = new THREE.MeshStandardMaterial({ color: '#30302b', roughness: .55, metalness: .26 });
  const pale = new THREE.MeshStandardMaterial({ color: '#d9d4b9', roughness: .58, metalness: .18 });
  const jointMaterial = new THREE.MeshStandardMaterial({ color: '#7f7964', roughness: .44, metalness: .45 });
  const edge = new THREE.LineBasicMaterial({ color: '#bccab4', transparent: true, opacity: .57 });
  const fine = new THREE.LineBasicMaterial({ color: '#b0b2a0', transparent: true, opacity: .45 });
  const sphere = new THREE.SphereGeometry(1,28,20);
  const ellipsoid = (parent: THREE.Object3D, pos: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material) => { const mesh = new THREE.Mesh(sphere,material); mesh.position.copy(pos); mesh.scale.copy(scale); parent.add(mesh); return mesh; };
  const tube = (parent: THREE.Object3D, pts: THREE.Vector3[], rs: number[], mat: THREE.Material, segments = 28) => { const mesh = new THREE.Mesh(taperedTube(pts,rs,segments,10),mat); parent.add(mesh); return mesh; };
  const thorax = ellipsoid(root,v(0,.1,0),v(.36,.35,.29),shell); thorax.rotation.z = -.3;
  ellipsoid(root,v(-.17,-.09,0),v(.24,.18,.26),dark);
  // A restrained lyre-like pair of pale dorsal markings.
  for (const side of [-1,1]) {
    tube(root,[v(-.26,.32,side*.12),v(-.12,.435,side*.16),v(.1,.43,side*.14),v(.26,.3,side*.06)],[.018,.025,.021,.008],pale);
    tube(root,[v(-.15,.16,side*.279),v(.04,.21,side*.291),v(.24,.19,side*.19)],[.01,.016,.006],jointMaterial);
  }
  const abdomen = new THREE.Group(); root.add(abdomen);
  for (let i=0;i<8;i++) {
    const x = .24+i*.185, r = .225 * Math.pow(1-i/9,.66);
    tube(abdomen,[v(x,.055-i*.033,0),v(x+.1,.04-i*.033,0),v(x+.185,.019-i*.033,0)],[r*.94,r,r*.85],i%2===0?shell:dark,10);
    tube(abdomen,[v(x+.025,.051-i*.033,0),v(x+.049,.047-i*.033,0)],[r*.994,r*1.008],pale,3);
    for (const side of [-1,1]) ellipsoid(abdomen,v(x+.08,.07-i*.033,side*r*.95),v(.047,.042,.014),pale);
  }
  tube(abdomen,[v(1.69,-.2,0),v(1.83,-.25,0),v(1.88,-.28,0)],[.067,.038,.008],dark,12);
  tube(root,[v(-.24,.08,0),v(-.5,.13,0)],[.13,.09],dark,8);
  const head = new THREE.Group(); head.position.set(-.55,.16,0); root.add(head);
  ellipsoid(head,v(-.09,0,0),v(.205,.203,.2),shell);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#20494c', roughness: .29, metalness: .62, clearcoat: .8, emissive: '#102b29', emissiveIntensity: .22 });
  for (const side of [-1,1]) {
    ellipsoid(head,v(-.14,.035,side*.145),v(.145,.17,.104),eyeMat);
    const facets = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.013,0),eyeMat,110); const dummy = new THREE.Object3D();
    for(let i=0;i<110;i++) { const u=1-i/110*2, phi=i*2.399963; const w=Math.sqrt(1-u*u); dummy.position.set(-.14+Math.cos(phi)*w*.145,.035+u*.17,side*(.145+Math.abs(Math.sin(phi))*w*.101)); dummy.updateMatrix(); facets.setMatrixAt(i,dummy.matrix); } head.add(facets);
  }
  tube(head,[v(-.23,-.065,0),v(-.71,-.24,0),v(-1.53,-.6,0)],[.031,.021,.0055],jointMaterial,40);
  tube(head,[v(-.235,-.058,.021),v(-.75,-.24,.018),v(-1.48,-.573,.005)],[.009,.008,.003],pale,30);
  for(const side of [-1,1]) tube(head,[v(-.22,-.08,side*.07),v(-.42,-.18,side*.065),v(-.49,-.23,side*.05)],[.018,.012,.003],dark,14);
  const antennae: THREE.Group[] = [];
  for (const side of [-1,1]) {
    const antenna = new THREE.Group(); antenna.position.set(-.13,.175,side*.085); head.add(antenna); antennae.push(antenna);
    const pts=[v(0,0,0),v(-.18,.19,side*.12),v(-.46,.39,side*.26),v(-.68,.46,side*.35)];
    tube(antenna,pts,[.014,.011,.007,.0025],dark,28);
    antenna.add(new THREE.Line(curveLine(pts),fine));
    const curve = new THREE.CatmullRomCurve3(pts), hairs: THREE.Vector3[] = [];
    for(let i=2;i<17;i++) {const t=i/18,p=curve.getPoint(t); for(const k of [-1,1]) hairs.push(p,p.clone().add(v(.023,.047*(1-t*.5),k*.06)));}
    antenna.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hairs),fine));
  }
  const wings: THREE.Group[] = [], ghosts: THREE.Mesh[] = [];
  const membrane = new THREE.MeshPhysicalMaterial({ color: '#b8d4cc', transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, metalness: .25, roughness: .25, iridescence: .65, clearcoat: 1 });
  for(const side of [-1,1]) {
    const wing = new THREE.Group(); wing.position.set(.02,.34,side*.17); root.add(wing); wings.push(wing);
    const outline=[v(0,0,0),v(.46,.035,-side*.085),v(1.33,.055,-side*.035),v(1.92,.02,side*.07),v(2.08,0,side*.19),v(1.87,-.006,side*.34),v(1.22,.005,side*.46),v(.52,.025,side*.32),v(.12,.01,side*.11)];
    const smooth = new THREE.CatmullRomCurve3(outline,true).getPoints(80), center=v(.95,.025,side*.15), verts=[...center.toArray()], indices:number[]=[];
    for(const p of smooth) verts.push(...p.toArray());
    for(let i=1;i<smooth.length;i++) indices.push(0,i,i+1);
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,membrane);wing.add(mesh); wing.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(smooth),edge));
    const veins=[
      [v(0,.006,0),v(.65,.046,side*.05),v(1.95,.012,side*.18)],
      [v(.2,.023,side*.04),v(.8,.034,side*.18),v(1.83,.005,side*.32)],
      [v(.25,.021,side*.06),v(.6,.034,side*.28),v(1.27,.011,side*.44)],
      [v(.65,.037,side*.057),v(.9,.032,-side*.043)],
      [v(.93,.033,side*.085),v(1.33,.028,-side*.032)],
      [v(1.25,.026,side*.117),v(1.5,.022,side*.258)],
      [v(.73,.034,side*.167),v(.73,.031,side*.32)],
      [v(1.2,.023,side*.226),v(1.17,.018,side*.424)],
    ];
    for(const points of veins) wing.add(new THREE.Line(curveLine(points,25),fine));
    const micro: THREE.Vector3[]=[];
    for(let i=0;i<45;i++){ const p=smooth[Math.floor(i*80/45)];micro.push(p,p.clone().add(v(.006,.015,side*.024))); } wing.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(micro),fine));
    const ghost=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#c2dfd8',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ghost.rotation.x=side*.17; wing.add(ghost);ghosts.push(ghost);
    wing.rotation.y=-side*.53;
    // Halteres, one small balancing organ behind each wing root.
    tube(root,[v(.25,.13,side*.24),v(.43,.05,side*.46)],[.012,.009],jointMaterial,8);
    ellipsoid(root,v(.43,.05,side*.46),v(.05,.035,.033),pale);
  }
  const legs: LegRig[] = [];
  const legGeometry = new THREE.CylinderGeometry(.014,.022,1,9);
  for(const side of [-1,1]) for(let i=0;i<3;i++) {
    const rest=[v([-.25,-.02,.22][i],-.08,side*.2),v([-.78,-.13,.71][i],-.35,side*[.75,.94,.77][i]),v([-1.24,.19,1.42][i],-.9,side*[1.17,1.51,1.25][i]),v([-1.66,.45,1.96][i],-1.13,side*[1.36,1.72,1.47][i]),v([-1.82,.49,2.1][i],-1.16,side*[1.43,1.8,1.53][i])];
    if(side<0){rest[1].x+=[-.1,-.3,.15][i];for(let j=2;j<5;j++){rest[j].x+=[-.24,-.75,.3][i];rest[j].z*=1.12;}}
    const segments: THREE.Group[]=[];
    for(let j=0;j<4;j++) {
      const segment=new THREE.Group(); const shaft=new THREE.Mesh(legGeometry,dark);shaft.scale.setScalar(j>1?.62:1);shaft.scale.y=1;segment.add(shaft);
      for(const y of j<2 ? [.24,.35] : [.27]) { const band=new THREE.Mesh(new THREE.CylinderGeometry(j>1?.012:.019,j>1?.013:.021,.075,9),pale);band.position.y=y;segment.add(band); }
      root.add(segment);segmentPose(segment,rest[j],rest[j+1]);segments.push(segment);
      ellipsoid(segment,v(0,-.5,0),v(.025,.035,.025),jointMaterial);
    }
    legs.push({segments,rest,side,index:i});
  }
  const random=seeded(46), hairs:THREE.Vector3[]=[];
  for(let i=0;i<150;i++){const a=random()*Math.PI*2,u=random()*2-1,w=Math.sqrt(1-u*u),p=v(Math.cos(a)*w*.355,.1+u*.35,Math.sin(a)*w*.29); hairs.push(p,p.clone().add(v((random()-.5)*.05,.03+random()*.05,(random()-.5)*.05)));}
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hairs),fine));
  const nerve=new THREE.Group();root.add(nerve);nerve.visible=false;
  const nerveMat = new THREE.MeshBasicMaterial({color:'#72ffe5',transparent:true,opacity:.9,depthTest:false});
  tube(nerve,[v(-.65,.17,0),v(0,.16,0),v(.7,-.02,0),v(1.6,-.17,0)],[.009,.016,.014,.002],nerveMat);
  for(let i=0;i<7;i++)ellipsoid(nerve,v(-.58+i*.31,.16-i*.045,0),v(.043,.043,.043),nerveMat);
  return {root,head,abdomen,wings,ghosts,antennae,legs,nerve};
}
