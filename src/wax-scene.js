import * as T from 'three';
import {cocoaTextures,creamPuffTextures,macaronTextures,pistachioTextures} from './chocolate-textures.js';
import {buildCustard,buildPuffCrumbs} from './cream-puff.js';
import {buildSoftSpecimen} from './soft-specimens.js';
import {floor,gripScale,makeSeeds,peelProgress,poseBlend,random,roundedGeometry,shellCell,specimenNormal} from './wax-geometry.js';

const {clamp,lerp,smoothstep} = T.MathUtils;
const easeOut = x => 1-(1-x)**3;

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
  mesh.position.y=floor-.008;
  return mesh;
}

function buildCrunch(body, waxGroup, shadow, id) {
  const butter = id==='butter';
  const macaron = id==='macaron';
  const puff = id==='creamPuff';
  const skinMaps = butter ? {} : macaron ? macaronTextures() : puff ? creamPuffTextures() : cocoaTextures();
  const fillingMaps = id==='chocolate' ? pistachioTextures() : {};
  const skin = new T.MeshPhysicalMaterial({
    ...skinMaps, color:butter?0xffe29d:0xffffff, roughness:butter?.33:.86,
    clearcoat:butter?.32:0, bumpScale:puff?.067:.025,
  });
  const shellSkin=skin.clone();
  shellSkin.vertexColors=true;
  const edge = new T.MeshStandardMaterial({
    color:butter?0xffeabc:macaron?0xe48aa2:puff?0xd99a52:0x603019,roughness:.64,bumpMap:skinMaps.bumpMap??null,bumpScale:.026,side:T.DoubleSide,vertexColors:true,
  });
  const core = new T.Mesh(roundedGeometry(true,id),new T.MeshPhysicalMaterial({
    ...fillingMaps,color:butter?0xf6bb46:macaron?0x7faae4:puff?0xf4cd75:0xffffff,roughness:puff?.34:.53,bumpScale:.024,
    clearcoat:puff?.39:.24,clearcoatRoughness:.48,
  }));
  body.add(core);
  const whole = new T.Mesh(roundedGeometry(false,id),skin);
  body.add(whole);

  const rand = random(1736);
  const seeds = makeSeeds(rand);
  const pieces = seeds.map((dir,i)=>{
    const {geo,centers}=shellCell(dir,seeds,id);
    const mesh=new T.Mesh(geo,[shellSkin,edge]);
    // Geometry and its anchors move independently; the base bounds don't cover every morph.
    mesh.frustumCulled=false;
    waxGroup.add(mesh);

    const detach = puff || dir.y < .67 || i%3===0;
    const angle=Math.atan2(dir.z,dir.x)+(rand()-.5)*.71;
    const travel=1.34+rand()*.82+(dir.y>.18?.09:0);
    const landing=new T.Vector3(Math.cos(angle)*travel,0,Math.sin(angle)*travel*.79);
    const openingAxis=new T.Vector3(dir.z,0,-dir.x).normalize();
    // Let the broad face hit the surface. A little tilt keeps the pieces from looking arranged.
    const localNormal=specimenNormal(dir,id).divide(new T.Vector3(1.30,.43,1.39)).normalize();
    const restNormal=new T.Vector3((rand()-.5)*.51,rand()>.31?1:-1,(rand()-.5)*.49).normalize();
    const twist=new T.Quaternion().setFromAxisAngle(restNormal,(rand()-.5)*1.30);
    const finish=twist.multiply(new T.Quaternion().setFromUnitVectors(localNormal,restNormal));
    const release=.075+rand()*.23+(dir.y>.38?.07:0);
    const lift=.13+rand()*.20;

    const last=geo.morphAttributes.position[2];
    const p=new T.Vector3();
    let minY=Infinity, width=0;
    for(let j=0;j<last.count;j++){
      p.fromBufferAttribute(last,j).applyQuaternion(finish);
      minY=Math.min(p.y,minY);
      width=Math.max(width,Math.hypot(p.x,p.z));
    }
    landing.y=floor-minY+.011;
    const shade = new T.Mesh(shadow.geometry,shadow.material.clone());
    shade.rotation.x=-Math.PI/2;
    shade.scale.set(2*width+.18,1.65*width+.14,1);
    shade.position.set(landing.x,floor-.004,landing.z);
    shade.visible=false;
    waxGroup.add(shade);
    return {mesh,centers,landing,openingAxis,finish,detach,release,lift,shade};
  });

  return {
    whole,core,pieces,maps:[...Object.values(skinMaps),...Object.values(fillingMaps)],
    updateCustard:puff ? buildCustard(body,seeds,core.material) : null,
    updateCrumbs:puff ? buildPuffCrumbs(waxGroup,pieces) : null,
  };
}

