import * as T from 'three';
import {floor,peelProgress,puffSeams,random} from './wax-geometry.js';

const {lerp,smoothstep}=T.MathUtils;

export function buildCustard(body,seeds,material){
  const shape=new T.SphereGeometry(1,24,16);
  const points=shape.attributes.position;
  for(let i=0;i<points.count;i++){
    const x=points.getX(i), y=points.getY(i), z=points.getZ(i);
    points.setY(i,y*(1-.26*x)+.28*x*x);
    points.setZ(i,z*(1-.30*x)-.20*x*x);
  }
  shape.computeVertexNormals();
  const outlets=puffSeams(seeds).map(poses=>{
    const mesh=new T.Mesh(shape,material);
    body.add(mesh);
    return {mesh,poses};
  });
  const normal=new T.Vector3();
  return (progress,grip)=>{
    const step=Math.min(2,Math.floor(progress));
    const blend=progress-step;
    const exposed=1-smoothstep(progress,2.16,2.75);
    for(const [i,{mesh,poses}] of outlets.entries()){
      const open=smoothstep(progress,1.05+i*.058,1.82+i*.032)*exposed;
      mesh.visible=open>.008;
      if(!mesh.visible)continue;
      const reach=open*(.18+grip**1.32*.82);
      mesh.quaternion.copy(poses[step].rotation).slerp(poses[step+1].rotation,blend);
      normal.set(0,0,1).applyQuaternion(mesh.quaternion);
      mesh.position.lerpVectors(poses[step].point,poses[step+1].point,blend);
      mesh.position.addScaledVector(normal,-.092+reach*(.059+i*.006));
      mesh.scale.set(.086+reach*(.22-i*.022),.035+reach*(.129-i*.010),.071+reach*(.167-i*.009));
    }
  };
}

export function buildPuffCrumbs(group,pieces){
  const rand=random(224);
  const geometry=new T.DodecahedronGeometry(1,0);
  const material=new T.MeshStandardMaterial({roughness:.91});
  const crumbs=Array.from({length:56},(_,i)=>{
    const center=pieces[i%pieces.length].centers[2];
    const angle=Math.atan2(center.z,center.x)+(rand()-.5)*1.45;
    const distance=1.08+rand()**1.2*1.39;
    const size=.018+rand()**1.5*.054;
    return {
      from:center.clone().add(new T.Vector3((rand()-.5)*.18,.015,(rand()-.5)*.18)),
      to:new T.Vector3(Math.cos(angle)*distance,floor+size*.48,Math.sin(angle)*distance*.78),
      size, delay:.09+rand()*.34, hop:.10+rand()*.30, turn:2+rand()*5, tone:rand(),
    };
  });
  const mesh=new T.InstancedMesh(geometry,material,crumbs.length);
  mesh.frustumCulled=false;
  const crust=new T.Color(0x96481e), crumb=new T.Color(0xe4ac57);
  const color=new T.Color();
  crumbs.forEach(({tone},i)=>mesh.setColorAt(i,color.copy(crust).lerp(crumb,tone)));
  const pose=new T.Object3D();
  group.add(mesh);
  return (progress,scale)=>{
    mesh.visible=progress>2;
    if(!mesh.visible)return;
    crumbs.forEach(({from,to,size,delay,hop,turn},i)=>{
      const flight=peelProgress(progress,delay);
      const slide=1-(1-flight)**2;
      pose.position.set(
        lerp(from.x*scale.x,to.x,slide),
        lerp(floor+(from.y-floor)*scale.y,to.y,flight**2)+hop*4*flight*(1-flight),
        lerp(from.z*scale.z,to.z,slide),
      );
      pose.rotation.set(turn*slide,turn*(i%3-1)*slide,turn*.67*slide);
      pose.scale.set(size,size*.65,size*.82).multiplyScalar(Math.max(.001,smoothstep(flight,0,.065)));
      pose.updateMatrix();
      mesh.setMatrixAt(i,pose.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
  };
}
