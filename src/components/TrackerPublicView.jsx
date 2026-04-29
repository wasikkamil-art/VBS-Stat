// TrackerPublicView — publiczna strona zleceniodawcy /t/{token} (bez auth).
// Pokazuje status frachtu w czasie rzeczywistym: pozycję pojazdu, postęp tras
// (R1+R2 multi-stop), ETA z compliance tachografu, galerie zdjęć (CMR + towar +
// uszkodzenia), szczegóły zlecenia.
//
// Wydzielone z monolitu App.jsx 2026-04-29 (TODO #5c krok 2). Lazy-loadowane —
// zleceniodawcy WIDZIELI wcześniej cały bundle FleetStat (1.87 MB) tylko żeby
// zobaczyć status paczki. Teraz dostają mały chunk + minimalne core.
//
// 3 komponenty wewnątrz pliku:
//   - TrackerPhotoCard (~22 linii) — galeria zdjęć dla jednej fazy (CMR/towar/etc)
//   - TrackerPhaseCard (~30 linii) — kafelek fazy z grupami zdjęć
//   - TrackerPublicView (~464 linii) — główny komponent (stepper + mapa + ETA + galerie)

import { useState, useEffect, Fragment } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKER PHOTO CARD — pojedyncza karta z galerią zdjęć dla jednej kategorii
// (klik miniatury otwiera oryginał w nowej karcie)
// ═══════════════════════════════════════════════════════════════════════════════
function TrackerPhotoCard({ title, urls }) {
  return (
    <div style={{ marginTop: 14, background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 0.3, marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc", display: "block" }}>
            <img src={url} alt="" loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKER PHASE CARD — karta fazowa (legacy, jeszcze użyta? — sprawdź)
// ═══════════════════════════════════════════════════════════════════════════════
function TrackerPhaseCard({ title, groups }) {
  return (
    <div style={{ marginTop: 14, background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: 0.3, marginBottom: 14 }}>
        {title}
      </div>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? 14 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3, marginBottom: 8, textTransform: "uppercase" }}>
            {g.label} <span style={{ color: "#94a3b8", fontWeight: 500 }}>· {g.urls.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {g.urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc", display: "block" }}>
                <img src={url} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKER PUBLIC VIEW — widok trackera dla zleceniodawcy (bez logowania)
// Renderowany na ścieżce /t/{token}. Fetchuje Cloud Function trackerData co 30s.
// ═══════════════════════════════════════════════════════════════════════════════
export default function TrackerPublicView({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!token) { setError("missing_token"); setLoading(false); return; }
    let active = true;
    const fetchData = async () => {
      try {
        const url = `https://europe-west1-vbs-stats.cloudfunctions.net/trackerData?token=${encodeURIComponent(token)}`;
        const resp = await fetch(url);
        const json = await resp.json();
        if (!active) return;
        if (!resp.ok || json.error) {
          setError(json.error || `http_${resp.status}`);
          setData(null);
        } else {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e.message || "network_error");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => { active = false; clearInterval(id); };
  }, [token]);

  // Tick co minutę dla "ostatnia aktualizacja X min temu"
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const fmtHHMM = (ms) => {
    if (!ms) return "—";
    return new Date(ms).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
  };
  const fmtDateSmart = (ms) => {
    if (!ms) return "—";
    const nowW = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
    const tgtW = new Date(new Date(ms).toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
    const nowDay = new Date(nowW.getFullYear(), nowW.getMonth(), nowW.getDate()).getTime();
    const tgtDay = new Date(tgtW.getFullYear(), tgtW.getMonth(), tgtW.getDate()).getTime();
    const diff = Math.round((tgtDay - nowDay) / 86400000);
    if (diff === 0) return `dziś ${fmtHHMM(ms)}`;
    if (diff === 1) return `jutro ${fmtHHMM(ms)}`;
    if (diff === -1) return `wczoraj ${fmtHHMM(ms)}`;
    const d = new Date(ms).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
    return `${d}, ${fmtHHMM(ms)}`;
  };
  const fmtRelative = (ms) => {
    if (!ms) return "";
    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);
    // tick w zależności żeby się odświeżało
    void tick;
    if (minutes < 1) return "przed chwilą";
    if (minutes < 60) return `${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h temu`;
  };

  // Wrapper layout
  const Shell = ({ children }) => (
    <div style={{
      minHeight: "100vh",
      background: "#f8f9fb",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px 16px 40px",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <img src="/logodologowania.png" alt="FleetStat" style={{ width: 200, maxWidth: "70%" }} />
        </div>
        {children}
        <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#9ca3af" }}>
          fleetstat.pl
        </div>
      </div>
    </div>
  );

  if (loading && !data) {
    return (
      <Shell>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", color: "#64748b" }}>
          Ładowanie…
        </div>
      </Shell>
    );
  }

  if (error === "not_found") {
    return (
      <Shell>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Link wygasł lub nieprawidłowy</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>Skontaktuj się z nadawcą, aby otrzymać nowy link.</div>
        </div>
      </Shell>
    );
  }

  if (error === "disabled") {
    return (
      <Shell>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Śledzenie zostało wyłączone</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>Nadawca zamknął dostęp do tego linku. Skontaktuj się z nim, jeśli potrzebujesz aktualnych informacji.</div>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>Nie udało się wczytać danych</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>Spróbuj odświeżyć stronę za chwilę.</div>
        </div>
      </Shell>
    );
  }

  const d = data || {};
  const nr = d.nrZlecenia || "—";
  const status = d.status; // "przed_trasa" | "w_trasie" | "zakonczony"

  // Stepper — dynamiczny: 4 kroki (bez R2) lub 5 kroków (z R2)
  // hasR2 z backendu wskazuje czy są 2 rozładunki
  const hasR2 = !!d.hasR2;
  const activeIdx = typeof d.activeStep === "number"
    ? d.activeStep
    : (status === "zakonczony" ? (hasR2 ? 4 : 3) : status === "w_trasie" ? 2 : 0);
  const steps = hasR2
    ? [
        { label: "Dojazd do załadunku", icon: "🚚" },
        { label: "Załadowano",           icon: "📦" },
        { label: "Rozładunek 1",         icon: "📍" },
        { label: "Rozładunek 2",         icon: "📍" },
        { label: "Dostarczono",          icon: "✅" },
      ]
    : [
        { label: "Dojazd do załadunku", icon: "🚚" },
        { label: "Załadowano",           icon: "📦" },
        { label: "W trasie",             icon: "🚛" },
        { label: "Dostarczono",          icon: "✅" },
      ];

  const Stepper = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 4px", gap: 4 }}>
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        const dotBg = done ? "#22c55e" : active ? "#3b82f6" : "#e2e8f0";
        const dotColor = done || active ? "#fff" : "#94a3b8";
        const labelColor = done ? "#15803d" : active ? "#1d4ed8" : "#94a3b8";
        const lineColor = done ? "#22c55e" : "#e2e8f0";
        return (
          <Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 50, position: "relative" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: dotBg, color: dotColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
                boxShadow: active ? "0 0 0 4px rgba(59,130,246,0.18)" : "none",
                transition: "all 0.3s",
              }}>
                {done ? "✓" : s.icon}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: labelColor, marginTop: 6, textAlign: "center", lineHeight: 1.2 }}>
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: lineColor, marginTop: -20, transition: "background 0.3s" }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );

  // Delay / ETA
  const delayMin = d.delayMin;
  const onTime = delayMin === null || delayMin === undefined ? null : delayMin <= 15;
  const pct = status === "zakonczony" ? 100 : Math.max(0, Math.min(100, d.percentDone || 0));
  const kmRem = d.kmRemaining != null ? d.kmRemaining : null;

  let banner = null;
  if (status === "zakonczony") {
    banner = {
      bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d",
      icon: "✅", title: "Dostawa zrealizowana",
      sub: d.plannedMs ? `Planowana: ${fmtDateSmart(d.plannedMs)}` : null,
    };
  } else if (status === "przed_trasa") {
    banner = {
      bg: "#f8fafc", border: "#e2e8f0", color: "#334155",
      icon: "🕐", title: "Oczekiwanie na wyjazd",
      sub: "Pojazd przygotowuje się do wyjazdu",
    };
  } else if (onTime === null) {
    banner = {
      bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8",
      icon: "🚛", title: "W trasie",
      sub: d.etaMs ? `Przewidywane dotarcie: ${fmtDateSmart(d.etaMs)}` : null,
    };
  } else if (onTime) {
    banner = {
      bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d",
      icon: "✅", title: "Dostawa na czas",
      sub: d.plannedMs ? `Planowana: ${fmtDateSmart(d.plannedMs)}` : null,
    };
  } else {
    const delayStr = delayMin >= 60 ? Math.round(delayMin / 60) + " h" : delayMin + " min";
    banner = {
      bg: "#fffbeb", border: "#fde68a", color: "#b45309",
      icon: "⏱️", title: `Przewidywane opóźnienie ${delayStr}`,
      sub: `Planowana: ${fmtDateSmart(d.plannedMs)} · Przewidywana: ${fmtDateSmart(d.etaMs)}`,
    };
  }

  // Karty dat — gdy etap już zrealizowany pokazujemy "✅ Załadowano/Rozładowano/Dostarczono"
  // zamiast planowanej daty (która jest już nieaktualna z punktu widzenia klienta).
  const stepNum = d.activeStep ?? 0;
  const dateCard = (title, ms, doneLabel) => (
    <div style={{
      flex: 1, padding: "12px 14px", minWidth: 0,
      background: doneLabel ? "#f0fdf4" : "#f8fafc",
      border: doneLabel ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: doneLabel ? "#15803d" : "#334155" }}>
        {doneLabel || fmtDateSmart(ms)}
      </div>
    </div>
  );
  const loadDateBox = d.plannedLoadMs ? dateCard("Załadunek", d.plannedLoadMs, stepNum >= 1 ? "✅ Załadowano" : null) : null;
  // Gdy hasR2: osobne karty dla R1 i R2. Gdy tylko R1: jedna karta "Planowana dostawa".
  const unloadR1Box = hasR2
    ? (d.plannedR1Ms ? dateCard("Rozładunek 1", d.plannedR1Ms, stepNum >= 3 ? "✅ Rozładowano" : null) : null)
    : (d.plannedMs ? dateCard("Planowana dostawa", d.plannedMs, stepNum >= 3 ? "✅ Dostarczono" : null) : null);
  const unloadR2Box = hasR2 && d.plannedR2Ms ? dateCard("Rozładunek 2", d.plannedR2Ms, stepNum >= 4 ? "✅ Dostarczono" : null) : null;

  return (
    <Shell>
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>Zlecenie nr</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: d.vehiclePlate ? 10 : 0 }}>{nr}</div>
            {d.vehiclePlate && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 0.3 }}>
                <span style={{ fontSize: 11 }}>🚛</span>
                <span>{d.vehiclePlate}</span>
                {d.vehicleMaxWeight ? (
                  <>
                    <span style={{ color: "#cbd5e1", fontWeight: 400 }}>·</span>
                    <span style={{ color: "#64748b" }}>{d.vehicleMaxWeight.toLocaleString("pl-PL")} kg</span>
                  </>
                ) : null}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/vbs-logo.png" alt="VBS" style={{ width: 120, height: "auto", display: "block" }} />
          </div>
        </div>

        {/* Stepper */}
        <Stepper />

        {/* Paski postępu — dla 2 rozładunków dwa osobne, dla 1 rozładunku jeden główny */}
        {hasR2 && status === "w_trasie" && typeof d.percentToR1 === "number" ? (
          <div style={{ marginTop: 22 }}>
            {/* R1 — gdy activeStep >= 3 (R1 ukończony) pokazujemy pełen pasek + Rozładowano ✓ */}
            {(() => {
              const r1Done = (d.activeStep ?? 0) >= 3;
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3, textTransform: "uppercase" }}>Rozładunek 1</div>
                    {r1Done ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                        ✅ Rozładowano
                      </div>
                    ) : d.kmToR1 != null && (
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        <span style={{ color: "#111827", fontWeight: 700 }}>{d.kmToR1} km</span> · {d.percentToR1}%
                      </div>
                    )}
                  </div>
                  <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      width: `${r1Done ? 100 : d.percentToR1}%`,
                      height: "100%",
                      background: r1Done
                        ? "linear-gradient(90deg,#22c55e,#15803d)"
                        : "linear-gradient(90deg,#38bdf8,#0ea5e9)",
                      borderRadius: 999,
                      transition: "width 0.6s ease-out",
                    }} />
                  </div>
                </div>
              );
            })()}
            {/* R2 — łącznie */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3, textTransform: "uppercase" }}>Rozładunek 2 (łącznie)</div>
                {kmRem != null && (
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                    <span style={{ color: "#111827", fontWeight: 700 }}>{kmRem} km</span> · {pct}%
                  </div>
                )}
              </div>
              <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#3b82f6,#1d4ed8)",
                  borderRadius: 999,
                  transition: "width 0.6s ease-out",
                }} />
              </div>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
              ℹ Przewidywany czas dotarcia do rozładunku 2 może ulec zmianie — zależy od czasu rozładunku przy pierwszym adresie.
            </div>

            {/* GPS link */}
            {typeof d.lat === "number" && typeof d.lng === "number" && (
              <a href={`https://www.google.com/maps?q=${d.lat},${d.lng}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, textDecoration: "none", fontSize: 12, color: "#075985" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{ fontWeight: 600 }}>Aktualna pozycja:</span>
                  <span style={{ fontFamily: "monospace" }}>{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</span>
                </span>
                <span style={{ fontWeight: 700, fontSize: 11 }}>Otwórz w mapach →</span>
              </a>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 22 }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{pct}%</div>
              {status === "w_trasie" && kmRem != null && (
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  Do celu: <span style={{ color: "#111827", fontWeight: 700 }}>{kmRem} km</span>
                </div>
              )}
            </div>
            <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`,
                height: "100%",
                background: status === "zakonczony"
                  ? "linear-gradient(90deg,#22c55e,#15803d)"
                  : "linear-gradient(90deg,#3b82f6,#1d4ed8)",
                borderRadius: 999,
                transition: "width 0.6s ease-out",
              }} />
            </div>

            {/* GPS link — tylko dla w_trasie gdy mamy pozycję */}
            {status === "w_trasie" && typeof d.lat === "number" && typeof d.lng === "number" && (
              <a href={`https://www.google.com/maps?q=${d.lat},${d.lng}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, textDecoration: "none", fontSize: 12, color: "#075985" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{ fontWeight: 600 }}>Aktualna pozycja:</span>
                  <span style={{ fontFamily: "monospace" }}>{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</span>
                </span>
                <span style={{ fontWeight: 700, fontSize: 11 }}>Otwórz w mapach →</span>
              </a>
            )}
          </div>
        )}

        {/* Daty */}
        {(loadDateBox || unloadR1Box || unloadR2Box) && (
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {loadDateBox}
            {unloadR1Box}
            {unloadR2Box}
          </div>
        )}

        {/* Status banner */}
        {banner && (
          <div style={{
            marginTop: 16,
            padding: "14px 16px",
            background: banner.bg,
            border: `1px solid ${banner.border}`,
            borderRadius: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: banner.sub ? 4 : 0 }}>
              <span style={{ fontSize: 22 }}>{banner.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: banner.color }}>{banner.title}</span>
            </div>
            {banner.sub && (
              <div style={{ fontSize: 13, color: banner.color, opacity: 0.85, marginLeft: 32 }}>{banner.sub}</div>
            )}
          </div>
        )}

        {/* Notka o tacho — tylko dla w_trasie */}
        {status === "w_trasie" && (
          <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.5, textAlign: "center", padding: "0 8px" }}>
            Przewidywany czas dostawy uwzględnia wymagane przerwy kierowcy wynikające z przepisów o czasie pracy.
          </div>
        )}
      </div>

      {/* Galerie zdjęć — osobne karty per kategoria, w kolejności drogi kierowcy:
          1. CMR z załadunku
          2. Zdjęcie towaru z załadunku
          3. CMR z rozładunku (lub R1 + R2 gdy fracht ma 2 rozładunki)
          4. Zdjęcie towaru po rozładunku (uszkodzenia, opcjonalne) */}
      {d.photos?.cmrZal?.length > 0 && (
        <TrackerPhotoCard title="📄 CMR z załadunku" urls={d.photos.cmrZal} />
      )}
      {d.photos?.towar?.length > 0 && (
        <TrackerPhotoCard title="📦 Zdjęcie towaru z załadunku" urls={d.photos.towar} />
      )}
      {d.photos?.cmrRoz?.length > 0 && (
        <TrackerPhotoCard title="📄 CMR z rozładunku" urls={d.photos.cmrRoz} />
      )}
      {d.photos?.cmrRozR1?.length > 0 && (
        <TrackerPhotoCard title="📄 CMR z rozładunku 1" urls={d.photos.cmrRozR1} />
      )}
      {d.photos?.cmrRozR2?.length > 0 && (
        <TrackerPhotoCard title="📄 CMR z rozładunku 2" urls={d.photos.cmrRozR2} />
      )}
      {d.photos?.damage?.length > 0 && (
        <TrackerPhotoCard title="⚠️ Zdjęcie towaru po rozładunku" urls={d.photos.damage} />
      )}

      {/* Ostatnia aktualizacja */}
      {d.updatedAt && (
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
          Ostatnia aktualizacja: {fmtRelative(d.updatedAt)}
        </div>
      )}
    </Shell>
  );
}