function disposeMeshes(group, sharedGeometry) {
  const geometries=new Set(), materials=new Set();
  group.traverse(obj=>{
    if(obj.isInstancedMesh)obj.dispose();
    if(obj.geometry && obj.geometry!==sharedGeometry)geometries.add(obj.geometry);
    for(const material of [].concat(obj.material||[]))materials.add(material);
  });
  geometries.forEach(geometry=>geometry.dispose());
  materials.forEach(material=>material.dispose());
}

export function mountWax(host, firstItem) {
  const renderer = new T.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34,1,.1,30);
  camera.position.set(.12,2.03,6.5);
  camera.lookAt(0,-.23,0);

  const lighting = new T.HemisphereLight(0xffeddc,0x643116,1.7);
  scene.add(lighting);
  function light(color,intensity,xyz){
    const l = new T.DirectionalLight(color,intensity);
    l.position.set(...xyz); scene.add(l); return l;
  }
  light(0xffead2,3.05,[-3,5,4]);
  const rim = light(0xffa057,2.1,[3,1,-3]);
  light(0xf6d8aa,.45,[2,1,4]);
  const waxGroup = new T.Group();
  scene.add(waxGroup);
  const body = new T.Group();
  waxGroup.add(body);

  const shadow = contactShadow();
  scene.add(shadow);
  let model;
  let activeItem;
  let pulseUntil=0;
  let baseSpin=.20;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(pointer: coarse)');
  let current=0,start=0,target=0,started=0,frame=0,pointer=0,spin=.20,previous=0,lastProgress=-1;
  let grip=0,gripTarget=0,lastGrip=-1;
  const anchor=new T.Vector3(), origin=new T.Quaternion(), hinge=new T.Quaternion();
  const size=new ResizeObserver(([entry])=>{
    const {width,height}=entry.contentRect;
    if(!width||!height)return;
    camera.aspect=width/height;
    camera.fov=Math.max(camera.aspect<1.32 ? 43 : 34,2*T.MathUtils.radToDeg(Math.atan(.34/camera.aspect)));
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    schedule();
  });
  size.observe(host);
  function point(event){
    if(touch.matches||reduced.matches)return;
    const rect=host.getBoundingClientRect();
    pointer=((event.clientX-rect.left)/rect.width-.5)*.36;
    schedule();
  }
  function centerPointer(){pointer=0;schedule();}
  host.addEventListener('pointermove',point);
  host.addEventListener('pointerleave',centerPointer);
  reduced.addEventListener('change',schedule);

  function schedule(){
    if(!frame)frame=requestAnimationFrame(render);
  }
  function clearItem(){
    disposeMeshes(waxGroup,shadow.geometry);
    model?.maps.forEach(map=>map.dispose());
    body.clear();
    waxGroup.clear();
    waxGroup.add(body);
  }

  function setItem(item){
    clearItem();
    activeItem=item;
    if(item.breakable)model=buildCrunch(body,waxGroup,shadow,item.id);
    else {
      model={pieces:[],maps:[]};
      buildSoftSpecimen(body,item.id);
    }
    current=start=target=grip=gripTarget=pulseUntil=0;
    lastProgress=lastGrip=-1;
    baseSpin=spin=item.id==='butter' ? -.46 : .20;
    camera.lookAt(0,item.id==='chocolate' ? -.23 : item.id==='creamPuff' ? -.53 : -.69,0);
    rim.color.setHex(item.id==='chocolate' ? 0xffa057 : 0xffe7c6);
    schedule();
  }

  function render(now){
    frame=0;
    const dt=Math.min((now-(previous||now))/1000,.05);
    previous=now;
    const duration=target===3 ? 680 : 265;
    const elapsed=clamp((now-started)/duration,0,1);
    // The final phase uses its timeline directly so individual flakes can leave in sequence.
    current=reduced.matches||target===0 ? target : lerp(start,target,target===3 ? elapsed : easeOut(elapsed));
    if(elapsed===1)current=target;

    const desiredSpin=baseSpin+(reduced.matches?0:pointer);
    spin=reduced.matches ? desiredSpin : lerp(spin,desiredSpin,1-Math.exp(-Math.max(dt,.008)*12));
    if(Math.abs(spin-desiredSpin)<.001)spin=desiredSpin;
    waxGroup.rotation.y=spin;

    // Follow the live input without restarting the fracture animation. Release a little more
    // slowly so the gel has time to spring back to its current damaged shape.
    const pulsing=now<pulseUntil;
    const desiredGrip=pulsing ? Math.max(.95,gripTarget) : gripTarget;
    const follow=1-Math.exp(-Math.max(dt,.008)/(desiredGrip>grip ? .048 : activeItem.releaseTime));
    grip=reduced.matches ? desiredGrip : lerp(grip,desiredGrip,follow);
    if(Math.abs(grip-desiredGrip)<.004)grip=desiredGrip;

    if(current!==lastProgress||grip!==lastGrip){
      const newPose=current!==lastProgress;
      lastProgress=current;
      lastGrip=grip;
      const {whole,core,pieces}=model;
      const intact=current<.004;
      if(whole){
        whole.visible=intact;
        core.visible=!intact;
        if(newPose)poseBlend(core,current);
      }
      model.updateCustard?.(current,grip);
      const scale=gripScale(grip,1,activeItem.compression);
      if(newPose)model.updateCrumbs?.(current,scale);
      body.scale.set(scale.x,scale.y,scale.z);
      body.position.y=floor*(1-scale.y);
      shadow.scale.set((3.05+.53*current)*scale.x,(2.61+.39*current)*scale.z,1);
      const step=Math.min(Math.floor(current),2);
      for(const {mesh,centers,landing,openingAxis,finish,detach,release,lift,shade} of pieces){
        mesh.visible=!intact;
        if(!mesh.visible){shade.visible=false;continue;}
        if(newPose)poseBlend(mesh,current);
        anchor.lerpVectors(centers[step],centers[step+1],current-step);
        const peel=detach?peelProgress(current,release):0;
        const pry=smoothstep(peel,0,.21);
        const travel=clamp((peel-.15)/.85,0,1);
        // The rim lifts first; the body then falls faster than it travels horizontally.
        const lateral=easeOut(travel);
        const drop=travel**2;
        if(!newPose&&travel===1)continue;
        const flakeScale=gripScale(grip,1-lateral,activeItem.compression);
        mesh.scale.set(flakeScale.x,flakeScale.y,flakeScale.z);
        const y=lerp(anchor.y,landing.y,drop)+lift*pry*(1-drop);
        mesh.position.set(
          lerp(anchor.x,landing.x,lateral)*flakeScale.x,
          floor+(y-floor)*flakeScale.y,
          lerp(anchor.z,landing.z,lateral)*flakeScale.z,
        );
        hinge.setFromAxisAngle(openingAxis,.23*pry);
        mesh.quaternion.copy(peel===0 ? origin : hinge).slerp(finish,lateral);
        shade.visible=travel>.40;
        shade.material.opacity=.65*smoothstep(travel,.4,1);
      }
    }
    renderer.render(scene,camera);
    if(current!==target||spin!==desiredSpin||grip!==desiredGrip||pulsing)schedule();
  }
  setItem(firstItem);
  return {
    setItem,
    pulse(){
      pulseUntil=performance.now()+155;
      schedule();
    },
    setStage(value){
      start=current;
      target=value;
      started=performance.now();
      schedule();
    },
    setGrip(value){
      if(value===gripTarget)return;
      gripTarget=value;
      schedule();
    },
    dispose(){
      cancelAnimationFrame(frame);
      size.disconnect();
      host.removeEventListener('pointermove',point);
      host.removeEventListener('pointerleave',centerPointer);
      reduced.removeEventListener('change',schedule);
      clearItem();
      shadow.geometry.dispose();
      shadow.material.dispose();
      shadow.material.map.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      renderer.forceContextLoss();
    },
  };
}
