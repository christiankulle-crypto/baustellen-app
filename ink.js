"use strict";
/* Skizzen und Messen im Plan. Der Stift (Apple Pencil) zeichnet immer, der Finger schiebt und zoomt.
   Strecke/Fläche brauchen einen Maßstab (Auswahl oder Kalibrieren), sonst wären es nur Pixelwerte.
   Alles liegt getrennt vom PDF nur in diesem Gerät (IndexedDB). Das Original in OneDrive wird nie verändert.
   Koordinaten werden als Bruchteil der Seite gespeichert (0..1), damit sie bei jedem Zoom an der richtigen Stelle sitzen. */
const Ink = (() => {
  const DB = "baustellen-skizzen", ST = "plaene";
  const S = { key: null, strokes: [], hist: [], draw: false, erase: false, color: "#d62828", alpha: 1, wpx: 4, mult: 1,
              visible: true, cur: null, pid: null, pen: false, erased: [], last: null,
              tool: null, measure: null, calib: null, pendingTool: null, scale: null, dragPt: null };
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
  /* Text: Größe als Bruchteil der Seitenbreite (wächst beim Zoomen mit wie die Skizzen), weiß hinterlegt zum Lesen */
  let mctx = null;
  function textMass(st, W) {   // Maße in Ausgabepixeln; W = Seitenbreite in Ausgabepixeln
    const fs = st.fs * W, zeilen = st.t.split("\n"), pad = fs * 0.25;
    mctx = mctx || document.createElement("canvas").getContext("2d");
    mctx.font = `600 ${fs}px system-ui, sans-serif`;
    return { fs, zeilen, pad, w: Math.max(...zeilen.map((z) => mctx.measureText(z).width)) + 2 * pad, h: zeilen.length * fs * 1.25 + 2 * pad };
  }
  function drawText(ctx, st, X, Y, W) {
    const m = textMass(st, W), x = X(st.p[0][0]), y = Y(st.p[0][1]);
    ctx.fillStyle = st.m ? "rgba(255,214,10,.75)" : "rgba(255,255,255,.85)";
    ctx.fillRect(x, y, m.w, m.h);
    ctx.font = `600 ${m.fs}px system-ui, sans-serif`; ctx.fillStyle = st.m ? "#111111" : st.c; ctx.textBaseline = "top";
    m.zeilen.forEach((z, i) => ctx.fillText(z, x + m.pad, y + m.pad + i * m.fs * 1.25 + m.fs * 0.12));
    ctx.textBaseline = "alphabetic";
  }
  /* Formen: p = [Startpunkt, Endpunkt] (Rechteck/Kreis = gegenüberliegende Ecken des Rahmens, Pfeil = Anfang → Spitze) */
  const FORMEN = ["rechteck", "kreis", "pfeil"];
  function drawForm(ctx, st, X, Y, W) {
    const [a, b] = st.p, x0 = X(a[0]), y0 = Y(a[1]), x1 = X(b[0]), y1 = Y(b[1]), lw = Math.max(0.8, st.w * W);
    ctx.save();
    ctx.strokeStyle = st.c; ctx.fillStyle = st.c; ctx.globalAlpha = st.a; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    if (st.form === "rechteck") { ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.stroke(); }
    else if (st.form === "kreis") { ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    else {   // Pfeil: Linie bis kurz vor die Spitze, dann gefülltes Dreieck
      const ang = Math.atan2(y1 - y0, x1 - x0), h = Math.min(Math.max(lw * 4.5, 7), Math.hypot(x1 - x0, y1 - y0) * 0.6);
      ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(ang) * h * 0.7, y1 - Math.sin(ang) * h * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - h * Math.cos(ang - 0.45), y1 - h * Math.sin(ang - 0.45));
      ctx.lineTo(x1 - h * Math.cos(ang + 0.45), y1 - h * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function formPunkte(st) {   // Umriss als Punktfolge (für den Radierer)
    const [a, b] = st.p;
    if (st.form === "pfeil") return [a, b];
    if (st.form === "rechteck") return [a, [b[0], a[1]], b, [a[0], b[1]]];
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
    return Array.from({ length: 36 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 18), cy + ry * Math.sin((i * Math.PI) / 18)]);
  }
  function zeichne(ctx, st, X, Y, W, ps) {
    if (st.type === "mline" || st.type === "marea") drawMeasureShape(ctx, st, X, Y, ps);
    else if (st.type === "text") drawText(ctx, st, X, Y, W);
    else if (st.type === "form") drawForm(ctx, st, X, Y, W);
    else strokePath(ctx, st, X, Y, W);
  }
  function redraw() {
    const c = cv(), d = dprOf(), w = Math.round(vw().clientWidth * d), h = Math.round(vw().clientHeight * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    positionEditor();
    if (!S.visible || !V.pg || !V.w) return;
    const X = (nx) => (V.tx + nx * V.w * V.s) * d, Y = (ny) => (V.ty + ny * V.h * V.s) * d, W = V.w * V.s * d;
    for (const st of S.strokes) {
      if (st.pg !== V.page || (S.edit && S.edit.st === st)) continue;   // Text in Bearbeitung zeigt nur das Eingabefeld
      zeichne(ctx, st, X, Y, W, d);
    }
    if (S.cur) zeichne(ctx, S.cur, X, Y, W, d);
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
      if (st.type === "text") { (textHit(st, x, y) ? S.erased : keep).push(st); continue; }
      const form = st.type === "form", closed = form ? st.form !== "pfeil" : st.closed;   // Formen: am Umriss treffen
      const P = (form ? formPunkte(st) : st.p).map((q) => [V.tx + q[0] * sc, V.ty + q[1] * V.h * V.s]);
      const segs = P.length > 1 ? P.length - (closed ? 0 : 1) : 0, r = 16 + ((st.w || 0.006) * sc) / 2;
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
    if (e.pointerType === "mouse" && e.button !== 0) return false;   // nur linke Maustaste zeichnet/misst/radiert, Mitte/Rechts bleibt zum Verschieben frei
    // Am PC lässt sich ein vorhandener Text auch ohne Textwerkzeug anklicken (ändern) oder ziehen (verschieben)
    const freiText = !S.tool && !S.draw && !S.erase && e.pointerType === "mouse" && S.visible && !S.edit ? textAt(x, y) : null;
    if (S.tool === "text" || freiText) {
      if (S.pid !== null) return true;
      if (S.edit) { textFertig(); return true; }   // Klick daneben beendet nur die Eingabe
      S.pid = e.pointerId;
      const st = freiText || textAt(x, y);
      S.txtDrag = st ? { st, x, y, p0: st.p, moved: false } : { neu: [x, y] };
      return true;
    }
    if (S.edit && e.pointerType === "mouse") textFertig();   // Klick daneben (ohne Textwerkzeug): Eingabe beenden, Plan normal schieben
    if (FORMEN.includes(S.tool)) {   // Rechteck/Kreis/Pfeil aufziehen (Finger, Stift oder Maus)
      if (S.pid !== null) return true;
      S.pid = e.pointerId; S.pen = e.pointerType === "pen";
      const q = toN(x, y);
      S.cur = { pg: V.page, type: "form", form: S.tool, c: S.color, a: S.alpha, w: (S.wpx * S.mult) / (V.w * V.s), p: [q, q.slice()] };
      frame(); return true;
    }
    if (S.tool === "mline" || S.tool === "marea" || S.tool === "calib") {
      if (S.pid !== null) return true;   // Handballen/zweiten Finger ignorieren
      S.pid = e.pointerId;
      if (S.tool === "calib") { addCalibPoint(x, y); return true; }
      const hit = findNearbyPoint(x, y);
      if (hit) { S.dragPt = hit; frame(); return true; }   // vorhandenen Punkt anfassen statt neuen zu setzen
      addMeasurePoint(x, y);
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
    if (S.txtDrag) {
      if (S.pid !== e.pointerId) return false;
      const d = S.txtDrag;
      if (d && d.st) {
        const [x, y] = rel(e);
        if (d.moved || Math.hypot(x - d.x, y - d.y) > 4) { d.moved = true; d.st.p = [[d.p0[0][0] + (x - d.x) / (V.w * V.s), d.p0[0][1] + (y - d.y) / (V.h * V.s)]]; frame(); }
      }
      return true;
    }
    if (S.cur && S.cur.type === "form") {
      if (S.pid !== e.pointerId) return false;
      let [x, y] = rel(e);
      if (e.shiftKey && S.cur.form !== "pfeil") {   // Umschalt: Quadrat bzw. Kreis
        const sx = V.tx + S.cur.p[0][0] * V.w * V.s, sy = V.ty + S.cur.p[0][1] * V.h * V.s, d = Math.max(Math.abs(x - sx), Math.abs(y - sy));
        x = sx + Math.sign(x - sx || 1) * d; y = sy + Math.sign(y - sy || 1) * d;
      }
      S.cur.p[1] = toN(x, y); frame(); return true;
    }
    if (S.tool === "mline" || S.tool === "marea" || S.tool === "calib") {
      if (S.pid !== e.pointerId) return false;
      if (S.dragPt) {
        const [x, y] = rel(e), [nx, ny] = toN(x, y);
        S.dragPt.owner.p[S.dragPt.i] = [nx, ny];
        if (S.dragPt.owner !== S.measure) S.dragPt.owner.label = shapeLabel(S.dragPt.owner.type, S.dragPt.owner.p);   // fertige Messung: Beschriftung sofort nachrechnen
        frame(); renderBar();
      }
      return true;   // ohne Treffer: Punkt sitzt schon, Ziehen tut sonst nichts
    }
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
    if (S.txtDrag) {
      if (S.pid !== e.pointerId) return false;
      S.pid = null;
      const d = S.txtDrag; S.txtDrag = null;
      if (d && d.st && d.moved) { S.hist.push({ t: "move", s: d.st, p: d.p0 }); save(); updateUi(); }
      else if (d && d.st) textEditor(d.st, false);
      else if (d) { const [nx, ny] = toN(d.neu[0], d.neu[1]); textEditor({ pg: V.page, type: "text", p: [[nx, ny]], t: "", c: S.color, m: S.alpha < 1, fs: (TXT_PX[S.wpx] || 16) / (V.w * V.s) }, true); }
      return true;
    }
    if (S.cur && S.cur.type === "form") {
      if (S.pid !== e.pointerId) return false;
      S.pid = null;
      const [a, b] = S.cur.p;
      if (Math.hypot((a[0] - b[0]) * V.w * V.s, (a[1] - b[1]) * V.h * V.s) > 6) { S.strokes.push(S.cur); S.hist.push({ t: "add", s: S.cur }); save(); }   // nur Antippen: nichts anlegen
      S.cur = null; frame(); updateUi(); return true;
    }
    if (S.tool === "mline" || S.tool === "marea" || S.tool === "calib") {
      if (S.pid !== e.pointerId) return false;
      S.pid = null;
      if (S.dragPt) { if (S.dragPt.owner !== S.measure) save(); S.dragPt = null; frame(); renderBar(); }
      return true;
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
    if (h.t === "add") S.strokes = S.strokes.filter((s) => s !== h.s);
    else if (h.t === "text") Object.assign(h.s, h.alt);
    else if (h.t === "move") h.s.p = h.p;
    else S.strokes.push(...h.list);
    save(); redraw(); updateUi();
  };

  /* ---- Text: Stelle anklicken, schreiben, Enter = fertig (Umschalt+Enter = neue Zeile), Esc = abbrechen.
     Vorhandenen Text mit dem Textwerkzeug anklicken = ändern (leer machen = löschen), ziehen = verschieben. ---- */
  const TXT_PX = { 2: 12, 4: 16, 8: 24 };   // Schriftgröße je Strichstärke-Knopf, in Bildschirmpixeln beim Setzen
  const TXT_FARBEN = [["#d62828", false, "Rot"], ["#1d4ed8", false, "Blau"], ["#111111", false, "Schwarz"], ["#ffd60a", true, "Gelb hinterlegt"]];
  function textHit(st, x, y) {
    const W = V.w * V.s, m = textMass(st, W), x0 = V.tx + st.p[0][0] * W, y0 = V.ty + st.p[0][1] * V.h * V.s;
    return x >= x0 - 6 && x <= x0 + m.w + 6 && y >= y0 - 6 && y <= y0 + m.h + 6;
  }
  const textAt = (x, y) => [...S.strokes].reverse().find((st) => st.type === "text" && st.pg === V.page && textHit(st, x, y));
  const textStand = (st) => ({ t: st.t, c: st.c, m: st.m, fs: st.fs });
  function textEditor(st, neu) {
    const ta = document.createElement("textarea");
    ta.className = "v-txt"; ta.value = st.t; ta.rows = 1; ta.spellcheck = true;
    ta.setAttribute("aria-label", "Text für den Plan");
    // Leiste direkt am Text: Schrift kleiner/größer, Farbe, löschen, fertig
    const bar = document.createElement("div");
    bar.className = "v-tools v-txtbar";
    bar.innerHTML = `<button data-fs="0.8" aria-label="Schrift kleiner" class="t-txt">A−</button><button data-fs="1.25" aria-label="Schrift größer" class="t-txt">A+</button><span class="v-sep"></span>`
      + TXT_FARBEN.map(([c, m, l]) => `<button class="col" data-tc="${c}" data-tm="${m ? 1 : ""}" style="--c:${c}" aria-label="${l}"></button>`).join("")
      + `<span class="v-sep"></span><button data-del aria-label="Text löschen"><svg class="ic" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5m4-5v5"/></svg></button>`
      + `<button data-ok aria-label="Fertig (Enter)">✓</button>`;
    vw().appendChild(ta); vw().appendChild(bar);
    S.edit = { st, neu, ta, bar, alt: textStand(st) };
    ta.addEventListener("pointerdown", (e) => e.stopPropagation());   // im Feld klicken = Cursor setzen, nicht neuer Text
    // Leiste: Fokus im Textfeld lassen (sonst würde es abgeschlossen) und den Plan nicht verschieben
    ["pointerdown", "mousedown"].forEach((t) => bar.addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); }));
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.fs) st.fs = Math.min(0.2, Math.max(0.002, st.fs * +b.dataset.fs));
      else if (b.dataset.tc) { st.c = b.dataset.tc; st.m = !!b.dataset.tm; S.color = st.c; S.alpha = st.m ? 0.45 : 1; S.mult = st.m ? 4 : 1; updateUi(); }
      else if ("del" in b.dataset) { ta.value = ""; return textFertig(); }
      else if ("ok" in b.dataset) return textFertig();
      positionEditor(); ta.focus();
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); textFertig(); }
      else if (e.key === "Escape") { e.preventDefault(); textFertig(true); }
    });
    ta.addEventListener("input", positionEditor);
    ta.addEventListener("blur", (e) => { if (!(e.relatedTarget && bar.contains(e.relatedTarget))) textFertig(); });
    frame(); positionEditor();
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
  }
  function positionEditor() {
    const e = S.edit;
    if (!e) return;
    const W = V.w * V.s, st = e.st, m = textMass({ ...st, t: e.ta.value || " " }, W);
    Object.assign(e.ta.style, {
      left: V.tx + st.p[0][0] * W + "px", top: V.ty + st.p[0][1] * V.h * V.s + "px",
      fontSize: m.fs + "px", padding: m.pad + "px", width: Math.max(m.w, m.fs * 3) + m.fs + "px", height: m.h + 4 + "px",
      color: st.m ? "#111111" : st.c, background: st.m ? "rgba(255,214,10,.75)" : "rgba(255,255,255,.95)",
    });
    const b = e.bar, l = V.tx + st.p[0][0] * W, t = V.ty + st.p[0][1] * V.h * V.s, bh = b.offsetHeight || 46;
    b.style.left = Math.max(4, Math.min(l, vw().clientWidth - b.offsetWidth - 4)) + "px";
    b.style.top = (t - bh - 6 >= 4 ? t - bh - 6 : t + m.h + 10) + "px";   // über dem Text, oben am Rand darunter
    b.querySelectorAll("[data-tc]").forEach((x) => x.classList.toggle("on", x.dataset.tc === st.c && !!x.dataset.tm === !!st.m));
  }
  function textFertig(abbrechen) {
    const e = S.edit;
    if (!e) return;
    S.edit = null;   // vor dem Entfernen, weil remove() noch ein blur auslöst
    const t = e.ta.value.replace(/\s+$/, "");
    e.ta.remove(); e.bar.remove();
    if (abbrechen) Object.assign(e.st, e.alt);
    else if (e.neu) { if (t) { e.st.t = t; S.strokes.push(e.st); S.hist.push({ t: "add", s: e.st }); save(); } }
    else if (!t) { S.strokes = S.strokes.filter((s) => s !== e.st); S.hist.push({ t: "del", list: [Object.assign(e.st, e.alt)] }); save(); }
    else { e.st.t = t; const neuStand = textStand(e.st); if (JSON.stringify(neuStand) !== JSON.stringify(e.alt)) { S.hist.push({ t: "text", s: e.st, alt: e.alt }); save(); } }
    frame(); updateUi();
  }

  /* ---- Strecke/Fläche: Punkt für Punkt, vorhandene Punkte anfassbar ---- */
  function findNearbyPoint(x, y) {
    const R = 20, sc = V.w * V.s;
    const test = (arr, owner) => {
      for (let i = 0; i < arr.length; i++) {
        const sx = V.tx + arr[i][0] * sc, sy = V.ty + arr[i][1] * V.h * V.s;
        if (Math.hypot(sx - x, sy - y) <= R) return { owner, i };
      }
      return null;
    };
    if (S.measure && S.measure.pg === V.page) { const h = test(S.measure.p, S.measure); if (h) return h; }
    for (const st of S.strokes) { if (st.pg === V.page && st.type === S.tool) { const h = test(st.p, st); if (h) return h; } }
    return null;
  }
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
  function cancelMeasure() { S.measure = null; S.dragPt = null; frame(); renderBar(); }
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
    if (S.edit && S.edit.st.pg !== V.page) textFertig();
    if (S.tool === "calib") S.calib = [];
    S.dragPt = null;
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
    save(); updateUi();
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
    if (S.edit && (S.draw || S.erase || (S.tool && S.tool !== "text"))) textFertig();   // anderes Werkzeug gewählt: Eingabe abschließen
    const q = (id) => document.getElementById(id);
    q("t-draw").classList.toggle("on", S.draw);
    q("t-text").classList.toggle("on", S.tool === "text");
    FORMEN.forEach((f) => q("t-" + f).classList.toggle("on", S.tool === f));
    q("t-erase").classList.toggle("on", S.erase);
    q("t-mline").classList.toggle("on", S.tool === "mline");
    q("t-marea").classList.toggle("on", S.tool === "marea");
    q("t-eye").classList.toggle("on", !S.visible);
    q("t-eye").classList.toggle("aus", !S.visible);   // durchgestrichenes Auge
    const denom = S.scale ? (S.scale * 72) / 0.0254 : 0;   // Maßstab direkt auf dem Knopf
    q("t-scale").textContent = !S.scale ? "1:?" : Math.abs(denom - Math.round(denom)) < 0.01 ? "1:" + Math.round(denom) : "kalib.";
    q("t-undo").disabled = !S.hist.length;
    q("t-clear").disabled = !S.strokes.length;
    document.querySelectorAll("#v-tools [data-c]").forEach((b) => b.classList.toggle("on", !S.erase && b.dataset.c === S.color));
    document.querySelectorAll("#v-tools [data-w]").forEach((b) => b.classList.toggle("on", +b.dataset.w === S.wpx));
  }
  function init() {
    const on = (id, f) => { document.getElementById(id).onclick = f; };
    on("t-draw", () => { S.draw = !S.draw; if (S.draw) { S.erase = false; S.tool = null; cancelMeasure(); } updateUi(); vmsg(S.draw ? "Zeichnen mit Finger an. Zum Verschieben und Zoomen wieder ausschalten." : ""); setTimeout(() => vmsg(""), 2500); });
    on("t-erase", () => { S.erase = !S.erase; if (S.erase) { S.draw = false; S.tool = null; cancelMeasure(); } updateUi(); });
    FORMEN.forEach((f) => on("t-" + f, () => {
      S.draw = false; S.erase = false; cancelMeasure(); textFertig();
      S.tool = S.tool === f ? null : f;
      updateUi();
    }));
    on("t-text", () => {
      S.draw = false; S.erase = false; cancelMeasure(); textFertig();
      S.tool = S.tool === "text" ? null : "text";
      updateUi();
      vmsg(S.tool === "text" ? "Auf den Plan klicken und schreiben. Enter = fertig, Umschalt+Enter = neue Zeile." : "");
      setTimeout(() => vmsg(""), 3500);
    });
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
    on("t-shot", shareView);
    // Farbe/Stärke: beim Textwerkzeug bleibt es aktiv, ein gerade bearbeiteter Text übernimmt Farbe bzw. Größe
    const fuerText = () => { if (S.edit) { positionEditor(); S.edit.ta.focus(); } };
    document.querySelectorAll("#v-tools [data-c]").forEach((b) => (b.onclick = () => {
      S.erase = false; if (S.tool !== "text" && !FORMEN.includes(S.tool)) S.tool = null; cancelMeasure();
      S.color = b.dataset.c; S.alpha = +(b.dataset.a || 1); S.mult = +(b.dataset.m || 1);
      if (S.edit) { S.edit.st.c = S.color; S.edit.st.m = S.alpha < 1; }
      updateUi(); fuerText();
    }));
    document.querySelectorAll("#v-tools [data-w]").forEach((b) => (b.onclick = () => {
      if (S.tool !== "text" && !FORMEN.includes(S.tool)) S.tool = null; cancelMeasure(); S.wpx = +b.dataset.w;
      if (S.edit) S.edit.st.fs = (TXT_PX[S.wpx] || 16) / (V.w * V.s);
      updateUi(); fuerText();
    }));
  }

  /* ---- Öffnen, Schließen, Liste ---- */
  async function open(key) {
    if (S.edit) { S.edit.ta.remove(); S.edit.bar.remove(); S.edit = null; }
    S.key = key; S.strokes = []; S.hist = []; S.cur = null; S.pid = null; S.visible = true; S.erase = false; S.draw = false;
    S.tool = null; S.measure = null; S.calib = null; S.pendingTool = null; S.scale = null; S.dragPt = null;
    document.getElementById("v-scale").hidden = true; renderBar();
    updateUi();
    try { const r = await tx("readonly", (s) => s.get(key)); if (r && S.key === key) { S.strokes = r.strokes || []; S.scale = r.mProPt || null; updateUi(); redraw(); } } catch { /* ohne Speicher weiterarbeiten */ }
  }
  async function close() {
    textFertig();
    clearTimeout(saveT);
    if (S.key) await persist(S.key, S.strokes, S.scale);
    S.key = null; S.strokes = []; S.hist = []; S.cur = null; S.pid = null; S.tool = null; S.measure = null; S.calib = null; S.dragPt = null;
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
    for (const st of mine) zeichne(ctx, st, X, Y, c.width, k);
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
  /* Sichtbarer Bildausschnitt (so wie auf dem Bildschirm, mit Skizzen/Messungen) als JPEG */
  async function baueAusschnitt() {
    const wrap = vw(), k = Math.max(2, dprOf());
    const w = Math.round(wrap.clientWidth * k), h = Math.round(wrap.clientHeight * k);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    await V.pg.render({ canvasContext: ctx, viewport: V.pg.getViewport({ scale: V.fit * V.s * k, offsetX: V.tx * k, offsetY: V.ty * k }) }).promise;
    if (S.visible) ctx.drawImage(cv(), 0, 0, w, h);   // Skizzen-Ebene hat dieselbe Bildschirmgröße
    const jpg = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    const stem = V.name.replace(/\.pdf$/i, "");
    return new File([jpg], `${stem}_Ausschnitt_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.jpg`, { type: "image/jpeg" });
  }
  let sharing = false;
  async function teilen(bauen, meldung, knopf) {
    if (!V.pg || !V.bytes || sharing) return;   // Doppel-Tipp: nicht zwei Exporte gleichzeitig auf derselben Seite rendern
    sharing = true;
    try {
      if (meldung) vmsg(meldung);
      let file;
      try { file = await bauen(); } catch (e) { vmsg("Das hat nicht geklappt: " + (e.message || e)); return; }
      vmsg("");
      try { await senden(file); }
      catch (e) {
        if (e && e.name === "AbortError") return;
        // iOS verlangt manchmal einen frischen Tipp, wenn das Erstellen länger gedauert hat
        const box = document.getElementById("v-msg");
        box.innerHTML = `<button class="v-send">${knopf}</button>`;
        box.querySelector("button").onclick = async () => { box.innerHTML = ""; try { await senden(file); } catch { download(file); } };
      }
    } finally { sharing = false; }
  }
  function share() {
    const skizze = S.strokes.some((s) => s.pg === V.page);
    return teilen(baueDatei, skizze ? "Kommentierte Fassung wird erstellt …" : "", skizze ? "Kommentierte Fassung senden" : "Plan senden");
  }
  const shareView = () => teilen(baueAusschnitt, "Ausschnitt wird erstellt …", "Ausschnitt senden");

  init();
  return { down, move, up, redraw, open, close, keys, pageChanged };
})();
