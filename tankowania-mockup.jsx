import { useState } from "react";

const MOCK_ENTRIES = [
  { id: 1, date: "2026-04-15", liters: 412, mileage: 845230, station: "Shell Wrocław A4", cardNr: "EW-4821", pricePerL: 5.89, country: "PL", fullTank: true },
  { id: 2, date: "2026-04-11", liters: 385, mileage: 844102, station: "Orlen Legnica", cardNr: "EW-4821", pricePerL: 5.79, country: "PL", fullTank: true },
  { id: 3, date: "2026-04-07", liters: 290, mileage: 842850, station: "TotalEnergies Köln", cardNr: "EW-4821", pricePerL: 1.62, country: "DE", fullTank: false },
  { id: 4, date: "2026-04-03", liters: 405, mileage: 841600, station: "BP Antwerpen", cardNr: "EW-4821", pricePerL: 1.71, country: "BE", fullTank: true },
  { id: 5, date: "2026-03-30", liters: 350, mileage: 840200, station: "Shell Rotterdam", cardNr: "EW-4821", pricePerL: 1.65, country: "NL", fullTank: true },
];

const COUNTRIES = ["PL","DE","NL","BE","FR","CZ","AT","IT","ES","LU","DK","SE","HU","SK","LT","LV","RO","BG","HR","SI"];

function formatDate(d) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function calcConsumption(entries) {
  const full = entries.filter(e => e.fullTank);
  if (full.length < 2) return null;
  const sorted = [...full].sort((a, b) => a.mileage - b.mileage);
  const totalL = sorted.slice(1).reduce((s, e) => s + e.liters, 0);
  const totalKm = sorted[sorted.length - 1].mileage - sorted[0].mileage;
  return totalKm > 0 ? ((totalL / totalKm) * 100).toFixed(1) : null;
}

