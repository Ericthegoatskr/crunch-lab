import * as T from 'three';

const {lerp, smoothstep} = T.MathUtils;
export const floor = -1.17;
const radius = 1.13;
const up = new T.Vector3(0, 1, 0);
const right = new T.Vector3(1, 0, 0);
const poses = [
  {squash:1, bulge:0, skew:0},
  {squash:.93, bulge:.044, skew:.017},
  {squash:.73, bulge:.155, skew:.061},
  {squash:.43, bulge:.30, skew:.118},
];

export function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function waxRadius(n) {
  return radius + .027*Math.sin(4*n.x+2*n.y)*Math.sin(5*n.z-n.y)
    + .017*Math.cos(9*n.y+3*n.z)*Math.cos(6*n.x-4*n.z)
    + .008*Math.sin(16*n.x+7*n.z)*Math.sin(13*n.y-5*n.z);
}

// The shell and gel share these baked shapes, including the wider belly and off-centre press.
function press(p, stage) {
  const {squash, bulge, skew} = poses[stage];
  const belly = 1+bulge*(.81+.20*Math.cos(2.7*p.y)+.12*Math.sin(4*p.z-2*p.x));
  const x = p.x*belly+skew*(.30-.72*p.y*p.y+.42*p.z);
  const y = floor+(p.y-floor)*squash+skew*(.29*p.x-.28*p.z+.32*Math.sin(3.8*p.x-1.7*p.z));
  const z = p.z*(belly+.32*bulge)+skew*(.33*p.x+.33*Math.cos(3.6*p.x+1.9*p.y));
  return new T.Vector3(x,y,z);
}

function strain(n) {
  const line = Math.abs(n.y-(.27-.38*n.x+.115*Math.sin(6*n.x)));
  return (1-smoothstep(line,.01,.49))*smoothstep(n.z,.21,.87);
}

// One warp in sphere space gives both sides of every seam the same chipped, meandering outline.
function roughen(n) {
  const {x,y,z} = n;
  const u = .047*Math.sin(12*y+7*z)*Math.sin(9*x-5*z)
    +.022*Math.sin(27*y-13*z+3*x)+.009*Math.sin(53*z+21*y);
  const v = .042*Math.sin(13*z+5*x)*Math.sin(10*y-7*x)
    +.019*Math.sin(25*x+16*z)+.009*Math.sin(48*x-27*z);
  const w = .039*Math.sin(12*x+7*y)*Math.sin(9*z-3*y)
    +.018*Math.sin(26*y-13*x)+.009*Math.sin(52*y+20*z);
  return n.clone().addScaledVector(new T.Vector3(u,v,w),.57).normalize();
}

function setMorphs(geo, positions, normals) {
  const attr = values => new T.Float32BufferAttribute(values,3);
  geo.setAttribute('position',attr(positions[0]));
  geo.setAttribute('normal',attr(normals[0]));
  if(positions.length>1){
    geo.morphAttributes.position = positions.slice(1).map(attr);
    geo.morphAttributes.normal = normals.slice(1).map(attr);
  }
  return geo;
}

export function roundedGeometry(core = false) {
  const geo = new T.SphereGeometry(1,96,64);
  const dir = geo.attributes.position;
  const positions = [];
  const normals = [];
  const v = new T.Vector3();
  for(let stage=0;stage<(core ? 4 : 1);stage++){
    const points=[];
    for(let i=0;i<dir.count;i++){
      v.fromBufferAttribute(dir,i).normalize();
      const r=waxRadius(v)-(core ? .050+.009*Math.sin(5*v.x+4*v.y-3*v.z) : 0);
      points.push(...press(v.clone().multiplyScalar(r),stage));
    }
    positions.push(points);
    geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geo.computeVertexNormals();
    normals.push(Array.from(geo.attributes.normal.array));
  }
  return setMorphs(geo,positions,normals);
}

export function makeSeeds(rand) {
  const count = 44;
  return Array.from({length:count},(_,i)=>{
    const y = 1-2*(i+.5)/count;
    const az = i*Math.PI*(3-Math.sqrt(5))+(rand()-.5)*.55;
    const r = Math.sqrt(1-y*y);
    return new T.Vector3(Math.cos(az)*r,y+(rand()-.5)*.27,Math.sin(az)*r).normalize();
  });
}

// Spherical Voronoi cells have linear boundaries in a gnomonic projection.
function cellCorners(seed,seeds) {
  const u = new T.Vector3().crossVectors(Math.abs(seed.y)>.9 ? right : up,seed).normalize();
  const v = new T.Vector3().crossVectors(seed,u);
  let corners = [[-4,-4],[4,-4],[4,4],[-4,4]];
  for(const other of seeds){
    if(other===seed)continue;
    const d = seed.clone().sub(other);
    const a=d.dot(u), b=d.dot(v), c=d.dot(seed);
    corners = corners.flatMap((p,i)=>{
      const q = corners[(i+1)%corners.length];
      const fp=a*p[0]+b*p[1]+c, fq=a*q[0]+b*q[1]+c;
      const segment = fp>=0 ? [p] : [];
      if((fp>=0)!==(fq>=0)){
        const t=fp/(fp-fq);
        segment.push([lerp(p[0],q[0],t),lerp(p[1],q[1],t)]);
      }
      return segment;
    });
  }
  return corners.map(([x,y])=>seed.clone().addScaledVector(u,x).addScaledVector(v,y).normalize());
}

