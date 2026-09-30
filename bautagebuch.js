"use strict";
/* Bautagebuch der Baustellen-App (aus dem früheren Bautagebuch_Tool.html). Speichert in OneDrive, siehe Abschnitt "Speicher". */
(function(){


  var LOGO_SRC = "data:image/png;base64,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";

  // Blatt-Typen: Tagesbericht ist die eigentliche Bautagebuch-Seite (mit Wetter/Besetzung/etc.),
  // die übrigen drei sind schlankere Gesprächs-/Abstimmungsnotizen mit eigenem Briefkopf-Titel und eigener Nummerierung.
  var TYPE_META = {
    tagesbericht:     { doctype:"Bautagebuch",        thema:"Tagesbericht",        article:"Der", short:"TB",   metaLabel:"Ort/Art:",       metaField:"ortArt",     metaPlaceholder:"(Ort/Art eintragen, z. B. „Baustelle, ...“)" },
    telefonnotiz:     { doctype:"Telefonnotiz",        thema:"Telefonnotiz",        article:"Die", short:"Tel",  metaLabel:"Gesprächspartner:", metaField:"teilnehmer", metaPlaceholder:"(Gesprächspartner eintragen)" },
    videobesprechung: { doctype:"Videobesprechung",    thema:"Videobesprechung",    article:"Die", short:"Video",metaLabel:"Teilnehmer:",    metaField:"teilnehmer", metaPlaceholder:"(Teilnehmer eintragen)" },
    email:            { doctype:"E-Mail-Abstimmung",   thema:"E-Mail-Abstimmung",   article:"Die", short:"Mail", metaLabel:"Beteiligte:",    metaField:"teilnehmer", metaPlaceholder:"(E-Mail-Verteiler/Beteiligte eintragen)" }
  };
  function typeMeta(type){ return TYPE_META[type] || TYPE_META.tagesbericht; }

  function defaultState(){
    return {
      bauvorhaben: "",
      auftraggeber: "",
      verfasserRolleDefault: "M. Eng. Christian Kulle, freier Landschaftsarchitekt",
      ortArtDefault: "",
      lastBackupAt: null,
      reports: []
    };
  }

  function normalizeState(s){
    if(!s || typeof s !== "object") return defaultState();
    if(s.bauvorhaben === undefined) s.bauvorhaben = "";
    if(s.auftraggeber === undefined) s.auftraggeber = "";
    if(s.verfasserRolleDefault === undefined) s.verfasserRolleDefault = "M. Eng. Christian Kulle, freier Landschaftsarchitekt";
    if(s.ortArtDefault === undefined) s.ortArtDefault = "";
    if(s.lastBackupAt === undefined) s.lastBackupAt = null;
    if(!Array.isArray(s.reports)) s.reports = [];
    s.reports.forEach(function(r){
      if(r.type === undefined || !TYPE_META[r.type]) r.type = "tagesbericht";
      if(r.nr === undefined) r.nr = "";
      if(r.datum === undefined) r.datum = "";
      if(r.ortArt === undefined) r.ortArt = "";
      if(r.teilnehmer === undefined) r.teilnehmer = "";
      if(r.verfasserRolle === undefined) r.verfasserRolle = "M. Eng. Christian Kulle, freier Landschaftsarchitekt";
      if(r.auftraggeber === undefined) r.auftraggeber = "";
      if(r.phase === undefined) r.phase = "";
      if(r.wetter === undefined) r.wetter = "";
      if(r.temperatur === undefined) r.temperatur = "";
      if(r.arbeitskraefte === undefined) r.arbeitskraefte = "";
      if(r.geraete === undefined) r.geraete = "";
      if(r.infoText === undefined) r.infoText = "";
      if(r.sonstigesText === undefined) r.sonstigesText = "";
      if(r.collapsed === undefined) r.collapsed = false;
      if(!Array.isArray(r.images)) r.images = [];
      if(r.verfasserDatum === undefined) r.verfasserDatum = "";
    });
    return s;
  }

  // ---------- Speicher: Datei "bautagebuch.json" im Bautagebuch-Ordner des Projekts (OneDrive, über Microsoft Graph).
  // Fotos liegen als JPG daneben im Unterordner "Bautagebuch-Fotos", vor dem ersten Speichern eines Tages wird der
  // bisherige Stand nach "_Sicherung/bautagebuch_JJJJ-MM-TT.json" kopiert. Gespeichert wird nur mit passendem eTag:
  // Hat jemand anderes (oder Claude) die Datei inzwischen geändert, wird nichts überschrieben, sondern nachgefragt.
  var CFG = window.APP_CONFIG;
  var LOCAL = ["localhost", "127.0.0.1"].indexOf(location.hostname) !== -1;
  var DEMO = new URLSearchParams(location.search).has("demo") || (!CFG.clientId && LOCAL);
  var GRAPH = "https://graph.microsoft.com/v1.0/me/drive";
  var SCOPES = ["Files.ReadWrite"];
  var DATEI = "bautagebuch.json", FOTO_DIR = "Bautagebuch-Fotos", SICHERUNG_DIR = "_Sicherung";

  var msalApp = null, account = null;
  var projekte = [], proj = null, ordner = "";
  var etag = null, geladenText = null, sicherungGemacht = false;
  var saving = false, saveAgain = false, konflikt = false, dirty = false;

  function enc(p){ return p.split("/").map(encodeURIComponent).join("/"); }
  function HttpError(status, msg){ var e = new Error(msg || ("HTTP " + status)); e.status = status; return e; }

  function initAuth(){
    if(DEMO) return Promise.resolve(true);
    if(!CFG.clientId || !CFG.tenantId) return Promise.resolve(false);
    var base = location.origin + location.pathname.replace(/[^/]*$/, "");
    msalApp = new window.msal.PublicClientApplication({
      auth: { clientId: CFG.clientId, authority: "https://login.microsoftonline.com/" + CFG.tenantId, redirectUri: base, navigateToLoginRequestUrl: false },
      cache: { cacheLocation: "localStorage" }
    });
    return msalApp.initialize().then(function(){
      return msalApp.handleRedirectPromise().catch(function(){ return null; });
    }).then(function(r){
      account = (r && r.account) || msalApp.getActiveAccount() || msalApp.getAllAccounts()[0] || null;
      if(account) msalApp.setActiveAccount(account);
      return !!account;
    });
  }
  function token(){
    return msalApp.acquireTokenSilent({ scopes: SCOPES, account: account })
      .then(function(r){ return r.accessToken; }, function(e){ throw HttpError(401, e.message); });
  }
  function graph(url, opt){
    opt = opt || {};
    return token().then(function(t){
      var h = Object.assign({}, opt.headers || {}, { Authorization: "Bearer " + t });
      return fetch(url, Object.assign({}, opt, { headers: h }));
    }).then(function(r){
      if(!r.ok) throw HttpError(r.status);
      return r;
    });
  }

  // Einheitlicher Dateizugriff: Graph in echt, im lokalen Test (?demo) über den dev_server.
  var io = {
    daten: function(rel){
      if(DEMO) return fetch("/demo-daten/" + rel).then(function(r){ if(!r.ok) throw HttpError(r.status); return r.json(); });
      return graph(GRAPH + "/root:/" + enc(CFG.datenRoot + "/" + rel) + ":/content").then(function(r){ return r.json(); });
    },
    // -> {text, etag} oder null, wenn es die Datei (noch) nicht gibt
    readText: function(path){
      if(DEMO){
        return fetch("/demo-bt?path=" + encodeURIComponent(path), { cache: "no-store" }).then(function(r){
          if(r.status === 404) return null;
          if(!r.ok) throw HttpError(r.status);
          var tag = r.headers.get("ETag");
          return r.text().then(function(t){ return { text: t, etag: tag }; });
        });
      }
      // erst die Metadaten (eTag), dann den Inhalt über /content – kein $select, sonst fehlt die Download-URL
      return graph(GRAPH + "/root:/" + enc(path)).then(function(r){ return r.json(); }, function(e){
        if(e.status === 404) return null;
        throw e;
      }).then(function(meta){
        if(!meta) return null;
        return graph(GRAPH + "/root:/" + enc(path) + ":/content", { cache: "no-store" })
          .then(function(r){ return r.text(); })
          .then(function(t){ return { text: t, etag: meta.eTag }; });
      });
    },
    // ifMatch = eTag des zuletzt gelesenen Stands; null = Datei darf es noch nicht geben. -> neuer eTag
    write: function(path, body, ifMatch, ctype){
      var headers = { "Content-Type": ctype || "application/json" };
      if(ifMatch) headers["If-Match"] = ifMatch;
      if(DEMO){
        return fetch("/demo-bt?path=" + encodeURIComponent(path) + (ifMatch ? "" : "&neu=1"), { method: "PUT", headers: headers, body: body })
          .then(function(r){ if(!r.ok) throw HttpError(r.status); return r.headers.get("ETag"); });
      }
      var url = GRAPH + "/root:/" + enc(path) + ":/content" + (ifMatch ? "" : "?@microsoft.graph.conflictBehavior=fail");
      return graph(url, { method: "PUT", headers: headers, body: body }).then(function(r){ return r.json(); })
        .then(function(j){ return j.eTag; });
    },
    replace: function(path, body, ctype){   // bewusst überschreiben (nur für erzeugte PDFs, nach Rückfrage)
      if(DEMO){
        return fetch("/demo-bt?path=" + encodeURIComponent(path) + "&ersetzen=1", { method: "PUT", headers: { "Content-Type": ctype }, body: body })
          .then(function(r){ if(!r.ok) throw HttpError(r.status); });
      }
      return graph(GRAPH + "/root:/" + enc(path) + ":/content", { method: "PUT", headers: { "Content-Type": ctype }, body: body });
    },
    readBlob: function(path){
      if(DEMO) return fetch("/demo-bt?path=" + encodeURIComponent(path)).then(function(r){ if(!r.ok) throw HttpError(r.status); return r.blob(); });
      return graph(GRAPH + "/root:/" + enc(path) + ":/content").then(function(r){ return r.blob(); });
    }
  };

  // Datei <-> Arbeitsstand: In der Datei stehen Fotos nur als Verweis ("datei"), im Browser zusätzlich als Bild-URL.
  function toFile(s){
    var out = JSON.parse(JSON.stringify(s, function(k, v){ return k === "dataUrl" || k === "neu" ? undefined : v; }));
    out.format = "bautagebuch-v2";
    out.hinweis = "Bautagebuch der Baustellen-App. Fotos liegen im Unterordner " + FOTO_DIR + ", Sicherungen in " + SICHERUNG_DIR + ".";
    return out;
  }
  function dataUrlToBlob(u){
    var parts = u.split(","), mime = (parts[0].match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    var bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function blobToDataUrl(b){
    return new Promise(function(res, rej){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = rej; r.readAsDataURL(b); });
  }

  var state = defaultState(); // Platzhalter, bis ladeProjekt() den echten Stand geladen hat
  var saveTimer = null;
  var saveTimer = null;
  function todayIso(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }

  function setToolbarNote(msg){
    var n = document.getElementById("toolbarNote");
    n.textContent = msg || " ";
  }
  function setSaveNote(t){ document.getElementById("saveNote").textContent = t; }

  // Zeigt, wo das Bautagebuch liegt (statt der früheren Erinnerung ans Sichern: jetzt speichert OneDrive).
  function updateBackupReminder(){
    var el = document.getElementById("storeHint");
    if(el) el.textContent = proj ? ("Gespeichert in OneDrive: " + proj.ordner + " / " + proj.bautagebuch + " / " + DATEI) : "";
  }

  function markSaved(){
    var now = new Date();
    setSaveNote("gespeichert " + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0"));
  }

  // Speichern: erst neue Fotos hochladen, dann (einmal am Tag) den alten Stand sichern, dann die Datei schreiben.
  function speichern(){
    var neue = [];
    state.reports.forEach(function(r){ r.images.forEach(function(img){ if(img.neu && img.dataUrl) neue.push(img); }); });
    var kette = Promise.resolve();
    neue.forEach(function(img){
      kette = kette.then(function(){
        var rel = FOTO_DIR + "/" + img.id + ".jpg";
        return io.write(ordner + "/" + rel, dataUrlToBlob(img.dataUrl), null, "image/jpeg")
          .catch(function(e){ if(e.status !== 409) throw e; })   // gibt es schon (z. B. zweiter Versuch): gut
          .then(function(){ img.datei = rel; delete img.neu; });
      });
    });
    return kette.then(function(){
      if(sicherungGemacht || !geladenText) return;
      return io.write(ordner + "/" + SICHERUNG_DIR + "/bautagebuch_" + todayIso() + ".json", geladenText, null)
        .catch(function(e){ if(e.status !== 409) throw e; })   // heutige Sicherung gibt es schon
        .then(function(){ sicherungGemacht = true; });
    }).then(function(){
      var text = JSON.stringify(toFile(state), null, 1);
      return io.write(ordner + "/" + DATEI, text, etag).then(function(neuerTag){ etag = neuerTag; geladenText = text; });
    });
  }
  function persist(){
    if(!proj || konflikt) return Promise.resolve();
    clearTimeout(saveTimer); saveTimer = null;
    if(saving){ saveAgain = true; return Promise.resolve(); }
    saving = true; dirty = false;
    setSaveNote("speichert …");
    return speichern().then(function(){
      saving = false;
      markSaved();
      setToolbarNote("");
      if(saveAgain || dirty){ saveAgain = false; return persist(); }
    }, function(e){
      saving = false;
      dirty = true;
      if(e.status === 412 || (e.status === 409 && !etag)){ zeigeKonflikt(); return; }
      if(e.status === 401){ setToolbarNote("Anmeldung abgelaufen – bitte über die Baustellen-App neu anmelden. Die Änderungen in diesem Fenster sind noch nicht gespeichert."); setSaveNote("nicht gespeichert"); return; }
      setSaveNote("nicht gespeichert");
      setToolbarNote("Speichern hat nicht geklappt (" + (e.message || e) + "). Neuer Versuch in 15 Sekunden – Fenster bitte offen lassen.");
      saveTimer = setTimeout(persist, 15000);
    });
  }
  function scheduleSave(){ dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 800); }
  function flush(){   // vor Projektwechsel: Ausstehendes speichern und abwarten
    return new Promise(function(res){
      if(dirty && !konflikt) persist();
      (function warte(){ if(saving) setTimeout(warte, 150); else res(); })();
    });
  }
  window.addEventListener("beforeunload", function(e){
    if(dirty || saving){ e.preventDefault(); e.returnValue = ""; }
  });

  function zeigeKonflikt(){
    konflikt = true;
    setSaveNote("nicht gespeichert");
    var box = document.getElementById("konfliktBox");
    box.hidden = false;
    box.innerHTML = 'Das Bautagebuch wurde inzwischen an anderer Stelle geändert (anderes Fenster, anderer PC oder durch Claude). '
      + 'Deine letzten Änderungen hier sind noch <b>nicht</b> gespeichert. '
      + '<button type="button" class="btn small" id="kfLaden">Neuesten Stand laden</button> '
      + '<button type="button" class="btn small" id="kfMeins">Meine Fassung trotzdem speichern</button>';
    document.getElementById("kfLaden").onclick = function(){ dirty = false; ladeProjekt(proj.slug); };
    document.getElementById("kfMeins").onclick = function(){
      io.readText(ordner + "/" + DATEI).then(function(r){
        etag = r ? r.etag : null; geladenText = r ? r.text : geladenText;
        sicherungGemacht = false;   // der fremde Stand landet so noch in der Tagessicherung
        konflikt = false; box.hidden = true;
        return persist();
      });
    };
  }

  function afterStateReady(){
    sortReports();
    updateBackupReminder();
    render();
    var root = document.getElementById("appRoot");
    if(root) root.classList.remove("loading");
    ladeBilder();
  }

  // Fotos aus dem Ordner nachladen (nach und nach, ohne den Rest neu aufzubauen)
  var bildUrls = [];
  function ladeBilder(){
    var todo = [];
    state.reports.forEach(function(r){ r.images.forEach(function(img){ if(!img.dataUrl && img.datei) todo.push(img); }); });
    var slug = proj && proj.slug;
    (function weiter(){
      var img = todo.shift();
      if(!img || !proj || proj.slug !== slug) return;
      io.readBlob(ordner + "/" + img.datei).then(function(b){
        img.dataUrl = URL.createObjectURL(b); bildUrls.push(img.dataUrl);
        var el = document.querySelector('.media-item[data-img-id="' + cssEscape(img.id) + '"] img');
        if(el) el.src = img.dataUrl;
      }, function(){
        var el = document.querySelector('.media-item[data-img-id="' + cssEscape(img.id) + '"] img');
        if(el) el.alt = "Foto nicht gefunden: " + img.datei;
      }).then(weiter);
    })();
  }

  function ladeProjekt(slug){
    var p = projekte.filter(function(x){ return x.slug === slug; })[0] || projekte[0];
    if(!p) return;
    var root = document.getElementById("appRoot");
    root.classList.add("loading");
    bildUrls.forEach(function(u){ URL.revokeObjectURL(u); }); bildUrls = [];
    proj = p; ordner = CFG.projekteRoot + "/" + p.ordner + "/" + p.bautagebuch;
    konflikt = false; sicherungGemacht = false; dirty = false; saveAgain = false;
    document.getElementById("konfliktBox").hidden = true;
    document.getElementById("projSel").value = p.slug;
    document.title = "Bautagebuch – " + p.name;
    if(location.hash !== "#" + p.slug) history.replaceState(null, "", "#" + p.slug);
    try{ localStorage.setItem("bautagebuch:letztes", p.slug); }catch(e){}
    setSaveNote("lädt …");
    setToolbarNote("");
    return io.readText(ordner + "/" + DATEI).then(function(r){
      if(r){
        state = normalizeState(JSON.parse(r.text));
        etag = r.etag; geladenText = r.text;
      } else {
        state = defaultState();
        state.bauvorhaben = p.name + (p.ort ? ", " + p.ort : "");
        etag = null; geladenText = null;
      }
      setSaveNote(r ? "geladen" : "noch leer");
      afterStateReady();
    }).catch(fehlerBeimLaden);
  }
  function fehlerBeimLaden(e){
    var root = document.getElementById("appRoot");
    root.classList.remove("loading");
    state = defaultState(); proj = null;
    render();
    setSaveNote("");
    if(e && e.status === 401) setToolbarNote("Nicht angemeldet oder Anmeldung abgelaufen. Bitte zuerst die Baustellen-App öffnen und anmelden, dann hierher zurück.");
    else setToolbarNote("Bautagebuch konnte nicht geladen werden: " + ((e && e.message) || e));
  }

  function boot(){
    initAuth().then(function(ok){
      if(!ok) throw HttpError(401);
      return io.daten("projekte.json");
    }).then(function(j){
      projekte = (j.projekte || []).filter(function(p){ return p.bautagebuch; });
      var sel = document.getElementById("projSel");
      sel.innerHTML = projekte.map(function(p){ return '<option value="' + esc(p.slug) + '">' + esc(p.name) + (p.ort ? " (" + esc(p.ort) + ")" : "") + '</option>'; }).join("");
      var wunsch = location.hash.replace(/^#/, "");
      if(!wunsch){ try{ wunsch = localStorage.getItem("bautagebuch:letztes") || ""; }catch(e){} }
      return ladeProjekt(wunsch);
    }).catch(fehlerBeimLaden);
  }
  document.getElementById("projSel").addEventListener("change", function(e){
    var slug = e.target.value;
    flush().then(function(){ ladeProjekt(slug); });
  });
  window.addEventListener("hashchange", function(){
    var slug = location.hash.replace(/^#/, "");
    if(proj && slug && slug !== proj.slug) flush().then(function(){ ladeProjekt(slug); });
  });

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function autoGrow(ta){ ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }

  // Baut den Druck-Spiegel eines Freitextfelds: pro Zeile ein Flex-Block, damit ein
  // umgebrochener Spiegelstrich hängend unter dem ersten Wort weiterläuft statt unter dem "-".
  function bulletMirrorHtml(text){
    var lines = String(text == null ? "" : text).split("\n");
    return lines.map(function(line){
      var m = /^(\s*-\s+)(.*)$/.exec(line);
      if(m){
        return '<div class="bullet-line"><span class="bullet-dash">'+esc(m[1])+'</span><span class="bullet-text">'+esc(m[2])+'</span></div>';
      }
      if(/^\s*-\s*$/.test(line)){
        return '<div class="bullet-line"><span class="bullet-dash">'+esc(line)+'</span><span class="bullet-text"></span></div>';
      }
      return '<div class="plain-line">'+(line === "" ? "&nbsp;" : esc(line))+'</div>';
    }).join("");
  }

  function findDay(id){
    for(var i=0;i<state.reports.length;i++){ if(state.reports[i].id === id) return state.reports[i]; }
    return null;
  }
  function dayIndex(id){
    for(var i=0;i<state.reports.length;i++){ if(state.reports[i].id === id) return i; }
    return -1;
  }
  function nextNr(type){
    var max = 0;
    state.reports.forEach(function(r){ if(r.type !== type) return; var n = parseInt(r.nr,10); if(!isNaN(n) && n > max) max = n; });
    return String(max + 1).padStart(2,"0");
  }
  function lastOfType(type){
    for(var i=state.reports.length-1;i>=0;i--){ if(state.reports[i].type === type) return state.reports[i]; }
    return null;
  }
  function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  // Blätter chronologisch nach Datum halten (typübergreifend) – leere Daten rutschen ans Ende.
  // Nr. bleibt beim jeweiligen Blatt "kleben" (an der Erstellung vergeben), nur die Reihenfolge folgt dem Datum.
  // Array.sort ist stabil, gleiche Daten behalten also ihre bisherige Reihenfolge (z. B. per Blatt ↑/↓ gesetzt).
  function sortReports(){
    state.reports.sort(function(a,b){
      var da = a.datum || "9999-99-99";
      var db = b.datum || "9999-99-99";
      if(da < db) return -1;
      if(da > db) return 1;
      return 0;
    });
  }

  function addDay(){
    var typeSelect = document.getElementById("newSheetType");
    var type = (typeSelect && TYPE_META[typeSelect.value]) ? typeSelect.value : "tagesbericht";
    var last = lastOfType(type);
    var iso = todayIso();
    var newId = uid("d");
    // Bisherige Blätter werden beim Anlegen eines neuen automatisch zugeklappt,
    // damit nur das aktuelle offen im Weg steht.
    state.reports.forEach(function(r){ r.collapsed = true; });
    state.reports.push({
      id: newId,
      type: type,
      nr: nextNr(type),
      datum: iso,
      ortArt: last ? last.ortArt : (state.ortArtDefault || ""),
      teilnehmer: last ? last.teilnehmer : "",
      verfasserRolle: last ? last.verfasserRolle : (state.verfasserRolleDefault || "M. Eng. Christian Kulle, freier Landschaftsarchitekt"),
      auftraggeber: last ? last.auftraggeber : (state.auftraggeber || ""),
      phase: last ? last.phase : "",
      wetter: "", temperatur: "",
      arbeitskraefte: "", geraete: "",
      infoText: "", sonstigesText: "",
      images: [],
      verfasserDatum: iso,
      collapsed: false
    });
    if(istMC() && type === "tagesbericht"){   // Kopfdaten des Formulars vom letzten Bericht übernehmen
      var neu = state.reports[state.reports.length - 1];
      MC_KOPF.forEach(function(k){ neu[k] = last && last[k] != null ? last[k] : (k === "mc_ingenieur" ? "C. Kulle" : ""); });
    }
    sortReports();
    scheduleSave();
    render();
    var s = container.querySelector('.day-sheet[data-id="'+cssEscape(newId)+'"]');
    if(s) s.scrollIntoView({behavior:"smooth", block:"start"});
  }

  function deleteDay(id){
    var idx = dayIndex(id);
    if(idx < 0) return;
    var r = state.reports[idx];
    var m = typeMeta(r.type);
    if(!confirm(m.thema + " Nr. " + (r.nr||"?") + " vom " + (r.datum||"?") + " wirklich löschen? Das kann nicht rückgängig gemacht werden.")) return;
    state.reports.splice(idx,1);
    scheduleSave();
    render();
  }
  function moveDay(id, dir){
    var idx = dayIndex(id);
    var to = idx + dir;
    if(idx < 0 || to < 0 || to >= state.reports.length) return;
    var tmp = state.reports[idx];
    state.reports[idx] = state.reports[to];
    state.reports[to] = tmp;
    scheduleSave();
    render();
  }

  // ---------- Bild-Verarbeitung: verkleinern/komprimieren, um Speicher zu schonen; HEIC/HEIF
  // (echte iPhone-Fotos) über eingebettetes libheif dekodieren, da Browser das nicht selbst können ----------
  function isHeicFile(file){
    var t = (file.type || "").toLowerCase();
    if(t.indexOf("heic") !== -1 || t.indexOf("heif") !== -1) return true;
    return /\.(heic|heif)$/i.test(file.name || "");
  }
  function encodeResized(source, srcW, srcH){
    var maxDim = 1400;
    var scale = Math.min(1, maxDim / Math.max(srcW, srcH || 1));
    var cw = Math.max(1, Math.round(srcW*scale)), ch = Math.max(1, Math.round(srcH*scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(source, 0, 0, cw, ch);
    try{ return canvas.toDataURL("image/jpeg", 0.82); }catch(e){ return null; }
  }
  var heifDecoderPromise = null;
  function getHeifDecoder(){
    // libheif() liefert je nach Bundle-Variante entweder ein Promise oder das Modul direkt zurück –
    // Promise.resolve(...) deckt beide Fälle sicher ab (await/​.then auf einem Nicht-Promise reicht
    // den Wert nur unverändert durch, ein direktes .then() auf einem Nicht-Promise wirft dagegen).
    if(!heifDecoderPromise){
      heifDecoderPromise = new Promise(function(res, rej){   // HEIC-Bibliothek (1,4 MB) erst bei Bedarf laden
        if(typeof libheif !== "undefined") return res();
        var sc = document.createElement("script"); sc.src = "lib/libheif.js"; sc.onload = res; sc.onerror = rej;
        document.head.appendChild(sc);
      }).then(function(){ return libheif(); }).then(function(mod){ return new mod.HeifDecoder(); });
    }
    return heifDecoderPromise;
  }
  function decodeHeic(file){
    return file.arrayBuffer().then(function(buf){
      return getHeifDecoder().then(function(decoder){
        var images = decoder.decode(buf);
        if(!images || !images.length) return null;
        var image = images[0];
        var w = image.get_width(), h = image.get_height();
        if(!w || !h) return null;
        var imgData = new ImageData(w, h);
        return new Promise(function(resolve){
          image.display(imgData, function(ok){
            if(!ok){ resolve(null); return; }
            var canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").putImageData(imgData, 0, 0);
            resolve(encodeResized(canvas, w, h));
          });
        });
      });
    }).catch(function(err){ if(window.console) console.error("HEIC-Dekodierung fehlgeschlagen:", err); return null; });
  }
  function readAndCompress(file){
    if(isHeicFile(file)){
      if(typeof libheif === "undefined") return Promise.resolve(null);
      return decodeHeic(file);
    }
    return new Promise(function(resolve){
      var reader = new FileReader();
      reader.onload = function(){
        var img = new Image();
        img.onload = function(){ resolve(encodeResized(img, img.width, img.height)); };
        img.onerror = function(){ resolve(null); };
        img.src = reader.result;
      };
      reader.onerror = function(){ resolve(null); };
      reader.readAsDataURL(file);
    });
  }
  function processFiles(fileList, dayId){
    var day = findDay(dayId);
    if(!day) return;
    var files = Array.prototype.filter.call(fileList || [], function(f){
      if(!f) return false;
      if(f.type && f.type.indexOf("image/") === 0) return true;
      return isHeicFile(f);
    });
    if(!files.length) return;
    var hasHeic = files.some(isHeicFile);
    if(hasHeic) setToolbarNote("Foto(s) werden konvertiert (HEIC) … das kann ein paar Sekunden dauern.");
    Promise.all(files.map(readAndCompress)).then(function(urls){
      var failed = 0;
      urls.forEach(function(u){
        if(!u){ failed++; return; }
        day.images.push({ id: uid("img"), dataUrl: u, caption: "", neu: true });
      });
      scheduleSave();
      render();
      if(failed){
        setToolbarNote(failed + " Foto(s) konnten nicht gelesen werden – bitte als JPG/PNG erneut versuchen.");
      } else {
        setToolbarNote("");
      }
    });
  }

  function deleteImage(dayId, imgId){
    var day = findDay(dayId);
    if(!day) return;
    var idx = -1;
    for(var i=0;i<day.images.length;i++){ if(day.images[i].id === imgId){ idx = i; break; } }
    if(idx < 0) return;
    day.images.splice(idx,1);
    scheduleSave();
    render();
  }
  function moveImage(dayId, imgId, dir){
    var day = findDay(dayId);
    if(!day) return;
    var idx = -1;
    for(var i=0;i<day.images.length;i++){ if(day.images[i].id === imgId){ idx = i; break; } }
    var to = idx + dir;
    if(idx < 0 || to < 0 || to >= day.images.length) return;
    var tmp = day.images[idx];
    day.images[idx] = day.images[to];
    day.images[to] = tmp;
    scheduleSave();
    render();
  }

  // ---------- Rendering ----------
  var activeFilter = "all"; // reine Anzeige-Einstellung, nicht Teil des gespeicherten Zustands
  function filteredReports(){
    return activeFilter === "all" ? state.reports : state.reports.filter(function(r){ return r.type === activeFilter; });
  }

  function dayNavHtml(){
    if(!state.reports.length) return '<span class="day-nav-empty">Noch kein Blatt angelegt – &bdquo;+ Neues Blatt&ldquo; oben klicken.</span>';
    var visible = filteredReports();
    if(!visible.length) return '<span class="day-nav-empty">Keine Bl&auml;tter vom Typ &bdquo;'+esc(typeMeta(activeFilter).thema)+'&ldquo; vorhanden.</span>';
    return visible.map(function(r){
      var m = typeMeta(r.type);
      return '<button type="button" class="day-chip" data-jump="'+esc(r.id)+'">'+esc(m.short)+' '+esc(r.nr||"?")+' · '+esc(r.datum||"?")+'</button>';
    }).join("");
  }

  function mediaItemHtml(day, img, idx, total){
    return ''
      +'<div class="media-item" data-img-id="'+esc(img.id)+'">'
        +'<img src="'+(img.dataUrl||"data:,")+'" alt="Baustellenfoto">'
        +'<div class="cap-row"><span class="cap-num">Abbildung '+(idx+1)+':</span>'
          +'<span class="cap-input" contenteditable="true" spellcheck="false" data-day="'+esc(day.id)+'" data-img-field="caption" data-img-id="'+esc(img.id)+'">'+esc(img.caption)+'</span>'
        +'</div>'
        +'<div class="media-actions">'
          +'<button type="button" class="img-btn" data-action="img-up" data-day="'+esc(day.id)+'" data-img-id="'+esc(img.id)+'" '+(idx===0?'disabled':'')+'>↑</button>'
          +'<button type="button" class="img-btn" data-action="img-down" data-day="'+esc(day.id)+'" data-img-id="'+esc(img.id)+'" '+(idx===total-1?'disabled':'')+'>↓</button>'
          +'<button type="button" class="img-btn del" data-action="img-del" data-day="'+esc(day.id)+'" data-img-id="'+esc(img.id)+'">Entfernen</button>'
        +'</div>'
      +'</div>';
  }

  // ---------- Modus-Consult-Formular (Projekte mit bautagebuch_vorlage) ----------
  var MC_KOPF = ["mc_projNr", "mc_arge", "mc_auftraggeber", "mc_massnahme", "mc_bauunternehmen", "mc_bauleiter", "mc_ingenieur"];
  var MC_MASCHINEN = ["---", "Asphaltfertiger", "Betonfertiger", "Betonpumpe", "Betonsäge", "Bindemittelstreuer", "Bodenstabilisierer", "Erdfräse",
    "Grader", "Gummiradwalze", "Hydraulikbagger", "Kehrmaschine", "Kombiwalze", "Kompressor", "Laderaupe", "Minibagger", "Muldenkipper",
    "Planierraupe", "Radlader", "Ramme", "Rampenspritzgerät", "Vibrationsplatte - groß", "Vibrationsplatte - klein", "Vibrationsstampfer",
    "Vibrationswalze", "Vorderkipper"];
  function istMC(){ return !!(proj && proj.bautagebuch_vorlage); }
  function mcBlatt(day){ return istMC() && day.type === "tagesbericht"; }
  function mcIn(day, field, cls, ph){
    return '<input type="text" class="mc-in '+(cls||"")+'" data-day="'+esc(day.id)+'" data-field="'+field+'" value="'+esc(day[field]||"")+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>';
  }
  function mcTa(day, field, ph){
    return '<textarea class="autogrow mc-ta" data-day="'+esc(day.id)+'" data-field="'+field+'" placeholder="'+esc(ph||"")+'">'+esc(day[field]||"")+'</textarea>';
  }
  function mcSheetHtml(day, idx, total, hideReorder){
    var id = esc(day.id);
    var ak = function(n){ return '<tr><td>von '+mcIn(day,"mc_von"+n,"s")+' Uhr bis '+mcIn(day,"mc_bis"+n,"s")+' Uhr</td>'
      + ["auf","mf","fa","he","so"].map(function(k){ return '<td>'+mcIn(day,"mc_"+k+n,"c")+'</td>'; }).join("") + '</tr>'; };
    var masch = ""; for(var i=1;i<=9;i++) masch += mcIn(day, "mc_m"+i, "m", "---").replace('<input ', '<input list="mcMaschinen" ');
    return ''
    +'<div class="day-sheet mc-sheet'+(day.collapsed?' collapsed':'')+'" data-id="'+id+'">'
      +'<div class="day-toolbar">'
        +'<button type="button" class="move-btn collapse-toggle" data-action="toggle-collapse" data-day="'+id+'">'+(day.collapsed?'▸ Aufklappen':'▾ Zuklappen')+'</button>'
        +'<span class="tag">Bautagesbericht '+esc(day.nr||"?")+' · '+esc(day.datum||"?")+' · Modus Consult</span>'
        + (hideReorder ? '' :
          '<button type="button" class="move-btn" data-action="day-up" data-day="'+id+'" '+(idx===0?'disabled':'')+'>Blatt ↑</button>'
          +'<button type="button" class="move-btn" data-action="day-down" data-day="'+id+'" '+(idx===total-1?'disabled':'')+'>Blatt ↓</button>')
        +'<button type="button" class="move-btn pdf-btn" data-action="pdf-day" data-day="'+id+'" title="Formular von Modus Consult ausfüllen und im Projektordner ablegen">Speichern als PDF</button>'
        +'<button type="button" class="move-btn del-day-btn" data-action="del-day" data-day="'+id+'">Blatt löschen</button>'
      +'</div>'
      +'<div class="day-body">'
        +'<div class="mc-head"><div><b>Proj.-Nr.</b> '+mcIn(day,"mc_projNr","s")+'</div><div class="mc-logo">MODUS CONSULT</div></div>'
        +'<div class="mc-box"><b>Bautagesbericht - Nr.</b> <input type="text" class="mc-in s" data-day="'+id+'" data-field="nr" value="'+esc(day.nr)+'">'
          +' &nbsp; <b>Datum</b> <input type="date" data-day="'+id+'" data-field="datum" value="'+esc(day.datum)+'"></div>'
        +'<div class="mc-box mc-2"><label>Auftraggeber: '+mcIn(day,"mc_auftraggeber")+'</label><label>ARGE-Nr.: '+mcIn(day,"mc_arge")+'</label>'
          +'<label class="w">Maßnahme: '+mcIn(day,"mc_massnahme")+'</label></div>'
        +'<div class="mc-box mc-2"><label>Bauunternehmen: '+mcIn(day,"mc_bauunternehmen")+'</label><label>Bauüberwachung: <span class="mc-fix">Modus Consult</span></label>'
          +'<label>Verantwortl. Bauleiter: '+mcIn(day,"mc_bauleiter")+'</label><label>Verantwortlicher Ingenieur: '+mcIn(day,"mc_ingenieur")+'</label></div>'
        +'<div class="mc-box"><div class="mc-t">Arbeitsbedingungen</div><div class="mc-2">'
          +'<label>Temperatur (°C): '+mcIn(day,"mc_temperatur","s")+'</label><label>Wetter: '+mcIn(day,"mc_wetter1")+'</label>'
          +'<label>Niederschlag (l/m²): '+mcIn(day,"mc_niederschlag","s")+'</label><label>Wetter (2. Zeile): '+mcIn(day,"mc_wetter2")+'</label></div></div>'
        +'<div class="mc-box"><div class="mc-t">Eingesetzte Arbeitskräfte</div><table class="mc-ak"><tr><th>Zeit</th><th>Aufsicht</th><th>Maschinenführer</th><th>Facharbeiter</th><th>Helfer</th><th>Sonst.</th></tr>'+ak(1)+ak(2)+'</table></div>'
        +'<div class="mc-box"><div class="mc-t">Eingesetzte Maschinen</div><div class="mc-m">'+masch+'</div></div>'
        +'<div class="mc-box"><div class="mc-t">Erbrachte Leistungen</div>'+mcTa(day,"mc_leistungen","z. B. Abbrucharbeiten (laufend)")+'</div>'
        +'<div class="mc-box"><div class="mc-t">Visiten</div>'+mcTa(day,"mc_visiten","z. B. Christian Kulle (Modus Consult); TAS Bauunternehmen")+'</div>'
        +'<div class="mc-box"><div class="mc-t">Bemerkungen</div>'+mcTa(day,"mc_bemerkungen","- ...")+'</div>'
      +'</div>'
    +'</div>';
  }

  function dayHtml(day, idx, total, hideReorder){
    if(mcBlatt(day)) return mcSheetHtml(day, idx, total, hideReorder);
    var meta = typeMeta(day.type);
    var isTagesbericht = day.type === "tagesbericht";
    var images = day.images.map(function(img,i){ return mediaItemHtml(day, img, i, day.images.length); }).join("");
    var metaVal = isTagesbericht ? day.ortArt : day.teilnehmer;
    var summary = meta.short + " " + esc(day.nr||"?") + " · " + esc(day.datum||"?") + (metaVal ? " · " + esc(metaVal) : "");

    var kvTables = "";
    if(isTagesbericht){
      kvTables = ''
      +'<table class="doc kv-table">'
        +'<caption>Baufortschritt</caption>'
        +'<tr><td class="k">Phase</td><td><input type="text" data-day="'+esc(day.id)+'" data-field="phase" value="'+esc(day.phase)+'" placeholder="z. B. Erdbau, Pflasterarbeiten, Pflanzung ..."></td></tr>'
      +'</table>'
      +'<table class="doc kv-table">'
        +'<caption>Witterung</caption>'
        +'<tr><td class="k">Wetter</td><td><input type="text" data-day="'+esc(day.id)+'" data-field="wetter" value="'+esc(day.wetter)+'" placeholder="z. B. sonnig, bewölkt, Regen ..."></td></tr>'
        +'<tr><td class="k">Temperatur</td><td><input type="text" data-day="'+esc(day.id)+'" data-field="temperatur" value="'+esc(day.temperatur)+'" placeholder="z. B. 23 °C"></td></tr>'
      +'</table>'
      +'<table class="doc kv-table">'
        +'<caption>Baustellenbesetzung</caption>'
        +'<tr><td class="k">Arbeitskräfte</td><td><input type="text" data-day="'+esc(day.id)+'" data-field="arbeitskraefte" value="'+esc(day.arbeitskraefte)+'" placeholder="z. B. 7 AK"></td></tr>'
        +'<tr><td class="k">Geräte</td><td><input type="text" data-day="'+esc(day.id)+'" data-field="geraete" value="'+esc(day.geraete)+'" placeholder="z. B. Minibagger, Radlader ..."></td></tr>'
      +'</table>';
    }

    var infoLabel = isTagesbericht ? "Information" : "Notiz";
    var infoPlaceholder = isTagesbericht ? "- derzeit: ...&#10;- Einbau ..." : "- Besprochen: ...&#10;- Stand: ...";
    var sonstigesLabel = isTagesbericht ? "Sonstiges" : "Vereinbarungen / nächste Schritte";
    var sonstigesPlaceholder = isTagesbericht ? "- Hinweise, Abstimmungen, Termine ..." : "- Wer macht was bis wann ...";

    return ''
    +'<div class="day-sheet'+(day.collapsed?' collapsed':'')+'" data-id="'+esc(day.id)+'">'

      +'<div class="day-toolbar">'
        +'<button type="button" class="move-btn collapse-toggle" data-action="toggle-collapse" data-day="'+esc(day.id)+'">'+(day.collapsed?'▸ Aufklappen':'▾ Zuklappen')+'</button>'
        +'<span class="tag">'+summary+'</span>'
        + (hideReorder ? '' :
          '<button type="button" class="move-btn" data-action="day-up" data-day="'+esc(day.id)+'" '+(idx===0?'disabled':'')+'>Blatt ↑</button>'
          +'<button type="button" class="move-btn" data-action="day-down" data-day="'+esc(day.id)+'" '+(idx===total-1?'disabled':'')+'>Blatt ↓</button>')
        +'<button type="button" class="move-btn pdf-btn" data-action="pdf-day" data-day="'+esc(day.id)+'" title="PDF dieses Blatts im Projektordner ablegen">Speichern als PDF</button>'
        + (mcBlatt(day) ? '' : '<button type="button" class="move-btn" data-action="print-day" data-day="'+esc(day.id)+'">Drucken</button>')
        +'<button type="button" class="move-btn del-day-btn" data-action="del-day" data-day="'+esc(day.id)+'">Blatt löschen</button>'
      +'</div>'

      +'<div class="day-body">'

      +'<div class="letterhead">'
        +'<div class="doctype">'+esc(meta.doctype)+'</div>'
        +'<div class="firm-row"><div class="firm">Kulle Landschaftsarchitektur</div><img class="logo" src="'+LOGO_SRC+'" alt=""></div>'
      +'</div>'

      +'<div class="bauvorhaben-line">Bauvorhaben: '+esc(state.bauvorhaben)+'</div>'

      +'<table class="meta-table">'
        +'<tr><td class="k">Thema:</td><td>'+esc(meta.thema)+' Nr. <input type="text" class="nr-input" inputmode="numeric" data-day="'+esc(day.id)+'" data-field="nr" value="'+esc(day.nr)+'"></td></tr>'
        +'<tr><td class="k">Datum:</td><td><input type="date" data-day="'+esc(day.id)+'" data-field="datum" value="'+esc(day.datum)+'"></td></tr>'
        +'<tr><td class="k">'+esc(meta.metaLabel)+'</td><td><span class="ortart-input" contenteditable="true" spellcheck="false" data-day="'+esc(day.id)+'" data-field="'+esc(meta.metaField)+'" data-placeholder="'+esc(meta.metaPlaceholder)+'">'+esc(metaVal)+'</span></td></tr>'
      +'</table>'

      +'<div class="colophon">'+esc(meta.article)+' vorliegende '+esc(meta.thema)+' wurde von <span class="gfield" contenteditable="true" spellcheck="false" data-day="'+esc(day.id)+'" data-field="verfasserRolle" data-placeholder="(Verfasser eintragen)">'+esc(day.verfasserRolle)+'</span>'
        +', im Auftrag von <span class="gfield" contenteditable="true" spellcheck="false" data-day="'+esc(day.id)+'" data-field="auftraggeber" data-placeholder="(Auftraggeber eintragen)">'+esc(day.auftraggeber)+'</span> erstellt.</div>'

      + kvTables

      +'<table class="doc im-table">'
        +'<thead><tr><th class="info-col">'+esc(infoLabel)+'</th><th class="media-col">Media</th></tr></thead>'
        +'<tbody><tr>'
          +'<td class="info-cell"><div class="info-cell-inner">'
            +'<textarea class="autogrow" data-day="'+esc(day.id)+'" data-field="infoText" placeholder="'+infoPlaceholder+'">'+esc(day.infoText)+'</textarea>'
            +'<div class="print-mirror">'+bulletMirrorHtml(day.infoText)+'</div>'
            +'<div class="sonstiges-label">'+esc(sonstigesLabel)+'</div>'
            +'<textarea class="autogrow" data-day="'+esc(day.id)+'" data-field="sonstigesText" placeholder="'+sonstigesPlaceholder+'">'+esc(day.sonstigesText)+'</textarea>'
            +'<div class="print-mirror">'+bulletMirrorHtml(day.sonstigesText)+'</div>'
          +'</div></td>'
          +'<td class="media-cell"><div class="media-cell-inner" data-drop-day="'+esc(day.id)+'">'
            + (images || '<div class="no-media">Noch keine Fotos.</div>')
            +'<input type="file" class="img-file-input" accept="image/*" multiple style="display:none" data-day="'+esc(day.id)+'">'
            +'<button type="button" class="add-link" data-action="add-img" data-day="'+esc(day.id)+'">+ Bild hinzufügen</button>'
            +'<div class="media-drop-hint">Bild hierher ziehen oder mit Strg+V einfügen</div>'
          +'</div></td>'
        +'</tr></tbody>'
      +'</table>'

      +'<div class="sheet-footer">Verfasser: Christian Kulle, <input type="date" data-day="'+esc(day.id)+'" data-field="verfasserDatum" value="'+esc(day.verfasserDatum)+'"></div>'

      +'</div>'

    +'</div>';
  }

  function render(){
    document.getElementById("dayNav").innerHTML = dayNavHtml();
    refreshProjectHead();

    var container = document.getElementById("daysContainer");
    var visible = filteredReports();
    var hideReorder = activeFilter !== "all";
    if(!visible.length && state.reports.length){
      container.innerHTML = '<p class="filter-empty">Keine Bl&auml;tter vom Typ &bdquo;'+esc(typeMeta(activeFilter).thema)+'&ldquo; vorhanden. &bdquo;Alle&ldquo; oben w&auml;hlen, um wieder alles zu sehen.</p>';
    } else {
      container.innerHTML = visible.map(function(r,i){ return dayHtml(r, i, visible.length, hideReorder); }).join("");
    }
    Array.prototype.forEach.call(container.querySelectorAll("textarea.autogrow"), autoGrow);
  }

  // ---------- Event delegation ----------
  var container = document.getElementById("daysContainer");

  container.addEventListener("input", function(e){
    var t = e.target;
    if(t.dataset && t.dataset.day && t.dataset.field){
      var day = findDay(t.dataset.day);
      if(!day) return;
      var val = (t.tagName === "TEXTAREA" || t.tagName === "INPUT") ? t.value : t.textContent;
      day[t.dataset.field] = val;
      if(t.tagName === "TEXTAREA"){
        autoGrow(t);
        var mirror = t.nextElementSibling;
        if(mirror && mirror.classList.contains("print-mirror")) mirror.innerHTML = bulletMirrorHtml(val);
      }
      scheduleSave();
      return;
    }
    if(t.dataset && t.dataset.day && t.dataset.imgField === "caption"){
      var d2 = findDay(t.dataset.day);
      if(!d2) return;
      var img = d2.images.filter(function(i){ return i.id === t.dataset.imgId; })[0];
      if(img){ img.caption = t.textContent; scheduleSave(); }
      return;
    }
  });

  // Enter in den Freitext-Feldern (Information/Notiz, Sonstiges/Vereinbarungen) setzt automatisch
  // einen neuen Spiegelstrich fort; Enter auf einem leeren "- " beendet die Liste wieder.
  container.addEventListener("keydown", function(e){
    if(e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    var ta = e.target;
    if(!(ta.tagName === "TEXTAREA" && ta.classList.contains("autogrow"))) return;
    e.preventDefault();
    var val = ta.value;
    var pos = ta.selectionStart;
    var lineStart = val.lastIndexOf("\n", pos - 1) + 1;
    var currentLine = val.slice(lineStart, pos);
    var isEmptyBullet = /^[ \t]*-[ \t]*$/.test(currentLine);
    var newVal, newPos;
    if(isEmptyBullet){
      newVal = val.slice(0, lineStart) + val.slice(pos);
      newPos = lineStart;
    } else {
      newVal = val.slice(0, pos) + "\n- " + val.slice(pos);
      newPos = pos + 3;
    }
    ta.value = newVal;
    ta.selectionStart = ta.selectionEnd = newPos;
    ta.dispatchEvent(new Event("input", {bubbles:true}));
  });

  // ---------- Stammdaten-Modal ----------
  var stammdatenOverlay = document.getElementById("stammdatenOverlay");
  function refreshProjectHead(){
    var bvEl = document.getElementById("bauvorhabenDisplay");
    var afEl = document.getElementById("auftraggeberDisplay");
    bvEl.textContent = state.bauvorhaben || "(noch nicht eingetragen)";
    bvEl.classList.toggle("ph-empty", !state.bauvorhaben);
    afEl.textContent = state.auftraggeber || "(noch nicht eingetragen)";
    afEl.classList.toggle("ph-empty", !state.auftraggeber);
    Array.prototype.forEach.call(document.querySelectorAll(".bauvorhaben-line"), function(el){
      el.textContent = "Bauvorhaben: " + state.bauvorhaben;
    });
  }
  function openStammdaten(){
    document.getElementById("sdBauvorhaben").value = state.bauvorhaben;
    document.getElementById("sdAuftraggeber").value = state.auftraggeber;
    document.getElementById("sdVerfasserRolle").value = state.verfasserRolleDefault;
    document.getElementById("sdOrtArt").value = state.ortArtDefault;
    stammdatenOverlay.classList.add("open");
    document.getElementById("sdBauvorhaben").focus();
  }
  function closeStammdaten(){ stammdatenOverlay.classList.remove("open"); }
  document.getElementById("sdBauvorhaben").addEventListener("input", function(e){ state.bauvorhaben = e.target.value; refreshProjectHead(); scheduleSave(); });
  document.getElementById("sdAuftraggeber").addEventListener("input", function(e){ state.auftraggeber = e.target.value; refreshProjectHead(); scheduleSave(); });
  document.getElementById("sdVerfasserRolle").addEventListener("input", function(e){ state.verfasserRolleDefault = e.target.value; scheduleSave(); });
  document.getElementById("sdOrtArt").addEventListener("input", function(e){ state.ortArtDefault = e.target.value; scheduleSave(); });
  document.getElementById("stammdatenBtn").addEventListener("click", openStammdaten);
  document.getElementById("stammdatenClose").addEventListener("click", closeStammdaten);
  document.getElementById("stammdatenDone").addEventListener("click", closeStammdaten);
  stammdatenOverlay.addEventListener("click", function(e){ if(e.target === stammdatenOverlay) closeStammdaten(); });
  window.addEventListener("keydown", function(e){ if(e.key === "Escape" && stammdatenOverlay.classList.contains("open")) closeStammdaten(); });

  container.addEventListener("click", function(e){
    var btn = e.target.closest("button");
    if(!btn) return;
    var action = btn.dataset.action;
    if(action === "day-up") moveDay(btn.dataset.day, -1);
    else if(action === "day-down") moveDay(btn.dataset.day, 1);
    else if(action === "del-day") deleteDay(btn.dataset.day);
    else if(action === "print-day") printSingleDay(btn.dataset.day);
    else if(action === "pdf-day") pdfBlatt(btn.dataset.day, btn);
    else if(action === "toggle-collapse"){
      var d = findDay(btn.dataset.day);
      if(d){ d.collapsed = !d.collapsed; scheduleSave(); render(); }
    }
    else if(action === "add-img"){
      var input = container.querySelector('.img-file-input[data-day="'+cssEscape(btn.dataset.day)+'"]');
      if(input) input.click();
    }
    else if(action === "img-up") moveImage(btn.dataset.day, btn.dataset.imgId, -1);
    else if(action === "img-down") moveImage(btn.dataset.day, btn.dataset.imgId, 1);
    else if(action === "img-del") deleteImage(btn.dataset.day, btn.dataset.imgId);
  });

  document.getElementById("dayNav").addEventListener("click", function(e){
    var chip = e.target.closest(".day-chip");
    if(!chip) return;
    var day = findDay(chip.dataset.jump);
    if(day && day.collapsed){ day.collapsed = false; scheduleSave(); render(); }
    var sheet = container.querySelector('.day-sheet[data-id="'+cssEscape(chip.dataset.jump)+'"]');
    if(sheet) sheet.scrollIntoView({behavior:"smooth", block:"start"});
  });

  document.getElementById("filterRow").addEventListener("click", function(e){
    var chip = e.target.closest(".filter-chip");
    if(!chip) return;
    activeFilter = chip.dataset.filter;
    Array.prototype.forEach.call(document.querySelectorAll(".filter-chip"), function(c){
      c.classList.toggle("active", c.dataset.filter === activeFilter);
    });
    render();
  });

  function cssEscape(s){ return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }

  container.addEventListener("change", function(e){
    if(e.target.classList && e.target.classList.contains("img-file-input")){
      processFiles(e.target.files, e.target.dataset.day);
      e.target.value = "";
      return;
    }
    // Datum fertig editiert (Picker-Auswahl oder Fokus verlassen) -> Reihenfolge neu sortieren.
    if(e.target.tagName === "INPUT" && e.target.type === "date" && e.target.dataset.field === "datum"){
      var dayId = e.target.dataset.day;
      sortReports();
      scheduleSave();
      render();
      var sheet = container.querySelector('.day-sheet[data-id="'+cssEscape(dayId)+'"]');
      if(sheet) sheet.scrollIntoView({behavior:"smooth", block:"nearest"});
    }
  });

  // Ganze Media-Spalte ist Drop-Ziel, nicht nur der kleine Hinweistext.
  container.addEventListener("dragenter", function(e){
    var zone = e.target.closest(".media-cell-inner");
    if(!zone) return;
    e.preventDefault();
    zone.classList.add("dragover");
  });
  container.addEventListener("dragover", function(e){
    var zone = e.target.closest(".media-cell-inner");
    if(!zone) return;
    e.preventDefault();
  });
  container.addEventListener("dragleave", function(e){
    var zone = e.target.closest(".media-cell-inner");
    if(!zone) return;
    // Nur entfernen, wenn die Maus die Zone wirklich verlässt (nicht nur zu einem Kind-Element wechselt).
    if(zone.contains(e.relatedTarget)) return;
    zone.classList.remove("dragover");
  });
  container.addEventListener("drop", function(e){
    var zone = e.target.closest(".media-cell-inner");
    if(!zone) return;
    e.preventDefault();
    zone.classList.remove("dragover");
    processFiles(e.dataTransfer.files, zone.dataset.dropDay);
  });

  window.addEventListener("paste", function(e){
    var active = document.activeElement;
    var sheet = active && active.closest && active.closest(".day-sheet");
    if(!sheet) return;
    var items = (e.clipboardData || {}).items || [];
    var files = [];
    for(var i=0;i<items.length;i++){
      if(items[i].type && items[i].type.indexOf("image/") === 0){
        var f = items[i].getAsFile();
        if(f) files.push(f);
      }
    }
    if(files.length){
      e.preventDefault();
      processFiles(files, sheet.dataset.id);
    }
  });

  var printOnlyId = null;
  function printSingleDay(id){
    printOnlyId = id;
    var sheet = container.querySelector('.day-sheet[data-id="'+cssEscape(id)+'"]');
    if(sheet) sheet.classList.add("print-target");
    document.body.classList.add("print-only-current");
    window.print();
  }
  window.addEventListener("afterprint", function(){
    document.body.classList.remove("print-only-current");
    Array.prototype.forEach.call(container.querySelectorAll(".print-target"), function(el){ el.classList.remove("print-target"); });
    printOnlyId = null;
  });

  document.getElementById("addDayBtn").addEventListener("click", addDay);
  document.getElementById("printAllBtn").addEventListener("click", function(){ window.print(); });
  document.getElementById("gesamtBtn").addEventListener("click", function(){ pdfGesamt(this); });

  // ---------- PDF speichern: einzelnes Blatt bzw. gesamtes Bautagebuch, abgelegt im Projektordner ----------
  var pdfLibPromise = null;
  function ladePdfLib(){
    if(!pdfLibPromise){
      var lade = function(src){ return new Promise(function(res, rej){ var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error(src + " nicht geladen")); }; document.head.appendChild(s); }); };
      pdfLibPromise = lade("lib/pdf-lib.min.js").then(function(){ return lade("bautagebuch-pdf.js?v=2"); });
      pdfLibPromise.catch(function(){ pdfLibPromise = null; });
    }
    return pdfLibPromise;
  }
  var ART = { tagesbericht: "Baubericht", telefonnotiz: "Telefonnotiz", videobesprechung: "Videobesprechung", email: "E-Mail-Abstimmung" };
  function jjmmtt(iso){ return String(iso || todayIso()).replace(/^\d\d(\d\d)-(\d\d)-(\d\d)$/, "$1$2$3"); }
  function pdfCfg(){ return (proj && proj.bautagebuch_pdf) || {}; }
  function dateiname(muster, r){
    var cfg = pdfCfg(), art = (cfg.art && cfg.art[r ? r.type : ""]) || (r ? ART[r.type] : "Bautagebuch");
    return muster.replace(/\{datum\}/g, jjmmtt(r && r.datum)).replace(/\{heute\}/g, jjmmtt(todayIso()))
      .replace(/\{nr\}/g, r ? String(r.nr || "").padStart(2, "0") : "").replace(/\{art\}/g, art).replace(/[\\/:*?"<>|]/g, "-");
  }
  function pdfPfad(name){ var sub = pdfCfg().ordner; return ordner + "/" + (sub ? sub + "/" : "") + name; }
  var mcVorlage = null;
  function holeVorlage(){
    if(!istMC()) return Promise.resolve(null);
    if(mcVorlage && mcVorlage.slug === proj.slug) return Promise.resolve(mcVorlage.buf);
    return io.readBlob(ordner + "/" + proj.bautagebuch_vorlage).then(function(b){ return b.arrayBuffer(); }).then(function(buf){
      mcVorlage = { slug: proj.slug, buf: buf }; return buf;
    }, function(e){ throw new Error("Vorlage " + proj.bautagebuch_vorlage + " nicht gefunden (" + (e.message || e) + ")"); });
  }
  function ablegen(name, bytes){
    var pfad = pdfPfad(name), blob = new Blob([bytes], { type: "application/pdf" });
    return io.write(pfad, blob, null, "application/pdf").catch(function(e){
      if(e.status !== 409) throw e;
      if(!confirm("„" + name + "“ gibt es im Projektordner schon.\n\nMit der neuen Fassung ersetzen? (OneDrive behält die alte Version im Versionsverlauf.)")) return "abbruch";
      return io.replace(pfad, blob, "application/pdf");
    }).then(function(x){
      if(x === "abbruch"){ setToolbarNote("Nicht gespeichert."); return; }
      var url = URL.createObjectURL(blob);
      zeigeHinweis('✓ Abgelegt: <b>' + esc((pdfCfg().ordner ? pdfCfg().ordner + " / " : "") + name) + '</b> &nbsp;<a href="' + url + '" target="_blank" rel="noopener">PDF ansehen</a>');
    });
  }
  function zeigeHinweis(html){ var n = document.getElementById("toolbarNote"); n.innerHTML = html; n.classList.add("ok"); setTimeout(function(){ n.classList.remove("ok"); }, 400); }
  function laeuft(btn, an){ if(btn){ btn.disabled = an; btn.dataset.txt = btn.dataset.txt || btn.textContent; btn.textContent = an ? "PDF wird erstellt …" : btn.dataset.txt; } }
  function pdfBlatt(id, btn){
    var r = findDay(id);
    if(!r || !proj) return;
    var cfg = pdfCfg();
    if(!cfg.name){ setToolbarNote("Für dieses Projekt ist noch kein PDF-Dateiname eingerichtet."); return; }
    laeuft(btn, true); setToolbarNote("");
    flush().then(ladePdfLib).then(holeVorlage).then(function(vorlage){
      return mcBlatt(r) ? window.BTPdf.modus(vorlage, r) : window.BTPdf.erzeuge(state, [r], LOGO_SRC, null, typeMeta(r.type).thema + " Nr. " + r.nr);
    }).then(function(bytes){ return ablegen(dateiname(cfg.name, r), bytes); })
      .catch(function(e){ setToolbarNote("PDF konnte nicht erstellt werden: " + (e.message || e)); console.error(e); })
      .then(function(){ laeuft(btn, false); });
  }
  function pdfGesamt(btn){
    if(!proj || !state.reports.length) return;
    var cfg = pdfCfg();
    if(!cfg.gesamt){ setToolbarNote("Für dieses Projekt ist noch kein Dateiname fürs Gesamt-PDF eingerichtet."); return; }
    laeuft(btn, true); setToolbarNote("");
    var alle = state.reports.slice();
    flush().then(ladePdfLib).then(holeVorlage).then(function(vorlage){
      return window.BTPdf.erzeuge(state, alle, LOGO_SRC, vorlage, "Bautagebuch " + proj.name);
    }).then(function(bytes){ return ablegen(dateiname(cfg.gesamt, null), bytes); })
      .catch(function(e){ setToolbarNote("PDF konnte nicht erstellt werden: " + (e.message || e)); console.error(e); })
      .then(function(){ laeuft(btn, false); });
  }
  (function(){   // Vorschlagsliste für die Maschinen im Modus-Consult-Formular
    var dl = document.createElement("datalist"); dl.id = "mcMaschinen";
    dl.innerHTML = MC_MASCHINEN.map(function(m){ return '<option value="' + esc(m) + '">'; }).join("");
    document.body.appendChild(dl);
  })();
  document.getElementById("exportBtn").addEventListener("click", async function(){
    var kopie = JSON.parse(JSON.stringify(toFile(state)));
    var bilder = []; state.reports.forEach(function(r){ r.images.forEach(function(img){ bilder.push(img); }); });
    setToolbarNote("Kopie wird erstellt …");
    var urls = await Promise.all(bilder.map(function(img){
      if(!img.dataUrl || img.dataUrl.indexOf("data:,") === 0) return null;
      if(img.dataUrl.indexOf("data:") === 0) return img.dataUrl;
      return fetch(img.dataUrl).then(function(r){ return r.blob(); }).then(blobToDataUrl).catch(function(){ return null; });
    }));
    var map = {}; bilder.forEach(function(img, i){ map[img.id] = urls[i]; });
    kopie.reports.forEach(function(r){ r.images.forEach(function(img){ if(map[img.id]) img.dataUrl = map[img.id]; }); });
    setToolbarNote("");
    var json = JSON.stringify(kopie, null, 2);
    var slug = (state.bauvorhaben || "bautagebuch").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,40) || "bautagebuch";
    var suggestedName = "bautagebuch_" + slug + "_" + todayIso() + ".json";

    // Bevorzugt: nativer "Speichern unter"-Dialog, damit der Zielordner frei wählbar ist
    // (statt automatisch im Downloads-Ordner zu landen). Nur in Chrome/Edge verfügbar;
    // fällt sonst auf den klassischen Download weiter unten zurück.
    if(window.showSaveFilePicker){
      try{
        var handle = await window.showSaveFilePicker({
          suggestedName: suggestedName,
          types: [{ description: "Bautagebuch-Sicherung", accept: {"application/json": [".json"]} }]
        });
        var writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      }catch(pickErr){
        if(pickErr && pickErr.name === "AbortError") return; // Nutzer hat den Dialog abgebrochen
        // sonst: unten weiter zum klassischen Download
      }
    }

    try{
      var blob = new Blob([json], {type:"application/json"});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    }catch(err){
      setToolbarNote("Download hat nicht funktioniert (z. B. weil die Seite in einer Vorschau ohne Download-Erlaubnis läuft). Bitte die lokal gespeicherte Datei im Browser öffnen und von dort exportieren.");
    }
  });
  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var parsed = JSON.parse(reader.result);
        if(!proj) return;
        var n = (parsed.reports || []).length;
        if(!confirm(n + " Blätter aus dieser Datei übernehmen und damit das Bautagebuch „" + proj.name + "“ ersetzen?"
          + (state.reports.length ? "\n\nDer bisherige Stand (" + state.reports.length + " Blätter) wird vorher in " + SICHERUNG_DIR + " gesichert." : ""))) return;
        state = normalizeState(parsed);
        state.reports.forEach(function(r){ r.images.forEach(function(img){ if(img.dataUrl && img.dataUrl.indexOf("data:") === 0) img.neu = true; }); });
        sortReports();
        render();
        setToolbarNote("Wird übernommen, Fotos werden hochgeladen …");
        persist();
      }catch(err){
        setToolbarNote("Diese Datei konnte nicht gelesen werden – ist es ein gültiger Bautagebuch-Export (.json)?");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  boot();
})();

