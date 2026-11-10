import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh, Vector3} from 'three';
import {makeSeeds, peelProgress, poseBlend, random, shellCell} from '../src/wax-geometry.js';

test('the unbroken cell rims fit together, and all baked shell poses face outward',()=>{
  const seeds=makeSeeds(random(1736));
  const edges=[];
  const a=new Vector3(),b=new Vector3(),c=new Vector3(),n=new Vector3();
  for(const seed of seeds){
    const {geo,centers}=shellCell(seed,seeds);
    const {position,normal}=geo.attributes;
    const {start,count}=geo.groups[1];
    // The first two vertices in each wall strip are the ends of a top rim segment.
    for(let i=start;i<start+count;i+=9){
      const point=j=>new Vector3().fromBufferAttribute(position,j).add(centers[0]);
      edges.push([point(i),point(i+1)]);
    }
    for(let stage=0;stage<4;stage++){
      const vertices=stage===0?position:geo.morphAttributes.position[stage-1];
      const normals=stage===0?normal:geo.morphAttributes.normal[stage-1];
      for(let i=0;i<start;i+=3){
        a.fromBufferAttribute(vertices,i);
        b.fromBufferAttribute(vertices,i+1);
        c.fromBufferAttribute(vertices,i+2);
        n.fromBufferAttribute(normals,i);
        assert.ok(b.sub(a).cross(c.sub(a)).dot(n)>0,'the wax face must not fold over or disappear');
      }
    }
    geo.dispose();
  }
  assert.ok(edges.length>100);
  const close=(a,b)=>a.distanceToSquared(b)<1e-12;
  const pairs=new Set();
  for(let i=0;i<edges.length;i++){
    if(pairs.has(i))continue;
    const [a,b]=edges[i];
    const other=edges.findIndex(([c,d],j)=>j>i&&!pairs.has(j)&&close(a,d)&&close(b,c));
    assert.notEqual(other,-1,'each seam must have a matching rim in the neighboring cell');
    pairs.add(other);
  }
});

test('attachment survives the first two poses and a staggered peel settles fully on the third',()=>{
  for(const delay of [.075,.2,.37]){
    assert.equal(peelProgress(1,delay),0);
    assert.equal(peelProgress(2,delay),0);
    assert.equal(peelProgress(2+delay*.9,delay),0);
    assert.ok(peelProgress(2+delay+.05,delay)>0);
    assert.equal(peelProgress(3,delay),1);
  }
  const seeds=makeSeeds(random(1736));
  const {geo}=shellCell(seeds[0],seeds);
  const mesh=new Mesh(geo);
  poseBlend(mesh,1.5);
  assert.deepEqual(mesh.morphTargetInfluences,[.5,.5,0]);
  poseBlend(mesh,3);
  assert.deepEqual(mesh.morphTargetInfluences,[0,0,1]);
  poseBlend(mesh,0);
  assert.deepEqual(mesh.morphTargetInfluences,[0,0,0]);
  geo.dispose();
  mesh.material.dispose();
});
