import {CanvasTexture, RepeatWrapping, SRGBColorSpace} from 'three';
import {random} from './wax-geometry.js';

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d');
}

function texture(context, color = false) {
  const map = new CanvasTexture(context.canvas);
  map.wrapS = RepeatWrapping;
  map.anisotropy = 4;
  if (color) map.colorSpace = SRGBColorSpace;
  return map;
}

function noiseField(columns, rows, rand) {
  const samples = Array.from({length: columns * rows}, () => rand() * 2 - 1);
  return (u, v) => {
    const x = Math.floor(u * columns);
    const y = Math.floor(v * rows);
    const right = (x + 1) % columns;
    const below = (y + 1) % rows;
    const sx = u * columns - x;
    const sy = v * rows - y;
    const tx = sx * sx * (3 - 2 * sx);
    const ty = sy * sy * (3 - 2 * sy);
    const top = samples[y * columns + x] * (1 - tx) + samples[y * columns + right] * tx;
    const bottom = samples[below * columns + x] * (1 - tx) + samples[below * columns + right] * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

// Build color and relief together so every toasted strand catches the light in the same place.
function mottledSurface(width, height, seed, base, variation) {
  const color = surface(width, height);
  const relief = surface(width, height);
  const pigment = color.createImageData(width, height);
  const heightMap = relief.createImageData(width, height);
  const rand = random(seed);
  const broad = noiseField(11, 6, rand);
  const grain = noiseField(72, 36, rand);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const u = x / width;
      const v = y / height;
      const clump = grain(u, v);
      const speck = rand() - .5;
      const tone = clump * .33 + broad(u, v) * .25 + speck;
      const elevation = 105 + clump * 20 + speck * 58;
      pigment.data[offset] = base[0] + variation[0] * tone;
      pigment.data[offset + 1] = base[1] + variation[1] * tone;
      pigment.data[offset + 2] = base[2] + variation[2] * tone;
      pigment.data[offset + 3] = 255;
      heightMap.data[offset] = elevation;
      heightMap.data[offset + 1] = elevation;
      heightMap.data[offset + 2] = elevation;
      heightMap.data[offset + 3] = 255;
    }
  }
  color.putImageData(pigment, 0, 0);
  relief.putImageData(heightMap, 0, 0);
  return {color, relief};
}

export function cocoaTextures() {
  const {color, relief} = mottledSurface(512, 256, 318, [103, 54, 33], [67, 41, 29]);
  return {map: texture(color, true), bumpMap: texture(relief)};
}

export function creamPuffTextures() {
  const width=512, height=256;
  const {color,relief}=mottledSurface(width,height,562,[174,104,44],[70,55,30]);
  const pigment=color.getImageData(0,0,width,height);
  const elevation=relief.getImageData(0,0,width,height);
  const rand=random(425);
  const columns=24, rows=15;
  const tiles=Array.from({length:columns*rows},()=>[.19+rand()*.62,.19+rand()*.62,rand()]);
  const roughness=noiseField(82,45,rand);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width, v=y/height;
    const grain=roughness(u,v);
    const px=u*columns+.16*grain, py=v*rows-.13*grain;
    const col=Math.floor(px), row=Math.floor(py);
    let closest=Infinity, next=Infinity, toast=0;
    for(let j=row-1;j<=row+1;j++)for(let i=col-1;i<=col+1;i++){
      const [dx,dy,tone]=tiles[((j+rows)%rows)*columns+(i+columns)%columns];
      const d=(px-i-dx)**2+(py-j-dy)**2;
      if(d<closest){next=closest;closest=d;toast=tone;}
      else if(d<next)next=d;
    }
    const plate=Math.min(1,(next-closest)*5);
    const topping=Math.min(1,Math.max(0,(.68-v)*5+grain*.22));
    const tint=topping*(plate*(19+35*toast)-20)+Math.max(0,v-.56)*47;
    const index=(y*width+x)*4;
    pigment.data[index]+=tint;
    pigment.data[index+1]+=tint*.92;
    pigment.data[index+2]+=tint*.59;
    const bump=topping*plate*47+grain*11;
    for(let channel=0;channel<3;channel++)elevation.data[index+channel]+=bump;
  }
  color.putImageData(pigment,0,0);
  relief.putImageData(elevation,0,0);
  return {map:texture(color,true),bumpMap:texture(relief)};
}

export function macaronTextures() {
  const width=512, height=256;
  const color=surface(width,height), relief=surface(width,height);
  const pigment=color.createImageData(width,height);
  const elevation=relief.createImageData(width,height);
  const rand=random(1042);
  const waves=noiseField(38,15,rand);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=(y*width+x)*4;
    const mid=Math.abs(y/height-.5)+(waves(x/width,y/height)*.01);
    const filling=mid<.050;
    const foot=!filling && mid<.097;
    const tone=filling ? [121,156,216] : foot ? [221,112,132] : [242,151,168];
    const grain=(rand()-.5)*(foot ? 57 : 18);
    for(let c=0;c<3;c++){
      pigment.data[index+c]=tone[c]+grain;
      elevation.data[index+c]=123+grain*(foot?1.65:.7);
    }
    pigment.data[index+3]=elevation.data[index+3]=255;
  }
  color.putImageData(pigment,0,0);
  relief.putImageData(elevation,0,0);
  return {map:texture(color,true),bumpMap:texture(relief)};
}

function filament(ctx, x, y, dx, dy, bend, width, color) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + dx * .5 - dy * bend, y + dy * .5 + dx * bend, x + dx, y + dy);
  ctx.stroke();
}

export function pistachioTextures() {
  const width = 1024;
  const height = 512;
  const {color, relief} = mottledSurface(width, height, 939, [101, 112, 49], [54, 50, 33]);
  color.lineCap = relief.lineCap = 'round';
  const rand = random(411);
  const toasted = ['#69532b', '#8d753c', '#a38a42', '#bc9b51', '#d4b56a', '#d9c27f'];
  for (let i = 0; i < 7900; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const angle = rand() * Math.PI * 2;
    const length = 4 + rand() ** 1.5 * 24;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length * .67;
    const bend = (rand() - .5) * .8;
    const thickness = .8 + rand() * 2.6;
    const ink = toasted[Math.floor(rand() * toasted.length)];
    // Continue strokes across the longitude seam on the sphere.
    const shifted = x + dx < 0 ? x + width : x + dx > width ? x - width : null;
    for (const start of shifted === null ? [x] : [x, shifted]) {
      filament(color, start, y + .75, dx, dy, bend, thickness + .8, '#403e25');
      filament(color, start, y, dx, dy, bend, thickness, ink);
      filament(relief, start, y, dx, dy, bend, thickness + .75, '#777');
      filament(relief, start, y, dx, dy, bend, thickness * .64, '#ccc');
    }
  }
  return {map: texture(color, true), bumpMap: texture(relief)};
}
