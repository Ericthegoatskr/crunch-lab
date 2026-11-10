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

const butterAxes = new T.Vector3(1.42,.65,.72);
const macaronAxes = new T.Vector3(1.25,.60,1.10);
const puffAxes = new T.Vector3(1.24,.825,1.13);

function specimenPoint(direction, size, shape) {
  if(shape==='creamPuff'){
    const {x,y,z}=direction;
    const angle=Math.atan2(z,x);
    const lobe=1+(1-y*y)*(.048*Math.cos(5*angle+.7*y)+.019*Math.cos(9*angle-3*y));
    const dome=y+.05*(1-y*y)*Math.sin(5*x+3*z);
    const scale=size/radius;
    return new T.Vector3(
      x*puffAxes.x*scale*lobe,
      floor+.74+(.825*dome+.085*dome*dome)*scale,
      z*puffAxes.z*scale*lobe,
    );
  }
  const axes=shape==='butter' ? butterAxes : shape==='macaron' ? macaronAxes : null;
  if(!axes)return direction.clone().multiplyScalar(size);
  const exponent=shape==='butter' ? 8 : 4;
  const {x,y,z}=direction;
  const horizontal=shape==='macaron'
    ? ((x/axes.x)**2+(z/axes.z)**2)**2
    : Math.abs(x/axes.x)**exponent+Math.abs(z/axes.z)**exponent;
  const edge=(horizontal+Math.abs(y/axes.y)**exponent)**(-1/exponent);
  const point=direction.clone().multiplyScalar(edge*size/radius);
  if(shape==='macaron'){
    const filling=1-.067*Math.exp(-((y/.23)**2));
    point.x*=filling;
    point.z*=filling;
  }
  point.y+=floor+axes.y+.02;
  return point;
}

export function specimenNormal(direction, shape) {
  if(shape==='creamPuff'){
    return new T.Vector3(direction.x/puffAxes.x,direction.y/(puffAxes.y+.17*direction.y),direction.z/puffAxes.z).normalize();
  }
  const axes=shape==='butter' ? butterAxes : shape==='macaron' ? macaronAxes : null;
  if(!axes)return direction.clone();
  if(shape==='macaron'){
    const {x,y,z}=direction;
    const radial=(x/axes.x)**2+(z/axes.z)**2;
    return new T.Vector3(radial*x/axes.x**2,y**3/axes.y**4,radial*z/axes.z**2).normalize();
  }
  const gradient=(value,axis)=>Math.sign(value)*(Math.abs(value)/axis)**7/axis;
  return new T.Vector3(
    gradient(direction.x,axes.x),
    gradient(direction.y,axes.y),
    gradient(direction.z,axes.z),
  ).normalize();
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

function strain(n, shape) {
  if(shape==='creamPuff'){
    const crown=Math.abs(n.y-(.57-.30*n.x+.11*Math.sin(6*n.x)));
    const branch=Math.abs(n.x-(.21+.34*n.y));
    return Math.max(
      (1-smoothstep(crown,.015,.34))*smoothstep(n.z,.05,.7),
      .63*(1-smoothstep(branch,.02,.24))*smoothstep(n.y,.25,.86),
    );
  }
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

export function roundedGeometry(core = false, shape = 'chocolate') {
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
      points.push(...press(specimenPoint(v,r,shape),stage));
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

export function shellCell(seed,seeds,shape = 'chocolate') {
  const corners=cellCorners(seed,seeds);
  const centers=poses.map((_,i)=>press(specimenPoint(seed,waxRadius(seed),shape),i));
  const positions=poses.map(()=>[]), normals=poses.map(()=>[]), colors=[], uv=[];
  const puff=shape==='creamPuff';
  const baseGap=puff ? [0,.002,.110,.110] : [0,.005,.069,.078];
  const stressGap=puff ? [0,.079,.175,.179] : [0,.105,.110,.111];
  function surface(direction, rim, inner = false){
    const n=roughen(direction);
    const thickness=(puff ? .062 : .039)+.012*Math.sin(21*n.x+11*n.y)*Math.sin(19*n.z-9*n.y)
      +.006*Math.sin(37*n.z+14*n.x);
    const cuts = strain(n,shape);
    const r = waxRadius(n)-(inner ? thickness : 0);
    const points=[], dirs=[];
    for(let stage=0;stage<poses.length;stage++){
      const gap=baseGap[stage]+stressGap[stage]*cuts;
      const d=n.clone().lerp(seed,gap*rim).normalize();
      const {squash,bulge} = poses[stage];
      points.push(press(specimenPoint(d,r,shape),stage).sub(centers[stage]));
      const normal=specimenNormal(d,shape);
      dirs.push(normal.divide(new T.Vector3(1+bulge,squash,1+bulge*1.32)).normalize());
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

// Choose visible seams on the same Voronoi shell so the filling emerges through real gaps.
export function puffSeams(seeds) {
  const edges=seeds.flatMap(seed=>{
    const corners=cellCorners(seed,seeds);
    return corners.map((a,i)=>{
      const b=corners[(i+1)%corners.length];
      return {a,b,mid:a.clone().add(b).normalize()};
    });
  });
  const outlets=[
    [-.5,.52,.69], [.3,.59,.76], [-.02,.18,.98],
    [-.78,.32,.60], [.76,.27,.60], [.09,.94,.31],
  ];
  return outlets.map(values=>{
    const target=new T.Vector3(...values).normalize();
    const {a,b,mid}=edges.reduce((best,edge)=>edge.mid.dot(target)>best.mid.dot(target)?edge:best);
    const n=roughen(mid);
    const position=direction=>specimenPoint(direction,waxRadius(direction)-.042,'creamPuff');
    return poses.map(({squash,bulge},stage)=>{
      const point=press(position(n),stage);
      const tangent=press(position(roughen(b)),stage).sub(press(position(roughen(a)),stage));
      const normal=specimenNormal(n,'creamPuff').divide(new T.Vector3(1+bulge,squash,1+bulge*1.32)).normalize();
      const across=new T.Vector3().crossVectors(normal,tangent).normalize();
      tangent.crossVectors(across,normal);
      const rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(tangent,across,normal));
      return {point,rotation};
    });
  });
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
export function gripScale(grip, attachment=1, compression=.41) {
  const amount=T.MathUtils.clamp(grip,0,1)*attachment;
  return {x:1+.16*amount,y:1-compression*amount,z:1+.19*amount};
}

// A flake stays anchored until its release threshold, then peels before it travels.
export function peelProgress(progress,release) {
  return Math.max(0,Math.min(1,(progress-2-release)/(1-release)));
}
