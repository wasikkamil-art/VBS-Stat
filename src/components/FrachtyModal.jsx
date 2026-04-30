// FrachtyModal — admin modal dodawania/edycji zlecenia (~480 linii)
// + SendTrackerLinkModal (~220 linii) — generuje publiczny link tracker dla zleceniodawcy.
//
// Wydzielone z monolitu App.jsx 2026-04-29 (TODO #5c krok 6 — FINAL extraction).
// Lazy-loadowane — admin pobiera dopiero gdy klika „+ Dodaj fracht" lub edytuje.
//
// Wewnętrzne lazy-loaded sub-modale (kierowca/zleceniodawca komunikacja):
//   - CopyOrderPreviewModal — tekst do Signal/SMS/email
//   - WhatsappSendPreviewModal — wysyłka template do Meta WhatsApp Cloud API

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { httpsCallable } from "firebase/functions";

import { functions } from "../firebase";
import { safeHref } from "../utils/safeHref";
import { isFrachtRozladowany } from "../utils/frachtStatus";
import { logAction } from "../utils/logAction";
import TripSummaryPanel from "./TripSummaryPanel";
import ZlecenieUploadBtn from "./ZlecenieUploadBtn";

// Lazy sub-modale — pobierane dopiero gdy admin klika konkretny przycisk wewnątrz modala
const CopyOrderPreviewModal = lazy(() => import("./CopyOrderPreviewModal"));
const WhatsappSendPreviewModal = lazy(() => import("./WhatsappSendPreviewModal"));

