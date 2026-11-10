const fingers = [[5,6,8],[9,10,12],[13,14,16],[17,18,20]];
const clamp01 = value => Math.max(0,Math.min(1,value));

function distance(a,b){
  return Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
}

function bendAngle(a,b,c){
  const ab=distance(a,b), bc=distance(b,c), ac=distance(a,c);
  if(ab*bc < 1e-9)return 0;
  return Math.acos(Math.max(-1,Math.min(1,(ab*ab+bc*bc-ac*ac)/(2*ab*bc)))) * 180/Math.PI;
}

// Use palm-relative geometry so distance from the camera and wrist rotation matter less.
// The continuous value describes closure; the pose is only used to count distinct fists.
export function readHand(landmarks, world, aspect=1) {
  const missing={pose:'missing',grip:0};
  if(!landmarks || landmarks.length!==21)return missing;
  const points=world?.length===21?world:landmarks.map(p=>({x:p.x*aspect,y:p.y,z:p.z*aspect}));
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)))return missing;
  const wrist=points[0];
  const palmSize=distance(wrist,points[9]);
  if(palmSize < 1e-5)return missing;
  let curled=0, extended=0, closure=0;
  for(const [base,joint,tip] of fingers){
    const angle=bendAngle(points[base],points[joint],points[tip]);
    const reach=distance(points[tip],wrist)/Math.max(distance(points[base],wrist),palmSize*.66);
    if(angle<122 && reach<1.42 || angle<146 && reach<1.12)curled++;
    if(angle>150 && reach>1.40)extended++;
    const bend=clamp01((170-angle)/138);
    const tuck=clamp01((1.70-reach)/.82);
    closure+=.45*bend+.55*tuck;
  }
  const pose=curled>=3 && extended===0 ? 'fist' : extended>=3 && curled===0 ? 'open' : 'uncertain';
  return {pose,grip:clamp01((closure/4-.055)/.92)};
}

export function createGestureGate() {
  const confirmAfter=28;
  const maxEvidenceGap=115;
  let armed=false, candidate=null, since=0, lastEvidence=-Infinity;
  return {
    reset(){
      armed=false;
      candidate=null;
      lastEvidence=-Infinity;
    },
    sample(pose,now,grip){
      // Use a separate release threshold so the middle of a squeeze cannot rearm it.
      let evidence=pose;
      if(pose==='uncertain'){
        if(grip<=.22)evidence='open';
        else if(grip>=.54)evidence='fist';
      }
      if(now-lastEvidence>maxEvidenceGap)candidate=null;
      if(evidence!=='open'&&evidence!=='fist')return {armed,trigger:false,stable:null};
      if(evidence!==candidate){
        since=now;
        candidate=evidence;
      }
      lastEvidence=now;
      // Require two observations. One unclear frame may fall between them.
      if(now-since<confirmAfter)return {armed,trigger:false,stable:null};
      const trigger=candidate==='fist'&&armed;
      armed=candidate==='open';
      return {armed,trigger,stable:candidate};
    },
  };
}
