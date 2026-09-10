import * as THREE from 'three';
export function taperedTube(points: THREE.Vector3[], radii: number[], segments = 24, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPoint(t), ri = t * (radii.length - 1), lo = Math.floor(ri);
    const r = THREE.MathUtils.lerp(radii[lo], radii[Math.min(lo + 1, radii.length - 1)], ri - lo);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const v = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r);
      positions.push(v.x, v.y, v.z);
      if (i < segments && j < radial) { const k = i * (radial + 1) + j; indices.push(k,k+1,k+radial+1,k+1,k+radial+2,k+radial+1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions,3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
export function curveLine(points: THREE.Vector3[], segments = 40) { return new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(segments)); }
export const v = (x: number, y: number, z: number) => new THREE.Vector3(x,y,z);
export function segmentPose(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius = 1) {
  mesh.position.copy(a).lerp(b,.5); mesh.scale.set(radius,a.distanceTo(b),radius);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().sub(a).normalize());
}