export default function TankowaniaMockup() {
  const [view, setView] = useState("list"); // list | form | stats
  const [entries, setEntries] = useState(MOCK_ENTRIES);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    liters: "",
    mileage: "",
    station: "",
    cardNr: "EW-4821",
    pricePerL: "",
    country: "PL",
    fullTank: true,
  });

  const avg = calcConsumption(entries);
  const totalL = entries.reduce((s, e) => s + e.liters, 0);
  const sortedByMileage = [...entries].sort((a, b) => b.mileage - a.mileage);
  const totalKm = sortedByMileage.length >= 2
    ? sortedByMileage[0].mileage - sortedByMileage[sortedByMileage.length - 1].mileage
    : 0;

  const handleSubmit = () => {
    if (!form.liters || !form.mileage) return;
    setEntries([
      { ...form, id: Date.now(), liters: +form.liters, mileage: +form.mileage, pricePerL: +form.pricePerL || 0 },
      ...entries,
    ]);
    setView("list");
    setForm(f => ({ ...f, liters: "", mileage: "", station: "", pricePerL: "" }));
  };

  // ──── MOBILE SHELL ────
  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", minHeight: "100vh",
      background: "#f0f4f8", fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
        color: "#fff", padding: "18px 16px 14px", display: "flex",
        alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 10,
      }}>
        <span style={{ fontSize: 26 }}>⛽</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Tankowania</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>TK314CL &middot; Kwiecień 2026</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <TabBtn active={view === "list"} onClick={() => setView("list")} label="Lista" />
          <TabBtn active={view === "stats"} onClick={() => setView("stats")} label="Statystyki" />
        </div>
      </div>

      {/* SUMMARY BAR */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8, padding: "12px 12px 4px",
      }}>
        <SummaryCard label="Śr. spalanie" value={avg ? `${avg} L/100` : "—"} color="#2563eb" />
        <SummaryCard label="Suma litrów" value={`${totalL} L`} color="#059669" />
        <SummaryCard label="Km przejechane" value={`${totalKm.toLocaleString("pl")}`} color="#7c3aed" />
      </div>

      {/* ──── LIST VIEW ──── */}
      {view === "list" && (
        <div style={{ padding: "8px 12px 90px" }}>
          {entries.map(e => (
            <div key={e.id} style={{
              background: "#fff", borderRadius: 12, padding: "12px 14px",
              marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {/* flag + date */}
              <div style={{ textAlign: "center", minWidth: 48 }}>
                <div style={{ fontSize: 22 }}>{countryFlag(e.country)}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{formatDate(e.date)}</div>
              </div>

              {/* main info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#1e293b" }}>
                  {e.liters} L
                  {e.fullTank && <span style={{
                    fontSize: 10, background: "#dbeafe", color: "#1d4ed8",
                    padding: "1px 6px", borderRadius: 8, marginLeft: 6, verticalAlign: "middle",
                  }}>FULL</span>}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{e.station}</div>
              </div>

              {/* mileage */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  {e.mileage.toLocaleString("pl")} km
                </div>
                {e.pricePerL > 0 && (
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {e.country === "PL" ? `${e.pricePerL.toFixed(2)} PLN/L` : `${e.pricePerL.toFixed(3)} €/L`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──── STATS VIEW ──── */}
      {view === "stats" && (
        <div style={{ padding: "12px 12px 90px" }}>
          {/* Simple bar chart of liters per entry */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
              Litry na tankowanie
            </div>
            {entries.slice(0, 6).map(e => {
              const pct = (e.liters / 450) * 100;
              return (
                <div key={e.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 2 }}>
                    <span>{formatDate(e.date)}</span>
                    <span>{e.liters} L</span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 6, height: 18, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 6,
                      background: e.fullTank
                        ? "linear-gradient(90deg, #3b82f6, #2563eb)"
                        : "linear-gradient(90deg, #94a3b8, #64748b)",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Consumption trend */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
              Spalanie między tankowaniami (FULL)
            </div>
            {(() => {
              const fulls = entries.filter(e => e.fullTank).sort((a, b) => a.mileage - b.mileage);
              const segments = [];
              for (let i = 1; i < fulls.length; i++) {
                const km = fulls[i].mileage - fulls[i - 1].mileage;
                const cons = km > 0 ? ((fulls[i].liters / km) * 100).toFixed(1) : "—";
                segments.push({ date: fulls[i].date, km, consumption: cons });
              }
              return segments.reverse().map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: i < segments.length - 1 ? "1px solid #f1f5f9" : "none",
                }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{formatDate(s.date)}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>{s.km.toLocaleString("pl")} km</span>
                  <span style={{
                    fontSize: 14, fontWeight: 700,
                    color: parseFloat(s.consumption) > 33 ? "#dc2626" : parseFloat(s.consumption) > 30 ? "#f59e0b" : "#059669",
                  }}>
                    {s.consumption} L/100
                  </span>
                </div>
              ));
            })()}
          </div>

          {/* Country breakdown */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
              Tankowania wg kraju
            </div>
            {(() => {
              const byCountry = {};
              entries.forEach(e => {
                if (!byCountry[e.country]) byCountry[e.country] = { liters: 0, count: 0 };
                byCountry[e.country].liters += e.liters;
                byCountry[e.country].count++;
              });
              return Object.entries(byCountry)
                .sort((a, b) => b[1].liters - a[1].liters)
                .map(([c, d]) => (
                  <div key={c} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                    borderBottom: "1px solid #f8fafc",
                  }}>
                    <span style={{ fontSize: 20 }}>{countryFlag(c)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", flex: 1 }}>{c}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{d.count}x</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{d.liters} L</span>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}

      {/* ──── FORM VIEW ──── */}
      {view === "form" && (
        <div style={{ padding: "12px 12px 90px" }}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>
              Nowe tankowanie
            </div>

            <FormField label="Data tankowania" required>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={inputStyle} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Litry" required>
                <input type="number" placeholder="np. 400" value={form.liters}
                  onChange={e => setForm(f => ({ ...f, liters: e.target.value }))}
                  style={inputStyle} />
              </FormField>
              <FormField label="Przebieg (km)" required>
                <input type="number" placeholder="np. 845230" value={form.mileage}
                  onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))}
                  style={inputStyle} />
              </FormField>
            </div>

            <FormField label="Stacja paliw">
              <input type="text" placeholder="np. Shell Wrocław A4" value={form.station}
                onChange={e => setForm(f => ({ ...f, station: e.target.value }))}
                style={inputStyle} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Nr karty paliwowej">
                <input type="text" placeholder="EW-4821" value={form.cardNr}
                  onChange={e => setForm(f => ({ ...f, cardNr: e.target.value }))}
                  style={inputStyle} />
              </FormField>
              <FormField label="Cena za litr">
                <input type="number" step="0.01" placeholder="np. 5.89" value={form.pricePerL}
                  onChange={e => setForm(f => ({ ...f, pricePerL: e.target.value }))}
                  style={inputStyle} />
              </FormField>
            </div>

            <FormField label="Kraj">
              <select value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                style={inputStyle}>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{countryFlag(c)} {c}</option>
                ))}
              </select>
            </FormField>

            {/* Full tank toggle */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 0", marginTop: 4,
            }}>
              <div
                onClick={() => setForm(f => ({ ...f, fullTank: !f.fullTank }))}
                style={{
                  width: 48, height: 26, borderRadius: 13, cursor: "pointer",
                  background: form.fullTank ? "#2563eb" : "#cbd5e1",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: "#fff", position: "absolute", top: 2,
                  left: form.fullTank ? 24 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: 14, color: "#334155", fontWeight: 500 }}>
                Do pełna (FULL)
              </span>
            </div>

            <button onClick={handleSubmit} style={{
              width: "100%", padding: "14px", marginTop: 8,
              background: "linear-gradient(135deg, #1e40af, #3b82f6)",
              color: "#fff", border: "none", borderRadius: 12,
              fontSize: 16, fontWeight: 700, cursor: "pointer",
            }}>
              Zapisz tankowanie
            </button>
          </div>
        </div>
      )}

      {/* ──── FAB BUTTON ──── */}
      {view !== "form" && (
        <button
          onClick={() => setView("form")}
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
            color: "#fff", border: "none", borderRadius: 16,
            padding: "14px 28px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 16px rgba(37,99,235,0.4)",
            display: "flex", alignItems: "center", gap: 8,
            zIndex: 20,
          }}
        >
          <span style={{ fontSize: 20 }}>+</span> Dodaj tankowanie
        </button>
      )}
    </div>
  );
}

// ──── HELPER COMPONENTS ────

function TabBtn({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(255,255,255,0.25)" : "transparent",
      color: "#fff", border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: 8, padding: "4px 10px", fontSize: 12,
      fontWeight: 600, cursor: "pointer",
    }}>
      {label}
    </button>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "10px 8px",
      textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0",
  borderRadius: 10, fontSize: 15, color: "#1e293b",
  background: "#f8fafc", outline: "none", boxSizing: "border-box",
};

function countryFlag(code) {
  const flags = {
    PL: "\u{1F1F5}\u{1F1F1}", DE: "\u{1F1E9}\u{1F1EA}", NL: "\u{1F1F3}\u{1F1F1}",
    BE: "\u{1F1E7}\u{1F1EA}", FR: "\u{1F1EB}\u{1F1F7}", CZ: "\u{1F1E8}\u{1F1FF}",
    AT: "\u{1F1E6}\u{1F1F9}", IT: "\u{1F1EE}\u{1F1F9}", ES: "\u{1F1EA}\u{1F1F8}",
    LU: "\u{1F1F1}\u{1F1FA}", DK: "\u{1F1E9}\u{1F1F0}", SE: "\u{1F1F8}\u{1F1EA}",
    HU: "\u{1F1ED}\u{1F1FA}", SK: "\u{1F1F8}\u{1F1F0}", LT: "\u{1F1F1}\u{1F1F9}",
    LV: "\u{1F1F1}\u{1F1FB}", RO: "\u{1F1F7}\u{1F1F4}", BG: "\u{1F1E7}\u{1F1EC}",
    HR: "\u{1F1ED}\u{1F1F7}", SI: "\u{1F1F8}\u{1F1EE}",
  };
  return flags[code] || code;
}
