"use strict";
/* Skizzen und Messen im Plan. Der Stift (Apple Pencil) zeichnet immer, der Finger schiebt und zoomt.
   Strecke/Fläche brauchen einen Maßstab (Auswahl oder Kalibrieren), sonst wären es nur Pixelwerte.
   Alles liegt getrennt vom PDF nur in diesem Gerät (IndexedDB). Das Original in OneDrive wird nie verändert.
   Koordinaten werden als Bruchteil der Seite gespeichert (0..1), damit sie bei jedem Zoom an der richtigen Stelle sitzen. */
const Ink = (() => {
  const DB = "baustellen-skizzen", ST = "plaene";
  const S = { key: null, strokes: [], hist: [], draw: false, erase: false, color: "#d62828", alpha: 1, wpx: 4, mult: 1,
              visible: true, cur: null, pid: null, pen: false, erased: [], last: null,
              tool: null, measure: null, calib: null, pendingTool: null, scale: null };
  let dbp = null, saveT = null, raf = 0;

  /* ---- Speicher ---- */
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction(ST, mode); const q = fn(t.objectStore(ST)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
  };
  const persist = async (key, strokes, mProPt) => {
    try { if (strokes.length || mProPt) await tx("readwrite", (s) => s.put({ strokes, mProPt: mProPt || null, updated: Date.now() }, key)); else await tx("readwrite", (s) => s.delete(key)); }
    catch (e) { console.warn("Skizze konnte nicht gespeichert werden", e); }
  };
  const save = () => { clearTimeout(saveT); const k = S.key, st = S.strokes, sc = S.scale; saveT = setTimeout(() => persist(k, st, sc), 300); };
  async function listNonEmptyKeys() {   // eigene Abfrage, damit nur Pläne mit sichtbarem Inhalt die Marke "Skizze" bekommen
    const d = await db();
    return new Promise((resolve, reject) => {
      const out = [], t = d.transaction(ST, "readonly"), req = t.objectStore(ST).openCursor();
      req.onsuccess = () => { const cur = req.result; if (cur) { if (cur.value && cur.value.strokes && cur.value.strokes.length) out.push(cur.key); cur.continue(); } };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
    });
  }
  const keys = async () => { try { return await listNonEmptyKeys(); } catch { return []; } };

  /* ---- Zeichnen auf der Ink-Ebene ---- */
  const cv = () => document.getElementById("v-ink");
  const dprOf = () => window.devicePixelRatio || 1;
  function strokePath(ctx, st, X, Y, W) {
    const p = st.p;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = st.c; ctx.globalAlpha = st.a; ctx.lineWidth = Math.max(0.8, st.w * W);
    ctx.beginPath();
    ctx.moveTo(X(p[0][0]), Y(p[0][1]));
    if (p.length === 1) ctx.lineTo(X(p[0][0]) + 0.01, Y(p[0][1]));
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(X(p[i][0]), Y(p[i][1]), (X(p[i][0]) + X(p[i + 1][0])) / 2, (Y(p[i][1]) + Y(p[i + 1][1])) / 2);
    if (p.length > 1) ctx.lineTo(X(p[p.length - 1][0]), Y(p[p.length - 1][1]));
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  /* Strecke/Fläche: Linie/Fläche + Beschriftung. `ps` ist "Ausgabepixel je Seiteneinheit" (Bildschirm: Pixeldichte; Export: Bildauflösung). */
  function drawMeasureShape(ctx, st, X, Y, ps) {
    const pts = st.p.map((p) => [X(p[0]), Y(p[1])]);
    if (!pts.length) return;
    if (pts.length === 1) { ctx.fillStyle = "#0a58ca"; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 3 * ps, 0, 7); ctx.fill(); return; }
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = "#0a58ca"; ctx.lineWidth = 2.5 * ps;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (st.closed) { ctx.closePath(); ctx.fillStyle = "rgba(10,88,202,0.15)"; ctx.fill(); }
    ctx.stroke();
    ctx.fillStyle = "#0a58ca";
    for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 3 * ps, 0, 7); ctx.fill(); }
    if (st.label) {
      const c = st.closed ? pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]) : pts[pts.length - 1];
      ctx.font = `${Math.round(13 * ps)}px system-ui, sans-serif`;
      const tw = ctx.measureText(st.label).width, pad = 5 * ps, hh = 10 * ps;
      ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillRect(c[0] - tw / 2 - pad, c[1] - hh - pad, tw + 2 * pad, 2 * hh + 2 * pad);
      ctx.strokeStyle = "#0a58ca"; ctx.lineWidth = 1 * ps; ctx.strokeRect(c[0] - tw / 2 - pad, c[1] - hh - pad, tw + 2 * pad, 2 * hh + 2 * pad);
      ctx.fillStyle = "#0a58ca"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(st.label, c[0], c[1]);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
  }
  function redraw() {
    const c = cv(), d = dprOf(), w = Math.round(vw().clientWidth * d), h = Math.round(vw().clientHeight * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (!S.visible || !V.pg || !V.w) return;
    const X = (nx) => (V.tx + nx * V.w * V.s) * d, Y = (ny) => (V.ty + ny * V.h * V.s) * d, W = V.w * V.s * d;
    for (const st of S.strokes) {
      if (st.pg !== V.page) continue;
      if (st.type === "mline" || st.type === "marea") drawMeasureShape(ctx, st, X, Y, d);
      else strokePath(ctx, st, X, Y, W);
    }
    if (S.cur) strokePath(ctx, S.cur, X, Y, W);
    if (S.measure && S.measure.pg === V.page && S.measure.p.length) {
      drawMeasureShape(ctx, { p: S.measure.p, closed: S.tool === "marea" && S.measure.p.length > 2, label: shapeLabel(S.tool, S.measure.p) }, X, Y, d);
    }
    if (S.tool === "calib" && S.calib && S.calib.length) {
      const pts = S.calib.map((p) => [X(p[0]), Y(p[1])]);
      ctx.fillStyle = "#c026d3"; ctx.strokeStyle = "#c026d3"; ctx.lineWidth = 2 * d; ctx.setLineDash([6 * d, 4 * d]);
      for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 5 * d, 0, 7); ctx.fill(); }
      if (pts.length === 2) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke(); }
      ctx.setLineDash([]);
    }
  }
  const frame = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); }); };

  /* ---- Maßeinheiten: PDF-Punkte der Seite (V.baseW/V.baseH) x Meter je Punkt (S.scale) ---- */
  const ptFrom = (n) => [n[0] * V.baseW, n[1] * V.baseH];
  function polyLen(pts, closed) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) { const [ax, ay] = ptFrom(pts[i - 1]), [bx, by] = ptFrom(pts[i]); s += Math.hypot(ax - bx, ay - by); }
    if (closed && pts.length > 2) { const [ax, ay] = ptFrom(pts[pts.length - 1]), [bx, by] = ptFrom(pts[0]); s += Math.hypot(ax - bx, ay - by); }
    return S.scale ? s * S.scale : s;
  }
  function polyArea(pts) {
    if (pts.length < 3) return 0;
    const P = pts.map(ptFrom);
    let a = 0;
    for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; }
    const areaPt2 = Math.abs(a) / 2;
    return S.scale ? areaPt2 * S.scale * S.scale : areaPt2;
  }
  const fmtLen = (m) => nf(m, m < 10 ? 2 : 1, m < 10 ? 2 : 1) + " m";
  const fmtArea = (a) => nf(a, a < 10 ? 2 : 1, a < 10 ? 2 : 1) + " m²";
  const shapeLabel = (tool, pts) => (tool === "mline" ? fmtLen(polyLen(pts)) : fmtArea(polyArea(pts)));
  function measureText() {
    if (!S.measure || !S.measure.p.length) return "Ersten Punkt antippen";
    const n = S.measure.p.length;
    if (S.tool === "mline") return shapeLabel("mline", S.measure.p) + (n < 2 ? " – noch einen Punkt" : "");
    if (n < 3) return "Noch " + (3 - n) + (3 - n > 1 ? " Punkte für eine Fläche" : " Punkt für eine Fläche");
    return shapeLabel("marea", S.measure.p) + " · Umfang " + fmtLen(polyLen(S.measure.p, true));
  }

  /* ---- Eingabe ---- */
  const toN = (x, y) => [(x - V.tx) / (V.w * V.s), (y - V.ty) / (V.h * V.s)];
  function eraseAt(x, y) {
    const sc = V.w * V.s, keep = [];
    for (const st of S.strokes) {
      if (st.pg !== V.page) { keep.push(st); continue; }
      const P = st.p.map((q) => [V.tx + q[0] * sc, V.ty + q[1] * V.h * V.s]);
      const segs = P.length > 1 ? P.length - (st.closed ? 0 : 1) : 0, r = 16 + ((st.w || 0.006) * sc) / 2;
      let hit = P.length === 1 ? Math.hypot(P[0][0] - x, P[0][1] - y) <= r : false;
      for (let i = 0; i < segs && !hit; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        hit = Math.hypot(ax + t * dx - x, ay + t * dy - y) <= r;
      }
      if (hit) S.erased.push(st); else keep.push(st);
    }
    S.strokes = keep;
  }
  /* Gibt true zurück, wenn Ink das Ereignis behandelt (dann macht der Viewer kein Schieben/Zoomen). */
  function down(e, [x, y]) {
    if (!V.pg) return false;
    if (S.tool === "mline" || S.tool === "marea" || S.tool === "calib") {
      if (S.pid !== null) return true;   // Handballen/zweiten Finger ignorieren
      S.pid = e.pointerId;
      if (S.tool === "calib") addCalibPoint(x, y); else addMeasurePoint(x, y);
      return true;
    }
    if (S.pid !== null && S.pen && e.pointerType === "touch") return true;   // Handballen ignorieren, solange der Stift zeichnet
    if (!S.erase && !(e.pointerType === "pen" || S.draw)) return false;   // Radieren geht immer per Finger, Zeichnen nur mit Stift oder "mit Finger zeichnen"
    S.pid = e.pointerId; S.pen = e.pointerType === "pen"; S.erased = []; S.last = [x, y];
    if (S.erase) eraseAt(x, y);
    else { const [nx, ny] = toN(x, y); S.cur = { pg: V.page, c: S.color, a: S.alpha, w: (S.wpx * S.mult) / (V.w * V.s), p: [[nx, ny]] }; }
    frame(); return true;
  }
  function move(e, rel) {
    if (S.tool === "mline" || S.tool === "marea" || S.tool === "calib") return S.pid === e.pointerId;   // Punkt sitzt schon, Ziehen tut nichts
    if (S.pid !== e.pointerId) return false;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = rel(ev);
      if (S.erase) {   // ganzen Weg seit dem letzten Punkt prüfen, damit schnelles Wischen nichts überspringt
        const [x0, y0] = S.last || [x, y], n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 6));
        for (let i = 1; i <= n; i++) eraseAt(x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n);
        S.last = [x, y];
      } else if (S.cur) { const q = toN(x, y), l = S.cur.p[S.cur.p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) * V.w * V.s > 0.8) S.cur.p.push(q); }
    }
    frame(); return true;
  }
  function up(e) {
    if (S.tool === "mline" || S.tool === "marea" || S.tool === "calib") {
      if (S.pid !== e.pointerId) return false;
      S.pid = null; return true;
    }
    if (S.pid !== e.pointerId) return false;
    S.pid = null;
    if (S.erase) { if (S.erased.length) { S.hist.push({ t: "del", list: S.erased }); save(); } S.erased = []; }
    else if (S.cur) { S.strokes.push(S.cur); S.hist.push({ t: "add", s: S.cur }); S.cur = null; save(); }
    frame(); updateUi(); return true;
  }
  const undo = () => {
    const h = S.hist.pop();
    if (!h) return;
    if (h.t === "add") S.strokes = S.strokes.filter((s) => s !== h.s); else S.strokes.push(...h.list);
    save(); redraw(); updateUi();
  };

  /* ---- Strecke/Fläche: Punkt für Punkt ---- */
  function addMeasurePoint(x, y) {
    if (!S.measure) S.measure = { type: S.tool, pg: V.page, p: [] };
    S.measure.p.push(toN(x, y));
    frame(); renderBar();
  }
  function removeLastMeasurePoint() {
    if (!S.measure) return;
    S.measure.p.pop();
    if (!S.measure.p.length) S.measure = null;
    frame(); renderBar();
  }
  function cancelMeasure() { S.measure = null; frame(); renderBar(); }
  function finishMeasure() {
    if (!S.measure) return;
    const n = S.measure.p.length;
    if ((S.tool === "mline" && n < 2) || (S.tool === "marea" && n < 3)) return;
    const st = { pg: S.measure.pg, type: S.tool, closed: S.tool === "marea", p: S.measure.p, label: shapeLabel(S.tool, S.measure.p), w: 4 / (V.w * V.s) };
    S.strokes.push(st); S.hist.push({ t: "add", s: st });
    S.measure = null; save(); frame(); renderBar(); updateUi();
  }
  function renderBar() {
    const box = document.getElementById("v-msg");
    if (S.tool !== "mline" && S.tool !== "marea") { if (box.dataset.mbar) { box.innerHTML = ""; delete box.dataset.mbar; } return; }
    box.dataset.mbar = "1";
    const n = S.measure ? S.measure.p.length : 0, minOk = S.tool === "mline" ? n >= 2 : n >= 3;
    box.innerHTML = `<div class="v-mbar"><span class="v-mval">${measureText()}</span>
      <button id="mv-back" ${n ? "" : "disabled"}>↶ Punkt</button>
      <button id="mv-done" ${minOk ? "" : "disabled"}>Fertig</button>
      <button id="mv-cancel">Abbrechen</button></div>`;
    document.getElementById("mv-back").onclick = removeLastMeasurePoint;
    document.getElementById("mv-done").onclick = finishMeasure;
    document.getElementById("mv-cancel").onclick = cancelMeasure;
  }
  function selectTool(t) {
    const turningOn = S.tool !== t;
    if (turningOn && !S.scale) { S.pendingTool = t; openScalePanel(); return; }
    S.draw = false; S.erase = false;
    cancelMeasure();
    S.tool = turningOn ? t : null;
    updateUi(); renderBar();
  }
  function pageChanged() {   // Seite gewechselt (nicht nur Fenstergröße): unfertige Messung verwerfen, sie gehörte zur alten Seite
    if (S.measure && S.measure.pg !== V.page) cancelMeasure();
    if (S.tool === "calib") S.calib = [];
  }

  /* ---- Maßstab: Dropdown oder Kalibrieren (zwei Punkte antippen, echte Länge eingeben) ---- */
  function openScalePanel() {
    document.getElementById("v-scale").hidden = false;
    const denom = S.scale ? Math.round((S.scale * 72) / 0.0254) : "";
    const sel = document.getElementById("v-scale-sel");
    sel.value = [...sel.options].some((o) => o.value === String(denom)) ? String(denom) : "";
  }
  function closeScalePanel() { document.getElementById("v-scale").hidden = true; S.pendingTool = null; }
  function applyScaleDenom(denomStr) {
    const denom = parseFloat(String(denomStr).replace(",", "."));
    if (!denom || denom <= 0) return;
    S.scale = (0.0254 / 72) * denom;
    afterScaleSet("1 : " + denom);
  }
  function afterScaleSet(text) {
    save();
    document.getElementById("v-scale").hidden = true;
    vmsg("Maßstab " + text + " übernommen."); setTimeout(() => vmsg(""), 2000);
    if (S.pendingTool) { S.tool = S.pendingTool; S.pendingTool = null; updateUi(); renderBar(); }
  }
  function startCalibration() {
    document.getElementById("v-scale").hidden = true;
    S.calib = []; S.tool = "calib";
    vmsg("Anfang und Ende einer bekannten Strecke antippen.");
  }
  function addCalibPoint(x, y) {
    S.calib.push(toN(x, y));
    if (S.calib.length === 2) {
      const [ax, ay] = ptFrom(S.calib[0]), [bx, by] = ptFrom(S.calib[1]), dPt = Math.hypot(ax - bx, ay - by);
      const real = prompt("Wie lang ist diese Strecke in Metern?", "");
      const val = real ? parseFloat(real.replace(",", ".")) : null;
      const restore = S.pendingTool;
      S.calib = null; S.tool = null; S.pendingTool = null;
      if (val && val > 0 && dPt > 0) { S.scale = val / dPt; afterScaleSet("kalibriert"); if (restore) { S.tool = restore; updateUi(); renderBar(); } }
      else { vmsg("Kalibrierung abgebrochen."); setTimeout(() => vmsg(""), 2000); updateUi(); }
    }
    frame();
  }

  /* ---- Oberfläche ---- */
  function updateUi() {
    const q = (id) => document.getElementById(id);
    q("t-draw").classList.toggle("on", S.draw);
    q("t-erase").classList.toggle("on", S.erase);
    q("t-mline").classList.toggle("on", S.tool === "mline");
    q("t-marea").classList.toggle("on", S.tool === "marea");
    q("t-eye").classList.toggle("on", !S.visible);
    q("t-eye").textContent = S.visible ? "◉" : "◌";
    q("t-undo").disabled = !S.hist.length;
    q("t-clear").disabled = !S.strokes.length;
    document.querySelectorAll("#v-tools [data-c]").forEach((b) => b.classList.toggle("on", !S.erase && b.dataset.c === S.color));
    document.querySelectorAll("#v-tools [data-w]").forEach((b) => b.classList.toggle("on", +b.dataset.w === S.wpx));
  }
  function init() {
    const on = (id, f) => { document.getElementById(id).onclick = f; };
    on("t-draw", () => { S.draw = !S.draw; if (S.draw) { S.erase = false; S.tool = null; cancelMeasure(); } updateUi(); vmsg(S.draw ? "Zeichnen mit Finger an. Zum Verschieben und Zoomen wieder ausschalten." : ""); setTimeout(() => vmsg(""), 2500); });
    on("t-erase", () => { S.erase = !S.erase; if (S.erase) { S.draw = false; S.tool = null; cancelMeasure(); } updateUi(); });
    on("t-mline", () => selectTool("mline"));
    on("t-marea", () => selectTool("marea"));
    on("t-scale", () => { S.pendingTool = null; openScalePanel(); });
    on("v-scale-close", closeScalePanel);
    on("v-scale-calib", startCalibration);
    document.getElementById("v-scale-sel").onchange = (e) => { if (e.target.value) applyScaleDenom(e.target.value); };
    on("t-undo", undo);
    on("t-eye", () => { S.visible = !S.visible; redraw(); updateUi(); });
    on("t-clear", () => {
      if (!S.strokes.length) return;
      if (confirm(`Alle ${S.strokes.length} Skizzen/Messungen auf diesem Plan löschen? Der Plan selbst bleibt unverändert.`)) { S.strokes = []; S.hist = []; save(); redraw(); updateUi(); }
    });
    on("t-share", share);
    document.querySelectorAll("#v-tools [data-c]").forEach((b) => (b.onclick = () => {
      S.erase = false; S.tool = null; cancelMeasure();
      S.color = b.dataset.c; S.alpha = +(b.dataset.a || 1); S.mult = +(b.dataset.m || 1); updateUi();
    }));
    document.querySelectorAll("#v-tools [data-w]").forEach((b) => (b.onclick = () => { S.tool = null; cancelMeasure(); S.wpx = +b.dataset.w; updateUi(); }));
  }

  /* ---- Öffnen, Schließen, Liste ---- */
  async function open(key) {
    S.key = key; S.strokes = []; S.hist = []; S.cur = null; S.pid = null; S.visible = true; S.erase = false; S.draw = false;
    S.tool = null; S.measure = null; S.calib = null; S.pendingTool = null; S.scale = null;
    document.getElementById("v-scale").hidden = true; renderBar();
    updateUi();
    try { const r = await tx("readonly", (s) => s.get(key)); if (r && S.key === key) { S.strokes = r.strokes || []; S.scale = r.mProPt || null; updateUi(); redraw(); } } catch { /* ohne Speicher weiterarbeiten */ }
  }
  async function close() {
    clearTimeout(saveT);
    if (S.key) await persist(S.key, S.strokes, S.scale);
    S.key = null; S.strokes = []; S.hist = []; S.cur = null; S.pid = null; S.tool = null; S.measure = null; S.calib = null;
    const c = cv(); c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }

  /* ---- Teilen: kommentierte Fassung als PDF (Originaldatei bleibt unberührt) ---- */
  function bildAlsPdf(jpeg, wPx, hPx, wPt, hPt) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
    const f = (n) => n.toFixed(2);
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(wPt)} ${f(hPt)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
    const content = `q ${f(wPt)} 0 0 ${f(hPt)} 0 0 cm /Im0 Do Q`;
    obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offs[5] = len;
    push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg); push("\nendstream\nendobj\n");
    const xref = len;
    let x = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    push(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len);
    let o = 0;
    for (const b of parts) { out.set(b, o); o += b.length; }
    return out;
  }
  async function baueDatei() {
    const stem = V.name.replace(/\.pdf$/i, "");
    const mine = S.strokes.filter((s) => s.pg === V.page);
    if (!mine.length) return new File([V.bytes], V.name, { type: "application/pdf" });   // keine Skizze/Messung: Original unverändert
    const base = V.pg.getViewport({ scale: 1 });
    const k = Math.min(4096 / base.width, Math.sqrt(10e6 / (base.width * base.height)));
    const c = document.createElement("canvas");
    c.width = Math.round(base.width * k); c.height = Math.round(base.height * k);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await V.pg.render({ canvasContext: ctx, viewport: V.pg.getViewport({ scale: k }) }).promise;
    const X = (nx) => nx * c.width, Y = (ny) => ny * c.height;
    for (const st of mine) {
      if (st.type === "mline" || st.type === "marea") drawMeasureShape(ctx, st, X, Y, k);
      else strokePath(ctx, st, X, Y, c.width);
    }
    const jpg = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const pdf = bildAlsPdf(new Uint8Array(await jpg.arrayBuffer()), c.width, c.height, base.width, base.height);
    const seite = V.doc.numPages > 1 ? `_Seite${V.page}` : "";
    return new File([pdf], `${stem}${seite}_kommentiert_${new Date().toISOString().slice(0, 10)}.pdf`, { type: "application/pdf" });
  }
  function download(file) {
    const u = URL.createObjectURL(file), a = document.createElement("a");
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  async function senden(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); return; }
    download(file);
  }
  let sharing = false;
  async function share() {
    if (!V.pg || !V.bytes || sharing) return;   // Doppel-Tipp: nicht zwei Exporte gleichzeitig auf derselben Seite rendern
    sharing = true;
    try { await shareInner(); } finally { sharing = false; }
  }
  async function shareInner() {
    const skizze = S.strokes.some((s) => s.pg === V.page);
    vmsg(skizze ? "Kommentierte Fassung wird erstellt …" : "");
    let file;
    try { file = await baueDatei(); } catch (e) { vmsg("Das hat nicht geklappt: " + (e.message || e)); return; }
    vmsg("");
    try { await senden(file); }
    catch (e) {
      if (e && e.name === "AbortError") return;
      // iOS verlangt manchmal einen frischen Tipp, wenn das Erstellen länger gedauert hat
      const box = document.getElementById("v-msg");
      box.innerHTML = `<button class="v-send">${skizze ? "Kommentierte Fassung senden" : "Plan senden"}</button>`;
      box.querySelector("button").onclick = async () => { box.innerHTML = ""; try { await senden(file); } catch { download(file); } };
    }
  }

  init();
  return { down, move, up, redraw, open, close, keys, pageChanged };
})();
