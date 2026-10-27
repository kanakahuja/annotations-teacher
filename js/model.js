// Pure data helpers. No DOM access.

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const r4 = (v) => Math.round(v * 10000) / 10000;

export const RECT = ["box", "circle", "pen"];
export const isRect = (a) => RECT.indexOf(a.type) >= 0;

// Text size is stored in px relative to a 360px-wide page.
export const fsOf = (a) => a.fs || [0, 10, 12, 16][a.sz || 2];
export const fsCq = (a) => (fsOf(a) * 100) / 360;

export const mkQ = (id, max) => ({
  id, max: max || 10, marks: null, attempted: true, objective: false,
  params: [
    { name: "Introduction", marks: null },
    { name: "Content", marks: null },
    { name: "Conclusion", marks: null },
  ],
});

export function fresh(reviewer) {
  return {
    meta: { copyId: "", test: "", reviewer: reviewer || "" },
    cohort: "foundation",
    questions: [mkQ(1), mkQ(2), mkQ(3)],
    overall: "",
    anns: [],
    aiLoaded: false,
  };
}

// Box numbers: by page, then top to bottom, then left to right.
export function numbered(S) {
  const m = {};
  S.anns.filter((a) => a.type === "box" && !a._draft)
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    .forEach((b, i) => (m[b.id] = i + 1));
  return m;
}

export function remark(p) {
  return p >= 90 ? "Excellent" : p >= 60 ? "Very Good" : p >= 40 ? "Good Effort" : "Keep Practicing";
}

export function totals(S) {
  let got = 0, max = 0;
  S.questions.forEach((q) => { max += q.max; got += q.attempted ? +q.marks || 0 : 0; });
  const pct = max ? (got / max) * 100 : 0;
  return { got: Math.round(got * 100) / 100, max, pct, remark: remark(pct) };
}

// Fingerprint used to flag edits to an imported AI annotation.
export function core(a) {
  return JSON.stringify([a.type, a.page, r4(a.x), r4(a.y), r4(a.w || 0), r4(a.h || 0),
    a.color || "", a.text || "", a.value || "", a.stamp || "", a.q]);
}
export const isEdited = (a) => a.src === "ai" && a.orig && a.orig !== core(a);
