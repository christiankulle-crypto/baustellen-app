"use strict";
/* Skizzen im Plan. Der Stift (Apple Pencil) zeichnet, der Finger schiebt und zoomt.
   Die Skizzen liegen getrennt vom PDF in diesem Gerät (IndexedDB). Das Original in OneDrive wird nie verändert.
   Koordinaten werden als Bruchteil der Seite gespeichert (0..1), damit sie bei jedem Zoom an der richtigen Stelle sitzen. */
const Ink = (() => {
  const DB = "baustellen-skizzen", ST = "plaene";
  const S = { key: null, strokes: [], hist: [], draw: false, erase: false, color: "#d62828", alpha: 1, wpx: 4, mult: 1,
              visible: true, cur: null, pid: null, pen: false, erased: [] };
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
  const persist = async (key, strokes) => {
    try { if (strokes.length) await tx("readwrite", (s) => s.put({ strokes, updated: Date.now() }, key)); else await tx("readwrite", (s) => s.delete(key)); }
    catch (e) { console.warn("Skizze konnte nicht gespeichert werden", e); }
  };
  const save = () => { clearTimeout(saveT); const k = S.key, st = S.strokes; saveT = setTimeout(() => persist(k, st), 300); };

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
  function redraw() {
    const c = cv(), d = dprOf(), w = Math.round(vw().clientWidth * d), h = Math.round(vw().clientHeight * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (!S.visible || !V.pg || !V.w) return;
    const X = (nx) => (V.tx + nx * V.w * V.s) * d, Y = (ny) => (V.ty + ny * V.h * V.s) * d, W = V.w * V.s * d;
    for (const st of S.strokes) if (st.pg === V.page) strokePath(ctx, st, X, Y, W);
    if (S.cur) strokePath(ctx, S.cur, X, Y, W);
  }
  const frame = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); }); };

  /* ---- Eingabe ---- */
  const toN = (x, y) => [(x - V.tx) / (V.w * V.s), (y - V.ty) / (V.h * V.s)];
  function eraseAt(x, y) {
    const sc = V.w * V.s, keep = [];
    for (const st of S.strokes) {
      if (st.pg !== V.page) { keep.push(st); continue; }
      const P = st.p.map((q) => [V.tx + q[0] * sc, V.ty + q[1] * V.h * V.s]), r = 16 + (st.w * sc) / 2;
      let hit = false;
      if (P.length === 1) hit = Math.hypot(P[0][0] - x, P[0][1] - y) <= r;
      for (let i = 0; i < P.length - 1 && !hit; i++) {
        const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
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
    if (S.pid !== null && S.pen && e.pointerType === "touch") return true;   // Handballen ignorieren, solange der Stift zeichnet
    if (!(e.pointerType === "pen" || S.draw)) return false;
    S.pid = e.pointerId; S.pen = e.pointerType === "pen"; S.erased = []; S.last = [x, y];
    if (S.erase) eraseAt(x, y);
    else { const [nx, ny] = toN(x, y); S.cur = { pg: V.page, c: S.color, a: S.alpha, w: (S.wpx * S.mult) / (V.w * V.s), p: [[nx, ny]] }; }
    frame(); return true;
  }
  function move(e, rel) {
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

  /* ---- Oberfläche ---- */
  function updateUi() {
    const q = (id) => document.getElementById(id);
    q("t-draw").classList.toggle("on", S.draw);
    q("t-erase").classList.toggle("on", S.erase);
    q("t-eye").classList.toggle("on", !S.visible);
    q("t-eye").textContent = S.visible ? "◉" : "◌";
    q("t-undo").disabled = !S.hist.length;
    q("t-clear").disabled = !S.strokes.length;
    document.querySelectorAll("#v-tools [data-c]").forEach((b) => b.classList.toggle("on", !S.erase && b.dataset.c === S.color));
    document.querySelectorAll("#v-tools [data-w]").forEach((b) => b.classList.toggle("on", +b.dataset.w === S.wpx));
  }
  function init() {
    const on = (id, f) => { document.getElementById(id).onclick = f; };
    on("t-draw", () => { S.draw = !S.draw; updateUi(); vmsg(S.draw ? "Zeichnen mit Finger an. Zum Verschieben und Zoomen wieder ausschalten." : ""); setTimeout(() => vmsg(""), 2500); });
    on("t-erase", () => { S.erase = !S.erase; updateUi(); });
    on("t-undo", undo);
    on("t-eye", () => { S.visible = !S.visible; redraw(); updateUi(); });
    on("t-clear", () => {
      if (!S.strokes.length) return;
      if (confirm(`Alle ${S.strokes.length} Skizzen auf diesem Plan löschen? Der Plan selbst bleibt unverändert.`)) { S.strokes = []; S.hist = []; save(); redraw(); updateUi(); }
    });
    on("t-share", share);
    document.querySelectorAll("#v-tools [data-c]").forEach((b) => (b.onclick = () => {
      S.erase = false; S.color = b.dataset.c; S.alpha = +(b.dataset.a || 1); S.mult = +(b.dataset.m || 1); updateUi();
    }));
    document.querySelectorAll("#v-tools [data-w]").forEach((b) => (b.onclick = () => { S.wpx = +b.dataset.w; updateUi(); }));
  }

  /* ---- Öffnen, Schließen, Liste ---- */
  async function open(key) {
    S.key = key; S.strokes = []; S.hist = []; S.cur = null; S.pid = null; S.visible = true; S.erase = false;
    updateUi();
    try { const r = await tx("readonly", (s) => s.get(key)); if (r && S.key === key) { S.strokes = r.strokes || []; updateUi(); redraw(); } } catch { /* ohne Speicher weiterarbeiten */ }
  }
  async function close() {
    clearTimeout(saveT);
    if (S.key) await persist(S.key, S.strokes);
    S.key = null; S.strokes = []; S.hist = []; S.cur = null; S.pid = null;
    const c = cv(); c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }
  const keys = async () => { try { return (await tx("readonly", (s) => s.getAllKeys())) || []; } catch { return []; } };

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
    if (!mine.length) return new File([V.bytes], V.name, { type: "application/pdf" });   // keine Skizze: Original unverändert
    const base = V.pg.getViewport({ scale: 1 });
    const k = Math.min(4096 / base.width, Math.sqrt(10e6 / (base.width * base.height)));
    const c = document.createElement("canvas");
    c.width = Math.round(base.width * k); c.height = Math.round(base.height * k);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await V.pg.render({ canvasContext: ctx, viewport: V.pg.getViewport({ scale: k }) }).promise;
    const X = (nx) => nx * c.width, Y = (ny) => ny * c.height;
    for (const st of mine) strokePath(ctx, st, X, Y, c.width);
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
  async function share() {
    if (!V.pg || !V.bytes) return;
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
  return { down, move, up, redraw, open, close, keys };
})();
