// App-wide settings and constants.

export const CONFIG = {
  name: "Redpen",
  // Optional. If set, "Submit" POSTs the review JSON here (JSON body).
  // Leave empty to download the JSON instead.
  submitUrl: "",
  submitHeaders: {},
};

export const STAMPS = ["Good", "Very Good", "Incomplete", "Irrelevant", "Needs more detail"];

export const COLORS = {
  red:    { label: "Mistake",     hex: "#F04438", pol: "negative" },
  yellow: { label: "Improve",     hex: "#EAAA2E", pol: "neutral" },
  green:  { label: "Correct",     hex: "#16B364", pol: "positive" },
};

export const RED = "#BF2734";
export const PENC = { red: "#BF2734", green: "#1B7938" };

// Hand-drawn sprites. cq = display width in % of page width.
const sp = (file, w, h, cq) => ({ src: "assets/sprites/" + file, w, h, cq });
export const SPR = {
  "tick":       sp("tick.png", 152, 100, 7.5),
  "cross":      sp("cross.png", 142, 112, 7.1),
  "Very Good":  sp("very-good.png", 162, 132, 9.3),
  "Good":       sp("good.png", 130, 98, 7.5),
  "Incomplete": sp("incomplete.png", 252, 110, 14.5),
  "Irrelevant": sp("irrelevant.png", 220, 106, 12.7),
};
export const SPRIMG = {};
if (typeof Image !== "undefined") {
  Object.keys(SPR).forEach((k) => { const im = new Image(); im.src = SPR[k].src; SPRIMG[k] = im; });
}

export const TOOLS = [
  { id: "select",    ic: "↖", label: "Select",    hint: "Click a mark to edit. Drag to move." },
  { id: "box",       ic: "▭", label: "Box",       hint: "Drag to draw a box. Feedback is required." },
  { id: "tick",      ic: `<img src="${SPR.tick.src}" alt="">`,  label: "Tick",  hint: "Click to place a tick." },
  { id: "cross",     ic: `<img src="${SPR.cross.src}" alt="">`, label: "Cross", hint: "Click to place a cross." },
  { id: "underline", ic: "<span class='u'>U</span>", label: "Underline", hint: "Drag along text. Select it to add a comment." },
  { id: "strike",    ic: "<span class='s'>S</span>", label: "Strike",    hint: "Drag across text to strike it." },
  { id: "score",     ic: "⓪", label: "Score",     hint: "Click, then enter the marks." },
  { id: "stamp",     ic: "✎", label: "Stamp",     hint: "Pick a stamp, then click. One per question." },
  { id: "text",      ic: "<span class='aa'>Aa</span>", label: "Write", hint: "Click and type. Enter adds a line." },
  { id: "circle",    ic: "◯", label: "Circle",    hint: "Drag around a word." },
  { id: "pen",       ic: "✒", label: "Pen",       hint: "Draw freely." },
  { id: "eraser",    ic: "🗑", label: "Delete",    hint: "Click a mark to delete it." },
];
