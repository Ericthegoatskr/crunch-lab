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

test('counts quick squeezes with a partly released hand and tolerates an unclear frame',()=>{
  const gate=createGestureGate();
  assert.equal(gate.sample('open',0).armed,false);
  assert.equal(gate.sample('open',48).armed,true);
  assert.equal(gate.sample('fist',96).trigger,false);
  assert.equal(gate.sample('fist',144).trigger,true);
  assert.equal(gate.sample('uncertain',192,.32).armed,false,'a half-closed hand does not rearm');
  gate.sample('uncertain',240,.19);
  assert.equal(gate.sample('uncertain',288,.18).armed,true,'a clear release does not require straight fingers');
  assert.equal(gate.sample('fist',336).trigger,false);
  gate.sample('uncertain',384,.39);
  assert.equal(gate.sample('uncertain',432,.63).trigger,true,'a high grip confirms the squeeze after one unclear frame');
});

test('ignores isolated detections and evidence separated by a stall',()=>{
  const gate=createGestureGate();
  gate.sample('open',0);
  assert.equal(gate.sample('open',150).armed,false);
  assert.equal(gate.sample('open',184).armed,true);
  gate.sample('fist',217);
  gate.sample('open',250);
  assert.equal(gate.sample('fist',283).trigger,false);
  assert.equal(gate.sample('fist',420).trigger,false);
  assert.equal(gate.sample('fist',453).trigger,true);
  gate.sample('open',486);
  assert.equal(gate.sample('fist',519).trigger,false,'an isolated open frame does not rearm');
  assert.equal(gate.sample('fist',552).trigger,false);
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
