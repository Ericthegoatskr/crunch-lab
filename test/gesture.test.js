import assert from 'node:assert/strict';
import test from 'node:test';
import {readHand,createGestureGate} from '../src/gesture.js';

test('requires an open palm, then counts each distinct fist once even after tracking loss',()=>{
  const gate=createGestureGate();
  let now=0;
  const hold=(pose,frames=5)=>Array.from({length:frames},()=>gate.sample(pose,now+=46)).filter(r=>r.trigger).length;
  assert.equal(hold('fist'),0,'a fist already in view is not a new squeeze');
  assert.equal(hold('open'),0);
  assert.equal(hold('fist',30),1,'a held fist stays latched');
  assert.equal(hold('missing'),0);
  assert.equal(hold('fist'),0,'reappearing in the same pose must not rearm');
  assert.equal(hold('uncertain'),0);
  assert.equal(hold('fist'),0);
  assert.equal(hold('open'),0);
  assert.equal(hold('fist'),1);
  assert.equal(hold('open'),0);
  assert.equal(hold('fist'),1);
  gate.reset();
  assert.equal(hold('fist'),0,'reset still requires an open palm');
});

test('ignores a brief fist, a transient open palm, and stale frames',()=>{
  const gate=createGestureGate();
  gate.sample('open',0);
  gate.sample('open',500);
  assert.equal(gate.sample('open',550).armed,false);
  assert.equal(gate.sample('open',630).armed,true);
  gate.sample('fist',680);
  assert.equal(gate.sample('fist',740).trigger,false);
  gate.sample('uncertain',770);
  gate.sample('fist',800);
  assert.equal(gate.sample('fist',920).trigger,true);
  gate.sample('open',950);
  assert.equal(gate.sample('fist',1080).trigger,false);
  assert.equal(gate.sample('fist',1230).trigger,false);
});

function hand(curls,scale=1){
  const points=Array.from({length:21},()=>({x:0,y:0,z:0}));
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.25;
    const extended=[[1,0],[1.38,.01],[1.68,.02],[1.9,.03]];
    const curled=[[1,0],[1.38,.07],[1.22,.39],[.87,.24]];
    extended.forEach(([y,z],j)=>{
      const t=curls[i];
      points[5+4*i+j]={x:x*scale,y:(y+(curled[j][0]-y)*t)*scale,z:(z+(curled[j][1]-z)*t)*scale};
    });
  }
  return points;
}

test('reads pose and squeeze from hand proportions independent of scale',()=>{
  assert.deepEqual(readHand(undefined),{pose:'missing',grip:0});
  assert.deepEqual(readHand(hand([0,0,0,0],.07)),{pose:'open',grip:0});
  assert.equal(readHand(hand([1,1,1,1],1.8)).pose,'fist');
  assert.equal(readHand(hand([0,1,1,0])).pose,'uncertain');
  const curled=Array(4).fill(.66);
  assert.ok(Math.abs(readHand(hand(curled,.07)).grip-readHand(hand(curled,1.8)).grip)<1e-9);
});

test('the same closed fist can squeeze harder without advancing a fracture',()=>{
  const gate=createGestureGate();
  const values=[0,.4,.5,.72,.95,0];
  const samples=values.map(curl=>readHand(hand(Array(4).fill(curl))));
  assert.equal(samples[1].pose,'uncertain');
  assert.ok(samples[1].grip>0,'starts deforming before a fist is counted');
  assert.ok(samples.slice(2,5).every(sample=>sample.pose==='fist'));
  for(let i=1;i<=4;i++)assert.ok(samples[i].grip>samples[i-1].grip);
  assert.equal(samples[5].grip,0);

  let now=0;
  let stage=0;
  for(const {pose} of samples){
    for(let i=0;i<5;i++){
      if(gate.sample(pose,now+=46).trigger)stage++;
    }
  }
  assert.equal(stage,1,'tightening or releasing the same fist must not add a fracture');
});
