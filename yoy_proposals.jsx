import { useState } from "react";

// Mock data for demonstration
const MONTHS = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const data25 = [34200, 38100, 41500, 36800, 39200, 42100, 37500, 35800, 40200, 43100, 38900, 34800];
const data26 = [37800, 41200, 44600, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const fmtV = (v) => {
  if (!v) return "—";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  return Math.round(v).toString();
};

const fmtPct = (v25, v26) => {
  if (!v25 || !v26) return null;
  const p = ((v26 - v25) / Math.abs(v25)) * 100;
  return p;
};

// ═══════════════════════════════════════════════════
// PROPOZYCJA 1: Tabela z paskami postępu (Progress Bars)
// ═══════════════════════════════════════════════════
const Proposal1 = () => {
  const maxVal = Math.max(...data25, ...data26);
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>Koncept: Tabela z paskami postępu</div>
        <div style={{ fontSize: 11, color: "#3b82f6" }}>Każdy miesiąc to wiersz tabeli z wizualnymi bar-charts. Łatwe skanowanie wzrokiem w pionie. Kwartały jako separatory.</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 80px", background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Miesiąc</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em" }}>2026</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>2025</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Zmiana</div>
        </div>

        {MONTHS.map((m, mi) => {
          const v25 = data25[mi];
          const v26 = data26[mi];
          const pct = fmtPct(v25, v26);
          const isFuture = !v26;
          const isQEnd = mi === 2 || mi === 5 || mi === 8;

          return (
            <div key={mi}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr 1fr 80px",
                  padding: "8px 16px",
                  alignItems: "center",
                  gap: 12,
                  opacity: isFuture ? 0.35 : 1,
                  background: mi % 2 === 0 ? "#fff" : "#fafbfc",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{m}</div>

                {/* 2026 bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 18, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(v26 / maxVal) * 100}%`,
                        background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                        borderRadius: 4,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", minWidth: 40, textAlign: "right" }}>{fmtV(v26)}</span>
                </div>

                {/* 2025 bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 18, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(v25 / maxVal) * 100}%`,
                        background: "linear-gradient(90deg, #cbd5e1, #94a3b8)",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", minWidth: 40, textAlign: "right" }}>{fmtV(v25)}</span>
                </div>

                {/* Change pill */}
                <div style={{ textAlign: "right" }}>
                  {pct !== null ? (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: pct >= 0 ? "#f0fdf4" : "#fef2f2",
                        color: pct >= 0 ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>
                  )}
                </div>
              </div>

              {/* Quarter separator */}
              {isQEnd && (
                <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 80px", padding: "6px 16px", background: "#f0f4ff", borderTop: "1px solid #e0e7ff", borderBottom: "1px solid #e0e7ff", gap: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4338ca" }}>Q{Math.floor(mi / 3) + 1}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>{fmtV(qSum(data26, Math.floor(mi / 3)))}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>{fmtV(qSum(data25, Math.floor(mi / 3)))}</div>
                  <div style={{ textAlign: "right" }}>
                    {(() => {
                      const q = Math.floor(mi / 3);
                      const q25 = qSum(data25, q);
                      const q26 = qSum(data26, q);
                      const p = q25 && q26 ? ((q26 - q25) / q25) * 100 : null;
                      return p !== null ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: p >= 0 ? "#15803d" : "#b91c1c" }}>
                          {p >= 0 ? "+" : ""}{p.toFixed(1)}%
                        </span>
                      ) : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>;
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* YTD Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 80px", padding: "12px 16px", background: "#f8fafc", borderTop: "2px solid #e2e8f0", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>YTD</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1d4ed8" }}>{fmtV(data26.reduce((a, b) => a + b, 0))}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>{fmtV(data25.reduce((a, b) => a + b, 0))}</div>
          <div style={{ textAlign: "right" }}>
            {(() => {
              const ytd25 = data25.slice(0, 3).reduce((a, b) => a + b, 0);
              const ytd26 = data26.slice(0, 3).reduce((a, b) => a + b, 0);
              const p = ((ytd26 - ytd25) / ytd25) * 100;
              return (
                <span style={{ fontSize: 12, fontWeight: 800, color: p >= 0 ? "#15803d" : "#b91c1c" }}>
                  {p >= 0 ? "+" : ""}{p.toFixed(1)}%
                </span>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// PROPOZYCJA 2: Kompaktowa siatka z heatmapą
// ═══════════════════════════════════════════════════
const Proposal2 = () => {
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);
  const hSum = (arr, h) => arr.slice(h * 6, h * 6 + 6).reduce((a, b) => a + b, 0);

  // Heatmap color for % change
  const heatColor = (v25, v26) => {
    if (!v26) return { bg: "#f8fafc", text: "#94a3b8" };
    const pct = ((v26 - v25) / Math.abs(v25)) * 100;
    if (pct >= 15) return { bg: "#14532d", text: "#fff" };
    if (pct >= 10) return { bg: "#166534", text: "#fff" };
    if (pct >= 5) return { bg: "#22c55e", text: "#fff" };
    if (pct >= 0) return { bg: "#bbf7d0", text: "#166534" };
    if (pct >= -5) return { bg: "#fecaca", text: "#991b1b" };
    if (pct >= -10) return { bg: "#ef4444", text: "#fff" };
    return { bg: "#991b1b", text: "#fff" };
  };

  const Cell = ({ label, v25, v26, size = "normal" }) => {
    const colors = heatColor(v25, v26);
    const pct = v25 && v26 ? ((v26 - v25) / Math.abs(v25)) * 100 : null;
    const isFuture = !v26;
    const isLarge = size === "large";
    const isMedium = size === "medium";

    return (
      <div
        style={{
          background: colors.bg,
          borderRadius: isLarge ? 12 : isMedium ? 10 : 8,
          padding: isLarge ? "14px 16px" : isMedium ? "10px 12px" : "8px 10px",
          opacity: isFuture ? 0.3 : 1,
          transition: "all 0.2s",
          border: isFuture ? "1px dashed #d1d5db" : "1px solid transparent",
        }}
      >
        <div style={{ fontSize: isLarge ? 13 : isMedium ? 12 : 10, fontWeight: 600, color: colors.text, opacity: 0.8, marginBottom: isLarge ? 8 : 4 }}>
          {label}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <span style={{ fontSize: isLarge ? 20 : isMedium ? 16 : 13, fontWeight: 800, color: colors.text }}>{fmtV(v26)}</span>
            <span style={{ fontSize: isLarge ? 11 : 9, color: colors.text, opacity: 0.6, marginLeft: 4 }}>vs {fmtV(v25)}</span>
          </div>
          {pct !== null && (
            <span style={{
              fontSize: isLarge ? 14 : isMedium ? 12 : 10,
              fontWeight: 800,
              color: colors.text,
              background: "rgba(255,255,255,0.2)",
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#faf5ff", borderRadius: 10, border: "1px solid #e9d5ff" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", marginBottom: 4 }}>Koncept: Heatmapa z intensywnością kolorów</div>
        <div style={{ fontSize: 11, color: "#8b5cf6" }}>Im większa zmiana YoY — tym intensywniejszy kolor. Zielony = wzrost, czerwony = spadek. Natychmiast widać "gorące" miesiące.</div>
      </div>

      {/* Monthly grid 4x3 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
        {MONTHS.map((m, mi) => (
          <Cell key={mi} label={m} v25={data25[mi]} v26={data26[mi]} />
        ))}
      </div>

      {/* Quarters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
        {[0, 1, 2, 3].map((q) => (
          <Cell key={q} label={`Q${q + 1}`} v25={qSum(data25, q)} v26={qSum(data26, q)} size="medium" />
        ))}
      </div>

      {/* Half-years + YTD */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <Cell label="H1" v25={hSum(data25, 0)} v26={hSum(data26, 0)} size="large" />
        <Cell label="H2" v25={hSum(data25, 1)} v26={hSum(data26, 1)} size="large" />
        <Cell
          label="ROK"
          v25={data25.reduce((a, b) => a + b, 0)}
          v26={data26.reduce((a, b) => a + b, 0)}
          size="large"
        />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#94a3b8" }}>spadek</span>
        {["#991b1b", "#ef4444", "#fecaca", "#bbf7d0", "#22c55e", "#166534", "#14532d"].map((c, i) => (
          <div key={i} style={{ width: 20, height: 8, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 9, color: "#94a3b8" }}>wzrost</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// PROPOZYCJA 3: Wykres delta z kumulatywnym YTD
// ═══════════════════════════════════════════════════
const Proposal3 = () => {
  const maxDiff = Math.max(...MONTHS.map((_, mi) => Math.abs(data26[mi] - data25[mi])).filter(v => v > 0));
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);

  // Cumulative YTD difference
  let cumDiff = 0;
  const cumData = MONTHS.map((_, mi) => {
    if (data26[mi]) cumDiff += data26[mi] - data25[mi];
    return cumDiff;
  });
  const maxCum = Math.max(...cumData.map(Math.abs));

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#ecfdf5", borderRadius: 10, border: "1px solid #a7f3d0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#059669", marginBottom: 4 }}>Koncept: Wykres różnic + kumulatywna linia YTD</div>
        <div style={{ fontSize: 11, color: "#10b981" }}>Fokus na deltę (różnicę) zamiast wartości absolutnych. Słupki pokazują miesięczną zmianę, linia — kumulatywny wynik YTD.</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 20px 16px" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "YTD 2026", value: data26.slice(0, 3).reduce((a, b) => a + b, 0), color: "#1d4ed8", bg: "#eff6ff" },
            { label: "YTD 2025", value: data25.slice(0, 3).reduce((a, b) => a + b, 0), color: "#64748b", bg: "#f8fafc" },
            { label: "Różnica YTD", value: data26.slice(0, 3).reduce((a, b) => a + b, 0) - data25.slice(0, 3).reduce((a, b) => a + b, 0), color: "#15803d", bg: "#f0fdf4", showSign: true },
            { label: "Zmiana YTD", value: ((data26.slice(0, 3).reduce((a, b) => a + b, 0) - data25.slice(0, 3).reduce((a, b) => a + b, 0)) / data25.slice(0, 3).reduce((a, b) => a + b, 0) * 100), color: "#15803d", bg: "#f0fdf4", isPct: true },
          ].map((card, i) => (
            <div key={i} style={{ background: card.bg, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>
                {card.showSign && card.value >= 0 ? "+" : ""}{card.isPct ? card.value.toFixed(1) + "%" : fmtV(card.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ position: "relative", height: 200 }}>
          {/* Zero line */}
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#e2e8f0" }} />

          {/* Grid lines */}
          {[-2, -1, 1, 2].map(level => (
            <div key={level} style={{
              position: "absolute",
              top: `${50 - (level / 2.5) * 50}%`,
              left: 0, right: 60,
              height: 1,
              background: "#f1f5f9",
              borderTop: "1px dashed #e2e8f0",
            }}>
              <span style={{ position: "absolute", right: -55, top: -7, fontSize: 9, color: "#94a3b8" }}>
                {level > 0 ? "+" : ""}{(level * maxDiff / 2.5 / 1000).toFixed(0)}k
              </span>
            </div>
          ))}

          {/* Bars */}
          <div style={{ display: "flex", position: "absolute", inset: 0, right: 60, alignItems: "center", gap: 3, padding: "0 4px" }}>
            {MONTHS.map((m, mi) => {
              const diff = data26[mi] - data25[mi];
              const isFuture = !data26[mi];
              const barHeight = isFuture ? 0 : Math.abs(diff) / (maxDiff * 1.2) * 80;
              const isPos = diff >= 0;

              return (
                <div key={mi} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "center", position: "relative" }}>
                  {/* Bar going up or down from center */}
                  <div style={{
                    position: "absolute",
                    width: "70%",
                    height: `${barHeight}%`,
                    background: isFuture ? "#f1f5f9" : isPos
                      ? "linear-gradient(180deg, #22c55e, #16a34a)"
                      : "linear-gradient(0deg, #ef4444, #dc2626)",
                    borderRadius: isPos ? "4px 4px 0 0" : "0 0 4px 4px",
                    [isPos ? "bottom" : "top"]: "50%",
                    opacity: isFuture ? 0.3 : 1,
                    transition: "height 0.5s ease",
                  }} />

                  {/* Value label */}
                  {!isFuture && (
                    <div style={{
                      position: "absolute",
                      [isPos ? "bottom" : "top"]: `calc(50% + ${barHeight}% + 4px)`,
                      fontSize: 9,
                      fontWeight: 700,
                      color: isPos ? "#15803d" : "#dc2626",
                      whiteSpace: "nowrap",
                    }}>
                      {isPos ? "+" : ""}{fmtV(diff)}
                    </div>
                  )}

                  {/* Month label */}
                  <div style={{
                    position: "absolute",
                    bottom: -2,
                    fontSize: 9,
                    fontWeight: 600,
                    color: isFuture ? "#d1d5db" : "#64748b",
                  }}>
                    {m}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cumulative line */}
          <svg style={{ position: "absolute", inset: 0, right: 60, pointerEvents: "none" }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="0.6"
              strokeDasharray="1.5 0.8"
              points={cumData.map((v, i) => {
                const x = (i + 0.5) / 12 * 100;
                const y = 50 - (v / (maxCum * 1.3)) * 40;
                return `${x},${y}`;
              }).join(" ")}
            />
            {cumData.map((v, i) => {
              if (!data26[i]) return null;
              const x = (i + 0.5) / 12 * 100;
              const y = 50 - (v / (maxCum * 1.3)) * 40;
              return <circle key={i} cx={x} cy={y} r="0.8" fill="#8b5cf6" />;
            })}
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "linear-gradient(180deg, #22c55e, #16a34a)" }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>Wzrost vs 2025</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "linear-gradient(0deg, #ef4444, #dc2626)" }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>Spadek vs 2025</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: "#8b5cf6" }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>Kumulatywna delta YTD</span>
          </div>
        </div>

        {/* Quarterly summary below */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 16 }}>
          {[0, 1, 2, 3].map(q => {
            const q25 = qSum(data25, q);
            const q26 = qSum(data26, q);
            const diff = q26 - q25;
            const pct = q25 && q26 ? ((q26 - q25) / q25 * 100) : null;
            const hasData = q26 > 0;

            return (
              <div key={q} style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: "10px 12px",
                opacity: hasData ? 1 : 0.35,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>Q{q + 1}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{fmtV(q26)} vs {fmtV(q25)}</div>
                </div>
                {pct !== null ? (
                  <div style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: diff >= 0 ? "#15803d" : "#dc2626",
                    background: diff >= 0 ? "#f0fdf4" : "#fef2f2",
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}>
                    {diff >= 0 ? "+" : ""}{pct.toFixed(1)}%
                  </div>
                ) : (
                  <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
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
// GŁÓWNY KOMPONENT Z PRZEŁĄCZANIEM
// ═══════════════════════════════════════════════════
export default function YoYProposals() {
  const [active, setActive] = useState(1);

  const proposals = [
    { id: 1, name: "Tabela + Paski", icon: "☰", component: <Proposal1 /> },
    { id: 2, name: "Heatmapa", icon: "◼", component: <Proposal2 /> },
    { id: 3, name: "Wykres Delta", icon: "◿", component: <Proposal3 /> },
  ];

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>Porównanie Y2Y — Propozycje</h2>
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
      <div style={{ animation: "fadeIn 0.3s ease" }}>
        {proposals.find(p => p.id === active)?.component}
      </div>

      {/* Comparison notes */}
      <div style={{ marginTop: 24, padding: "16px 20px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>Porównanie z obecnym widokiem (12 kart + klamry Q/H):</div>
        <div style={{ fontSize: 11, color: "#a16207", lineHeight: 1.7 }}>
          {active === 1 && "✅ Układ pionowy — łatwiejszy do skanowania wzrokiem niż 12 kolumn. Paski dają natychmiastowe porównanie wielkości. Kwartały jako separatory zamiast osobnych kart z klamrami. YTD na dole."}
          {active === 2 && "✅ Kompaktowy layout 4×3 zamiast 12 kolumn — mieści się na każdym ekranie. Intensywność koloru natychmiast komunikuje skalę zmiany. Łatwe wychwycenie najlepszych/najgorszych miesięcy."}
          {active === 3 && "✅ Skupienie na różnicy zamiast wartości absolutnych — od razu widać trend. Kumulatywna linia YTD pokazuje, czy rok jest ogólnie lepszy/gorszy. KPI w nagłówku dają szybki kontekst."}
        </div>
      </div>
    </div>
  );
}