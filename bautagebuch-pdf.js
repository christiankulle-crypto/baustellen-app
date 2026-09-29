"use strict";
/* PDF-Erzeugung fürs Bautagebuch (braucht lib/pdf-lib.min.js).
   kulle():  Blatt im Kulle-Layout, nachgebaut nach der Druckansicht des Bautagebuch-Tools (A4, Briefkopf, Tabellen,
             Information | Media, Fußzeile mit Adresse).
   modus():  Tagesbericht im Formular von Modus Consult: füllt die Original-Vorlage (ausfüllbares PDF) aus. */
(function(){
  var P = window.PDFLib;
  var A4 = [595.28, 841.89], ML = 56.7, MR = 56.7, MT = 56.7, MB = 65.2;
  var INK = P.rgb(0.106, 0.110, 0.094), SOFT = P.rgb(0.29, 0.30, 0.26), SHADE = P.rgb(0.914, 0.914, 0.882),
      RULE = P.rgb(0.871, 0.875, 0.835), RULE2 = P.rgb(0.725, 0.733, 0.675), GREY = P.rgb(0.333, 0.333, 0.333);
  var ADRESSE = "Christian Kulle, Daimlerstr. 4a, 76344 Eggenstein-Leopoldshafen", KONTAKT = "+49 155 66564695 | info@kulle-la.de";

  // Standardschriften können nur WinAnsi; alles andere ersetzen statt abstürzen.
  var WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  function clean(s){
    return String(s == null ? "" : s).replace(/\r/g, "").replace(/[‐‑‒]/g, "-").replace(/−/g, "-")
      .replace(/[   ]/g, " ").replace(/[′]/g, "'").replace(/[″]/g, '"')
      .replace(/[^\n\x20-\x7E\xA1-\xFF]/g, function(c){ return WINANSI_EXTRA.indexOf(c) >= 0 ? c : "?"; });
  }
  function datumDE(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + "." + m[2] + "." + m[1] : (iso || ""); }

  function wrap(text, font, size, width){
    var out = [];
    clean(text).split("\n").forEach(function(par){
      var words = par.split(/ +/), line = "";
      words.forEach(function(w){
        var probe = line ? line + " " + w : w;
        if(font.widthOfTextAtSize(probe, size) <= width){ line = probe; return; }
        if(line) out.push(line);
        while(font.widthOfTextAtSize(w, size) > width && w.length > 1){   // überlanges Wort hart trennen
          var i = w.length; while(i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        line = w;
      });
      out.push(line);
    });
    return out;
  }

  function bytesOf(url){ return fetch(url).then(function(r){ return r.arrayBuffer(); }); }
  function embedImage(doc, url){
    return bytesOf(url).then(function(buf){
      var b = new Uint8Array(buf);
      return (b[0] === 0x89 && b[1] === 0x50) ? doc.embedPng(buf) : doc.embedJpg(buf);
    });
  }

  var TYPE = {
    tagesbericht:     { doctype: "Bautagebuch", thema: "Tagesbericht", article: "Der", metaLabel: "Ort/Art:", metaField: "ortArt", info: "Information", sonst: "Sonstiges" },
    telefonnotiz:     { doctype: "Telefonnotiz", thema: "Telefonnotiz", article: "Die", metaLabel: "Gesprächspartner:", metaField: "teilnehmer", info: "Notiz", sonst: "Vereinbarungen / nächste Schritte" },
    videobesprechung: { doctype: "Videobesprechung", thema: "Videobesprechung", article: "Die", metaLabel: "Teilnehmer:", metaField: "teilnehmer", info: "Notiz", sonst: "Vereinbarungen / nächste Schritte" },
    email:            { doctype: "E-Mail-Abstimmung", thema: "E-Mail-Abstimmung", article: "Die", metaLabel: "Beteiligte:", metaField: "teilnehmer", info: "Notiz", sonst: "Vereinbarungen / nächste Schritte" }
  };

  // ---------- Kulle-Layout ----------
  function kulleBlatt(doc, F, state, r, logo){
    var t = TYPE[r.type] || TYPE.tagesbericht;
    var W = A4[0] - ML - MR;
    var page, y;
    function neueSeite(){
      page = doc.addPage(A4); y = A4[1] - MT;
      page.drawText(clean(ADRESSE), { x: ML, y: 34, size: 7.5, font: F.r, color: GREY });
      page.drawText(clean(KONTAKT), { x: A4[0] - MR - F.r.widthOfTextAtSize(KONTAKT, 7.5), y: 34, size: 7.5, font: F.r, color: GREY });
    }
    function text(s, x, size, font, color){ page.drawText(clean(s), { x: x, y: y - size, size: size, font: font, color: color || INK }); }
    function hline(x1, x2, yy, th, col){ page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: th, color: col || INK }); }
    function platz(h){ if(y - h < MB){ neueSeite(); return true; } return false; }

    neueSeite();
    // Briefkopf
    text(t.doctype, ML, 12, F.b);
    var firm = "Kulle Landschaftsarchitektur", ls = 25;
    if(logo) page.drawImage(logo, { x: A4[0] - MR - ls, y: y - ls + 4, width: ls, height: ls });
    page.drawText(firm, { x: A4[0] - MR - (logo ? ls + 7 : 0) - F.b.widthOfTextAtSize(firm, 12), y: y - 12, size: 12, font: F.b, color: INK });
    y -= 26; hline(ML, A4[0] - MR, y, 0.75); y -= 11;
    // Bauvorhaben
    wrap("Bauvorhaben: " + (state.bauvorhaben || ""), F.b, 9.75, W).forEach(function(l){ text(l, ML, 9.75, F.b); y -= 13.5; });
    y -= 5;
    // Kopfdaten
    var metaVal = r[t.metaField] || "";
    var kw = Math.max(75, F.r.widthOfTextAtSize(clean(t.metaLabel), 9.75) + 10);
    [["Thema:", t.thema + " Nr. " + (r.nr || "")], ["Datum:", datumDE(r.datum)], [t.metaLabel, metaVal]].forEach(function(row){
      text(row[0], ML, 9.75, F.r);
      var lines = wrap(row[1], F.r, 9.75, W - kw);
      lines.forEach(function(l, i){ text(l, ML + kw, 9.75, F.r); if(i < lines.length - 1) y -= 13; });
      y -= 16;
    });
    y -= 2;
    var colo = t.article + " vorliegende " + t.thema + " wurde von " + (r.verfasserRolle || "") + ", im Auftrag von " + (r.auftraggeber || "") + " erstellt.";
    wrap(colo, F.i, 9.75, W).forEach(function(l){ text(l, ML, 9.75, F.i, SOFT); y -= 13.5; });
    y -= 4;

    // Kenndaten-Tabellen (nur Tagesbericht)
    function kvTabelle(titel, rows){
      platz(20 + rows.length * 18);
      y -= 12;
      page.drawRectangle({ x: ML, y: y - 18, width: W, height: 18, color: SHADE });
      text(titel, ML + 6, 9.75, F.b); y -= 18; hline(ML, A4[0] - MR, y, 0.75);
      rows.forEach(function(row, i){
        var lines = wrap(row[1] || "", F.r, 9.75, W - 125);
        var h = Math.max(1, lines.length) * 13 + 6;
        platz(h);
        y -= 4;
        text(row[0], ML + 6, 9.75, F.r, SOFT);
        lines.forEach(function(l, k){ text(l, ML + 119, 9.75, F.r); if(k < lines.length - 1) y -= 13; });
        y -= 15;
        hline(ML, A4[0] - MR, y, 0.5, i === rows.length - 1 ? RULE2 : RULE);
      });
    }
    if(r.type === "tagesbericht"){
      kvTabelle("Baufortschritt", [["Phase", r.phase]]);
      kvTabelle("Witterung", [["Wetter", r.wetter], ["Temperatur", r.temperatur]]);
      kvTabelle("Baustellenbesetzung", [["Arbeitskräfte", r.arbeitskraefte], ["Geräte", r.geraete]]);
    }

    // Information | Media: zwei Spalten, die unabhängig voneinander über Seiten weiterlaufen
    var wL = W * 0.56, wR = W - wL, xL = ML, xR = ML + wL, pad = 6;
    platz(60);
    y -= 12;
    page.drawRectangle({ x: ML, y: y - 18, width: W, height: 18, color: SHADE });
    text(t.info, xL + pad, 9.75, F.b); text("Media", xR + pad, 9.75, F.b);
    y -= 18; hline(ML, A4[0] - MR, y, 0.75); y -= 6;

    var sz = 9.4, lh = 14.5, links = [];
    function textBloecke(s){
      clean(s).split("\n").forEach(function(line){
        var m = /^(\s*[-–•]\s+)(.*)$/.exec(line);
        if(m){
          var dash = m[1].replace(/\s+$/, "") + " ", dw = F.r.widthOfTextAtSize(dash, sz);
          wrap(m[2], F.r, sz, wL - 2 * pad - dw).forEach(function(l, i){ links.push({ h: lh, draw: function(p, x, yy){ if(i === 0) p.drawText(dash, { x: x, y: yy - sz, size: sz, font: F.r, color: INK }); p.drawText(l, { x: x + dw, y: yy - sz, size: sz, font: F.r, color: INK }); } }); });
        } else if(!line.trim()){
          links.push({ h: lh * 0.6, draw: function(){} });
        } else {
          wrap(line, F.r, sz, wL - 2 * pad).forEach(function(l){ links.push({ h: lh, draw: function(p, x, yy){ p.drawText(l, { x: x, y: yy - sz, size: sz, font: F.r, color: INK }); } }); });
        }
      });
    }
    textBloecke(r.infoText || "");
    links.push({ h: 22, draw: function(p, x, yy){ p.drawText(clean(t.sonst), { x: x, y: yy - 16, size: 9.75, font: F.b, color: INK }); } });
    textBloecke(r.sonstigesText || "");

    return Promise.all((r.images || []).map(function(img){
      return img.dataUrl && img.dataUrl.indexOf("data:,") !== 0 ? embedImage(doc, img.dataUrl).catch(function(){ return null; }) : Promise.resolve(null);
    })).then(function(bilder){
      var rechts = [], n = 0, bw = wR - 2 * pad;
      bilder.forEach(function(b, i){
        if(!b) return;
        n++;
        var bh = b.height * (bw / b.width), maxH = 330;
        var w2 = bw, h2 = bh;
        if(bh > maxH){ h2 = maxH; w2 = b.width * (maxH / b.height); }
        var cap = wrap("Abbildung " + n + ": " + ((r.images[i] && r.images[i].caption) || ""), F.i, 8.6, bw);
        rechts.push({ h: 8 + h2 + 4 + cap.length * 11 + 8, draw: function(p, x, yy){
          p.drawImage(b, { x: x, y: yy - 8 - h2, width: w2, height: h2 });
          p.drawRectangle({ x: x, y: yy - 8 - h2, width: w2, height: h2, borderColor: RULE2, borderWidth: 0.5 });
          cap.forEach(function(l, k){ p.drawText(l, { x: x, y: yy - 8 - h2 - 4 - 9 - k * 11, size: 8.6, font: k === 0 ? F.i : F.i, color: SOFT }); });
        } });
      });

      // Spalten verteilen
      var iL = 0, iR = 0, top = y;
      for(;;){
        var yL = top, yR = top;
        while(iL < links.length && yL - links[iL].h >= MB){ links[iL].draw(page, xL + pad, yL); yL -= links[iL].h; iL++; }
        while(iR < rechts.length && (yR - rechts[iR].h >= MB || yR === top)){ rechts[iR].draw(page, xR + pad, yR); yR -= rechts[iR].h; iR++; }
        page.drawLine({ start: { x: xR, y: top + 6 }, end: { x: xR, y: Math.min(yL, yR) - 2 }, thickness: 0.4, color: RULE });
        if(iL >= links.length && iR >= rechts.length){ y = Math.min(yL, yR) - 4; break; }
        neueSeite(); top = y;
      }
      hline(ML, A4[0] - MR, y, 0.5, RULE2);
      // Verfasser
      if(y - 40 < MB) neueSeite();
      y -= 22; hline(ML, A4[0] - MR, y, 0.75); y -= 6;
      text("Verfasser: Christian Kulle, " + datumDE(r.verfasserDatum || r.datum), ML, 9, F.r, SOFT);
    });
  }

  function fonts(doc){
    var S = P.StandardFonts;
    return Promise.all([doc.embedFont(S.Helvetica), doc.embedFont(S.HelveticaBold), doc.embedFont(S.HelveticaOblique)])
      .then(function(f){ return { r: f[0], b: f[1], i: f[2] }; });
  }

  // reports: Liste von Blättern; mcVorlage (ArrayBuffer) nur, wenn Tagesberichte im Modus-Consult-Formular erscheinen sollen
  function erzeuge(state, reports, logoUrl, mcVorlage, titel){
    return P.PDFDocument.create().then(function(doc){
      doc.setTitle(clean(titel || "Bautagebuch")); doc.setAuthor("Christian Kulle"); doc.setCreator("Baustellen-App");
      return Promise.all([fonts(doc), logoUrl ? embedImage(doc, logoUrl).catch(function(){ return null; }) : null]).then(function(res){
        var F = res[0], logo = res[1], kette = Promise.resolve();
        reports.forEach(function(r){
          kette = kette.then(function(){
            if(mcVorlage && r.type === "tagesbericht"){
              return modusBytes(mcVorlage, r, true).then(function(bytes){ return P.PDFDocument.load(bytes); })
                .then(function(src){ return doc.copyPages(src, src.getPageIndices()); })
                .then(function(pages){ pages.forEach(function(p){ doc.addPage(p); }); });
            }
            return kulleBlatt(doc, F, state, r, logo);
          });
        });
        return kette.then(function(){ return doc.save(); });
      });
    });
  }

  // ---------- Modus-Consult-Formular ----------
  var MC_FELDER = {
    mc_projNr: "ProjNr", nr: "Bautagesbericht Nr", mc_auftraggeber: "Auftraggeber", mc_massnahme: "Maßnahme", mc_arge: "ARGE-Nr",
    mc_bauunternehmen: "Bauunternehmen", mc_bauleiter: "verantw. Bauleiter", mc_ingenieur: "verantw. Ingenieur",
    mc_temperatur: "Temperatur", mc_niederschlag: "Niederschlag", mc_wetter1: "Beschreibung des Wetters -1", mc_wetter2: "Beschreibung des Wetters -2",
    mc_von1: "von Uhr - 1", mc_bis1: "bis Uhr - 1", mc_von2: "von Uhr - 2", mc_bis2: "bis Uhr - 2",
    mc_auf1: "Aufsicht - 1", mc_mf1: "Maschinenführer - 1", mc_fa1: "Facharbeiter - 1", mc_he1: "Helfer - 1", mc_so1: "Sonstige - 1",
    mc_auf2: "Aufsicht - 2", mc_mf2: "Maschinenführer - 2", mc_fa2: "Facharbeiter - 2", mc_he2: "Helfer - 2", mc_so2: "Sonstige - 2",
    mc_leistungen: "Erbrachte Leistungen - 1", mc_visiten: "Visiten - 1", mc_bemerkungen: "Bemerkungen - 1"
  };
  for(var i = 1; i <= 9; i++) MC_FELDER["mc_m" + i] = "Eingesetzte Maschinen-" + i;
  var norm = function(s){ return String(s).normalize("NFC"); };

  function modusBytes(vorlage, r, flach){
    return P.PDFDocument.load(vorlage.slice(0)).then(function(doc){
      var form = doc.getForm(), byName = {};
      form.getFields().forEach(function(f){ byName[norm(f.getName())] = f; });
      Object.keys(MC_FELDER).forEach(function(key){
        var f = byName[norm(MC_FELDER[key])];
        if(!f) return;
        var v = clean(r[key] == null ? "" : r[key]);
        if(f instanceof P.PDFDropdown){
          var val = v || "---";
          try{ if(f.getOptions().indexOf(val) < 0 && !f.isEditable()) f.enableEditing(); f.select(val); }catch(e){ console.warn(key, e); }
        } else if(f instanceof P.PDFTextField){
          if(f.getMaxLength && f.getMaxLength() !== undefined && v.length > f.getMaxLength()) f.setMaxLength(undefined);
          f.setText(v);
        }
      });
      var df = byName["Datum1_af_date"];
      if(df && df instanceof P.PDFTextField) df.setText(datumDE(r.datum));
      return doc.embedFont(P.StandardFonts.Helvetica).then(function(helv){
        // Mehrzeilige Felder: größte Schrift bis max., bei der der Text noch ins Feld passt (sonst wählt das Feld
        // "automatisch" riesige Schrift bzw. schneidet ab). Bemerkungen wie in den bisherigen Berichten klein.
        [["Bemerkungen - 1", 7.5], ["Erbrachte Leistungen - 1", 9], ["Visiten - 1", 9]].forEach(function(x){
          var f = byName[norm(x[0])];
          if(!(f instanceof P.PDFTextField)) return;
          var rect = f.acroField.getWidgets()[0].getRectangle(), txt = f.getText() || "";
          var size = x[1];
          while(size > 4.5 && wrap(txt, helv, size, rect.width - 6).length * size * 1.18 > rect.height - 4) size -= 0.25;
          f.enableMultiline();
          f.acroField.setDefaultAppearance("/Helv " + size + " Tf 0 g");   // setFontSize() scheitert, wenn das Feld selbst kein /DA hat
        });
        form.updateFieldAppearances(helv);
        if(flach) form.flatten();
        return doc.save();
      });
    });
  }

  window.BTPdf = { erzeuge: erzeuge, modus: function(vorlage, r){ return modusBytes(vorlage, r, false); }, MC_FELDER: MC_FELDER };
})();
