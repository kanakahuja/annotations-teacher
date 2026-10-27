// JSON export/import and annotated-PDF export.
import { PDFDocument } from "../vendor/pdf-lib.esm.min.js";
import { COLORS, RED, PENC, SPR, SPRIMG } from "./config.js";
import { VIEWER_CSS, mountViewer } from "./viewer.js";
import { uid, r4, isRect, fsOf, fsCq, mkQ, numbered, totals, core, isEdited } from "./model.js";

export const SCHEMA = "redpen/v1";

export function downloadFile(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- JSON ---------- */

export function buildExport({ S, pages, fileName }) {
  const nums = numbered(S), t = totals(S);
  const annotations = S.anns.filter((a) => !a._draft)
    .slice().sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    .map((a) => {
      const o = { id: a.id, type: a.type, page: a.page + 1, question: a.q, x: r4(a.x), y: r4(a.y) };
      if (isRect(a) || a.type === "underline" || a.type === "strike" || a.type === "text") {
        o.width = r4(a.w); if (isRect(a)) o.height = r4(a.h);
      }
      if (a.type === "text") { o.text = a.value; o.font_size = fsOf(a); o.align = a.al || "left"; o.rotation = a.rot || 0; }
      if (a.type === "pen") o.points = a.pts;
      if (a.color) { o.color = a.color; if (a.type === "box" || a.type === "underline") o.polarity = COLORS[a.color].pol; }
      if (a.type === "box") o.number = nums[a.id];
      if (a.type === "box" || a.type === "underline") o.feedback = a.text;
      if (a.type === "score") o.score = a.value;
      if (a.type === "stamp") o.stamp = a.stamp;
      if (a.sc && a.sc !== 1) o.scale = a.sc;
      o.source = a.src === "ai" ? (isEdited(a) ? "ai_edited" : "ai") : "reviewer";
      return o;
    });
  return {
    schema: SCHEMA,
    file: fileName,
    exported_at: new Date().toISOString(),
    cohort: S.cohort,
    meta: S.meta,
    pages: pages.map((p) => ({ width: Math.round(p.w), height: Math.round(p.h) })),
    questions: S.questions.map((q) => {
      const o = { id: q.id, max_marks: q.max, marks_obtained: q.attempted ? q.marks : 0, attempted: q.attempted, objective: q.objective };
      if (S.cohort === "upsc") o.parameters = q.params.map((p) => ({ name: p.name, marks: p.marks }));
      return o;
    }),
    overall_summary: S.cohort === "upsc" ? S.overall : undefined,
    totals: { marks_obtained: t.got, total_marks: t.max, percent: +t.pct.toFixed(1), remark: t.remark },
    annotations,
  };
}

const TYPES = ["box", "tick", "cross", "underline", "strike", "score", "stamp", "text", "circle", "pen"];

// Loads a JSON file into S. asDraft=true marks everything as an AI draft
// (so edits are tracked); false resumes a saved review.
export function applyImport(S, json, asDraft, pageCount) {
  if (!json || !Array.isArray(json.annotations)) return { error: "No annotations in this file." };
  if (Array.isArray(json.questions) && json.questions.length) {
    S.questions = json.questions.map((q, i) => {
      const b = mkQ(q.id || i + 1, q.max_marks || 10);
      b.marks = q.marks_obtained == null ? null : q.marks_obtained;
      b.attempted = q.attempted !== false; b.objective = !!q.objective;
      if (Array.isArray(q.parameters)) b.params = q.parameters.map((p) => ({ name: p.name, marks: p.marks == null ? null : p.marks }));
      return b;
    });
  }
  if (json.cohort) S.cohort = json.cohort;
  if (json.meta) ["copyId", "test", "reviewer"].forEach((k) => { if (json.meta[k]) S.meta[k] = json.meta[k]; });
  if (json.overall_summary) S.overall = json.overall_summary;
  S.anns = json.annotations.map((o) => {
    const a = { id: uid(), type: o.type, page: Math.max(0, (o.page || 1) - 1), q: o.question || 1, x: o.x || 0, y: o.y || 0, src: asDraft ? "ai" : "reviewer" };
    if (["box", "underline", "strike", "circle", "pen", "text"].indexOf(o.type) >= 0) { a.w = o.width || 0.3; a.h = o.height || 0; }
    if (o.color) a.color = o.color;
    if (o.type === "text") { a.value = o.text || ""; a.fs = o.font_size || 12; a.al = o.align || "left"; a.rot = o.rotation || 0; if (!a.color) a.color = "red"; }
    if (o.type === "pen") a.pts = o.points || [];
    if (o.type === "box" || o.type === "underline") { a.text = o.feedback || ""; if (!a.color) a.color = "red"; }
    if (o.type === "score") a.value = String(o.score == null ? "" : o.score);
    if (o.type === "stamp") a.stamp = o.stamp || "Good";
    if (o.scale) a.sc = o.scale;
    if (asDraft) a.orig = core(a);
    return a;
  }).filter((a) => TYPES.indexOf(a.type) >= 0);
  S.aiLoaded = !!asDraft;
  return { pageMismatch: json.pages && pageCount && json.pages.length !== pageCount ? json.pages.length : 0 };
}

/* ---------- PDF ---------- */

function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function drawSpr(ctx, key, a, x, y, u) {
  const sp = SPR[key], im = SPRIMG[key];
  if (!sp || !im || !im.complete) return;
  const w = sp.cq * (a.sc || 1) * u, h = (w * sp.h) / sp.w;
  ctx.drawImage(im, x - w / 2, y - h / 2, w, h);
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  words.forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
}

function drawAnns(ctx, W, H, pi, S, nums) {
  const u = W / 100;
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  S.anns.filter((a) => a.page === pi && !a._draft).forEach((a) => {
    const x = a.x * W, y = a.y * H;
    if (a.type === "box") {
      const c = COLORS[a.color].hex;
      ctx.fillStyle = hexA(c, 0.12); ctx.strokeStyle = c; ctx.lineWidth = u * 0.28;
      ctx.fillRect(x, y, a.w * W, a.h * H); ctx.strokeRect(x, y, a.w * W, a.h * H);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, u * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `700 ${u * 1.9}px 'Reddit Sans',sans-serif`; ctx.fillText(String(nums[a.id] || ""), x, y + u * 0.05);
    } else if (a.type === "tick" || a.type === "cross") { drawSpr(ctx, a.type, a, x, y, u); }
    else if (a.type === "score") {
      ctx.font = `700 ${u * 3.4}px Kalam,cursive`;
      const txt = a.value || "0", tw = ctx.measureText(txt).width;
      ctx.strokeStyle = RED; ctx.lineWidth = u * 0.45; ctx.beginPath();
      ctx.ellipse(x, y, Math.max(tw / 2 + u * 1.6, u * 3.2), u * 2.4, -0.14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = RED; ctx.fillText(txt, x, y);
    } else if (a.type === "stamp" && SPRIMG[a.stamp]) { drawSpr(ctx, a.stamp, a, x, y, u); }
    else if (a.type === "stamp") {
      ctx.font = `400 ${u * 3.5}px Kalam,cursive`; ctx.fillStyle = RED; ctx.fillText(a.stamp, x, y);
      const tw = ctx.measureText(a.stamp).width;
      ctx.strokeStyle = RED; ctx.lineWidth = u * 0.25; ctx.beginPath(); ctx.moveTo(x - tw / 2, y + u * 2.1); ctx.lineTo(x + tw / 2, y + u * 2.1); ctx.stroke();
    } else if (a.type === "text") {
      const fpx = u * fsCq(a), maxW = (a.w || 0.4) * W, al = a.al || "left";
      ctx.save(); ctx.translate(x, y); ctx.rotate(((a.rot || 0) * Math.PI) / 180);
      ctx.textBaseline = "top"; ctx.textAlign = al; ctx.fillStyle = PENC[a.color] || RED; ctx.font = `400 ${fpx}px Kalam,cursive`;
      const tx = al === "left" ? 0 : al === "center" ? maxW / 2 : maxW; let ty = 0;
      String(a.value || "").split("\n").forEach((par) => {
        const ls = par.trim() ? wrapLines(ctx, par, maxW) : [""];
        ls.forEach((l) => { ctx.fillText(l, tx, ty); ty += fpx; });
      });
      ctx.restore(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    } else if (a.type === "circle") {
      ctx.strokeStyle = PENC[a.color] || RED; ctx.lineWidth = u * 0.4; ctx.beginPath();
      ctx.ellipse(x + (a.w * W) / 2, y + (a.h * H) / 2, (a.w * W) / 2, (a.h * H) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (a.type === "pen") {
      ctx.strokeStyle = PENC[a.color] || RED; ctx.lineWidth = u * 0.45; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      (a.pts || []).forEach((q, k) => { const px = (a.x + q[0] * a.w) * W, py = (a.y + q[1] * a.h) * H; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
      ctx.stroke();
    } else if (a.type === "underline" || a.type === "strike") {
      ctx.strokeStyle = a.type === "strike" ? RED : COLORS[a.color].hex; ctx.lineWidth = u * (a.type === "strike" ? 0.4 : 0.36); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a.w * W, y); ctx.stroke();
    }
  });
}

// Returns a PDF Blob: the original pages with all annotations burned in.
export async function exportPdf({ S, pages }) {
  await Promise.all([document.fonts.load("400 24px Kalam"), document.fonts.load("700 24px Kalam"), document.fonts.load("700 24px 'Reddit Sans'")]);
  await Promise.all(Object.values(SPRIMG).map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  const nums = numbered(S), doc = await PDFDocument.create(), W = 1400, PT = 595;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i], H = Math.round((W * p.h) / p.w);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    if (p.kind === "img") ctx.drawImage(p.img, 0, 0, W, H);
    else { const vp = p.page.getViewport({ scale: W / p.w }); await p.page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise; }
    drawAnns(ctx, W, H, i, S, nums);
    const b64 = c.toDataURL("image/jpeg", 0.9).split(",")[1];
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const img = await doc.embedJpg(bytes);
    const pg = doc.addPage([PT, (PT * H) / W]);
    pg.drawImage(img, { x: 0, y: 0, width: PT, height: (PT * H) / W });
  }
  const out = await doc.save();
  return new Blob([out], { type: "application/pdf" });
}

/* ---------- HTML (standalone viewer) ---------- */

const toDataURL = async (url) => {
  const blob = await (await fetch(url)).blob();
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
};

async function pageImages(pages, W) {
  const out = [];
  for (const p of pages) {
    const H = Math.round((W * p.h) / p.w), c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    if (p.kind === "img") ctx.drawImage(p.img, 0, 0, W, H);
    else { const vp = p.page.getViewport({ scale: W / p.w }); await p.page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise; }
    out.push(c.toDataURL("image/jpeg", 0.82));
  }
  return out;
}

// One self-contained .html file: page images, annotations and viewer script.
export async function buildHtml({ S, pages, title }) {
  const imgs = await pageImages(pages, 1000), nums = numbered(S), spr = {};
  for (const k of Object.keys(SPR)) spr[k] = { ...SPR[k], src: await toDataURL(SPR[k].src) };
  const D = {
    spr,
    pages: pages.map((p, i) => ({ src: imgs[i], w: Math.round(p.w), h: Math.round(p.h) })),
    anns: S.anns.filter((a) => !a._draft && !(a.type === "box" && !a.text.trim())).map((a) => ({
      id: a.id, type: a.type, page: a.page, q: a.q, x: a.x, y: a.y, w: a.w || 0, h: a.h || 0, color: a.color,
      text: a.text || "", value: a.value, stamp: a.stamp, sz: a.sz, fs: a.fs, al: a.al, rot: a.rot, pts: a.pts, sc: a.sc, n: nums[a.id],
    })),
  };
  const json = JSON.stringify(D).replace(/</g, "\\u003c");
  const t = String(title || "Annotated copy").replace(/[<>&"]/g, "");
  return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + t + "</title>"
    + "<link href=\"https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Reddit+Sans:wght@400;500;600;700;800&display=swap\" rel=\"stylesheet\">"
    + "<style>" + VIEWER_CSS + "#root{position:fixed;inset:0}</style></head><body><div id=\"root\"></div><script>"
    + "const D=" + json + ";(" + mountViewer.toString() + ")(document.getElementById('root'),D,null);<\/script></body></html>";
}
