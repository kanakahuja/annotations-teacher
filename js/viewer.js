// Read-only viewer for an annotated copy. Used for the downloadable HTML.
// mountViewer is serialised with toString() into the exported file, so it must stay
// self-contained (no imports, no outside variables).
export const VIEWER_CSS = `
html,body{height:100%;margin:0}
.v-app{height:100%;display:flex;flex-direction:column;background:#fff;color:#1B2124;font-family:'Reddit Sans',-apple-system,'Segoe UI',sans-serif;position:relative;font-size:14px}
.v-app *{box-sizing:border-box}
.v-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #E3E5E9;background:#fff}
.v-sp{width:34px}
.v-x{width:34px;height:34px;border:none;background:none;font-size:20px;border-radius:8px;cursor:pointer}
.v-pill{border:none;background:#EEF0FE;border-radius:99px;padding:8px 14px;font:600 13px 'Reddit Sans',sans-serif;cursor:pointer;color:#1B2124}
.v-scroll{flex:1;overflow:auto;background:#ECEDF0;padding:14px 0 90px}
.v-col{max-width:720px;margin:0 auto;padding:0 12px}
.v-pg{position:relative;background:#fff;margin:0 0 16px;container-type:inline-size;box-shadow:0 1px 5px rgba(0,0,0,.18)}
.v-pg img{display:block;width:100%;height:100%}
.v-ov{position:absolute;inset:0}
.v-an{position:absolute;font-family:'Kalam',cursive}
.c-red{--g:rgba(240,68,56,.25)}.c-yellow{--g:rgba(234,170,46,.30)}.c-green{--g:rgba(22,179,100,.25)}
.v-box{border:2px solid transparent;border-radius:12px}
.v-box.c-red{background:rgba(240,68,56,.09)}.v-box.c-green{background:rgba(22,179,100,.10)}.v-box.c-yellow{background:rgba(250,197,21,.11)}
.v-box.hc{cursor:pointer}
.v-box.on{border-style:dashed}
.v-box.c-red.on{border-color:#F04438;background:rgba(240,68,56,.08)}
.v-box.c-yellow.on{border-color:#EAAA2E;background:rgba(250,197,21,.14)}
.v-box.c-green.on{border-color:#16B364;background:rgba(22,179,100,.08)}
.v-b{position:absolute;right:8px;bottom:8px;width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-style:normal;box-shadow:0 0 0 7px var(--g);cursor:pointer;transition:all .15s}
.v-b b{display:none;font:700 13px 'Reddit Sans',sans-serif}
.c-red .v-b{background:#F04438}.c-yellow .v-b{background:#E0A526}.c-green .v-b{background:#1B7938}
.v-an.on .v-b{width:28px;height:28px;right:-14px;bottom:-14px;box-shadow:0 0 0 7px var(--g)}
.v-an.on .v-b b{display:block}
.v-tx{white-space:pre-wrap;overflow-wrap:anywhere;font-weight:400;font-style:normal;letter-spacing:0;line-height:1;transform-origin:left top}
.v-tx.c-red{color:#BF2734}.v-tx.c-green{color:#1B7938}
.v-ci{border:.4cqw solid;border-radius:50%}
.v-ci.c-red{border-color:#BF2734}.v-ci.c-green{border-color:#1B7938}
.v-pn svg{display:block}
.v-ul{height:3.4cqw;transform:translateY(-50%)}
.v-ul.hc{cursor:pointer}
.v-ul .v-b{right:-8px;bottom:auto;top:50%;margin-top:-6px}
.v-ul.on .v-b{right:-14px;top:50%;bottom:auto;margin-top:-14px}
.v-l{position:absolute;left:0;right:0;top:50%;height:.36cqw;margin-top:-.18cqw;border-radius:1cqw}
.v-ul.c-red .v-l{background:#F04438}.v-ul.c-green .v-l{background:#16B364}
.v-st{height:3.4cqw;transform:translateY(-50%)}
.v-st .v-l{background:#BF2734;height:.4cqw;margin-top:-.2cqw}
.v-tick,.v-cross,.v-sc,.v-stp{transform:translate(-50%,-50%);white-space:nowrap;line-height:1}
.v-tick,.v-cross{line-height:0}
.v-an img{display:block;width:100%;height:auto}
.v-stp.simg{transform:translate(-50%,-50%);text-decoration:none;line-height:0}
.v-sc{font:700 3.4cqw 'Kalam',cursive;color:#BF2734;border:.45cqw solid #BF2734;border-radius:50%;padding:.8cqw 1.7cqw;min-width:6.4cqw;text-align:center;transform:translate(-50%,-50%) rotate(-8deg)}
.v-stp{font:400 3.5cqw 'Kalam',cursive;color:#BF2734;text-decoration:underline;transform:translate(-50%,-50%) rotate(-6deg)}
.v-card{position:absolute;right:4%;width:266px;max-width:92%;z-index:10;background:#fff;border-radius:10px;border-top:4px solid var(--bc,#F04438);padding:10px 14px 4px;box-shadow:0 6px 18px rgba(0,0,0,.22);font-family:'Kalam',cursive;font-size:13px;line-height:1.45}
.v-card::before{content:"";position:absolute;top:-13px;left:var(--ax,80%);margin-left:-8px;border:8px solid transparent;border-top:0;border-bottom:9px solid var(--bc,#F04438)}
.v-card.up::before{top:auto;bottom:-9px;border-bottom:0;border-top:9px solid #fff}
.v-card p{margin:0 0 4px;white-space:pre-wrap;max-height:150px;overflow:auto}
.v-card.c-red{--bc:#F04438;color:#C0261D}
.v-card.c-green{--bc:#16B364;color:#087443}
.v-card.c-yellow{--bc:#EAAA2E;color:#A15C07}
.v-th{display:flex;gap:6px}
.v-th button{border:none;background:none;font-size:18px;opacity:.5;cursor:pointer;padding:4px 6px;border-radius:6px}
.v-th button.on{opacity:1;background:rgba(0,0,0,.07)}
.v-nav{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #D9DCE1;border-radius:99px;padding:5px 8px;box-shadow:0 6px 22px rgba(0,0,0,.18);z-index:30}
.v-nav button{border:none;background:none;width:30px;height:30px;border-radius:50%;font-size:18px;font-weight:700;cursor:pointer}
.v-nav button:hover{background:#EEF0FE}
.v-nav span{font-size:12.5px;font-weight:600;min-width:110px;text-align:center}
.v-hide .v-an,.v-hide .v-card,.v-hide .v-nav{display:none}
`;
export function mountViewer(root,D,onClose){
  const e=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const pc=v=>(v*100)+"%";
  const SP=D.spr||{}, spi=k=>SP[k]?'<img src="'+SP[k].src+'" alt="" draggable="false">':"", spw=(k,a)=>SP[k]?";width:"+(SP[k].cq*(a.sc||1))+"cqw":"";
  const TX=[0,2.8,3.4,4.6], PC={red:"#BF2734",green:"#1B7938"};
    const list=D.anns.filter(a=>(a.type==="box"||a.type==="underline")&&a.text&&a.text.trim()).sort((a,b)=>a.page-b.page||a.y-b.y||a.x-b.x);
  let cur=-1;
  let h='<div class="v-app"><div class="v-head">'+(onClose?'<button class="v-x" data-x title="Close">✕</button>':'<span class="v-sp"></span>')+'<button class="v-pill" data-fb>Hide Feedback</button><span class="v-sp"></span></div><div class="v-scroll"><div class="v-col">';
  D.pages.forEach((p,i)=>{
    h+='<div class="v-pg" style="aspect-ratio:'+p.w+' / '+p.h+'"><img src="'+p.src+'" alt="Page '+(i+1)+'"><div class="v-ov">';
    D.anns.filter(a=>a.page===i).forEach(a=>{
      const c=a.color||"red", has=a.text&&a.text.trim(), pos='left:'+pc(a.x)+';top:'+pc(a.y);
      if(a.type==="box"){ if(has) h+='<div class="v-an v-box c-'+c+' hc" data-id="'+a.id+'" style="'+pos+';width:'+pc(a.w)+';height:'+pc(a.h)+'"><i class="v-b"><b>'+(a.n||"")+'</b></i></div>'; }
      else if(a.type==="underline") h+='<div class="v-an v-ul c-'+c+(has?' hc':'')+'" data-id="'+a.id+'" style="'+pos+';width:'+pc(a.w)+'"><span class="v-l"></span>'+(has?'<i class="v-b"><b>•</b></i>':'')+'</div>';
      else if(a.type==="strike") h+='<div class="v-an v-st" style="'+pos+';width:'+pc(a.w)+'"><span class="v-l"></span></div>';
      else if(a.type==="text") h+='<div class="v-an v-tx c-'+c+'" style="'+pos+';width:'+pc(a.w||.4)+';text-align:'+(a.al||'left')+';font-size:'+((a.fs||[0,10,12,16][a.sz||2])*100/360)+'cqw;transform:rotate('+(a.rot||0)+'deg)">'+e(a.value)+'</div>';
      else if(a.type==="circle") h+='<div class="v-an v-ci c-'+c+'" style="'+pos+';width:'+pc(a.w)+';height:'+pc(a.h)+'"></div>';
      else if(a.type==="pen") h+='<div class="v-an v-pn" style="'+pos+';width:'+pc(a.w)+';height:'+pc(a.h)+'"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible"><polyline points="'+(a.pts||[]).map(q=>(q[0]*100).toFixed(2)+','+(q[1]*100).toFixed(2)).join(' ')+'" fill="none" stroke="'+(PC[c]||'#BF2734')+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>';
      else if(a.type==="tick") h+='<div class="v-an v-tick" style="'+pos+spw('tick',a)+'">'+spi('tick')+'</div>';
      else if(a.type==="cross") h+='<div class="v-an v-cross" style="'+pos+spw('cross',a)+'">'+spi('cross')+'</div>';
      else if(a.type==="score") h+='<div class="v-an v-sc" style="'+pos+'">'+e(a.value||"0")+'</div>';
      else if(a.type==="stamp") h+=SP[a.stamp]?'<div class="v-an v-stp simg" style="'+pos+spw(a.stamp,a)+'">'+spi(a.stamp)+'</div>':'<div class="v-an v-stp" style="'+pos+'">'+e(a.stamp)+'</div>';
    });
    h+='</div></div>';
  });
  h+='</div></div><div class="v-nav"'+(list.length?'':' hidden')+'><button data-pv title="Previous comment">‹</button><span data-nl>Comments · '+list.length+'</span><button data-nx title="Next comment">›</button></div></div>';
  root.innerHTML=h;
  const app=root.querySelector(".v-app");
  function upd(){ const l=root.querySelector("[data-nl]"); if(l) l.textContent=cur>=0?"Comment "+(cur+1)+" / "+list.length:"Comments · "+list.length; }
  function close(){ root.querySelectorAll(".v-card").forEach(x=>x.remove()); root.querySelectorAll(".v-an.on").forEach(x=>x.classList.remove("on")); }
  function open(id,scroll){
    close(); const a=D.anns.find(x=>x.id===id), el=root.querySelector('.v-an[data-id="'+id+'"]'); if(!a||!el) return;
    el.classList.add("on"); cur=list.findIndex(x=>x.id===id); upd();
    const card=document.createElement("div"); card.className="v-card c-"+(a.color||"red");
    card.innerHTML='<p>'+e(a.text)+'</p><div class="v-th"><button data-th>👍</button><button data-th>👎</button></div>';
    const bottom=a.type==="box"?a.y+a.h:a.y, bx=(a.type==="box"||a.type==="underline")?a.x+a.w:a.x;
    const pw=el.parentNode.clientWidth, cw=Math.min(266,pw*.92), cl=pw*.96-cw; let axp=bx*pw-cl; axp=Math.max(18,Math.min(cw-18,axp)); card.style.setProperty("--ax",axp+"px");
    if(bottom>0.72){ card.classList.add("up"); card.style.bottom="calc("+pc(1-a.y)+" + 22px)"; } else card.style.top="calc("+pc(bottom)+" + 22px)";
    el.parentNode.appendChild(card);
    if(scroll) el.scrollIntoView({behavior:"smooth",block:"center"});
  }
  root.addEventListener("click",ev=>{
    const t=ev.target;
    if(t.closest("[data-x]")){ if(onClose) onClose(); return; }
    if(t.closest("[data-fb]")){ const hid=app.classList.toggle("v-hide"); t.closest("[data-fb]").textContent=hid?"Show Feedback":"Hide Feedback"; close(); return; }
    const th=t.closest("[data-th]"); if(th){ const was=th.classList.contains("on"); th.parentNode.querySelectorAll("button").forEach(b=>b.classList.remove("on")); if(!was) th.classList.add("on"); return; }
    if(t.closest("[data-pv]")){ if(list.length){ cur=cur<=0?list.length-1:cur-1; open(list[cur].id,true); } return; }
    if(t.closest("[data-nx]")){ if(list.length){ cur=cur>=list.length-1?0:cur+1; open(list[cur].id,true); } return; }
    if(t.closest(".v-card")) return;
    const an=t.closest(".v-an.hc");
    if(an){ if(an.classList.contains("on")) close(); else open(an.dataset.id,false); return; }
    close();
  });
}
