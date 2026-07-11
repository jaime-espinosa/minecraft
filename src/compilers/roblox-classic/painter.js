import { REGION_GROUPS } from './template-v1.js';

const WIDTH=585, HEIGHT=559;
const rgb = (hex) => [1,3,5].map((index)=>parseInt(hex.slice(index,index+2),16));
const fill = (rgba, [x,y,width,height], color) => { const [r,g,b]=rgb(color); for(let row=y;row<y+height;row++)for(let column=x;column<x+width;column++){const offset=(row*WIDTH+column)*4;rgba.set([r,g,b,255],offset);} };
const faceColor = (palette, face) => face==='up'?palette.highlight:(face==='front'?palette.primary:palette.shadow);

export function paintRobloxClassic(snapshot, garment) {
  const rgba=new Uint8Array(WIDTH*HEIGHT*4); const appearance=snapshot.semanticAppearance;
  if(garment==='shirt'){
    for(const [group,faces] of Object.entries(REGION_GROUPS))for(const [face,rectangle] of Object.entries(faces)){
      let color=faceColor(appearance.outfit.top,face);
      if(appearance.outfit.outerwear && group==='torso' && face==='front') color=appearance.outfit.top.highlight;
      fill(rgba,rectangle,color);
    }
  } else if(garment==='pants'){
    for(const [group,faces] of Object.entries(REGION_GROUPS))for(const [face,rectangle] of Object.entries(faces)){
      fill(rgba,rectangle,faceColor(appearance.outfit.bottom,face));
      if(group!=='torso'){
        const [x,y,width,height]=rectangle;
        const shoe = face==='down' ? rectangle : [x,y+Math.floor(height*.75),width,height-Math.floor(height*.75)];
        fill(rgba,shoe,faceColor(appearance.outfit.footwear,face));
      }
    }
  } else throw new TypeError('Roblox garment must be shirt or pants');
  return rgba;
}

export function inspectRobloxCanvas(rgba){
  if(!(rgba instanceof Uint8Array)||rgba.length!==WIDTH*HEIGHT*4)return {passed:false,reason:'dimensions'};
  const mask=new Uint8Array(WIDTH*HEIGHT);
  for(const faces of Object.values(REGION_GROUPS))for(const [x,y,width,height] of Object.values(faces))for(let row=y;row<y+height;row++)for(let column=x;column<x+width;column++)mask[row*WIDTH+column]=1;
  for(let index=0;index<mask.length;index++){const alpha=rgba[index*4+3];if(mask[index] ? alpha===0 : alpha!==0)return {passed:false,reason:mask[index]?'empty-region':'outside-alpha'};}
  return {passed:true,reason:'ok'};
}
