import assert from 'node:assert/strict';
import test from 'node:test';
import {createGestureGate} from '../src/gesture.js';
import {createHandRouter} from '../src/hand-routing.js';

const hand=(label,x,pose='open')=>({label,x,y:.5,pose});

test('preview slots survive detection reorder, wrist crossing, and one hand leaving',()=>{
  const router=createHandRouter();
  const a=hand('Right',.23), b=hand('Left',.74);
  assert.deepEqual(router.assign([b,a],2),[a,b]);
  const mislabeledA=hand('Left',.23), mislabeledB=hand('Right',.74);
  assert.deepEqual(router.assign([mislabeledB,mislabeledA],2),[mislabeledA,mislabeledB]);
  router.assign([hand('Left',.55),hand('Right',.46)],2);
  router.assign([hand('Left',.44),hand('Right',.58)],2);
  const crossedA=hand('Right',.69), crossedB=hand('Left',.32);
  assert.deepEqual(router.assign([crossedB,crossedA],2),[crossedA,crossedB]);
  assert.deepEqual(router.assign([crossedB],2),[null,crossedB]);
  assert.deepEqual(router.assign([crossedA,crossedB],2),[crossedA,crossedB]);
});

test('two independent gates support single-side and simultaneous squeezes',()=>{
  const router=createHandRouter();
  const gates=[createGestureGate(),createGestureGate()];
  const counts=[0,0];
  let now=0;
  function hold(left,right){
    for(let frame=0;frame<5;frame++){
      now+=46;
      const hands=[hand('Left',.78,right),hand('Right',.21,left)].filter(value=>value.pose!=='missing');
      router.assign(hands,2).forEach((value,i)=>{
        if(gates[i].sample(value?.pose||'missing',now).trigger)counts[i]++;
      });
    }
  }
  hold('open','open');
  hold('fist','open');
  assert.deepEqual(counts,[1,0]);
  hold('missing','fist');
  hold('fist','fist');
  assert.deepEqual(counts,[1,1]);
  hold('open','open');
  hold('fist','fist');
  assert.deepEqual(counts,[2,2]);
});
