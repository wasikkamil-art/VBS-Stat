import { useState } from "react";

// Mock data
const MONTHS = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const data25 = [34200, 38100, 41500, 36800, 39200, 42100, 37500, 35800, 40200, 43100, 38900, 34800];
const data26 = [37800, 41200, 44600, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const fmtV = (v) => {
  if (!v) return "—";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  return Math.round(v).toString();
};

const fmtFull = (v) => {
  if (!v) return "—";
  return v.toLocaleString("pl-PL", { maximumFractionDigits: 0 });
};

// ═══════════════════════════════════════════════════
// PROPOZYCJA 4: Butterfly / Tornado Chart
// Paski 2025 idą w lewo, 2026 w prawo od osi centralnej
// ═══════════════════════════════════════════════════
const Proposal4 = () => {
  const maxVal = Math.max(...data25, ...data26);
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);

  const Row = ({ label, v25, v26, isQuarter, isHalf }) => {
    const isFuture = !v26;
    const pct = v25 && v26 ? ((v26 - v25) / v25 * 100) : null;
    const barMax = isHalf ? maxVal * 6.5 : isQuarter ? maxVal * 3.3 : maxVal;
    const w25 = (v25 / barMax) * 100;
    const w26 = (v26 / barMax) * 100;
    const bgColor = isHalf ? "#f1f5f9" : isQuarter ? "#f8fafc" : "transparent";
    const height = isHalf ? 32 : isQuarter ? 28 : 24;

    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "50px 1fr 2px 1fr 58px",
        alignItems: "center",
        padding: `${isHalf ? 6 : isQuarter ? 4 : 2}px 0`,
        background: bgColor,
        borderRadius: isQuarter || isHalf ? 6 : 0,
        marginBottom: isHalf ? 4 : isQuarter ? 3 : 1,
        opacity: isFuture ? 0.3 : 1,
      }}>
        {/* Label */}
        <div style={{
          fontSize: isHalf ? 13 : isQuarter ? 12 : 11,
          fontWeight: isHalf ? 800 : isQuarter ? 700 : 500,
          color: isHalf ? "#0f172a" : isQuarter ? "#334155" : "#64748b",
          textAlign: "center",
        }}>{label}</div>

        {/* 2025 bar (right-aligned, goes left) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingRight: 8 }}>
          <span style={{ fontSize: isHalf ? 12 : 10, fontWeight: 500, color: "#94a3b8" }}>{fmtV(v25)}</span>
          <div style={{ width: `${w25}%`, height, background: "linear-gradient(270deg, #94a3b8, #cbd5e1)", borderRadius: "4px 0 0 4px", minWidth: v25 ? 4 : 0, transition: "width 0.5s ease" }} />
        </div>

        {/* Center axis */}
        <div style={{ width: 2, height: height + 8, background: "#334155", borderRadius: 1 }} />

        {/* 2026 bar (left-aligned, goes right) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
          <div style={{ width: `${w26}%`, height, background: v26 >= v25 ? "linear-gradient(90deg, #3b82f6, #2563eb)" : "linear-gradient(90deg, #f97316, #ea580c)", borderRadius: "0 4px 4px 0", minWidth: v26 ? 4 : 0, transition: "width 0.5s ease" }} />
          <span style={{ fontSize: isHalf ? 12 : 10, fontWeight: 600, color: "#1d4ed8" }}>{fmtV(v26)}</span>
        </div>

        {/* % change */}
        <div style={{ textAlign: "center" }}>
          {pct !== null ? (
            <span style={{
              fontSize: isHalf ? 12 : 10,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 4,
              background: pct >= 0 ? "#f0fdf4" : "#fef2f2",
              color: pct >= 0 ? "#15803d" : "#dc2626",
            }}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
            </span>
          ) : <span style={{ color: "#d1d5db", fontSize: 10 }}>—</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fff7ed", borderRadius: 10, border: "1px solid #fed7aa" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#c2410c", marginBottom: 4 }}>Koncept: Butterfly / Tornado Chart</div>
        <div style={{ fontSize: 11, color: "#ea580c" }}>2025 rozchodzi się w lewo, 2026 w prawo od osi. Natychmiast widać, który rok "wygrywa" w każdym miesiącu. Paski pomarańczowe = spadek YoY.</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 12px" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 2px 1fr 58px", marginBottom: 8, padding: "0 0 8px", borderBottom: "1px solid #e5e7eb" }}>
          <div />
          <div style={{ textAlign: "right", paddingRight: 8, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>← 2025</div>
          <div />
          <div style={{ paddingLeft: 8, fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>2026 →</div>
          <div style={{ textAlign: "center", fontSize: 9, fontWeight: 600, color: "#64748b" }}>YoY</div>
        </div>

        {/* Monthly rows with quarter separators */}
        {MONTHS.map((m, mi) => (
          <div key={mi}>
            <Row label={m} v25={data25[mi]} v26={data26[mi]} />
            {(mi === 2 || mi === 5 || mi === 8 || mi === 11) && (
              <div style={{ margin: "4px 0" }}>
                <Row label={`Q${Math.floor(mi / 3) + 1}`} v25={qSum(data25, Math.floor(mi / 3))} v26={qSum(data26, Math.floor(mi / 3))} isQuarter />
              </div>
            )}
            {(mi === 5 || mi === 11) && (
              <div style={{ margin: "4px 0" }}>
                <Row label={mi === 5 ? "H1" : "H2"} v25={data25.slice(mi === 5 ? 0 : 6, mi === 5 ? 6 : 12).reduce((a, b) => a + b, 0)} v26={data26.slice(mi === 5 ? 0 : 6, mi === 5 ? 6 : 12).reduce((a, b) => a + b, 0)} isHalf />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// PROPOZYCJA 5: Compact Scorecard (inspiracja dashboardem F1)
// Duże KPI + kompaktowa tabela z mini-barami inline
// ═══════════════════════════════════════════════════
const Proposal5 = () => {
  const ytd26 = data26.slice(0, 3).reduce((a, b) => a + b, 0);
  const ytd25 = data25.slice(0, 3).reduce((a, b) => a + b, 0);
  const full25 = data25.reduce((a, b) => a + b, 0);
  const pctYtd = ((ytd26 - ytd25) / ytd25 * 100);
  const maxVal = Math.max(...data25, ...data26);
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f0f9ff", borderRadius: 10, border: "1px solid #bae6fd" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 4 }}>Koncept: Scorecard Dashboard</div>
        <div style={{ fontSize: 11, color: "#0284c7" }}>Inspiracja dashboardami sportowymi/F1. Duże KPI na górze, kompaktowa tabela z inline-barami i procentami, ranking miesięcy po prawej.</div>
      </div>

      <div style={{ background: "#0f172a", borderRadius: 14, padding: 20, color: "#fff" }}>
        {/* Top KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr 1px 1fr", gap: 0, marginBottom: 20 }}>
          {[
            { label: "YTD 2026", value: fmtFull(ytd26) + " €", sub: `${(ytd26/full25*100).toFixed(0)}% rocznego 2025`, color: "#3b82f6" },
            null,
            { label: "YTD 2025", value: fmtFull(ytd25) + " €", sub: "okres porównywalny", color: "#64748b" },
            null,
            { label: "DELTA YTD", value: (pctYtd >= 0 ? "+" : "") + pctYtd.toFixed(1) + "%", sub: `${pctYtd >= 0 ? "+" : ""}${fmtFull(ytd26 - ytd25)} €`, color: pctYtd >= 0 ? "#22c55e" : "#ef4444" },
            null,
            { label: "PROJEKCJA ROCZNA", value: fmtFull(Math.round(ytd26 / 3 * 12)) + " €", sub: `vs ${fmtFull(full25)} € w 2025`, color: "#a78bfa" },
          ].map((item, i) => item === null ? (
            <div key={i} style={{ background: "#1e293b", width: 1 }} />
          ) : (
            <div key={i} style={{ textAlign: "center", padding: "8px 12px" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color, marginBottom: 4 }}>{item.value}</div>
              <div style={{ fontSize: 10, color: "#475569" }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 72px 72px 56px", gap: 8, padding: "8px 12px", borderBottom: "1px solid #1e293b" }}>
          {["", "PORÓWNANIE", "2026", "2025", "YoY"].map((h, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
          ))}
        </div>

        {/* Monthly rows */}
        {MONTHS.map((m, mi) => {
          const v25 = data25[mi];
          const v26 = data26[mi];
          const isFuture = !v26;
          const pct = v25 && v26 ? ((v26 - v25) / v25 * 100) : null;
          const barW25 = (v25 / maxVal) * 100;
          const barW26 = (v26 / maxVal) * 100;
          const isQEnd = mi === 2 || mi === 5 || mi === 8 || mi === 11;

          return (
            <div key={mi}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 72px 72px 56px",
                gap: 8,
                padding: "6px 12px",
                alignItems: "center",
                opacity: isFuture ? 0.25 : 1,
                borderBottom: isQEnd ? "none" : "1px solid #1e293b22",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{m}</div>

                {/* Dual inline bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: `${barW26}%`, height: 7, background: v26 >= v25 ? "#3b82f6" : "#f97316", borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: `${barW25}%`, height: 5, background: "#334155", borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", textAlign: "right" }}>{fmtV(v26)}</div>
                <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>{fmtV(v25)}</div>
                <div style={{ textAlign: "right" }}>
                  {pct !== null ? (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: pct >= 0 ? "#4ade80" : "#fb923c",
                    }}>
                      {pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(0)}%
                    </span>
                  ) : <span style={{ color: "#334155" }}>—</span>}
                </div>
              </div>

              {/* Quarter summary row */}
              {isQEnd && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 72px 72px 56px",
                  gap: 8,
                  padding: "5px 12px",
                  background: "#1e293b",
                  borderRadius: 6,
                  margin: "2px 0 6px",
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6" }}>Q{Math.floor(mi / 3) + 1}</div>
                  <div />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", textAlign: "right" }}>{fmtV(qSum(data26, Math.floor(mi / 3)))}</div>
                  <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>{fmtV(qSum(data25, Math.floor(mi / 3)))}</div>
                  <div style={{ textAlign: "right" }}>
                    {(() => {
                      const q = Math.floor(mi / 3);
                      const q25 = qSum(data25, q);
                      const q26 = qSum(data26, q);
                      const p = q25 && q26 ? ((q26 - q25) / q25 * 100) : null;
                      return p !== null ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: p >= 0 ? "#4ade80" : "#fb923c" }}>
                          {p >= 0 ? "+" : ""}{p.toFixed(1)}%
                        </span>
                      ) : <span style={{ color: "#334155" }}>—</span>;
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// PROPOZYCJA 6: Slope Chart + Summary Strip
// Linie łączące wartość 2025 → 2026 dla każdego miesiąca
// ═══════════════════════════════════════════════════
const Proposal6 = () => {
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);
  const ytd26 = data26.slice(0, 3).reduce((a, b) => a + b, 0);
  const ytd25 = data25.slice(0, 3).reduce((a, b) => a + b, 0);
  const minVal = Math.min(...data25.filter(Boolean), ...data26.filter(Boolean)) * 0.85;
  const maxVal = Math.max(...data25, ...data26) * 1.1;
  const toY = (v) => ((maxVal - v) / (maxVal - minVal)) * 100;

  const [hoveredMonth, setHoveredMonth] = useState(null);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fdf4ff", borderRadius: 10, border: "1px solid #f0abfc" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#a21caf", marginBottom: 4 }}>Koncept: Slope Chart (wykres nachylenia)</div>
        <div style={{ fontSize: 11, color: "#c026d3" }}>Każdy miesiąc to linia łącząca wartość 2025 (lewa strona) z 2026 (prawa). Nachylenie w górę = wzrost. Kolory i grubość wzmacniają przekaz.</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
        {/* Summary strip */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Najlepszy miesiąc", value: "Mar", detail: "+7.5% YoY", color: "#15803d", bg: "#f0fdf4" },
            { label: "Najsłabszy miesiąc", value: "—", detail: "brak danych Q2+", color: "#64748b", bg: "#f8fafc" },
            { label: "Średnia zmiana", value: `+${((ytd26 / ytd25 - 1) * 100).toFixed(1)}%`, detail: "3 mies. danych", color: "#1d4ed8", bg: "#eff6ff" },
            { label: "Wygrane miesiące", value: "3/3", detail: "100% powyżej 2025", color: "#7c3aed", bg: "#faf5ff" },
          ].map((card, i) => (
            <div key={i} style={{ flex: 1, background: card.bg, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{card.detail}</div>
            </div>
          ))}
        </div>

        {/* Slope chart */}
        <div style={{ position: "relative", height: 320, margin: "0 60px" }}>
          {/* Year labels */}
          <div style={{ position: "absolute", left: -52, top: -8, fontSize: 12, fontWeight: 800, color: "#94a3b8" }}>2025</div>
          <div style={{ position: "absolute", right: -52, top: -8, fontSize: 12, fontWeight: 800, color: "#1d4ed8" }}>2026</div>

          {/* Left and right axes */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "#e2e8f0", borderRadius: 1 }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 2, background: "#e2e8f0", borderRadius: 1 }} />

          {/* SVG slopes */}
          <svg style={{ position: "absolute", inset: 0 }} viewBox="0 0 100 100" preserveAspectRatio="none">
            {MONTHS.map((m, mi) => {
              const v25 = data25[mi];
              const v26 = data26[mi];
              if (!v26) return null;
              const y1 = toY(v25);
              const y2 = toY(v26);
              const isUp = v26 >= v25;
              const isHovered = hoveredMonth === mi;

              return (
                <line
                  key={mi}
                  x1="0.5" y1={y1}
                  x2="99.5" y2={y2}
                  stroke={isUp ? "#22c55e" : "#ef4444"}
                  strokeWidth={isHovered ? "0.8" : "0.35"}
                  opacity={isHovered ? 1 : 0.7}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Dot labels - left (2025) */}
          {MONTHS.map((m, mi) => {
            const v25 = data25[mi];
            const top = `${toY(v25)}%`;
            const isFuture = !data26[mi];

            return (
              <div
                key={`l${mi}`}
                onMouseEnter={() => setHoveredMonth(mi)}
                onMouseLeave={() => setHoveredMonth(null)}
                style={{
                  position: "absolute",
                  left: -4,
                  top,
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "default",
                  opacity: isFuture ? 0.3 : 1,
                  zIndex: hoveredMonth === mi ? 10 : 1,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", border: "2px solid #fff", boxShadow: hoveredMonth === mi ? "0 0 0 2px #94a3b8" : "none" }} />
                <div style={{ background: hoveredMonth === mi ? "#f8fafc" : "transparent", borderRadius: 4, padding: "1px 6px", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#64748b" }}>{m}</span>
                  <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 4 }}>{fmtV(v25)}</span>
                </div>
              </div>
            );
          })}

          {/* Dot labels - right (2026) */}
          {MONTHS.map((m, mi) => {
            const v26 = data26[mi];
            const v25 = data25[mi];
            if (!v26) return null;
            const top = `${toY(v26)}%`;
            const isUp = v26 >= v25;
            const pct = ((v26 - v25) / v25 * 100);

            return (
              <div
                key={`r${mi}`}
                onMouseEnter={() => setHoveredMonth(mi)}
                onMouseLeave={() => setHoveredMonth(null)}
                style={{
                  position: "absolute",
                  right: -4,
                  top,
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  flexDirection: "row-reverse",
                  gap: 6,
                  cursor: "default",
                  zIndex: hoveredMonth === mi ? 10 : 1,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: isUp ? "#22c55e" : "#ef4444", border: "2px solid #fff", boxShadow: hoveredMonth === mi ? `0 0 0 2px ${isUp ? "#22c55e" : "#ef4444"}` : "none" }} />
                <div style={{ background: hoveredMonth === mi ? "#f8fafc" : "transparent", borderRadius: 4, padding: "1px 6px", textAlign: "right", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8" }}>{fmtV(v26)}</span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    marginLeft: 4,
                    color: isUp ? "#15803d" : "#dc2626",
                  }}>
                    {isUp ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quarter cards below */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 24 }}>
          {[0, 1, 2, 3].map(q => {
            const q25 = qSum(data25, q);
            const q26 = qSum(data26, q);
            const hasData = q26 > 0;
            const pct = hasData ? ((q26 - q25) / q25 * 100) : null;

            return (
              <div key={q} style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "12px 14px",
                opacity: hasData ? 1 : 0.3,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Q{q + 1}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 8, color: "#94a3b8" }}>2025</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>{fmtV(q25)}</div>
                  </div>
                  <div style={{ width: 1, background: "#e5e7eb" }} />
                  <div>
                    <div style={{ fontSize: 8, color: "#3b82f6" }}>2026</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8" }}>{fmtV(q26)}</div>
                  </div>
                </div>
                {pct !== null && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    color: pct >= 0 ? "#15803d" : "#dc2626",
                  }}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// GŁÓWNY KOMPONENT
// ═══════════════════════════════════════════════════
export default function YoYProposals2() {
  const [active, setActive] = useState(4);

  const proposals = [
    { id: 4, name: "Butterfly", icon: "⟷", component: <Proposal4 /> },
    { id: 5, name: "Scorecard", icon: "▣", component: <Proposal5 /> },
    { id: 6, name: "Slope Chart", icon: "╱", component: <Proposal6 /> },
  ];

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>Porównanie Y2Y — Propozycje (seria 2)</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>FleetStat · Frachty € · Flota total · Dane przykładowe</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
        {proposals.map(p => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: active === p.id ? "2px solid #3b82f6" : "2px solid #e5e7eb",
              background: active === p.id ? "#eff6ff" : "#fff",
              color: active === p.id ? "#1d4ed8" : "#64748b",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>{p.icon}</span>
            Propozycja {p.id}: {p.name}
          </button>
        ))}
      </div>

      {/* Active proposal */}
      {proposals.find(p => p.id === active)?.component}

      {/* Comparison summary of ALL 6 */}
      <div style={{ marginTop: 28, padding: "16px 20px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 10 }}>Podsumowanie wszystkich 6 propozycji:</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
          <div><strong style={{ color: "#1d4ed8" }}>1. Tabela + Paski</strong> — klasyczny układ pionowy, łatwy skan wzrokiem</div>
          <div><strong style={{ color: "#7c3aed" }}>2. Heatmapa</strong> — kompaktowa siatka 4×3, kolor = skala zmiany</div>
          <div><strong style={{ color: "#059669" }}>3. Wykres Delta</strong> — fokus na różnicach, kumulatywna linia YTD</div>
          <div><strong style={{ color: "#c2410c" }}>4. Butterfly</strong> — paski w lewo/prawo od osi, wyścig lat</div>
          <div><strong style={{ color: "#0369a1" }}>5. Scorecard</strong> — ciemny dashboard, duże KPI, inline bary</div>
          <div><strong style={{ color: "#a21caf" }}>6. Slope Chart</strong> — linie nachylenia, wizualne "wygrane"</div>
        </div>
      </div>
    </div>
  );
}