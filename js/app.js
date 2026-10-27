// Redpen — answer copy annotation tool.
import * as pdfjsLib from "../vendor/pdfjs/pdf.min.mjs";
import { CONFIG, TOOLS, STAMPS, COLORS, SPR, SPRIMG, RED, PENC } from "./config.js";
import { uid, clamp, r4, isRect, fsOf, fsCq, mkQ, fresh, numbered as numberedOf, totals as totalsOf, core, isEdited } from "./model.js";
import { buildExport, applyImport, exportPdf, buildHtml, downloadFile } from "./export.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function setElText(e, v) { const n = e.firstChild; if (n && n.nodeType === 3) n.nodeValue = v; else e.insertBefore(document.createTextNode(v), e.firstChild); }

const LS = "redpen:";
const lsGet = (k) => { try { return localStorage.getItem(LS + k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS + k, v); } catch (e) {} };

const base = new URL("../vendor/pdfjs/", import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
const PDF_OPTS = { cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/", wasmUrl: base + "wasm/", iccUrl: base + "iccs/" };


/* ---------------- state ---------------- */
const freshS = () => fresh(lsGet("reviewer") || "");
let S = freshS();
let tool = "select", color = "red", stampSel = "Good", activeQ = 1, selId = null, zoom = 1, fbOn = true, tab = "marks", fbAll = false;
let pages = [], fileName = "", fileKey = "", curPage = 0, focusPop = false, drag = null, saveT = null, dirty = false, jsonMode = "resume";
let hist = [], hp = -1;

const curQ = () => S.questions.find((q) => q.id === activeQ) || S.questions[0];
const find = (id) => S.anns.find((a) => a.id === id);
const numbered = () => numberedOf(S);
const totals = () => totalsOf(S);
const baseName = () => (fileName || "copy").replace(/\.[^.]+$/, "");

function snap() {
  return JSON.stringify({ meta: S.meta, cohort: S.cohort, questions: S.questions, overall: S.overall, aiLoaded: S.aiLoaded,
    anns: S.anns.filter((a) => !a._new && !a._draft) });
}
function commit() {
  hist.splice(hp + 1); hist.push(snap()); if (hist.length > 120) hist.shift(); hp = hist.length - 1;
  saveSoon(); updateUndo();
}
function resetHist() { hist = [snap()]; hp = 0; updateUndo(); }
function updateUndo() { $("#btnUndo").disabled = hp <= 0; $("#btnRedo").disabled = hp >= hist.length - 1; }
function restore(str) {
  S = JSON.parse(str); selId = null;
  if (!S.questions.find((q) => q.id === activeQ)) activeQ = S.questions[0].id;
  renderAll(); saveSoon();
}
function undo() { finalizeSel(true); if (hp > 0) { hp--; restore(hist[hp]); updateUndo(); } }
function redo() { if (hp < hist.length - 1) { hp++; restore(hist[hp]); updateUndo(); } }
function flushSave() { if (fileKey) lsSet("draft:" + fileKey, snap()); }
function saveSoon() { dirty = true; clearTimeout(saveT); saveT = setTimeout(flushSave, 350); }

let toastT = null;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
function qHasWork(q) { return S.anns.some((a) => a.q === q.id) || (q.marks !== null && q.marks !== ""); }

/* ---------------- rail + options ---------------- */
function buildRail(){
  $("#rail").innerHTML=TOOLS.map(t=>`<button class="tl ${t.id===tool?"on":""}" data-tool="${t.id}" title="${esc(t.label)}"><span class="ic">${t.ic}</span>${t.label}</button>`).join("");
  $$(".tl").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
}
function setTool(t){
  finalizeSel(); tool=t; selId=null;
  if(["underline","text","circle","pen"].indexOf(t)>=0&&color==="yellow") color="red";
  $("#pages").dataset.tool=t; buildRail(); renderOpts(); renderOverlays();
}
function renderOpts(){
  const o=$("#opts");
  let h=`<div class="grp"><span class="lbl">Question</span>`;
  S.questions.forEach(q=>{ const st=!q.attempted?"na":(qHasWork(q)?"has":"");
    h+=`<button class="qchip ${q.id===activeQ?"on":""}" data-q="${q.id}" title="${q.attempted?"":"Not attempted"}">Q${q.id}<i class="${st}"></i></button>`; });
  h+=`<button class="qchip" id="qSet" title="Setup">⚙</button></div>`;
  if(["box","underline","text","circle","pen"].indexOf(tool)>=0){
    h+=`<div class="grp"><span class="lbl">Colour</span>`;
    ["red","yellow","green"].forEach(c=>{ if(tool!=="box"&&c==="yellow") return;
      const lab=(tool==="box"||tool==="underline")?COLORS[c].label:(c==="red"?"Red":"Green");
      h+=`<button class="cchip ${color===c?"on":""}" data-c="${c}"><i class="i-${c}"></i>${lab}</button>`; });
    h+=`</div>`;
  }
  if(tool==="stamp"){
    h+=`<div class="grp"><span class="lbl">Stamp</span>`+STAMPS.map(s=>`<button class="schip ${stampSel===s?"on":""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")+`</div>`;
  }
  o.innerHTML=h;
  $$(".qchip[data-q]",o).forEach(b=>b.onclick=()=>{ finalizeSel(); activeQ=+b.dataset.q; selId=null; renderOpts(); renderOverlays(); renderSide(); });
  const qs=$("#qSet",o); if(qs) qs.onclick=openSetup;
  $$(".cchip",o).forEach(b=>b.onclick=()=>{ color=b.dataset.c; renderOpts(); });
  $$(".schip",o).forEach(b=>b.onclick=()=>{ stampSel=b.dataset.s; renderOpts(); });
  const t=TOOLS.find(x=>x.id===tool);
  $("#hint").textContent=fbOn?t.hint:"Annotations are hidden.";
}
/* ---------------- pages ---------------- */
const stage=$("#stage"),pagesEl=$("#pages");
let io=null;
function pageWidth(){ const base=Math.min(Math.max(stage.clientWidth-44,260),900); return Math.round(base*zoom); }
function layout(){
  const pw=pageWidth(); document.documentElement.style.setProperty("--pw",pw+"px");
  $("#zLbl").textContent=Math.round(zoom*100)+"%";
  pages.forEach(p=>p.rw=0);
  if(io){ io.disconnect(); $$(".pg").forEach(el=>io.observe(el)); }
}
function buildPages(){
  pagesEl.innerHTML=""; $("#empty").hidden=pages.length>0; $("#pager").hidden=pages.length===0;
  if(io) io.disconnect();
  io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) paintPage(+e.target.dataset.i); }),{root:stage,rootMargin:"700px 0px"});
  pages.forEach((p,i)=>{
    const el=document.createElement("div"); el.className="pg"; el.dataset.i=i; el.style.aspectRatio=p.w+" / "+p.h;
    el.innerHTML=`<span class="pn">${i+1}</span><canvas></canvas><div class="ov"></div>`;
    pagesEl.appendChild(el); io.observe(el);
  });
  layout(); updatePager();
}
async function paintPage(i){
  const p=pages[i],el=$(`.pg[data-i="${i}"]`); if(!p||!el) return;
  const pw=pageWidth(); if(p.rw===pw) return; p.rw=pw;
  const c=$("canvas",el),dpr=Math.min(window.devicePixelRatio||1,2);
  const W=Math.round(pw*dpr),H=Math.round(pw*dpr*p.h/p.w);
  try{
    if(p.kind==="img"){ c.width=W;c.height=H; c.getContext("2d").drawImage(p.img,0,0,W,H); }
    else{
      if(p.task){ try{p.task.cancel();}catch(e){} }
      const vp=p.page.getViewport({scale:W/p.w}); c.width=Math.round(vp.width); c.height=Math.round(vp.height);
      p.task=p.page.render({canvasContext:c.getContext("2d"),canvas:c,viewport:vp}); await p.task.promise;
    }
  }catch(e){ if(!(e&&e.name==="RenderingCancelledException")) p.rw=0; }
}
function updatePager(){ $("#pLbl").textContent=(curPage+1)+" / "+Math.max(pages.length,1); }
let scrollRaf=0;
stage.addEventListener("scroll",()=>{ cancelAnimationFrame(scrollRaf); scrollRaf=requestAnimationFrame(()=>{
  const st=stage.getBoundingClientRect(); let cur=0;
  $$(".pg").forEach((p,i)=>{ if(p.getBoundingClientRect().top-st.top<st.height*.4) cur=i; });
  if(cur!==curPage){curPage=cur;updatePager();}
}); });
function goPage(n){ n=clamp(n,0,pages.length-1); const el=$$(".pg")[n]; if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); }
function setZoom(z){ zoom=clamp(z,.5,2.6); layout(); renderOverlays(); }
let rsT=null; window.addEventListener("resize",()=>{ clearTimeout(rsT); rsT=setTimeout(()=>{ if(pages.length) layout(); },200); });
/* ---------------- annotation rendering ---------------- */
function pc(v){ return (v*100)+"%"; }
function geom(el,a){
  if(isRect(a)){ el.style.left=pc(a.x); el.style.top=pc(a.y); el.style.width=pc(a.w); el.style.height=pc(a.h); }
  else if(a.type==="underline"||a.type==="strike"||a.type==="text"){ el.style.left=pc(a.x); el.style.top=pc(a.y); el.style.width=pc(a.w); }
  else { el.style.left=pc(a.x); el.style.top=pc(a.y); }
}
function penSvg(a){
  const pts=(a.pts||[]).map(q=>(q[0]*100).toFixed(2)+","+(q[1]*100).toFixed(2)).join(" ");
  const sw=Math.max(1.6,pageWidth()*.0042);
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible"><polyline points="${pts}" fill="none" stroke="${PENC[a.color]||RED}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function setSpr(el,key,a){ const sp=SPR[key]; el.style.width=(sp.cq*(a.sc||1))+"cqw"; el.innerHTML='<img src="'+sp.src+'" alt="" draggable="false">'; }
function annEl(a,num){
  const el=document.createElement("div"); el.className="an "+a.type; el.dataset.id=a.id; geom(el,a);
  if(a.id===selId) el.classList.add("sel");
  if(a.type==="box"){
    el.classList.add("c-"+a.color); if(!a.text.trim()) el.classList.add("nofb");
    el.title=a.text||"";
    el.innerHTML=`<span class="num">${num||""}<em>Q${a.q}</em></span>`;
  } else if(a.type==="tick"||a.type==="cross"){ setSpr(el,a.type,a); }
  else if(a.type==="score"){ el.textContent=a.value||"0"; }
  else if(a.type==="stamp"){ if(SPR[a.stamp]){ el.classList.add("simg"); setSpr(el,a.stamp,a); } else el.textContent=a.stamp; }
  else if(a.type==="underline"){ el.classList.add("c-"+a.color); el.innerHTML=`<span class="ln"></span>`+(a.text?`<span class="cm">💬</span>`:""); el.title=a.text||""; }
  else if(a.type==="strike"){ el.innerHTML=`<span class="ln"></span>`; }
  else if(a.type==="text"){ el.classList.add("c-"+a.color); el.textContent=a.value||""; el.style.fontSize=fsCq(a)+"cqw"; el.style.textAlign=a.al||"left"; el.style.transform="rotate("+(a.rot||0)+"deg)"; }
  else if(a.type==="circle"){ el.classList.add("c-"+a.color); }
  else if(a.type==="pen"){ el.classList.add("c-"+a.color); el.innerHTML=penSvg(a); }
  if(S.aiLoaded && !a._new){
    if(a.src==="ai"&&isEdited(a)) el.insertAdjacentHTML("beforeend",`<span class="bdg" title="Edited from AI draft">edited</span>`);
    else if(a.src!=="ai") el.insertAdjacentHTML("beforeend",`<span class="bdg" title="Added">new</span>`);
  }
  if(a.id===selId){
    const hs=isRect(a)?["nw","ne","sw","se"]:(a.type==="underline"||a.type==="strike"||a.type==="text")?["w","e"]:[];
    hs.forEach(h=>el.insertAdjacentHTML("beforeend",`<span class="h ${h}" data-h="${h}"></span>`));
  }
  return el;
}
function renderOverlays(only){
  const nums=numbered();
  $$(".pg").forEach(pg=>{
    const i=+pg.dataset.i; if(only!=null&&i!==only) return;
    const ov=$(".ov",pg); ov.innerHTML=""; if(!fbOn) return;
    S.anns.filter(a=>a.page===i).forEach(a=>ov.appendChild(annEl(a,nums[a.id])));
    const s=S.anns.find(a=>a.id===selId&&a.page===i&&!a._draft);
    if(s&&(tool==="select"||s._new)) ov.appendChild(popEl(s,nums[s.id]));
  });
  if(focusPop){ focusPop=false; const f=$(".pop textarea, .pop input[type=text]"); if(f){ f.focus(); if(f.tagName==="INPUT") f.select(); } }
}

/* ---------------- popover ---------------- */
function popEl(a,num){
  const d=document.createElement("div"); d.className="pop";
  const right=a.x>.5, above=a.y>.72;
  const anchorX=right?(a.x+(a.w||0)):a.x;
  if(right) d.classList.add("r");
  d.style.left=pc(clamp(anchorX,0,1));
  const bottom=a.y+(a.h||0);
  if(above||(a.type==="text"&&a.y>.2)){ d.style.bottom="calc("+pc(1-a.y)+" + 22px)"; } else { d.style.top="calc("+pc(bottom)+" + "+(isRect(a)?10:22)+"px)"; }
  let h=""; const SC='<div class="trow"><span class="lbl">Size</span><button class="sm" data-sc="-1">−</button><button class="sm" data-sc="1">+</button></div>';
  const dots=cs=>`<div class="dots">`+cs.map(c=>`<button class="dot i-${c} ${a.color===c?"on":""}" data-c="${c}" title="${COLORS[c].label}"></button>`).join("")+`</div><span class="cl">${a.color&&(a.type==="box"||a.type==="underline")?COLORS[a.color].label:""}</span>`;
  if(a.type==="box"){
    h+=`<div class="ph">Box #${num||""} · Q${a.q} ${dots(["red","yellow","green"])}</div>
      <textarea data-ann="${a.id}" class="${a.text.trim()?"":"req"}" placeholder="Feedback (required)">${esc(a.text)}</textarea>`;
  } else if(a.type==="underline"){
    h+=`<div class="ph">Underline ${dots(["red","green"])}</div>
      <textarea data-ann="${a.id}" placeholder="Comment (optional)">${esc(a.text)}</textarea>`;
  } else if(a.type==="tick"||a.type==="cross"){
    h+=`<div class="ph">${a.type==="tick"?"Tick":"Cross"}</div><div class="row" style="margin-top:0;justify-content:flex-start"><button class="sm" data-do="flip">Change to ${a.type==="tick"?"✕ cross":"✓ tick"}</button></div>${SC}`;
  } else if(a.type==="score"){
    h+=`<div class="ph">Score</div><input type="text" inputmode="decimal" data-ann="${a.id}" value="${esc(a.value)}" placeholder="e.g. 6.5" maxlength="6">`;
  } else if(a.type==="stamp"){
    h+=`<div class="ph">Stamp</div><div class="chips">`+STAMPS.map(s=>`<button class="chip ${a.stamp===s?"on":""}" data-st="${esc(s)}">${esc(s)}</button>`).join("")+`</div>`+SC;
  } else if(a.type==="text"){
    const AL={left:"M0 1h14M0 5h9M0 9h12",center:"M0 1h14M2.5 5h9M1 9h12",right:"M0 1h14M5 5h9M2 9h12"};
    h+=`<div class="ph">Text ${dots(["red","green"])}</div><textarea class="wt" data-ann="${a.id}" placeholder="Type here">${esc(a.value)}</textarea>
      <div class="trow"><span class="lbl">Size</span><button class="sm" data-fs="-1">−</button><input type="number" class="fsin" min="6" max="60" value="${fsOf(a)}" data-fsin><button class="sm" data-fs="1">+</button>
      <span class="lbl" style="margin-left:6px">Align</span>`+["left","center","right"].map(k=>`<button class="sm ${(a.al||"left")===k?"pri":""}" data-al="${k}" title="Align ${k}"><svg width="14" height="10" viewBox="0 0 14 10"><path d="${AL[k]}" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>`).join("")+`</div>
      <div class="trow"><span class="lbl">Rotate</span><button class="sm" data-rot="-5">−</button><input type="number" class="fsin" min="-180" max="180" value="${a.rot||0}" data-rotin><span style="font-size:12px;color:var(--sub)">°</span><button class="sm" data-rot="5">+</button><button class="sm" data-rot0="1">Straight</button></div>`;
  } else if(a.type==="circle"){ h+=`<div class="ph">Circle ${dots(["red","green"])}</div>`;
  } else if(a.type==="pen"){ h+=`<div class="ph">Pen ${dots(["red","green"])}</div>`;
  } else { h+=`<div class="ph">Strike-through</div>`; }
  h+=`<div class="row">`;
  if(a.src==="ai"&&isEdited(a)) h+=`<button class="sm" data-do="restore">Restore AI version</button>`;
  h+=`<button class="sm danger" data-do="del">Delete</button><button class="sm pri" data-do="done">Done</button></div>`;
  d.innerHTML=h;
  $$("[data-c]",d).forEach(b=>b.onclick=()=>{ a.color=b.dataset.c; touch(a); focusPop=true; renderOverlays(a.page); renderSide(); });
  const setFs=v=>{ v=clamp(Math.round(v)||12,6,60); a.fs=v; const te=$(`.an[data-id="${a.id}"]`); if(te) te.style.fontSize=fsCq(a)+"cqw"; const fi=$("[data-fsin]",d); if(fi) fi.value=v; touch(a); };
  $$("[data-fs]",d).forEach(b=>b.onclick=()=>setFs(fsOf(a)+(+b.dataset.fs)));
  const fin=$("[data-fsin]",d); if(fin) fin.onchange=()=>setFs(parseFloat(fin.value));
  const setRot=v=>{ v=clamp(Math.round(v)||0,-180,180); a.rot=v; const te=$(`.an[data-id="${a.id}"]`); if(te) te.style.transform="rotate("+v+"deg)"; const ri=$("[data-rotin]",d); if(ri) ri.value=v; touch(a); };
  $$("[data-rot]",d).forEach(b=>b.onclick=()=>setRot((a.rot||0)+(+b.dataset.rot)));
  const rin=$("[data-rotin]",d); if(rin) rin.onchange=()=>setRot(parseFloat(rin.value));
  const r0=$("[data-rot0]",d); if(r0) r0.onclick=()=>setRot(0);
  $$("[data-al]",d).forEach(b=>b.onclick=()=>{ a.al=b.dataset.al; const te=$(`.an[data-id="${a.id}"]`); if(te) te.style.textAlign=a.al; $$("[data-al]",d).forEach(x=>x.classList.toggle("pri",x===b)); touch(a); });
  $$("[data-sc]",d).forEach(b=>b.onclick=()=>{ a.sc=clamp(Math.round(((a.sc||1)+(+b.dataset.sc)*.15)*100)/100,.5,3); const te=$(`.an[data-id="${a.id}"]`), key=a.type==="stamp"?a.stamp:a.type; if(te&&SPR[key]) te.style.width=(SPR[key].cq*a.sc)+"cqw"; touch(a); });
  $$("[data-st]",d).forEach(b=>b.onclick=()=>{ a.stamp=b.dataset.st; touch(a); renderOverlays(a.page); });
  const ta=$("textarea",d);
  if(ta){ ta.oninput=()=>{ if(a.type==="text"){ a.value=ta.value; const te=$(`.an[data-id="${a.id}"]`); if(te) setElText(te,a.value); saveSoon(); return; } a.text=ta.value; ta.classList.toggle("req",a.type==="box"&&!a.text.trim()); syncText(a.id,ta.value,ta); updateBoxTitle(a); saveSoon(); };
          ta.onchange=()=>touch(a);
          ta.onkeydown=e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); done(a); return; } if(e.key==="Escape"){ e.stopPropagation(); finalizeSel(); renderOverlays(); renderSide(); } }; }
  const inp=$("input[type=text]",d);
  if(inp){ inp.oninput=()=>{ if(a.type==="score") inp.value=inp.value.replace(/[^0-9.]/g,""); a.value=inp.value; const e=$(`.an[data-id="${a.id}"]`); if(e) e.textContent=a.value||(a.type==="score"?"0":""); saveSoon(); };
           inp.onchange=()=>touch(a);
           inp.onkeydown=e=>{ if(e.key==="Enter") done(a); if(e.key==="Escape"){ e.stopPropagation(); finalizeSel(); renderOverlays(); } }; }
  $$("[data-do]",d).forEach(b=>b.onclick=()=>{
    const k=b.dataset.do;
    if(k==="flip"){ a.type=a.type==="tick"?"cross":"tick"; touch(a); renderOverlays(a.page); }
    else if(k==="del"){ removeAnn(a.id,!a._new); }
    else if(k==="restore"){ const o=JSON.parse(a.orig); [a.type,a.page,a.x,a.y,a.w,a.h,a.color,a.text,a.value,a.stamp,a.q]=o; touch(a); renderAll(); }
    else done(a);
  });
  return d;
}
function updateBoxTitle(a){ const e=$(`.an[data-id="${a.id}"]`); if(e){ e.title=a.text||""; if(a.type==="box") e.classList.toggle("nofb",!a.text.trim()); } }
function syncText(id,val,src){ $$(`textarea[data-ann="${id}"]`).forEach(t=>{ if(t!==src){ t.value=val; t.classList.toggle("req",!val.trim()); } }); updateFbBadge(); }
function touch(a){ if(!a._new) commit(); else saveSoon(); }
function done(a){
  if(a.type==="box"&&!a.text.trim()){ toast("Feedback is required."); focusPop=true; renderOverlays(a.page); return; }
  if(a.type==="score"&&!String(a.value).trim()){ toast("Enter the marks."); return; }
  if(a.type==="text"&&!String(a.value).trim()){ toast("Enter some text."); return; }
  select(null);
}

/* ---------------- selection ---------------- */
function finalizeSel(silent){
  const a=selId?find(selId):null; if(!a) return;
  let remove=false;
  if(a.type==="box"&&!a.text.trim()){ remove=true; if(!silent) toast("Box removed. Feedback is required."); }
  if((a.type==="score"||a.type==="text")&&!String(a.value).trim()) remove=true;
  if(remove){ S.anns=S.anns.filter(x=>x.id!==a.id); selId=null; return; }
  if(a._new){ delete a._new; commit(); }
}
function select(id){
  const prev=selId; finalizeSel(); selId=id;
  if(id){ const a=find(id); if(a) activeQ=a.q; }
  renderOpts(); renderOverlays(); renderSide();
  if(id&&prev!==id) $$(".fbi").forEach(e=>e.classList.toggle("on",e.dataset.id===id));
}
function removeAnn(id,doCommit){
  S.anns=S.anns.filter(a=>a.id!==id); if(selId===id) selId=null;
  if(doCommit) commit(); renderOpts(); renderOverlays(); renderSide();
}
function add(props){ const a=Object.assign({id:uid(),q:activeQ,src:"reviewer"},props); S.anns.push(a); return a; }

/* ---------------- pointer interactions ---------------- */
function pt(e,r){ return {x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}; }
pagesEl.addEventListener("pointerdown",e=>{
  if(e.target.closest(".pop")) return;
  if(e.pointerType==="mouse"&&e.button!==0) return;
  const pgEl=e.target.closest(".pg"); if(!pgEl) return;
  const i=+pgEl.dataset.i, anEl=e.target.closest(".an"), hEl=e.target.closest(".h");
  if(!fbOn){ toast("Annotations are hidden."); return; }
  if(hEl&&anEl){ e.preventDefault(); const a=find(anEl.dataset.id); drag={mode:"resize",id:a.id,h:hEl.dataset.h,r:pgEl.getBoundingClientRect(),o:{x:a.x,y:a.y,w:a.w||0,hh:a.h||0},moved:false}; return; }
  if(anEl&&tool==="select"){ e.preventDefault(); const id=anEl.dataset.id; if(selId!==id) select(id);
    const a=find(id), r=pgEl.getBoundingClientRect(), p=pt(e,r);
    drag={mode:"move",id:id,r:r,ox:p.x-a.x,oy:p.y-a.y,moved:false}; return; }
  if(anEl&&tool==="eraser"){ e.preventDefault(); removeAnn(anEl.dataset.id,true); return; }
  if(tool==="select"||tool==="eraser"){ if(selId){ select(null); } return; }
  e.preventDefault(); startDraw(e,i,pgEl);
});
function startDraw(e,i,pgEl){
  finalizeSel(); selId=null;
  const r=pgEl.getBoundingClientRect(), p=pt(e,r);
  if(tool==="tick"||tool==="cross"){ add({type:tool,page:i,x:r4(p.x),y:r4(p.y)}); commit(); renderOpts(); renderOverlays(i); renderSide(); return; }
  if(tool==="score"){
    const q=curQ(); const a=add({type:"score",page:i,x:r4(p.x),y:r4(p.y),value:(q.attempted&&q.marks!==null&&q.marks!=="")?String(q.marks):"",_new:true});
    selId=a.id; focusPop=true; renderOverlays(); return;
  }
  if(tool==="text"){
    const tw=Math.max(.15,Math.min(.4,1-p.x)); const a=add({type:"text",page:i,x:r4(Math.min(p.x,1-tw)),y:r4(p.y),w:r4(tw),fs:12,al:"left",value:"",color:color==="green"?"green":"red",_new:true});
    selId=a.id; focusPop=true; renderOverlays(); return;
  }
  if(tool==="stamp"){
    const q=curQ();
    if(!q.attempted){ toast("Q"+q.id+" is not attempted."); renderOverlays(); return; }
    if(q.objective){ toast("Q"+q.id+" is objective. No stamp."); renderOverlays(); return; }
    const ex=S.anns.find(a=>a.type==="stamp"&&a.q===q.id);
    if(ex){ toast("Q"+q.id+" already has a stamp."); setTool("select"); select(ex.id); return; }
    add({type:"stamp",page:i,x:r4(p.x),y:r4(p.y),stamp:stampSel}); commit(); renderOpts(); renderOverlays(i); renderSide(); return;
  }
  if(["box","underline","strike","circle","pen"].indexOf(tool)>=0){
    const col=tool==="strike"?"red":(tool!=="box"&&color==="yellow"?"red":color);
    const a=add({type:tool,page:i,x:p.x,y:p.y,w:0,h:0,color:col,text:"",_draft:true});
    if(tool==="pen"){ a.raw=[[p.x,p.y]]; a.pts=[]; }
    drag={mode:"draw",id:a.id,r:r,sx:p.x,sy:p.y,page:i};
    renderOverlays(i);
  }
}
window.addEventListener("pointermove",e=>{
  if(!drag) return; const a=find(drag.id); if(!a) return; const p=pt(e,drag.r); drag.moved=true;
  if(drag.mode==="draw"){
    if(a.type==="pen"){
      a.raw.push([p.x,p.y]); const xs=a.raw.map(q=>q[0]),ys=a.raw.map(q=>q[1]);
      a.x=Math.min.apply(null,xs); a.y=Math.min.apply(null,ys); a.w=Math.max(.001,Math.max.apply(null,xs)-a.x); a.h=Math.max(.001,Math.max.apply(null,ys)-a.y);
      a.pts=a.raw.map(q=>[(q[0]-a.x)/a.w,(q[1]-a.y)/a.h]);
    }
    else if(a.type==="box"||a.type==="circle"){ a.x=Math.min(drag.sx,p.x); a.y=Math.min(drag.sy,p.y); a.w=Math.abs(p.x-drag.sx); a.h=Math.abs(p.y-drag.sy); }
    else { a.x=Math.min(drag.sx,p.x); a.y=drag.sy; a.w=Math.abs(p.x-drag.sx); a.h=0; }
  } else if(drag.mode==="move"){
    const w=a.w||0,h=a.h||0;
    if(isRect(a)){ a.x=clamp(p.x-drag.ox,0,1-w); a.y=clamp(p.y-drag.oy,0,1-h); }
    else if(a.type==="underline"||a.type==="strike"||a.type==="text"){ a.x=clamp(p.x-drag.ox,0,1-w); a.y=clamp(p.y-drag.oy,0,1); }
    else { a.x=clamp(p.x-drag.ox,0,1); a.y=clamp(p.y-drag.oy,0,1); }
  } else if(drag.mode==="resize"){
    const o=drag.o,h=drag.h;
    if(isRect(a)){
      let x1=o.x,y1=o.y,x2=o.x+o.w,y2=o.y+o.hh;
      if(h.indexOf("w")>=0) x1=p.x; if(h.indexOf("e")>=0) x2=p.x; if(h.indexOf("n")>=0) y1=p.y; if(h.indexOf("s")>=0) y2=p.y;
      a.x=Math.min(x1,x2); a.y=Math.min(y1,y2); a.w=Math.max(.015,Math.abs(x2-x1)); a.h=Math.max(.012,Math.abs(y2-y1));
    } else {
      let x1=o.x,x2=o.x+o.w; if(h==="w") x1=p.x; else x2=p.x;
      a.x=Math.min(x1,x2); a.w=Math.max(.02,Math.abs(x2-x1));
    }
  }
  const el=$(`.an[data-id="${a.id}"]`);
  if(el){ geom(el,a); if(drag.mode==="draw"&&a.type==="pen") el.innerHTML=penSvg(a); const pop=el.parentNode&&el.parentNode.querySelector(".pop"); if(pop) pop.style.display="none"; }
  else if(drag.mode==="draw") renderOverlays(drag.page);
});
window.addEventListener("pointerup",()=>{
  if(!drag) return; const d=drag; drag=null; const a=find(d.id); if(!a) return;
  if(d.mode==="draw"){
    delete a._draft;
    const tooSmall=a.type==="pen"?(a.raw.length<3||(a.w<.006&&a.h<.006)):(a.type==="box"||a.type==="circle")?(a.w<.012||a.h<.01):(a.w<.02);
    if(a.type==="pen"){ const st=Math.ceil(a.pts.length/250); a.pts=a.pts.filter((_,k)=>k%st===0||k===a.pts.length-1).map(q=>[r4(q[0]),r4(q[1])]); delete a.raw; }
    if(tooSmall){ S.anns=S.anns.filter(x=>x.id!==a.id); renderOverlays(d.page); return; }
    a.x=r4(a.x);a.y=r4(a.y);a.w=r4(a.w);a.h=r4(a.h);
    if(a.type==="box"){ a._new=true; selId=a.id; focusPop=true; renderOpts(); renderOverlays(); renderSide(); }
    else { commit(); renderOpts(); renderOverlays(a.page); renderSide(); }
  } else {
    a.x=r4(a.x);a.y=r4(a.y); if(a.w!=null) a.w=r4(a.w); if(a.h!=null) a.h=r4(a.h);
    if(d.moved) touch(a);
    renderOverlays(a.page); renderSide();
  }
});
document.addEventListener("keydown",e=>{
  const tg=e.target, typing=tg&&(tg.tagName==="INPUT"||tg.tagName==="TEXTAREA"||tg.tagName==="SELECT");
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==="z"&&!typing){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(mod&&e.key.toLowerCase()==="y"&&!typing){ e.preventDefault(); redo(); return; }
  if(typing) return;
  if((e.key==="Delete"||e.key==="Backspace")&&selId){ e.preventDefault(); const a=find(selId); removeAnn(selId,!(a&&a._new)); }
  if(e.key==="Escape"){ if(!$("#mw").hidden) closeModal(); else { finalizeSel(); selId=null; renderOverlays(); renderSide(); } }
});

/* ---------------- side panel ---------------- */
function renderSide(){ if(tab==="marks") renderMarks(); else renderFb(); updateTotals(); updateFbBadge(); $$(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab)); }
function updateFbBadge(){
  const n=S.anns.filter(a=>(a.type==="box"&&a.text.trim())||(a.type==="underline"&&a.text.trim())).length;
  $("#fbCount").textContent=n?"("+n+")":"";
}
function updateTotals(){
  const t=totals();
  $("#totalBar").innerHTML=`<div><div class="n">${t.got}<span style="font-size:16px"> / ${t.max}</span></div><div style="font-size:11px;color:var(--sub);margin-top:2px">Total</div></div>
    <div class="r">${t.pct.toFixed(0)}%<b>${t.remark}</b></div>`;
}
function renderMarks(){
  const w=$("#sideBody");
  let h=`<div class="seg" id="coSeg"><button data-co="foundation" class="${S.cohort==="foundation"?"on":""}">Foundation</button><button data-co="upsc" class="${S.cohort==="upsc"?"on":""}">UPSC</button></div>`;
  S.questions.forEach(q=>{
    h+=`<div class="qcard ${q.id===activeQ?"act":""}" data-q="${q.id}">
      <div class="qhead"><b>Q${q.id}</b><span>max ${q.max}${q.objective?" · objective":""}</span>
      <label class="na-l"><input type="checkbox" data-na ${q.attempted?"":"checked"}> Not attempted</label></div>
      <div class="mk">Marks <input type="text" inputmode="decimal" data-mk value="${q.attempted?(q.marks===null?"":q.marks):0}" ${q.attempted?"":"disabled"} placeholder="–"> / ${q.max}</div>`;
    if(S.cohort==="upsc"&&q.attempted){
      q.params.forEach((p,pi)=>{ h+=`<div class="prm"><span>${esc(p.name)}</span><input type="text" inputmode="decimal" data-pm="${pi}" value="${p.marks===null?"":p.marks}" placeholder="–"><span style="flex:0">/ 5</span></div>`; });
    }
    h+=`</div>`;
  });
  if(S.cohort==="upsc") h+=`<div class="sumBox"><h3>Overall summary</h3><textarea id="overall" placeholder="Required for UPSC">${esc(S.overall)}</textarea></div>`;
  w.innerHTML=h;
}
function renderFb(){
  const w=$("#sideBody"), nums=numbered();
  const list=S.anns.filter(a=>(a.type==="box"||(a.type==="underline"&&a.text.trim()))&&(fbAll||a.q===activeQ)&&!a._draft)
    .sort((a,b)=>a.page-b.page||a.y-b.y||a.x-b.x);
  let h=`<div class="seg"><button data-fa="0" class="${fbAll?"":"on"}">Q${activeQ} only</button><button data-fa="1" class="${fbAll?"on":""}">All questions</button></div>`;
  if(!list.length) h+=`<div class="empty-s">No feedback yet.</div>`;
  list.forEach(a=>{
    const bad=a.type==="box"&&!a.text.trim();
    h+=`<div class="fbi ${a.color} ${a.id===selId?"on":""}" data-id="${a.id}"><div class="t"><span class="b">${a.type==="box"?(nums[a.id]||""):"U"}</span>${a.type==="box"?"Box":"Underline"} · Q${a.q} · Page ${a.page+1} · ${COLORS[a.color].label}${bad?` <span class="need">· feedback needed</span>`:""}</div>
      <textarea data-ann="${a.id}" class="${bad?"req":""}" placeholder="Feedback (required)">${esc(a.text)}</textarea></div>`;
  });
  w.innerHTML=h;
}
$("#sideBody").addEventListener("click",e=>{
  const co=e.target.closest("[data-co]"); if(co){ S.cohort=co.dataset.co; commit(); renderSide(); return; }
  const fa=e.target.closest("[data-fa]"); if(fa){ fbAll=fa.dataset.fa==="1"; renderFb(); return; }
  const qc=e.target.closest(".qcard"); if(qc&&!e.target.closest("input")&&!e.target.closest("label")){ finalizeSel(); activeQ=+qc.dataset.q; selId=null; renderOpts(); renderOverlays(); renderSide(); return; }
  const fi=e.target.closest(".fbi"); if(fi&&e.target.tagName!=="TEXTAREA"){
    const a=find(fi.dataset.id); if(!a) return; if(tool!=="select") setTool("select");
    select(a.id); const el=$(`.an[data-id="${a.id}"]`); if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); }
});
$("#sideBody").addEventListener("input",e=>{
  const t=e.target, qc=t.closest(".qcard"), q=qc?S.questions.find(x=>x.id===+qc.dataset.q):null;
  if(t.matches("[data-mk]")&&q){
    t.value=t.value.replace(/[^0-9.]/g,""); const v=parseFloat(t.value);
    if(t.value===""){ t.classList.remove("bad"); q.marks=null; }
    else if(isNaN(v)||v<0||v>q.max){ t.classList.add("bad"); return; }
    else { t.classList.remove("bad"); q.marks=v; }
    updateTotals(); saveSoon();
  } else if(t.matches("[data-pm]")&&q){
    t.value=t.value.replace(/[^0-9.]/g,""); const v=parseFloat(t.value);
    if(t.value===""){ t.classList.remove("bad"); q.params[+t.dataset.pm].marks=null; }
    else if(isNaN(v)||v<0||v>5){ t.classList.add("bad"); return; }
    else { t.classList.remove("bad"); q.params[+t.dataset.pm].marks=v; }
    saveSoon();
  } else if(t.id==="overall"){ S.overall=t.value; saveSoon(); }
  else if(t.matches("textarea[data-ann]")){
    const a=find(t.dataset.ann); if(!a) return; a.text=t.value; t.classList.toggle("req",a.type==="box"&&!a.text.trim());
    syncText(a.id,t.value,t); updateBoxTitle(a); saveSoon();
  }
});
$("#sideBody").addEventListener("change",e=>{
  const t=e.target, qc=t.closest(".qcard"), q=qc?S.questions.find(x=>x.id===+qc.dataset.q):null;
  if(t.matches("[data-na]")&&q){
    q.attempted=!t.checked;
    if(!q.attempted){ q.marks=0; const had=S.anns.filter(a=>a.type==="stamp"&&a.q===q.id).length;
      S.anns=S.anns.filter(a=>!(a.type==="stamp"&&a.q===q.id)); if(had) toast("Stamp removed."); }
    else q.marks=null;
    commit(); renderOpts(); renderOverlays(); renderSide(); return;
  }
  if(t.matches("[data-mk],[data-pm]")&&q){
    if(t.classList.contains("bad")){ toast("Enter 0 to "+(t.matches("[data-mk]")?q.max:5)+"."); const v=t.matches("[data-mk]")?q.marks:q.params[+t.dataset.pm].marks; t.value=v===null?"":v; t.classList.remove("bad"); }
    commit(); renderOpts(); updateTotals(); return;
  }
  if(t.id==="overall"||t.matches("textarea[data-ann]")){ commit(); renderOverlays(); if(t.matches("textarea[data-ann]")) renderOpts(); }
});
$$(".tabs button").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; renderSide(); });


function renderAll() { buildRail(); renderOpts(); renderOverlays(); renderSide(); updateFbBtn(); }
function updateFbBtn() { $("#btnFb").textContent = fbOn ? "Hide annotations" : "Show annotations"; }

/* ---------------- modal ---------------- */
function openModal(html,mount){
  $("#modal").innerHTML=`<button class="x" id="mx" title="Close">✕</button>`+html; $("#mw").hidden=false;
  $("#mx").onclick=closeModal; if(mount) mount();
}
function closeModal(){ $("#mw").hidden=true; $("#modal").innerHTML=""; }
$("#mw").addEventListener("pointerdown",e=>{ if(e.target.id==="mw") closeModal(); });


/* ---------------- setup ---------------- */
function openSetup() {
  finalizeSel(); selId = null; renderOverlays();
  const m = S.meta, rows = S.questions.map((q) => ({ max: q.max, obj: q.objective }));
  let co = S.cohort;
  const draw = () => {
    $("#qrows").innerHTML = rows.map((r, i) => `<div class="qrow"><b>Q${i + 1}</b><input type="number" min="0.5" step="0.5" value="${r.max}" data-rm="${i}"> marks <label><input type="checkbox" data-ro="${i}" ${r.obj ? "checked" : ""}> Objective</label></div>`).join("");
    $("#qn").textContent = rows.length;
    $$("[data-rm]").forEach((i) => (i.oninput = () => { rows[+i.dataset.rm].max = Math.max(0.5, parseFloat(i.value) || 1); }));
    $$("[data-ro]").forEach((i) => (i.onchange = () => { rows[+i.dataset.ro].obj = i.checked; }));
  };
  openModal(`<h2>Setup</h2>
    <div class="seg" id="mco"><button data-co="foundation" class="${co === "foundation" ? "on" : ""}">Foundation</button><button data-co="upsc" class="${co === "upsc" ? "on" : ""}">UPSC</button></div>
    <div class="g2">
      <label class="f">Copy ID<input id="s_id" value="${esc(m.copyId)}"></label>
      <label class="f">Test<input id="s_test" value="${esc(m.test)}"></label>
      <label class="f">Reviewer<input id="s_rev" value="${esc(m.reviewer)}"></label>
    </div>
    <div class="qh"><b>Questions</b><button class="ic-btn" id="qm">−</button><b id="qn" class="qn"></b><button class="ic-btn" id="qp">+</button></div>
    <div id="qrows"></div>
    <div class="mfoot"><button class="btn" id="sCancel">Cancel</button><button class="btn primary" id="sApply">Apply</button></div>`, () => {
    draw();
    $$("#mco button").forEach((b) => (b.onclick = () => { co = b.dataset.co; $$("#mco button").forEach((x) => x.classList.toggle("on", x === b)); }));
    $("#qm").onclick = () => { if (rows.length > 1) { rows.pop(); draw(); } };
    $("#qp").onclick = () => { if (rows.length < 30) { rows.push({ max: 10, obj: false }); draw(); } };
    $("#sCancel").onclick = closeModal;
    $("#sApply").onclick = () => {
      S.meta = { copyId: $("#s_id").value.trim(), test: $("#s_test").value.trim(), reviewer: $("#s_rev").value.trim() };
      lsSet("reviewer", S.meta.reviewer);
      S.cohort = co;
      S.questions = rows.map((r, i) => {
        const old = S.questions.find((q) => q.id === i + 1) || mkQ(i + 1, r.max);
        old.max = r.max; old.objective = r.obj; if (old.marks !== null && old.marks > old.max) old.marks = old.max;
        return old;
      });
      S.anns.forEach((a) => { if (a.q > rows.length) a.q = rows.length; });
      if (activeQ > rows.length) activeQ = rows.length;
      commit(); closeModal(); renderAll();
    };
  });
}

/* ---------------- submit ---------------- */
function validate() {
  const issues = [], nums = numbered();
  if (!pages.length) issues.push({ msg: "Open an answer copy first." });
  S.anns.filter((a) => a.type === "box" && !a.text.trim()).forEach((a) => issues.push({ id: a.id, msg: `Q${a.q}: box #${nums[a.id]} needs feedback` }));
  S.questions.forEach((q) => { if (q.attempted && (q.marks === null || q.marks === "" || isNaN(+q.marks) || q.marks < 0 || q.marks > q.max)) issues.push({ q: q.id, msg: `Q${q.id}: enter marks (0 to ${q.max})` }); });
  if (S.cohort === "upsc" && !S.overall.trim()) issues.push({ upsc: 1, msg: "Overall summary is required" });
  if (!S.meta.reviewer) issues.push({ setup: 1, msg: "Reviewer name is required" });
  return issues;
}
const data = () => buildExport({ S, pages, fileName });
function saveJson() { downloadFile(baseName() + ".redpen.json", JSON.stringify(data(), null, 2), "application/json"); dirty = false; }
async function savePdf() {
  if (!pages.length) { toast("Open a copy first."); return; }
  busy(true, "Building PDF…");
  try { downloadFile(baseName() + ".annotated.pdf", await exportPdf({ S, pages }), "application/pdf"); }
  catch (e) { console.error(e); toast("Could not build the PDF."); }
  busy(false);
}
async function saveHtml() {
  if (!pages.length) { toast("Open a copy first."); return; }
  busy(true, "Building HTML…");
  try { downloadFile(baseName() + ".html", await buildHtml({ S, pages, title: S.meta.test || baseName() }), "text/html"); }
  catch (e) { console.error(e); toast("Could not build the HTML."); }
  busy(false);
}
async function submitReview() {
  finalizeSel(); selId = null; renderOverlays(); renderSide();
  const issues = validate();
  if (issues.length) {
    openModal(`<h2>Fix before submitting</h2>` + issues.map((x, i) => `<div class="issue" data-i="${i}">${esc(x.msg)}</div>`).join("") + `<div class="mfoot"><button class="btn" id="ic">Close</button></div>`, () => {
      $("#ic").onclick = closeModal;
      $$(".issue").forEach((el) => (el.onclick = () => {
        const x = issues[+el.dataset.i]; closeModal();
        if (x.id) { setTool("select"); select(x.id); const e = $(`.an[data-id="${x.id}"]`); if (e) e.scrollIntoView({ behavior: "smooth", block: "center" }); }
        else if (x.q) { activeQ = x.q; tab = "marks"; renderOpts(); renderSide(); }
        else if (x.upsc) { tab = "marks"; renderSide(); const o = $("#overall"); if (o) { o.scrollIntoView(); o.focus(); } }
        else if (x.setup) openSetup();
      }));
    });
    return;
  }
  if (CONFIG.submitUrl) {
    busy(true, "Submitting…");
    try {
      const r = await fetch(CONFIG.submitUrl, { method: "POST", headers: { "Content-Type": "application/json", ...CONFIG.submitHeaders }, body: JSON.stringify(data()) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      dirty = false; busy(false); toast("Submitted.");
    } catch (e) {
      busy(false);
      openModal(`<h2>Could not submit</h2><p>Save the JSON and try again later.</p><div class="mfoot"><button class="btn" id="dc">Close</button><button class="btn primary" id="dj">Save JSON</button></div>`,
        () => { $("#dc").onclick = closeModal; $("#dj").onclick = () => { saveJson(); closeModal(); }; });
    }
    return;
  }
  const t = totals();
  openModal(`<h2>Review complete</h2><p class="big">${t.got} / ${t.max}</p><div class="mfoot"><button class="btn" id="dh">Save HTML</button><button class="btn" id="dp">Save PDF</button><button class="btn primary" id="dj">Save JSON</button></div>`,
    () => { $("#dj").onclick = () => { saveJson(); closeModal(); }; $("#dp").onclick = savePdf; $("#dh").onclick = saveHtml; });
}

/* ---------------- opening files ---------------- */
function busy(on, txt) { $("#busy").hidden = !on; if (txt) $("#busyTxt").textContent = txt; }
const readURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

async function loadFiles(list) {
  const files = Array.from(list || []); if (!files.length) return;
  if (dirty && S.anns.length && !window.confirm("Discard unsaved changes?")) return;
  const pdf = files.find((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
  busy(true, "Opening…");
  try {
    const np = []; let key = "", name = "";
    if (pdf) {
      const buf = await pdf.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf, ...PDF_OPTS }).promise;
      for (let p = 1; p <= doc.numPages; p++) { const pg = await doc.getPage(p); const vp = pg.getViewport({ scale: 1 }); np.push({ kind: "pdf", page: pg, w: vp.width, h: vp.height }); }
      key = pdf.name + "|" + pdf.size + "|" + doc.numPages; name = pdf.name;
    } else {
      const imgs = files.filter((f) => /^image\//.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (!imgs.length) throw new Error("type");
      for (const f of imgs) { const im = await loadImg(await readURL(f)); np.push({ kind: "img", img: im, w: im.naturalWidth, h: im.naturalHeight }); }
      key = imgs.map((f) => f.name + f.size).join("|").slice(0, 160); name = imgs.length > 1 ? imgs[0].name + " (+" + (imgs.length - 1) + ")" : imgs[0].name;
    }
    startSession(np, name, key);
  } catch (e) {
    console.error(e);
    toast(e && e.message === "type" ? "Choose a PDF or images." : "Could not open this file.");
  }
  busy(false);
}
function startSession(np, name, key) {
  pages = np; fileName = name; fileKey = key; curPage = 0;
  let restored = false;
  const d = lsGet("draft:" + key);
  if (d) { try { S = JSON.parse(d); restored = true; } catch (e) {} }
  if (!restored) {
    const keep = S; S = freshS();
    S.meta = { ...keep.meta, copyId: baseName() };
    S.cohort = keep.cohort;
    S.questions = keep.questions.map((q) => { const n = mkQ(q.id, q.max); n.objective = q.objective; return n; });
  }
  if (!S.questions.find((q) => q.id === activeQ)) activeQ = S.questions[0].id;
  selId = null; dirty = false; $("#fname").textContent = name; $("#fname").title = name;
  buildPages(); resetHist(); renderAll(); stage.scrollTop = 0;
  if (restored) toast("Restored your saved work.");
}
async function makeDemo() {
  busy(true, "Preparing…");
  try {
    await document.fonts.load("34px Kalam");
    const mk = (lines) => {
      const c = document.createElement("canvas"); c.width = 1000; c.height = 1414; const x = c.getContext("2d");
      x.fillStyle = "#FFFEFA"; x.fillRect(0, 0, 1000, 1414); x.strokeStyle = "#CFD8EA"; x.lineWidth = 2;
      for (let y = 130; y < 1380; y += 52) { x.beginPath(); x.moveTo(60, y); x.lineTo(940, y); x.stroke(); }
      x.strokeStyle = "#E6A3A3"; x.beginPath(); x.moveTo(110, 0); x.lineTo(110, 1414); x.stroke();
      x.fillStyle = "#1F2F6B"; x.font = "34px Kalam"; lines.forEach((t, i) => { if (t) x.fillText(t, 130, 122 + i * 52); });
      return c.toDataURL("image/jpeg", 0.9);
    };
    const p1 = ["Q1. Explain the Coriolis force. (10 marks)", "", "Coriolis force is an apparent force that acts on", "objects moving over the rotating Earth. It is caused", "by the rotation of the Earth from west to east.", "It is maximum at the equator and zero at the poles.", "The force deflects winds to the right in the", "northern hemisphere and to the left in the southern", "hemisphere. This deflection shapes cyclones.", "", "Q2. State two causes of ocean tides. (5 marks)", "", "1) Gravitational pull of the Moon on the oceans.", "2) Gravitational pull of the Sun on the oceans."];
    const p2 = ["Q3. What is the demographic dividend? (10 marks)", "", "It is the growth benefit when the working-age", "population is larger than the dependent population.", "India’s window runs from about 2005 to 2041.", "Skilling and jobs are needed to use it well.", "", "Conclusion: policy must focus on education,", "health and employment for the youth."];
    const imgs = [await loadImg(mk(p1)), await loadImg(mk(p2))];
    S = freshS(); S.questions = [mkQ(1, 10), mkQ(2, 5), mkQ(3, 10)];
    startSession(imgs.map((im) => ({ kind: "img", img: im, w: im.naturalWidth, h: im.naturalHeight })), "demo.png", "demo");
  } catch (e) { toast("Could not prepare the demo."); }
  busy(false);
}
function openJson(txt) {
  let j; try { j = JSON.parse(txt); } catch (e) { toast("Not a valid JSON file."); return; }
  const r = applyImport(S, j, jsonMode === "draft", pages.length);
  if (r.error) { toast(r.error); return; }
  if (r.pageMismatch) toast("File has " + r.pageMismatch + " pages; this copy has " + pages.length + ".");
  activeQ = S.questions[0].id; selId = null; commit(); renderAll();
}

/* ---------------- wiring ---------------- */
$("#btnOpen").onclick = $("#btnOpen2").onclick = () => $("#file").click();
$("#file").onchange = (e) => { loadFiles(e.target.files); e.target.value = ""; };
$("#fileJson").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) f.text().then(openJson); };
$("#btnDemo").onclick = makeDemo;
$("#btnSetup").onclick = openSetup;
$("#btnSubmit").onclick = submitReview;
$("#btnUndo").onclick = undo; $("#btnRedo").onclick = redo;
$("#btnFb").onclick = () => { finalizeSel(); selId = null; fbOn = !fbOn; updateFbBtn(); renderOpts(); renderOverlays(); };
$("#btnExport").onclick = (e) => { e.stopPropagation(); $("#menu").hidden = !$("#menu").hidden; };
document.addEventListener("click", (e) => { if (!e.target.closest(".menuWrap")) $("#menu").hidden = true; });
$$("#menu button").forEach((b) => (b.onclick = () => {
  $("#menu").hidden = true; const k = b.dataset.act;
  if (k === "json") { if (!pages.length) { toast("Open a copy first."); return; } finalizeSel(); saveJson(); }
  else if (k === "pdf") { finalizeSel(); savePdf(); }
  else if (k === "html") { finalizeSel(); saveHtml(); }
  else if (k === "resume" || k === "draft") { if (!pages.length) { toast("Open a copy first."); return; } jsonMode = k; $("#fileJson").click(); }
  else if (k === "reset") {
    openModal(`<h2>Clear all?</h2><p>Removes every annotation and mark on this copy.</p><div class="mfoot"><button class="btn" id="rc">Cancel</button><button class="btn primary" id="rok">Clear</button></div>`, () => {
      $("#rc").onclick = closeModal;
      $("#rok").onclick = () => { S.anns = []; S.overall = ""; S.aiLoaded = false; S.questions.forEach((q) => { q.marks = null; q.attempted = true; q.params.forEach((p) => (p.marks = null)); }); selId = null; commit(); closeModal(); renderAll(); };
    });
  }
}));
$("#pPrev").onclick = () => goPage(curPage - 1); $("#pNext").onclick = () => goPage(curPage + 1);
$("#zIn").onclick = () => setZoom(zoom + 0.15); $("#zOut").onclick = () => setZoom(zoom - 0.15);
["dragenter", "dragover"].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove("drag"); }));
stage.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
window.addEventListener("beforeunload", (e) => { flushSave(); if (dirty && S.anns.length) { e.preventDefault(); e.returnValue = ""; } });

buildRail(); renderAll(); resetHist(); updatePager();
