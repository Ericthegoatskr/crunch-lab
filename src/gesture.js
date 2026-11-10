const fingers = [[5,6,8],[9,10,12],[13,14,16],[17,18,20]];

function distance(a,b){
  return Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
}

function bendAngle(a,b,c){
  const ab=distance(a,b), bc=distance(b,c), ac=distance(a,c);
  if(ab*bc < 1e-9)return 0;
  return Math.acos(Math.max(-1,Math.min(1,(ab*ab+bc*bc-ac*ac)/(2*ab*bc)))) * 180/Math.PI;
}

// Use palm-relative geometry so distance from the camera and wrist rotation matter less.
export function classifyHand(landmarks, world, aspect=1) {
  if(!landmarks || landmarks.length!==21)return 'missing';
  const points=world?.length===21?world:landmarks.map(p=>({x:p.x*aspect,y:p.y,z:p.z*aspect}));
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)))return 'missing';
  const wrist=points[0];
  const palmSize=distance(wrist,points[9]);
  if(palmSize < 1e-5)return 'missing';
  let curled=0, extended=0;
  for(const [base,joint,tip] of fingers){
    const angle=bendAngle(points[base],points[joint],points[tip]);
    const reach=distance(points[tip],wrist)/Math.max(distance(points[base],wrist),palmSize*.66);
    if(angle<122 && reach<1.42 || angle<146 && reach<1.12)curled++;
    if(angle>150 && reach>1.40)extended++;
  }
  if(curled>=3 && extended===0)return 'fist';
  if(extended>=3 && curled===0)return 'open';
  return 'uncertain';
}

export function createGestureGate({hold=110,maxGap=190}={}) {
  let armed=false, candidate=null, since=0, last=null, stable=null;
  return {
    reset(){
      armed=false;
      candidate=null;
      last=null;
      stable=null;
    },
    sample(pose,now){
      if(last===null || now-last>maxGap || pose!==candidate){
        since=now;
        candidate=pose;
        stable=null;
      }
      last=now;
      let trigger=false;
      if((pose==='open'||pose==='fist') && now-since>=hold){
        stable=pose;
        if(stable==='open')armed=true;
        if(stable==='fist' && armed){
          armed=false;
          trigger=true;
        }
      }
      return {armed,trigger,stable};
    },
  };
}