export function shellCell(seed,seeds) {
  const corners=cellCorners(seed,seeds);
  const centers=poses.map((_,i)=>press(seed.clone().multiplyScalar(waxRadius(seed)),i));
  const positions=poses.map(()=>[]), normals=poses.map(()=>[]), colors=[], uv=[];
  const baseGap=[0,.005,.069,.078], stressGap=[0,.105,.110,.111];
  function surface(direction, rim, inner = false){
    const n=roughen(direction);
    const thickness=.039+.012*Math.sin(21*n.x+11*n.y)*Math.sin(19*n.z-9*n.y)
      +.006*Math.sin(37*n.z+14*n.x);
    const cuts = strain(n);
    const r = waxRadius(n)-(inner ? thickness : 0);
    const points=[], dirs=[];
    for(let stage=0;stage<poses.length;stage++){
      const gap=baseGap[stage]+stressGap[stage]*cuts;
      const d=n.clone().lerp(seed,gap*rim).normalize();
      const {squash,bulge} = poses[stage];
      points.push(press(d.clone().multiplyScalar(r),stage).sub(centers[stage]));
      dirs.push(new T.Vector3(d.x/(1+bulge),d.y/squash,d.z/(1+bulge*1.32)).normalize());
    }
    return {
      points,dirs,n,
      uv:[.5+Math.atan2(n.z,-n.x)/(2*Math.PI),.5+Math.asin(n.y)/Math.PI],
    };
  }
  function triangle(a,b,c,side=0){
    const vertices=[a,b,c];
    const wrap=Math.max(...vertices.map(p=>p.uv[0]))-Math.min(...vertices.map(p=>p.uv[0]))>.5;
    for(let i=0;i<poses.length;i++){
      const faceNormal=side===1 ? b.points[i].clone().sub(a.points[i]).cross(c.points[i].clone().sub(a.points[i])).normalize() : null;
      for(const p of vertices){
        positions[i].push(...p.points[i]);
        normals[i].push(...(faceNormal || (side===2 ? p.dirs[i].clone().negate() : p.dirs[i])));
      }
    }
    for(const p of vertices){
      const {x,y,z}=p.n;
      const tint=.944+.035*Math.sin(9*x+5*z)*Math.cos(10*y-4*x)+.021*Math.sin(19*z+8*y);
      colors.push(tint,tint,tint);
      uv.push(p.uv[0]+(wrap&&p.uv[0]<.5?1:0),p.uv[1]);
    }
  }
  const steps=10;
  const boundaries=[];
  corners.forEach((a,i)=>{
    const b=corners[(i+1)%corners.length];
    const grid=[];
    for(let j=0;j<=steps;j++){
      grid[j]=[];
      for(let k=0;j+k<=steps;k++){
        const row=(j+k)/steps;
        // Each side samples identical unit vectors along a shared edge, in reverse order.
        const dir=row===0 ? seed : seed.clone().lerp(a.clone().lerp(b,k/(j+k)).normalize(),row).normalize();
        grid[j][k]=surface(dir,row);
      }
    }
    for(let j=0;j<steps;j++)for(let k=0;j+k<steps;k++){
      const p=grid[j][k], q=grid[j+1][k], r=grid[j][k+1];
      triangle(p,q,r);
      if(j+k<steps-1)triangle(q,grid[j+1][k+1],r);
    }
    boundaries.push(Array.from({length:steps+1},(_,i)=>({
      top:grid[steps-i][i],
      bottom:surface(a.clone().lerp(b,i/steps).normalize(),1,true),
    })));
  });
  const outer = positions[0].length/3;
  const inner=surface(seed,0,true);
  for(const boundary of boundaries)for(let j=0;j<steps;j++){
    const {top:p,bottom:pi}=boundary[j];
    const {top:q,bottom:qi}=boundary[j+1];
    triangle(q,p,pi,1);
    triangle(q,pi,qi,1);
    triangle(inner,qi,pi,2);
  }
  const geo=setMorphs(new T.BufferGeometry(),positions,normals);
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.addGroup(0,outer,0);
  geo.addGroup(outer,positions[0].length/3-outer,1);
  return {geo,centers};
}

export function poseBlend(mesh, progress){
  const weights=mesh.morphTargetInfluences;
  const start=Math.min(Math.floor(progress),2);
  const t=progress-start;
  weights[0]=start===0 ? t : start===1 ? 1-t : 0;
  weights[1]=start===1 ? t : start===2 ? 1-t : 0;
  weights[2]=start===2 ? t : 0;
}

// This reversible scale is applied on top of the baked fracture pose, around the floor.
// Flying flakes lose the live deformation as they separate from the core.
export function gripScale(grip, attachment=1) {
  const amount=T.MathUtils.clamp(grip,0,1)*attachment;
  return {x:1+.16*amount,y:1-.41*amount,z:1+.19*amount};
}

// A flake stays anchored until its release threshold, then peels before it travels.
export function peelProgress(progress,release) {
  return Math.max(0,Math.min(1,(progress-2-release)/(1-release)));
}
