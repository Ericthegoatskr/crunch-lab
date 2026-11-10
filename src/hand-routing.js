// Inputs use the mirrored preview coordinates. Track each wrist and its anatomical
// label across frames so MediaPipe's result order does not change which toy it controls.
export function createHandRouter() {
  let previous = [];

  function score(hand, slot, count) {
    const track=previous[slot];
    const visualSide=count===1 ? .5 : slot===0 ? .25 : .75;
    if(!track)return Math.abs(hand.x-visualSide)+.18;
    const distance=Math.hypot(hand.x-track.x,(hand.y-track.y)*.55);
    const mismatch=hand.label && track.label && hand.label!==track.label;
    // Use handedness near a crossing. An inconsistent label must not move a nearby wrist.
    return distance+(mismatch ? .20 : 0);
  }

  return {
    reset(){previous=[];},
    assign(hands,count){
      if(count===1){
        const hand=hands.reduce((best,current)=>!best || score(current,0,count)<score(best,0,count)?current:best,null);
        if(hand)previous[0]={...hand,label:previous[0]?.label||hand.label};
        return [hand];
      }

      const [a,b]=hands;
      let mapped=[null,null];
      if(a && b){
        const forward=score(a,0,count)+score(b,1,count);
        const reverse=score(b,0,count)+score(a,1,count);
        mapped=forward<=reverse ? [a,b] : [b,a];
      }else if(a){
        const slot=score(a,0,count)<=score(a,1,count)?0:1;
        mapped[slot]=a;
      }
      mapped.forEach((hand,slot)=>{
        if(hand)previous[slot]={...hand,label:previous[slot]?.label||hand.label};
      });
      return mapped;
    },
  };
}
