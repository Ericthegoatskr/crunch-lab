import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyHand,createGestureGate} from '../src/gesture.js';

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

test('classifies extended and curled landmarks independent of scale, and rejects mixed poses',()=>{
  const make=(curl,scale=1)=>{
    const points=Array.from({length:21},()=>({x:0,y:0,z:0}));
    for(let i=0;i<4;i++){
      const base=5+4*i;
      const x=(i-1.5)*.25;
      const coords=curl[i]?[[x,1,0],[x,1.38,.07],[x,1.22,.39],[x,.97,.28]]:
        [[x,1,0],[x,1.38,.01],[x,1.68,.02],[x,1.9,.03]];
      coords.forEach(([x,y,z],j)=>{points[base+j]={x:x*scale,y:y*scale,z:z*scale};});
    }
    return points;
  };
  assert.equal(classifyHand(undefined),'missing');
  assert.equal(classifyHand(make([false,false,false,false],.07)),'open');
  assert.equal(classifyHand(make([true,true,true,true],1.8)),'fist');
  assert.equal(classifyHand(make([false,true,true,false])),'uncertain');
});
