let context;
let noise;
let output;

export async function enableAudio(){
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio)return false;
  if(!context){
    context=new Audio();
    const limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-12;
    limiter.ratio.value=5;
    limiter.attack.value=.001;
    limiter.release.value=.10;
    output=context.createGain();
    output.connect(limiter).connect(context.destination);
  }
  await context.resume();
  return context.state==='running';
}

export function muteAudio(muted){
  if(output)output.gain.setTargetAtTime(muted?0:1,context.currentTime,.006);
}

function noiseBurst(start, frequency, duration, volume, resonance) {
  if(!noise){
    noise=context.createBuffer(1,Math.floor(context.sampleRate*.30),context.sampleRate);
    const data=noise.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  const source=context.createBufferSource();
  const filter=context.createBiquadFilter();
  const envelope=context.createGain();
  source.buffer=noise;
  filter.type='bandpass';
  filter.frequency.value=frequency;
  filter.Q.value=resonance;
  envelope.gain.setValueAtTime(.001,start);
  envelope.gain.exponentialRampToValueAtTime(volume,start+.001);
  envelope.gain.exponentialRampToValueAtTime(.001,start+duration);
  source.connect(filter).connect(envelope).connect(output);
  source.start(start,Math.random()*.18);
  source.stop(start+duration+.003);
}

export function playCrack(stage, id){
  if(context?.state!=='running')return;
  const start=context.currentTime+.004;
  const thin=id==='butter';
  const macaron=id==='macaron';
  const shift=thin?1.22:macaron?1.38:1;
  // The low snap supplies the break, while the dry high hits read as individual crumbs.
  noiseBurst(start,(thin?1130:macaron?1440:760),.035,macaron?.27:.38,.75);
  noiseBurst(start+.001,3100*shift,.026,.54,.62);
  noiseBurst(start+.003,5500*shift,.018,.38,.84);
  if(macaron)noiseBurst(start+.011,7300,.019,.26,.94);
  const splinters=[.018,.038,.063,.087,.113,.146,.173,.207];
  const count=[0,2,5,8][stage];
  for(let i=0;i<count;i++){
    const time=start+splinters[i]+Math.random()*.007;
    const volume=(.28+Math.random()*.15)*(1-i*.078);
    noiseBurst(time,(3100+Math.random()*2700)*shift,.014+Math.random()*.013,volume,.83);
    if(i%2===0)noiseBurst(time+.002,(950+Math.random()*650)*shift,.023,volume*.51,.85);
  }
}

export function playPop(id){
  if(context?.state!=='running')return;
  const start=context.currentTime+.004;
  const source=context.createOscillator();
  const envelope=context.createGain();
  source.frequency.setValueAtTime(id==='egg'?370:290,start);
  source.frequency.exponentialRampToValueAtTime(103,start+.08);
  envelope.gain.setValueAtTime(.001,start);
  envelope.gain.exponentialRampToValueAtTime(.22,start+.006);
  envelope.gain.exponentialRampToValueAtTime(.001,start+.11);
  source.connect(envelope).connect(output);
  source.start(start);
  source.stop(start+.115);
  noiseBurst(start+.002,1550,.019,.13,.85);
}