export default function FrachtyModal({ record, vehicles, driverEvents = [], fuelEntries = [], onSave, onPatch = null, onClose, onAddReturn = null, defaultVehicleId="", appUsers = [], currentUser = null, showToast = () => {} }) {
  // ── pomocnik: rozbij "PL 44-100 Gliwice" → ["PL 44-100", "Gliwice"] ──
  function splitKM(s) {
    if (!s?.trim()) return ['',''];
    const t = s.trim();
    const m = t.match(/^([A-Z]{2}[\s-]?[\d][\S]*)\s+(.+)$/i);
    if (m) return [m[1].trim(), m[2].trim()];
    const p = t.split(/\s+/);
    return p.length >= 2 ? [p[0], p.slice(1).join(' ')] : [t, ''];
  }
  const initF = (rec) => {
    const base = {
      dataZlecenia:"", vehicleId: defaultVehicleId, skad:"",
      zaladunekFirma:"", zaladunekKodPocztowy:"", zaladunekMiasto:"", zaladunekKod:"",
      zaladunekAdres:"", zaladunekTelefon:"", zaladunekGeo:"",
      dataZaladunku:"", godzZaladunku:"",
      zaladunekFirma2:"", zaladunekKodPocztowy2:"", zaladunekMiasto2:"", zaladunekKod2:"",
      zaladunekAdres2:"", zaladunekTelefon2:"", zaladunekGeo2:"",
      dataZaladunku2:"", godzZaladunku2:"",
      rozladunekFirma:"", dokodPocztowy:"", dokodMiasto:"", dokod:"",
      rozladunekAdres:"", rozladunekTelefon:"", rozladunekGeo:"",
      dataRozladunku:"", godzRozladunku:"",
      rozladunekFirma2:"", dokodPocztowy2:"", dokodMiasto2:"", dokod2:"",
      rozladunekAdres2:"", rozladunekTelefon2:"", rozladunekGeo2:"",
      dataRozladunku2:"", godzRozladunku2:"",
      rozladunekFirma3:"", dokodPocztowy3:"", dokodMiasto3:"", dokod3:"",
      rozladunekAdres3:"", rozladunekTelefon3:"", rozladunekGeo3:"",
      dataRozladunku3:"", godzRozladunku3:"",
      rozladunekFirma4:"", dokodPocztowy4:"", dokodMiasto4:"", dokod4:"",
      rozladunekAdres4:"", rozladunekTelefon4:"", rozladunekGeo4:"",
      dataRozladunku4:"", godzRozladunku4:"",
      rozladunekFirma5:"", dokodPocztowy5:"", dokodMiasto5:"", dokod5:"",
      rozladunekAdres5:"", rozladunekTelefon5:"", rozladunekGeo5:"",
      dataRozladunku5:"", godzRozladunku5:"",
      zleceniodawcaFirma:"", zleceniodawcaOsoba:"", zleceniodawcaTelefon:"", zleceniodawcaEmail:"",
      nrZlecenia:"", nrRef:"", towarOpis:"", towarIloscPalet:"", towarPalety:"", zaladunekTyp:"",
      wagaLadunku:"", uwagi:"",
      klient:"", cenaEur:"", kmPodjazd:"", kmLadowne:"", kmWszystkie:"",
      dyspozytor:"", nrFV:"", dataWyslania:"", terminPlatnosci:"", urlZlecenie:"",
      // Round-trip linker — jeśli set, ten fracht jest powrotnym dla linkedFrachtId
      linkedFrachtId:"",
      // Email podsumowanie — co wysłać klientowi (defaults: adresy + CMR tak, zdjęcia wewnętrzne nie)
      emailContent: { adresy: true, cmrZal: true, cmrRoz: true, towar: false, damage: false },
    };
    if (!rec) return base;
    const mg = {...base, ...rec};
    // emailContent — merge z defaults gdy rec ma niepełną/legacy strukturę
    mg.emailContent = { ...base.emailContent, ...((rec.emailContent && typeof rec.emailContent === "object") ? rec.emailContent : {}) };
    if (!mg.zaladunekKodPocztowy && !mg.zaladunekMiasto && mg.zaladunekKod) { const [k,m] = splitKM(mg.zaladunekKod); mg.zaladunekKodPocztowy=k; mg.zaladunekMiasto=m; }
    if (!mg.zaladunekKodPocztowy2 && !mg.zaladunekMiasto2 && mg.zaladunekKod2?.trim()) { const [k,m] = splitKM(mg.zaladunekKod2); mg.zaladunekKodPocztowy2=k; mg.zaladunekMiasto2=m; }
    if (!mg.dokodPocztowy && !mg.dokodMiasto && mg.dokod) { const [k,m] = splitKM(mg.dokod); mg.dokodPocztowy=k; mg.dokodMiasto=m; }
    if (!mg.dokodPocztowy2 && !mg.dokodMiasto2 && mg.dokod2?.trim()) { const [k,m] = splitKM(mg.dokod2); mg.dokodPocztowy2=k; mg.dokodMiasto2=m; }
    if (!mg.dokodPocztowy3 && !mg.dokodMiasto3 && mg.dokod3?.trim()) { const [k,m] = splitKM(mg.dokod3); mg.dokodPocztowy3=k; mg.dokodMiasto3=m; }
    return mg;
  };
  const [f, setF] = useState(() => initF(record));
  const set = (k, v) => setF(prev => {
    const n = {...prev, [k]: v};
    if (k==='zaladunekKodPocztowy'||k==='zaladunekMiasto') n.zaladunekKod=[n.zaladunekKodPocztowy,n.zaladunekMiasto].filter(Boolean).join(' ');
    if (k==='zaladunekKodPocztowy2'||k==='zaladunekMiasto2') n.zaladunekKod2=[n.zaladunekKodPocztowy2,n.zaladunekMiasto2].filter(Boolean).join(' ');
    if (k==='dokodPocztowy'||k==='dokodMiasto') n.dokod=[n.dokodPocztowy,n.dokodMiasto].filter(Boolean).join(' ');
    if (k==='dokodPocztowy2'||k==='dokodMiasto2') n.dokod2=[n.dokodPocztowy2,n.dokodMiasto2].filter(Boolean).join(' ');
    if (k==='dokodPocztowy3'||k==='dokodMiasto3') n.dokod3=[n.dokodPocztowy3,n.dokodMiasto3].filter(Boolean).join(' ');
    if (k==='dokodPocztowy4'||k==='dokodMiasto4') n.dokod4=[n.dokodPocztowy4,n.dokodMiasto4].filter(Boolean).join(' ');
    if (k==='dokodPocztowy5'||k==='dokodMiasto5') n.dokod5=[n.dokodPocztowy5,n.dokodMiasto5].filter(Boolean).join(' ');
    const pod=parseInt(n.kmPodjazd)||0; const lad=parseInt(n.kmLadowne)||0;
    n.kmWszystkie = pod+lad>0 ? String(pod+lad) : "";
    return n;
  });
  const eurKmLad = f.kmLadowne && f.cenaEur ? (parseFloat(f.cenaEur)/parseInt(f.kmLadowne)).toFixed(2) : null;
  const eurKmWsz = f.kmWszystkie && f.cenaEur ? (parseFloat(f.cenaEur)/parseInt(f.kmWszystkie)).toFixed(2) : null;
  const [geoPickerFor, setGeoPickerFor] = useState(null); // "z1"|"z2"|"r1"|"r2"|"r3"|"r4"|"r5"
  const [showWhatsappPreview, setShowWhatsappPreview] = useState(false);
  const [showCopyPreview, setShowCopyPreview] = useState(false);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerTokenLive, setTrackerTokenLive] = useState(record?.trackerToken || "");
  const [showZ2, setShowZ2] = useState(!!(record?.zaladunekKodPocztowy2 || record?.zaladunekKod2?.trim()));
  const [showR2, setShowR2] = useState(!!(record?.dokodPocztowy2 || record?.dokod2?.trim()));
  const [showR3, setShowR3] = useState(!!(record?.dokodPocztowy3 || record?.dokod3?.trim()));
  const [showR4, setShowR4] = useState(!!(record?.dokodPocztowy4));
  const [showR5, setShowR5] = useState(!!(record?.dokodPocztowy5));
  const [sendingSummary, setSendingSummary] = useState(false);

  // Eventy filtrowane do rozładowanego-check + isRozladowany dla przycisku "Wyślij podsumowanie".
  // Inline filter (bez useMemo) — admin modal renders rzadko, mały koszt; useMemo z optional
  // chaining w deps powodowało react-hooks/purity error "Compilation Skipped".
  const myFrachtEvents = record?.id ? driverEvents.filter(e => e.frachtId === record.id) : [];
  const isRozladowanyForSummary = !!record?.id && isFrachtRozladowany(record, myFrachtEvents);

  // Manual send podsumowania — admin button "📧 Wyślij podsumowanie" w footerze.
  // Wywołuje CF finalizeTrip z force=true (bypass email idempotency).
  // Auto-trigger ma source="auto", manual ma source="manual" — rozróżnienie w emailLogs.
  const sendTripSummary = async () => {
    if (!record?.id) return;
    const recipientEmail = (f.zleceniodawcaEmail || record.zleceniodawcaEmail || "").trim();
    if (!recipientEmail) {
      showToast("⚠️ Brak email zleceniodawcy");
      return;
    }
    if (record.tripEmailSentAt) {
      const sentDate = new Date(record.tripEmailSentAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
      const ok = window.confirm(`Email z podsumowaniem wysłano: ${sentDate}\n\nWysłać ponownie?`);
      if (!ok) return;
    } else if (!window.confirm(`Wysłać podsumowanie trasy do:\n${recipientEmail}?`)) {
      return;
    }
    setSendingSummary(true);
    try {
      const finalizeTripCall = httpsCallable(functions, "finalizeTrip");
      const res = await finalizeTripCall({ frachtId: record.id, force: true, source: "manual" });
      const data = res?.data || {};
      logAction("manual_send_summary", "frachty", { frachtId: record.id, recipient: recipientEmail, ok: !!data.emailSent });
      if (data.emailSent) {
        showToast(`📧 Podsumowanie wysłane do ${recipientEmail}`);
      } else if (data.reason === "no_recipient") {
        showToast("⚠️ Brak email zleceniodawcy");
      } else if (data.reason === "no_sendgrid_config") {
        showToast("❌ Brak konfiguracji SendGrid");
      } else if (data.reason === "send_failed") {
        showToast(`❌ Błąd wysyłki: ${data.error || "nieznany"}`);
      } else {
        showToast("⚠️ Nie wysłano (sprawdź logi)");
      }
    } catch (e) {
      console.error("sendTripSummary error:", e);
      showToast(`❌ Błąd: ${e?.message || "nie udało się wysłać"}`);
    } finally {
      setSendingSummary(false);
    }
  };

  // 🔄 ROUND-TRIP — "Dodaj fracht powrotny": auto-fill nowego frachta jako odwrócona trasa
  // (Z = ostatni R, R = pierwszy Z), z tym samym klientem + pojazdem + dyspo.
  // Linkuje przez linkedFrachtId żeby tracker / driver app / email mógł grupować jako kółko.
  const addReturnFracht = () => {
    if (!record?.id) {
      showToast("⚠️ Najpierw zapisz fracht (trzeba mieć ID do zlinkowania)");
      return;
    }
    if (!f.dokod && !f.dokodMiasto && !f.dokod2 && !f.dokod3 && !f.dokod4 && !f.dokod5) {
      showToast("⚠️ Wpisz adres rozładunku zanim dodasz powrotny");
      return;
    }
    // Znajdź OSTATNI rozładunek (R5 → R4 → ... → R1) — punkt skąd kierowca rusza powrotem
    const lastIdx = (() => {
      for (let i = 5; i >= 2; i--) {
        const sfx = String(i);
        if (f[`dokodPocztowy${sfx}`] || f[`dokodMiasto${sfx}`] || f[`dokod${sfx}`]) return i;
      }
      return 1;
    })();
    const sfx = lastIdx === 1 ? "" : String(lastIdx);
    const lastR = {
      firma: f[`rozladunekFirma${sfx}`] || "",
      kodPocztowy: f[`dokodPocztowy${sfx}`] || "",
      miasto: f[`dokodMiasto${sfx}`] || "",
      kod: f[`dokod${sfx}`] || "",
      adres: f[`rozladunekAdres${sfx}`] || "",
      telefon: f[`rozladunekTelefon${sfx}`] || "",
      geo: f[`rozladunekGeo${sfx}`] || "",
      data: f[`dataRozladunku${sfx}`] || "",
      godz: f[`godzRozladunku${sfx}`] || "",
    };

    // Z1 powrotnego = ostatni R oryginalnego (kierowca załadowuje tam gdzie rozładował)
    // R1 powrotnego = Z1 oryginalnego (zwrot do bazy)
    const refLabel = record.nrZlecenia || record.nrRef || record.id.slice(0, 6);
    const prefilled = {
      // Pojazd + dyspo + klient (ten sam)
      vehicleId: f.vehicleId,
      dyspozytor: f.dyspozytor,
      klient: f.klient,
      zleceniodawcaFirma: f.zleceniodawcaFirma,
      zleceniodawcaOsoba: f.zleceniodawcaOsoba,
      zleceniodawcaTelefon: f.zleceniodawcaTelefon,
      zleceniodawcaEmail: f.zleceniodawcaEmail,

      // Z1 = ostatni R oryginalnego
      zaladunekFirma: lastR.firma,
      zaladunekKodPocztowy: lastR.kodPocztowy,
      zaladunekMiasto: lastR.miasto,
      zaladunekKod: lastR.kod,
      zaladunekAdres: lastR.adres,
      zaladunekTelefon: lastR.telefon,
      zaladunekGeo: lastR.geo,
      dataZaladunku: lastR.data, // editable
      godzZaladunku: lastR.godz,

      // R1 = Z1 oryginalnego (zwrot do A)
      rozladunekFirma: f.zaladunekFirma,
      dokodPocztowy: f.zaladunekKodPocztowy,
      dokodMiasto: f.zaladunekMiasto,
      dokod: f.zaladunekKod,
      rozladunekAdres: f.zaladunekAdres,
      rozladunekTelefon: f.zaladunekTelefon,
      rozladunekGeo: f.zaladunekGeo,
      // Daty + cenaEur do uzupełnienia ręcznie
      dataRozladunku: "",
      godzRozladunku: "",

      // Linker
      linkedFrachtId: record.id,
      uwagi: `🔄 Fracht powrotny — kółko z #${refLabel}`,
    };

    if (typeof onAddReturn === "function") {
      onAddReturn(prefilled);
    } else {
      showToast("❌ Brak handlera onAddReturn (bug konfiguracji)");
    }
  };

  const inp = "w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-gray-400";
  const lbl = "text-xs font-semibold text-gray-500 mb-1 block";

  // geo config per punkt
  const geoConf = {
    z1: { key:"zaladunekGeo", addr:()=>[f.zaladunekAdres,f.zaladunekKodPocztowy,f.zaladunekMiasto].filter(Boolean).join(', ') },
    z2: { key:"zaladunekGeo2", addr:()=>[f.zaladunekAdres2,f.zaladunekKodPocztowy2,f.zaladunekMiasto2].filter(Boolean).join(', ') },
    r1: { key:"rozladunekGeo", addr:()=>[f.rozladunekAdres,f.dokodPocztowy,f.dokodMiasto].filter(Boolean).join(', ') },
    r2: { key:"rozladunekGeo2", addr:()=>[f.rozladunekAdres2,f.dokodPocztowy2,f.dokodMiasto2].filter(Boolean).join(', ') },
    r3: { key:"rozladunekGeo3", addr:()=>[f.rozladunekAdres3,f.dokodPocztowy3,f.dokodMiasto3].filter(Boolean).join(', ') },
    r4: { key:"rozladunekGeo4", addr:()=>[f.rozladunekAdres4,f.dokodPocztowy4,f.dokodMiasto4].filter(Boolean).join(', ') },
    r5: { key:"rozladunekGeo5", addr:()=>[f.rozladunekAdres5,f.dokodPocztowy5,f.dokodMiasto5].filter(Boolean).join(', ') },
  };
  const geoBtn = (fk) => {
    const gc = geoConf[fk]; if (!gc) return null;
    const val = f[gc.key];
    return (
      <div className="flex items-center gap-2 mt-1">
        <button type="button" onClick={() => setGeoPickerFor(fk)}
          className="text-xs font-medium px-2 py-1 rounded-lg transition-all hover:bg-blue-50"
          style={{ color: val ? "#15803d" : "#3b82f6", background: val ? "#f0fdf4" : "transparent" }}>
          {val ? `✅ ${val}` : "📍 Ustaw lokalizację"}
        </button>
        {val && <button type="button" onClick={() => set(gc.key,"")} className="text-xs text-gray-400 hover:text-red-400">✕</button>}
      </div>
    );
  };

  const waDriver = (() => {
    const veh = vehicles.find(v => v.id === f.vehicleId);
    if (!veh?.assignedDriver) return null;
    return appUsers.find(u => u.email === veh.assignedDriver && u.role === "kierowca") || null;
  })();
  const dispatcherName = (currentUser?.displayName || currentUser?.name || (currentUser?.email || "").split("@")[0] || "Dyspozytor");
  const canSendWhatsapp = !!(record?.id && waDriver?.whatsappNumber);

  const onUploadedParsed = (url, parsed) => {
    set("urlZlecenie", url);
    if (!parsed) return;
    Object.entries(parsed).forEach(([k, v]) => {
      if (v == null || v === "") return;
      const sv = String(v);
      if (k === "zaladunekKod" && !f.zaladunekKodPocztowy) {
        const [kp, km] = splitKM(sv); set("zaladunekKodPocztowy", kp); set("zaladunekMiasto", km);
      } else if (k === "dokod" && !f.dokodPocztowy) {
        const [kp, km] = splitKM(sv); set("dokodPocztowy", kp); set("dokodMiasto", km);
      } else if (k === "dokod2" && !f.dokodPocztowy2) {
        const [kp, km] = splitKM(sv); set("dokodPocztowy2", kp); set("dokodMiasto2", km); setShowR2(true);
      } else if (!f[k]) {
        set(k, sv);
      }
    });
  };

  return (
    <>
    {geoPickerFor && geoConf[geoPickerFor] && (
      <GeoPickerModal
        initialGeo={f[geoConf[geoPickerFor].key] || ""}
        address={geoConf[geoPickerFor].addr()}
        onSave={(geo) => { set(geoConf[geoPickerFor].key, geo); setGeoPickerFor(null); }}
        onClose={() => setGeoPickerFor(null)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.4)"}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{maxHeight:"92vh"}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-900">{record ? "Edytuj fracht" : "Nowy fracht"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">

          {/* POJAZD + DATA */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className={lbl}>Pojazd</label><select value={f.vehicleId} onChange={e => set("vehicleId",e.target.value)} className={inp}><option value="">wybierz pojazd</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} {v.brand}</option>)}</select></div>
            <div><label className={lbl}>Data zlecenia</label><input type="date" value={f.dataZlecenia||""} onChange={e => set("dataZlecenia",e.target.value)} className={inp} /></div>
          </div>

          {/* ══ ZAŁADUNEK ══ */}
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-widest pt-1">Załadunek</div>

          {/* Z1 */}
          <div style={{border:"2px solid #a7f3d0",borderRadius:12,padding:"14px",background:"#f0fdf4"}}>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">📦 Z1 — Miejsce załadunku</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input placeholder="np. VANKING" value={f.zaladunekFirma||""} onChange={e => set("zaladunekFirma",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Kod pocztowy</label><input placeholder="np. PL-44100" value={f.zaladunekKodPocztowy||""} onChange={e => set("zaladunekKodPocztowy",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Miasto</label><input placeholder="np. Gliwice" value={f.zaladunekMiasto||""} onChange={e => set("zaladunekMiasto",e.target.value)} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Adres (ulica, nr)</label><input placeholder="ul. Przykładowa 1" value={f.zaladunekAdres||""} onChange={e => set("zaladunekAdres",e.target.value)} className={inp} />{geoBtn("z1")}</div>
              <div><label className={lbl}>Telefon kontaktowy</label><input placeholder="+48..." value={f.zaladunekTelefon||""} onChange={e => set("zaladunekTelefon",e.target.value)} className={inp} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Data załadunku</label><input type="date" value={f.dataZaladunku||""} onChange={e => set("dataZaladunku",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Godz.</label><input type="time" value={f.godzZaladunku||""} onChange={e => set("godzZaladunku",e.target.value)} className={inp} /></div>
              </div>
            </div>
          </div>

          {/* Z2 */}
          {showZ2 ? (
            <div style={{border:"2px solid #6ee7b7",borderRadius:12,padding:"14px",background:"#f0fdf4"}}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">📦 Z2 — Załadunek dodatkowy</div>
                <button type="button" onClick={() => { setShowZ2(false); ["zaladunekFirma2","zaladunekKodPocztowy2","zaladunekMiasto2","zaladunekKod2","zaladunekAdres2","zaladunekTelefon2","zaladunekGeo2","dataZaladunku2","godzZaladunku2"].forEach(k => set(k,"")); }} className="text-xs text-red-400 hover:text-red-600">✕ usuń Z2</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input value={f.zaladunekFirma2||""} onChange={e => set("zaladunekFirma2",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Kod pocztowy</label><input placeholder="np. DE 40210" value={f.zaladunekKodPocztowy2||""} onChange={e => set("zaladunekKodPocztowy2",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Miasto</label><input placeholder="np. Düsseldorf" value={f.zaladunekMiasto2||""} onChange={e => set("zaladunekMiasto2",e.target.value)} className={inp} /></div>
                <div className="col-span-2"><label className={lbl}>Adres (ulica, nr)</label><input placeholder="ul. Przykładowa 2" value={f.zaladunekAdres2||""} onChange={e => set("zaladunekAdres2",e.target.value)} className={inp} />{geoBtn("z2")}</div>
                <div><label className={lbl}>Telefon kontaktowy</label><input placeholder="+49..." value={f.zaladunekTelefon2||""} onChange={e => set("zaladunekTelefon2",e.target.value)} className={inp} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Data załadunku</label><input type="date" value={f.dataZaladunku2||""} onChange={e => set("dataZaladunku2",e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Godz.</label><input type="time" value={f.godzZaladunku2||""} onChange={e => set("godzZaladunku2",e.target.value)} className={inp} /></div>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowZ2(true)} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 pl-1">＋ dodaj drugi punkt załadunku</button>
          )}

          {/* ══ ROZŁADUNEK ══ */}
          <div className="text-xs font-bold text-blue-700 uppercase tracking-widest pt-2">Rozładunek</div>

          {/* R1 */}
          <div style={{border:"2px solid #bfdbfe",borderRadius:12,padding:"14px",background:"#eff6ff"}}>
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">🏁 R1 — Miejsce rozładunku</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input placeholder="np. LIFTING PIECES AUTO 94" value={f.rozladunekFirma||""} onChange={e => set("rozladunekFirma",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Kod pocztowy</label><input placeholder="np. FR 93000" value={f.dokodPocztowy||""} onChange={e => set("dokodPocztowy",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Miasto</label><input placeholder="np. Bobigny" value={f.dokodMiasto||""} onChange={e => set("dokodMiasto",e.target.value)} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Adres (ulica, nr)</label><input placeholder="ul. Rozładunkowa 1" value={f.rozladunekAdres||""} onChange={e => set("rozladunekAdres",e.target.value)} className={inp} />{geoBtn("r1")}</div>
              <div><label className={lbl}>Telefon kontaktowy</label><input placeholder="+33..." value={f.rozladunekTelefon||""} onChange={e => set("rozladunekTelefon",e.target.value)} className={inp} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Data rozładunku</label><input type="date" value={f.dataRozladunku||""} onChange={e => set("dataRozladunku",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Godz.</label><input type="time" value={f.godzRozladunku||""} onChange={e => set("godzRozladunku",e.target.value)} className={inp} /></div>
              </div>
            </div>
          </div>

          {/* R2 */}
          {showR2 ? (
            <div style={{border:"2px solid #93c5fd",borderRadius:12,padding:"14px",background:"#eff6ff"}}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">🏁 R2 — Rozładunek 2</div>
                <button type="button" onClick={() => { setShowR2(false); setShowR3(false); setShowR4(false); setShowR5(false); ["rozladunekFirma2","dokodPocztowy2","dokodMiasto2","dokod2","rozladunekAdres2","rozladunekTelefon2","rozladunekGeo2","dataRozladunku2","godzRozladunku2"].forEach(k => set(k,"")); }} className="text-xs text-red-400 hover:text-red-600">✕ usuń R2</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input value={f.rozladunekFirma2||""} onChange={e => set("rozladunekFirma2",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Kod pocztowy</label><input placeholder="np. BE 1000" value={f.dokodPocztowy2||""} onChange={e => set("dokodPocztowy2",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Miasto</label><input placeholder="np. Bruxelles" value={f.dokodMiasto2||""} onChange={e => set("dokodMiasto2",e.target.value)} className={inp} /></div>
                <div className="col-span-2"><label className={lbl}>Adres (ulica, nr)</label><input value={f.rozladunekAdres2||""} onChange={e => set("rozladunekAdres2",e.target.value)} className={inp} />{geoBtn("r2")}</div>
                <div><label className={lbl}>Telefon kontaktowy</label><input placeholder="+32..." value={f.rozladunekTelefon2||""} onChange={e => set("rozladunekTelefon2",e.target.value)} className={inp} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Data rozładunku</label><input type="date" value={f.dataRozladunku2||""} onChange={e => set("dataRozladunku2",e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Godz.</label><input type="time" value={f.godzRozladunku2||""} onChange={e => set("godzRozladunku2",e.target.value)} className={inp} /></div>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowR2(true)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 pl-1">＋ dodaj drugi punkt rozładunku</button>
          )}

          {/* R3 */}
          {showR2 && (showR3 ? (
            <div style={{border:"2px solid #93c5fd",borderRadius:12,padding:"14px",background:"#eff6ff"}}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">🏁 R3 — Rozładunek 3</div>
                <button type="button" onClick={() => { setShowR3(false); setShowR4(false); setShowR5(false); ["rozladunekFirma3","dokodPocztowy3","dokodMiasto3","dokod3","rozladunekAdres3","rozladunekTelefon3","rozladunekGeo3","dataRozladunku3","godzRozladunku3"].forEach(k => set(k,"")); }} className="text-xs text-red-400 hover:text-red-600">✕ usuń R3</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input value={f.rozladunekFirma3||""} onChange={e => set("rozladunekFirma3",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Kod pocztowy</label><input value={f.dokodPocztowy3||""} onChange={e => set("dokodPocztowy3",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Miasto</label><input value={f.dokodMiasto3||""} onChange={e => set("dokodMiasto3",e.target.value)} className={inp} /></div>
                <div className="col-span-2"><label className={lbl}>Adres</label><input value={f.rozladunekAdres3||""} onChange={e => set("rozladunekAdres3",e.target.value)} className={inp} />{geoBtn("r3")}</div>
                <div><label className={lbl}>Telefon</label><input value={f.rozladunekTelefon3||""} onChange={e => set("rozladunekTelefon3",e.target.value)} className={inp} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Data rozładunku</label><input type="date" value={f.dataRozladunku3||""} onChange={e => set("dataRozladunku3",e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Godz.</label><input type="time" value={f.godzRozladunku3||""} onChange={e => set("godzRozladunku3",e.target.value)} className={inp} /></div>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowR3(true)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 pl-1">＋ dodaj trzeci punkt rozładunku</button>
          ))}

          {/* R4 */}
          {showR3 && (showR4 ? (
            <div style={{border:"2px solid #93c5fd",borderRadius:12,padding:"14px",background:"#eff6ff"}}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">🏁 R4 — Rozładunek 4</div>
                <button type="button" onClick={() => { setShowR4(false); setShowR5(false); ["rozladunekFirma4","dokodPocztowy4","dokodMiasto4","dokod4","rozladunekAdres4","rozladunekTelefon4","rozladunekGeo4","dataRozladunku4","godzRozladunku4"].forEach(k => set(k,"")); }} className="text-xs text-red-400 hover:text-red-600">✕ usuń R4</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input value={f.rozladunekFirma4||""} onChange={e => set("rozladunekFirma4",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Kod pocztowy</label><input value={f.dokodPocztowy4||""} onChange={e => set("dokodPocztowy4",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Miasto</label><input value={f.dokodMiasto4||""} onChange={e => set("dokodMiasto4",e.target.value)} className={inp} /></div>
                <div className="col-span-2"><label className={lbl}>Adres</label><input value={f.rozladunekAdres4||""} onChange={e => set("rozladunekAdres4",e.target.value)} className={inp} />{geoBtn("r4")}</div>
                <div><label className={lbl}>Telefon</label><input value={f.rozladunekTelefon4||""} onChange={e => set("rozladunekTelefon4",e.target.value)} className={inp} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Data rozładunku</label><input type="date" value={f.dataRozladunku4||""} onChange={e => set("dataRozladunku4",e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Godz.</label><input type="time" value={f.godzRozladunku4||""} onChange={e => set("godzRozladunku4",e.target.value)} className={inp} /></div>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowR4(true)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 pl-1">＋ dodaj czwarty punkt rozładunku</button>
          ))}

          {/* R5 */}
          {showR4 && (showR5 ? (
            <div style={{border:"2px solid #93c5fd",borderRadius:12,padding:"14px",background:"#eff6ff"}}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">🏁 R5 — Rozładunek 5</div>
                <button type="button" onClick={() => { setShowR5(false); ["rozladunekFirma5","dokodPocztowy5","dokodMiasto5","dokod5","rozladunekAdres5","rozladunekTelefon5","rozladunekGeo5","dataRozladunku5","godzRozladunku5"].forEach(k => set(k,"")); }} className="text-xs text-red-400 hover:text-red-600">✕ usuń R5</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={lbl}>Nazwa firmy</label><input value={f.rozladunekFirma5||""} onChange={e => set("rozladunekFirma5",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Kod pocztowy</label><input value={f.dokodPocztowy5||""} onChange={e => set("dokodPocztowy5",e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Miasto</label><input value={f.dokodMiasto5||""} onChange={e => set("dokodMiasto5",e.target.value)} className={inp} /></div>
                <div className="col-span-2"><label className={lbl}>Adres</label><input value={f.rozladunekAdres5||""} onChange={e => set("rozladunekAdres5",e.target.value)} className={inp} />{geoBtn("r5")}</div>
                <div><label className={lbl}>Telefon</label><input value={f.rozladunekTelefon5||""} onChange={e => set("rozladunekTelefon5",e.target.value)} className={inp} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Data rozładunku</label><input type="date" value={f.dataRozladunku5||""} onChange={e => set("dataRozladunku5",e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Godz.</label><input type="time" value={f.godzRozladunku5||""} onChange={e => set("godzRozladunku5",e.target.value)} className={inp} /></div>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowR5(true)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 pl-1">＋ dodaj piąty punkt rozładunku</button>
          ))}

          {/* ══ TOWAR ══ */}
          <div className="text-xs font-bold text-gray-600 uppercase tracking-widest pt-2">Towar i uwagi</div>
          <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:"14px",background:"#fafafa"}}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={lbl}>Nr zlecenia</label><input placeholder="ZL/2026/001" value={f.nrZlecenia||""} onChange={e => set("nrZlecenia",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Nr referencyjny</label><input placeholder="ESTE-0097" value={f.nrRef||""} onChange={e => set("nrRef",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Towar (opis)</label><input placeholder="Palety, kartony..." value={f.towarOpis||""} onChange={e => set("towarOpis",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Ilość palet/szt</label><input placeholder="4" value={f.towarIloscPalet||""} onChange={e => set("towarIloscPalet",e.target.value)} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label className={lbl}>Typ załadunku</label><input placeholder="Bok, tył, góra" value={f.zaladunekTyp||""} onChange={e => set("zaladunekTyp",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Waga ładunku (kg)</label><input type="number" placeholder="0" value={f.wagaLadunku||""} onChange={e => set("wagaLadunku",e.target.value)} className={inp} /></div>
            </div>
            <div className="mt-3"><label className={lbl}>Wymiary palet / szczegóły</label><textarea rows={2} placeholder="2× 240x120x240, 1× 120x120xH240..." value={f.towarPalety||""} onChange={e => set("towarPalety",e.target.value)} className={inp+" resize-none"} /></div>
            <div className="mt-3"><label className={lbl}>Uwagi dla kierowcy</label><textarea rows={2} placeholder="dodatkowe informacje..." value={f.uwagi||""} onChange={e => set("uwagi",e.target.value)} className={inp+" resize-none"} /></div>
          </div>

          {/* ══ ZLECENIODAWCA ══ */}
          <div className="text-xs font-bold text-orange-600 uppercase tracking-widest pt-2">Zleceniodawca</div>
          <div style={{border:"1px solid #fed7aa",borderRadius:12,padding:"14px",background:"#fff7ed"}}>
            <div className="text-xs text-orange-500 mb-3">Dane do wysyłki trackera i kontaktu ze zleceniodawcą</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Firma</label><input placeholder="nazwa firmy" value={f.zleceniodawcaFirma||""} onChange={e => set("zleceniodawcaFirma",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Osoba kontaktowa</label><input placeholder="Jan Kowalski" value={f.zleceniodawcaOsoba||""} onChange={e => set("zleceniodawcaOsoba",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Telefon</label><input placeholder="+48..." value={f.zleceniodawcaTelefon||""} onChange={e => set("zleceniodawcaTelefon",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email</label><input type="email" placeholder="kontakt@firma.pl" value={f.zleceniodawcaEmail||""} onChange={e => set("zleceniodawcaEmail",e.target.value)} className={inp} /></div>
            </div>
          </div>

          {/* ══ EMAIL PODSUMOWANIE ══ */}
          <div className="text-xs font-bold text-blue-600 uppercase tracking-widest pt-2">📧 Email podsumowanie</div>
          <div style={{border:"1px solid #bfdbfe",borderRadius:12,padding:"14px",background:"#eff6ff"}}>
            <div className="text-xs text-blue-500 mb-3">Co wysłać klientowi po zakończeniu trasy (zawsze: nr zlecenia, klient, pojazd, km, czas, punktualność)</div>
            <div className="space-y-1.5">
              {[
                { k: "adresy", label: "📍 Pełne adresy załadunku/rozładunku", sub: "kody, miasta, pełne adresy, telefony kontaktowe" },
                { k: "cmrZal", label: "📄 CMR załadunkowe (linki)", sub: "linki do zdjęć dokumentów z załadunku" },
                { k: "cmrRoz", label: "📄 CMR rozładunkowe (linki)", sub: "linki do zdjęć z pieczątkami po dostawie" },
                { k: "towar", label: "📦 Zdjęcia towaru z załadunku", sub: "jak towar został zapakowany — zwykle wewnętrzne" },
                { k: "damage", label: "⚠️ Zdjęcia uszkodzeń", sub: "ewentualne uszkodzenia stwierdzone u odbiorcy" },
              ].map(opt => {
                const isOn = !!(f.emailContent && f.emailContent[opt.k]);
                return (
                  <label key={opt.k} className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-blue-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => set("emailContent", { ...(f.emailContent || {}), [opt.k]: !isOn })}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                      <div className="text-[11px] text-gray-500">{opt.sub}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ══ BIURO ══ */}
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest pt-2">Dane biurowe</div>
          <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:"14px",background:"#fafafa"}}>
            <div className="text-xs text-gray-400 mb-3">🔒 Kierowca nie widzi tych danych</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={lbl}>Klient</label><input placeholder="nazwa klienta" value={f.klient||""} onChange={e => set("klient",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Dyspozytor</label><input placeholder="imię dyspozytora" value={f.dyspozytor||""} onChange={e => set("dyspozytor",e.target.value)} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div><label className={lbl}>Cena EUR</label><input type="number" placeholder="0.00" value={f.cenaEur||""} onChange={e => set("cenaEur",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>KM podjazd</label><input type="number" placeholder="0" value={f.kmPodjazd||""} onChange={e => set("kmPodjazd",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>KM ładowne</label><input type="number" placeholder="0" value={f.kmLadowne||""} onChange={e => set("kmLadowne",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>KM wszystkie (auto)</label><input readOnly value={f.kmWszystkie||""} className={inp+" bg-gray-50 text-gray-400"} /></div>
            </div>
            {(eurKmLad||eurKmWsz) && <div className="flex gap-4 text-sm mt-2">{eurKmLad && <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold">EUR/km lad: {eurKmLad}</span>}{eurKmWsz && <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">EUR/km wsz: {eurKmWsz}</span>}</div>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <div><label className={lbl}>Nr FV</label><input placeholder="F/01/2026" value={f.nrFV||""} onChange={e => set("nrFV",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Data wysłania FV</label><input type="date" value={f.dataWyslania||""} onChange={e => set("dataWyslania",e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Termin płatności</label><input type="date" value={f.terminPlatnosci||""} onChange={e => set("terminPlatnosci",e.target.value)} className={inp} /></div>
            </div>
          </div>

          {/* PODSUMOWANIE TRASY */}
          {record && isFrachtRozladowany(record, driverEvents.filter(e => e.frachtId === record.id)) && (() => {
            const vehForSummary = vehicles.find(vv => vv.id === (record.vehicleId || f.vehicleId));
            return <TripSummaryPanel fracht={record} vehicle={vehForSummary} driverEvents={driverEvents} fuelEntries={fuelEntries} variant="full" />;
          })()}

          {/* ZLECENIE PDF */}
          <div className="pt-2 border-t border-gray-100">
            <label className={lbl}>📋 Zlecenie transportowe</label>
            {f.urlZlecenie ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <span className="text-2xl">📋</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-800">Zlecenie wgrane</div>
                  <a href={safeHref(f.urlZlecenie)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Otwórz dokument →</a>
                </div>
                <ZlecenieUploadBtn frachtId={record?.id || "new"} onUploaded={onUploadedParsed} label="Zastąp" />
                <button type="button" onClick={() => set("urlZlecenie","")} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50" title="Usuń zlecenie">✕</button>
              </div>
            ) : (
              <ZlecenieUploadBtn frachtId={record?.id || "new"} onUploaded={onUploadedParsed} label="📎 Wgraj zlecenie (PDF / JPG)" fullWidth />
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {/* Status: email z podsumowaniem trasy — pokazuje datę wysyłki + odbiorcę */}
          {record?.id && record?.tripEmailSentAt && (
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1 justify-end flex-wrap">
              <span>📧 Podsumowanie wysłane: {new Date(record.tripEmailSentAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}</span>
              {(record.tripEmailRecipient || record.zleceniodawcaEmail) && (
                <span className="text-gray-400">→ {record.tripEmailRecipient || record.zleceniodawcaEmail}</span>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 flex-wrap">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Anuluj</button>
            <button onClick={() => setShowCopyPreview(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
              style={{background: "#6366f1"}}
              title="Podgląd danych zlecenia gotowy do skopiowania (Signal / SMS / email / inny komunikator)">
              📋 Kopiuj dane
            </button>
            {record?.id && (
              <button onClick={() => setShowTrackerModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                style={{background: "#0ea5e9"}}
                title="Wyślij zleceniodawcy link do śledzenia trasy">
                🔗 Wyślij tracker
              </button>
            )}
            {canSendWhatsapp && (
              <button onClick={() => setShowWhatsappPreview(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                style={{background:"#25D366"}}
                title={`Wyślij zlecenie na WhatsApp do: ${waDriver.displayName || waDriver.email}`}>
                📱 Wyślij na WhatsApp
              </button>
            )}
            {record?.id && typeof onAddReturn === "function" && (
              <button onClick={addReturnFracht}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                style={{background: "#9333ea"}}
                title="Auto-fill nowego frachtu jako odwrócona trasa (Z=R, R=Z) z tym samym klientem + pojazdem">
                🔄 Dodaj fracht powrotny
              </button>
            )}
            {record?.id && (() => {
              const recipient = (f.zleceniodawcaEmail || record.zleceniodawcaEmail || "").trim();
              const noEmail = !recipient;
              const notUnloaded = !isRozladowanyForSummary;
              const disabled = sendingSummary || noEmail || notUnloaded;
              const tooltip = noEmail ? "Brak email zleceniodawcy"
                : notUnloaded ? "Fracht jeszcze nie rozładowany"
                : record.tripEmailSentAt ? `Wyślij ponownie (poprzednio: ${new Date(record.tripEmailSentAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })})`
                : `Wyślij email z podsumowaniem trasy do: ${recipient}`;
              return (
                <button onClick={sendTripSummary} disabled={disabled}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{background: "#0891b2"}}
                  title={tooltip}>
                  {sendingSummary ? "⏳ Wysyłam..." : "📧 Wyślij podsumowanie"}
                </button>
              );
            })()}
            <button onClick={() => {
              if(!f.vehicleId){alert("Wybierz pojazd");return;}
              if(!f.cenaEur){alert("Wpisz cenę EUR");return;}
              // Heurystyka: adres zawierający enumerację "1. ... 2. ..." prawdopodobnie skleja
              // wiele punktów rozładunku w jedno pole — powinny być rozdzielone na R1/R2/...
              const hasMulti = (addr) => addr && /(^|\n)\s*1\.\s/.test(addr) && /(^|\n)\s*2\.\s/.test(addr);
              const multistopFields = [];
              if (hasMulti(f.zaladunekAdres))   multistopFields.push("Załadunek Z1");
              if (hasMulti(f.zaladunekAdres2))  multistopFields.push("Załadunek Z2");
              if (hasMulti(f.rozladunekAdres))  multistopFields.push("Rozładunek R1");
              if (hasMulti(f.rozladunekAdres2)) multistopFields.push("Rozładunek R2");
              if (hasMulti(f.rozladunekAdres3)) multistopFields.push("Rozładunek R3");
              if (hasMulti(f.rozladunekAdres4)) multistopFields.push("Rozładunek R4");
              if (hasMulti(f.rozladunekAdres5)) multistopFields.push("Rozładunek R5");
              if (multistopFields.length) {
                const ok = confirm(`Uwaga: pole(a) ${multistopFields.join(", ")} wygląda jakby zawierało wiele adresów ("1. ... 2. ..."). Powinieneś rozdzielić je na osobne punkty (R1, R2, ...).\n\nZapisać mimo to?`);
                if (!ok) return;
              }
              onSave(f);
            }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"#111827"}}>{record ? "Zapisz zmiany" : "Dodaj fracht"}</button>
          </div>
        </div>
      </div>
    </div>
    {showWhatsappPreview && canSendWhatsapp && (
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center" style={{background:"rgba(0,0,0,0.4)", zIndex:10000}}><div className="bg-white rounded-xl px-6 py-4 text-sm text-gray-500">📱 Ładowanie…</div></div>}>
        <WhatsappSendPreviewModal
          fracht={{...f, id: record?.id}}
          driver={waDriver}
          dispatcherName={dispatcherName}
          onClose={() => setShowWhatsappPreview(false)}
          onSent={() => { setShowWhatsappPreview(false); showToast && showToast("Wysłano na WhatsApp", "success"); }}
          showToast={showToast}
        />
      </Suspense>
    )}
    {showCopyPreview && (
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center" style={{background:"rgba(0,0,0,0.4)", zIndex:10000}}><div className="bg-white rounded-xl px-6 py-4 text-sm text-gray-500">📋 Ładowanie…</div></div>}>
        <CopyOrderPreviewModal
          fracht={f}
          vehicles={vehicles}
          showToast={showToast}
          onClose={() => setShowCopyPreview(false)}
        />
      </Suspense>
    )}
    {showTrackerModal && record?.id && (
      <SendTrackerLinkModal
        fracht={f}
        frachtId={record.id}
        trackerToken={trackerTokenLive}
        trackerEnabled={record.trackerEnabled !== false}
        initialShow={record.trackerShow || {}}
        onTokenGenerated={(t) => {
          setTrackerTokenLive(t);
          if (onPatch) onPatch(record.id, { trackerToken: t, trackerEnabled: true });
        }}
        onShowChange={(newShow) => {
          if (onPatch) onPatch(record.id, { trackerShow: newShow });
        }}
        onToggleEnabled={(enabled) => {
          if (onPatch) onPatch(record.id, { trackerEnabled: enabled });
        }}
        showToast={showToast}
        onClose={() => setShowTrackerModal(false)}
      />
    )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND TRACKER LINK MODAL — publiczny link do śledzenia dla zleceniodawcy
// Generuje trackerToken jeśli nie istnieje, daje opcje: kopiuj / WhatsApp / email.
// ═══════════════════════════════════════════════════════════════════════════════
function SendTrackerLinkModal({ fracht, frachtId, trackerToken, trackerEnabled = true, initialShow = {}, onTokenGenerated, onShowChange, onToggleEnabled, showToast, onClose }) {
  const initialToken = trackerToken || "";
  const [token, setToken] = useState(initialToken);
  const [enabled, setEnabled] = useState(trackerEnabled);
  const [show, setShow] = useState({
    cmrZal: !!initialShow.cmrZal,
    cmrRoz: !!initialShow.cmrRoz,
    towar: !!initialShow.towar,
    damage: !!initialShow.damage,
  });

  useEffect(() => {
    if (!token) {
      // Generuj losowy token (crypto.randomUUID() wspierane w nowoczesnych przeglądarkach)
      const newToken = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
      setToken(newToken);
      onTokenGenerated && onTokenGenerated(newToken);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleShow = (key) => {
    const next = { ...show, [key]: !show[key] };
    setShow(next);
    onShowChange && onShowChange(next);
  };

  const toggleEnabled = () => {
    const next = !enabled;
    const msg = next
      ? "Włączyć ponownie śledzenie dla zleceniodawcy?"
      : 'Wyłączyć śledzenie? Zleceniodawca zobaczy "Śledzenie wyłączone" zamiast trasy.';
    if (!window.confirm(msg)) return;
    setEnabled(next);
    onToggleEnabled && onToggleEnabled(next);
    showToast(next ? "Tracker włączony" : "Tracker wyłączony");
  };

  const link = token ? `https://fleetstat.pl/t/${token}` : "";
  const nrZl = fracht?.nrZlecenia || fracht?.nrRef || "";
  const firma = fracht?.zleceniodawcaFirma || "";
  const telefon = (fracht?.zleceniodawcaTelefon || "").trim();
  const email = (fracht?.zleceniodawcaEmail || "").trim();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link skopiowany");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = link; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        showToast("Link skopiowany");
      } catch {
        showToast("Nie udało się skopiować — skopiuj ręcznie");
      }
    }
  };

  const sendWhatsapp = () => {
    const msg = [
      firma ? `Dzień dobry${firma ? " " + firma : ""},` : "Dzień dobry,",
      "",
      `Śledzenie przesyłki${nrZl ? " (nr " + nrZl + ")" : ""}:`,
      link,
      "",
      "Pozdrawiamy,",
      "FleetStat",
    ].join("\n");
    const digits = telefon.replace(/[^\d+]/g, "").replace(/^\+/, "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sendEmail = () => {
    const subject = `Śledzenie przesyłki${nrZl ? " — zlecenie nr " + nrZl : ""}`;
    const body = [
      firma ? `Dzień dobry${firma ? " " + firma : ""},` : "Dzień dobry,",
      "",
      `Poniżej link do śledzenia przesyłki${nrZl ? " (nr zlecenia: " + nrZl + ")" : ""}.`,
      "Informacje są aktualizowane na bieżąco.",
      "",
      link,
      "",
      "Pozdrawiamy,",
      "FleetStat",
    ].join("\n");
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-gray-800">🔗 Wyślij tracker</div>
            <div className="text-xs text-gray-500 mt-0.5">Publiczny link do śledzenia dla zleceniodawcy</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {nrZl && (
            <div className="text-sm text-gray-600">
              Zlecenie: <span className="font-semibold text-gray-900">{nrZl}</span>
              {firma && <> · <span className="text-gray-700">{firma}</span></>}
            </div>
          )}

          {/* Status włączenia trackera */}
          <div className="flex items-center justify-between p-3 rounded-xl border"
            style={{
              background: enabled ? "#f0fdf4" : "#fef2f2",
              borderColor: enabled ? "#bbf7d0" : "#fecaca",
            }}>
            <div className="flex items-center gap-2.5">
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: enabled ? "#22c55e" : "#ef4444",
                boxShadow: enabled ? "0 0 0 3px rgba(34,197,94,0.25)" : "0 0 0 3px rgba(239,68,68,0.25)",
                display: "inline-block",
              }}></span>
              <div>
                <div className="text-sm font-bold" style={{ color: enabled ? "#15803d" : "#b91c1c" }}>
                  {enabled ? "Tracker włączony" : "Tracker wyłączony"}
                </div>
                <div className="text-[11px]" style={{ color: enabled ? "#166534" : "#991b1b" }}>
                  {enabled ? "Link działa — zleceniodawca widzi trasę" : 'Zleceniodawca widzi "Śledzenie wyłączone"'}
                </div>
              </div>
            </div>
            <button onClick={toggleEnabled}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: enabled ? "#dc2626" : "#16a34a" }}>
              {enabled ? "Wyłącz" : "Włącz"}
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">Co pokazać zleceniodawcy</label>
            <div className="space-y-1.5">
              {[
                { k: "cmrZal", label: "📄 CMR z załadunku",       sub: "dokument z załadunku (weryfikacja zgodności ze zleceniem)" },
                { k: "towar",  label: "📦 Zdjęcie towaru z załadunku", sub: "jak towar został zapakowany / załadowany" },
                { k: "cmrRoz", label: "📄 CMR z rozładunku",      sub: "dokument z pieczątką po dostawie" },
                { k: "damage", label: "⚠️ Zdjęcie towaru po rozładunku", sub: "ewentualne uszkodzenia stwierdzone u odbiorcy" },
              ].map(opt => (
                <label key={opt.k} className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!show[opt.k]}
                    onChange={() => toggleShow(opt.k)}
                    className="mt-0.5 w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                    <div className="text-[11px] text-gray-500">{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-gray-400 mt-1 pl-1">Nic nie zaznaczone = tylko statusy i trasa (bez zdjęć).</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Link</label>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={link}
                onFocus={e => e.target.select()}
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 font-mono text-gray-700"
              />
              <button onClick={copyLink}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{background:"#6366f1"}}
                title="Skopiuj do schowka">
                📋
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              Klient zobaczy: nr zlecenia, pasek postępu, status trasy, km do celu, ETA i — jeśli w trasie — aktualne koordynaty GPS.
              Dane wewnętrzne (cena, dyspozytor, adresy) są ukryte.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={sendWhatsapp}
              disabled={!telefon}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{background:"#25D366"}}
              title={telefon ? `Wyślij przez WhatsApp na ${telefon}` : "Brak telefonu zleceniodawcy"}>
              📱 WhatsApp{telefon ? "" : " (brak tel.)"}
            </button>
            <button onClick={sendEmail}
              disabled={!email}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{background:"#0284c7"}}
              title={email ? `Wyślij email na ${email}` : "Brak emaila zleceniodawcy"}>
              ✉️ Email{email ? "" : " (brak)"}
            </button>
          </div>

          {(!telefon || !email) && (
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aby skorzystać z WhatsApp/email, uzupełnij dane zleceniodawcy w sekcji „Zleceniodawca".
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-200">Zamknij</button>
        </div>
      </div>
    </div>
  );
}
function GeoPickerModal({ initialGeo, address, onSave, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState(address || "");
  const hasRealGeo = initialGeo && (() => {
    const [lat, lng] = initialGeo.split(",").map(Number);
    return lat && lng && !(Math.abs(lat - 51.5) < 0.01 && Math.abs(lng - 19.0) < 0.01);
  })();
  const [coords, setCoords] = useState(() => {
    if (hasRealGeo) {
      const [lat, lng] = initialGeo.split(",").map(Number);
      return { lat, lng };
    }
    return { lat: 52.0, lng: 19.0 };
  });
  // hasPinned: czy user już ustawił pinezkę (klik lub drag). Przy edycji istniejącej geo → true.
  const [hasPinned, setHasPinned] = useState(hasRealGeo);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    if (typeof window.L === "undefined") return;
    const map = window.L.map(mapRef.current).setView([coords.lat, coords.lng], hasRealGeo ? 15 : 6);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    // Pinezka niewidoczna dopóki user nie kliknie / nie przeciągnie (ukryta przez opacity 0)
    const marker = window.L.marker([coords.lat, coords.lng], { draggable: true, opacity: hasRealGeo ? 1 : 0 }).addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      setCoords({ lat: pos.lat, lng: pos.lng });
      setHasPinned(true);
      marker.setOpacity(1);
    });
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      setHasPinned(true);
      marker.setOpacity(1);
    });
    mapInstance.current = map;
    markerRef.current = marker;
    // Przy NOWYM wyborze: auto-pan do adresu, ale BEZ stawiania pinezki
    if (address && !hasRealGeo) {
      setTimeout(() => panToAddress(address), 500);
    }
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Wyciąga lat,lng ze stringu (np. wklejone z Google Maps: "50.027385, 19.942322")
  // Obsługiwane formaty: "50.02, 19.94" / "50.02,19.94" / "50.02 19.94" (spacja zamiast przecinka)
  const parseCoords = (str) => {
    if (!str) return null;
    const m = String(str).trim().match(/^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  };

  // Umieszcza pinezkę pod podanymi współrzędnymi (lat,lng) — NIE wymaga kliknięcia w mapę
  const placePinAt = (lat, lng) => {
    if (!mapInstance.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    markerRef.current.setOpacity(1);
    mapInstance.current.setView([lat, lng], 17); // zoom blisko żeby user zweryfikował
    setCoords({ lat, lng });
    setHasPinned(true);
  };

  // Przesuwa mapę do wyniku Nominatim — NIE stawia pinezki
  const panToAddress = async (query) => {
    if (!query?.trim()) return;
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await resp.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        if (mapInstance.current) {
          mapInstance.current.setView([parseFloat(lat), parseFloat(lon)], 15);
        }
      }
    } catch (e) { console.error("Geocoding error:", e); }
  };

  // "Szukaj / Ustaw" — jeśli user wpisał współrzędne → stawiamy pin bezpośrednio.
  // Inaczej traktujemy jako adres → pan do Nominatim (user potem klika w mapę).
  const searchAddress = async (query) => {
    if (!query?.trim()) return;
    const c = parseCoords(query);
    if (c) { placePinAt(c.lat, c.lng); return; }
    setSearching(true);
    await panToAddress(query);
    setSearching(false);
  };

  // Czy aktualny input to współrzędne? — wpływa na etykietę przycisku
  const inputIsCoords = !!parseCoords(searchQuery);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.6)", zIndex: 9999}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{maxHeight:"90vh"}}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">📍 Wybierz lokalizację</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-5 py-3">
          <div className="flex gap-2">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchAddress(searchQuery)}
              placeholder="Wklej współrzędne (np. 50.027385, 19.942322) lub wpisz adres"
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{borderColor: inputIsCoords ? "#10b981" : "#e5e7eb"}} />
            <button onClick={() => searchAddress(searchQuery)} disabled={searching}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white whitespace-nowrap"
              style={{background: searching ? "#9ca3af" : inputIsCoords ? "#10b981" : "#3b82f6"}}>
              {searching ? "..." : inputIsCoords ? "📍 Ustaw pinezkę" : "Szukaj"}
            </button>
          </div>
          <div className="text-[11px] mt-1 text-gray-400">
            💡 Tip: w Google Maps kliknij prawym na punkt (Street View znajdzie wjazd) → kopiuj współrzędne → wklej tutaj → "Ustaw pinezkę"
          </div>
          <div className="text-xs mt-1" style={{color: hasPinned ? "#9ca3af" : "#dc2626", fontWeight: hasPinned ? 400 : 600}}>
            {hasPinned
              ? "Możesz przeciągnąć pinezkę lub kliknąć ponownie, aby skorygować."
              : "⚠️ Wklej współrzędne z Google lub kliknij w mapę na dokładne miejsce (np. brama wjazdowa)."}
          </div>
        </div>
        <div ref={mapRef} style={{height: 350, width: "100%"}}></div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {hasPinned ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : <span style={{color: "#dc2626"}}>Pinezka nie ustawiona</span>}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100">Anuluj</button>
            <button onClick={() => onSave(`${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`)}
              disabled={!hasPinned}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{background: hasPinned ? "#111827" : "#9ca3af", cursor: hasPinned ? "pointer" : "not-allowed"}}>
              ✓ Zapisz lokalizację
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
