import * as T from 'three';

const clamp = T.MathUtils.clamp;
const blend = T.MathUtils.lerp;
const up = new T.Vector3(0, 1, 0);
const radius = 1.13;

function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function waxRadius(n) {
  return radius + .027 * Math.sin(4 * n.x + n.y * 2) * Math.sin(5 * n.z - n.y)
    + .017 * Math.cos(n.y * 9 + n.z * 3) * Math.cos(n.x * 6 - n.z * 4);
}

function grain() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(256, 256);
  const rand = random(318);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const g = 142 + (rand() - .5) * 53 + Math.cos(Math.floor(i / 1024) * .39) * 9;
    pixels.data.set([g, g, g, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function skinGeometry() {
  const geometry = new T.SphereGeometry(1, 96, 64);
  const p = geometry.attributes.position;
  const v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize().multiplyScalar(waxRadius(v));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// In each seed's tangent plane, the spherical bisectors are straight lines.
// Clip a polygon to the seed's cell, then project its tessellated surface onto the wax.
function cellGeometry(seed, seeds) {
  const u = new T.Vector3().crossVectors(Math.abs(seed.y) > .9 ? new T.Vector3(1, 0, 0) : up, seed).normalize();
  const v = new T.Vector3().crossVectors(seed, u);
  let corners = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
  for (const other of seeds) {
    if (other === seed) continue;
    const d = seed.clone().sub(other);
    const a = d.dot(u), b = d.dot(v), c = d.dot(seed);
    corners = corners.flatMap((p, i) => {
      const q = corners[(i + 1) % corners.length];
      const fp = a*p[0] + b*p[1] + c, fq = a*q[0] + b*q[1] + c;
      const segment = fp >= 0 ? [p] : [];
      if ((fp >= 0) !== (fq >= 0)) {
        const t = fp/(fp-fq);
        segment.push([blend(p[0], q[0], t), blend(p[1], q[1], t)]);
      }
      return segment;
    });
  }

  const center = seed.clone().multiplyScalar(waxRadius(seed));
  const positions = [], normals = [], uv = [];
  function surface(p, depth = 0) {
    const n = seed.clone().addScaledVector(u, p[0]).addScaledVector(v, p[1]).normalize();
    return { n, point: n.clone().multiplyScalar(waxRadius(n)-depth).sub(center), uv: [.5+Math.atan2(n.z,-n.x)/(2*Math.PI), .5+Math.asin(n.y)/Math.PI] };
  }
  function triangle(a, b, c, edge = false) {
    const normal = edge ? b.point.clone().sub(a.point).cross(c.point.clone().sub(a.point)).normalize() : null;
    const vertices = [a,b,c];
    const seam = Math.max(...vertices.map(p => p.uv[0])) - Math.min(...vertices.map(p => p.uv[0])) > .5;
    for (const p of vertices) {
      positions.push(...p.point);
      normals.push(...(normal || p.n));
      uv.push(p.uv[0]+(seam && p.uv[0] < .5 ? 1 : 0), p.uv[1]);
    }
  }
  const steps = 7;
  corners.forEach((a, i) => {
    const b = corners[(i+1)%corners.length];
    const at = (j,k) => surface([(a[0]*j+b[0]*k)/steps,(a[1]*j+b[1]*k)/steps]);
    for (let j=0; j<steps; j++) for (let k=0; j+k<steps; k++) {
      const p=at(j,k), q=at(j+1,k), r=at(j,k+1);
      triangle(p,q,r);
      if(j+k<steps-1) triangle(q,at(j+1,k+1),r);
    }
  });
  const outer = positions.length/3;
  corners.forEach((a, i) => {
    const b = corners[(i+1)%corners.length];
    for(let j=0;j<steps;j++){
      const p=[blend(a[0],b[0],j/steps),blend(a[1],b[1],j/steps)];
      const q=[blend(a[0],b[0],(j+1)/steps),blend(a[1],b[1],(j+1)/steps)];
      triangle(surface(q),surface(p),surface(p,.065),true);
      triangle(surface(q),surface(p,.065),surface(q,.065),true);
      triangle(surface([0,0],.065),surface(q,.065),surface(p,.065),true);
    }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.addGroup(0,outer,0);
  geo.addGroup(outer,positions.length/3-outer,1);
  return {geo, center};
}

function contactShadow() {
  const map = document.createElement('canvas');
  map.width = map.height = 128;
  const ctx = map.getContext('2d');
  const grad = ctx.createRadialGradient(64,64,3,64,64,64);
  grad.addColorStop(0,'rgba(14,6,3,.9)');
  grad.addColorStop(.45,'rgba(16,8,4,.65)');
  grad.addColorStop(1,'rgba(16,8,4,0)');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,128,128);
  const mesh = new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({
    map:new T.CanvasTexture(map), transparent:true, depthWrite:false, opacity:.78,
  }));
  mesh.rotation.x = -Math.PI/2;
  mesh.position.y=-1.14;
  return mesh;
}

export function mountWax(host) {
  const renderer = new T.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34,1,.1,30);
  camera.position.set(.12,2.03,6.5);
  camera.lookAt(0,-.17,0);

  const lighting = new T.HemisphereLight(0xffeddc,0x643116,1.7);
  scene.add(lighting);
  function light(color,intensity,xyz){
    const l = new T.DirectionalLight(color,intensity);
    l.position.set(...xyz); scene.add(l);
  }
  light(0xffead2,3.05,[-3,5,4]);
  light(0xffa057,2.1,[3,1,-3]);
  light(0xf6d8aa,.45,[2,1,4]);
  const waxGroup = new T.Group();
  scene.add(waxGroup);

  const bumpMap = grain();
  const skin = new T.MeshPhysicalMaterial({
    color:0xd0642f,roughness:.39,clearcoat:.36,clearcoatRoughness:.28,
    bumpMap,bumpScale:.023,
  });
  const face = new T.Mesh(new T.SphereGeometry(1,96,64),new T.MeshPhysicalMaterial({
    color:0xed9a3d,roughness:.23,clearcoat:.67,clearcoatRoughness:.24,
  }));
  const innerPos=face.geometry.attributes.position;
  const n=new T.Vector3();
  for(let i=0;i<innerPos.count;i++){
    n.fromBufferAttribute(innerPos,i).normalize();
    const a=(waxRadius(n)-.085) * (1+.021*Math.sin(n.x*7+n.z*5)*Math.cos(n.y*7));
    innerPos.setXYZ(i,n.x*a,n.y*a,n.z*a);
  }
  face.geometry.computeVertexNormals();
  waxGroup.add(face);
  const whole = new T.Mesh(skinGeometry(),skin);
  waxGroup.add(whole);

  const shadow=contactShadow();
  scene.add(shadow);
  const rand = random(1736);
  const count=43;
  const seeds=Array.from({length:count},(_,i)=>{
    const y = 1-2*(i+.5)/count;
    const az = i*Math.PI*(3-Math.sqrt(5))+(rand()-.5)*.31;
    const r = Math.sqrt(1-y*y);
    return new T.Vector3(Math.cos(az)*r,y+(rand()-.5)*.12,Math.sin(az)*r).normalize();
  });
  const edge = new T.MeshStandardMaterial({color:0xe59556,roughness:.65,side:T.DoubleSide});
  const pieces = seeds.map((dir,i)=>{
    const {geo,center}=cellGeometry(dir,seeds);
    const outer=skin.clone();
    outer.color.multiplyScalar(.86+rand()*.24);
    const mesh=new T.Mesh(geo,[outer,edge]);
    waxGroup.add(mesh);
    const angle=Math.atan2(dir.z,dir.x)+(rand()-.5)*.74;
    const detached = dir.y < .74 && i%5 !== 0;
    const distance=(1.25+rand()*.64) * (Math.abs(Math.cos(angle)) > .72 ? 1 : .88);
    const fall=new T.Vector3(Math.cos(angle)*distance,-1.04+rand()*.18,Math.sin(angle)*distance*.77);
    return {mesh,center,dir,detached,fall,turn:new T.Euler((rand()-.5)*2.1,(rand()-.5)*2.5,(rand()-.5)*2.2),bias:rand()};
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(pointer: coarse)');
  let current=0,target=0,previous=0,frame=0,impact=0,pointer=0,spin=.20,instantReset=false;
  const size=new ResizeObserver(([entry])=>{
    const {width,height}=entry.contentRect;
    if(!width||!height)return;
    camera.aspect=width/height;
    camera.fov= camera.aspect<1.32 ? 43 : 34;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
  });
  size.observe(host);
  host.addEventListener('pointermove',event=>{
    if(touch.matches || reduced.matches)return;
    const rect=host.getBoundingClientRect();
    pointer=((event.clientX-rect.left)/rect.width-.5)*.40;
  });
  host.addEventListener('pointerleave',()=>{ pointer=0; });

  function render(now){
    const dt=Math.min((now-(previous||now))/1000,.048);
    previous=now;
    const follow=1-Math.exp(-dt*12.4);
    current=reduced.matches||instantReset ? target : blend(current,target,follow);
    if(Math.abs(current-target)<.001)current=target;
    instantReset=false;
    impact*=Math.exp(-dt*9);
    const p=current/3;
    const squash=1-.56*p-(reduced.matches?0:impact*.035);
    const widen=1+.24*p;
    spin=blend(spin,.2+(reduced.matches?0:pointer),1-Math.exp(-dt*7));
    waxGroup.rotation.y=spin;
    const y=radius*(squash-1);
    whole.visible=current<=.015;
    face.visible=!whole.visible;
    face.scale.set(widen,squash,widen);
    face.position.y=y;
    shadow.scale.set(3.2+1.05*p,2.72+.74*p,1);
    const spread=clamp(current-2,0,1);
    for(const {mesh,center,dir,detached,fall,turn,bias} of pieces){
      mesh.visible=!whole.visible;
      if(!mesh.visible)continue;
      const crack=clamp(current,0,1)*(.022+bias*.052)+clamp(current-1,0,1)*(.06+bias*.13);
      const amount=detached?spread:0;
      const px=center.x*widen+dir.x*crack, py=center.y*squash+y+dir.y*crack, pz=center.z*widen+dir.z*crack;
      const arc=reduced.matches?0:Math.sin(amount*Math.PI)*(.1+.31*bias);
      mesh.position.set(blend(px,fall.x,amount),blend(py,fall.y,amount)+arc,blend(pz,fall.z,amount));
      mesh.scale.set(blend(widen,1,amount),blend(squash,1,amount),blend(widen,1,amount));
      const opening=crack*.9+amount;
      mesh.rotation.set(turn.x*opening,turn.y*opening,turn.z*opening);
    }
    renderer.render(scene,camera);
    frame=requestAnimationFrame(render);
  }
  frame=requestAnimationFrame(render);
  return {
    setStage(value){
      target=value;
      instantReset=value===0;
      impact=value?1:0;
    },
    dispose(){
      cancelAnimationFrame(frame);
      size.disconnect();
      scene.traverse(obj=>{obj.geometry?.dispose();for(const m of [].concat(obj.material||[])) m.dispose();});
      bumpMap.dispose();
      shadow.material.map.dispose();
      renderer.dispose();
    },
  };
}
