/* Generated artwork (SVG/PNG) and demo mix audio (WAV) */
function artSVG(seed,w,h,label){
  const r=rng(seed),hue=Math.floor(r()*360);
  const c1=`hsl(${hue} 85% 55%)`,c2=`hsl(${(hue+55)%360} 80% 38%)`,c3=`hsl(${(hue+190)%360} 75% 62%)`;
  let s='';for(let i=0;i<8;i++){const rad=(0.08+r()*0.34)*Math.min(w,h);s+=`<circle cx="${(r()*w)|0}" cy="${(r()*h)|0}" r="${rad|0}" fill="${[c1,c2,c3][i%3]}" opacity="${(0.22+r()*0.4).toFixed(2)}"/>`}
  for(let i=0;i<3;i++){const y=(r()*h)|0;s+=`<rect x="0" y="${y}" width="${w}" height="${Math.max(2,(h*0.004)|0)}" fill="#fff" opacity=".18"/>`}
  const t=label?`<text x="${w*0.06}" y="${h*0.93}" font-family="Georgia,serif" font-style="italic" font-weight="800" font-size="${Math.min(w,h)*0.07}" fill="#fff" opacity=".92">${esc(label)}</text>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="#0d0b09"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${s}${t}</svg>`}
const artURL=(seed,w=800,h=500,l)=>'data:image/svg+xml;utf8,'+encodeURIComponent(artSVG(seed,w,h,l));
