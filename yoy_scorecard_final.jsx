import { useState } from "react";

// Mock data for preview
const MONTHS_NAMES = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const mockData25 = [34200, 38100, 41500, 36800, 39200, 42100, 37500, 35800, 40200, 43100, 38900, 34800];
const mockData26 = [37800, 41200, 44600, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const fmtV = (v) => {
  if (!v) return "—";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  return Math.round(v).toString();
};
const fmtFull = (v) => !v ? "—" : v.toLocaleString("pl-PL", { maximumFractionDigits: 0 });

export default function YoYScorecard() {
  const [yoyMode, setYoyMode] = useState("flota");
  const [yoyMet, setYoyMet] = useState("frachty");

  // In real app these come from METRICS array, here we use mock
  const data25 = mockData25;
  const data26 = mockData26;
  const maxVal = Math.max(...data25, ...data26);
  const qSum = (arr, q) => arr.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0);

  // Calculate YTD (only months with 2026 data)
  const activeMonths = data26.filter(v => v > 0).length;
  const ytd26 = data26.slice(0, activeMonths).reduce((a, b) => a + b, 0);
  const ytd25 = data25.slice(0, activeMonths).reduce((a, b) => a + b, 0);
  const full25 = data25.reduce((a, b) => a + b, 0);
  const pctYtd = ytd25 ? ((ytd26 - ytd25) / ytd25 * 100) : 0;
  const projection = activeMonths > 0 ? Math.round(ytd26 / activeMonths * 12) : 0;

  const METRICS_LABELS = [
    { id: "frachty", label: "Frachty €" },
    { id: "koszty", label: "Koszty €" },
    { id: "zysk", label: "Zysk €" },
    { id: "km", label: "KM licznik" },
    { id: "paliwo", label: "Paliwo L" },
    { id: "spalanie", label: "Spalanie L/100" },
    { id: "eurkm", label: "€/km" },
    { id: "dni", label: "Dni w trasie" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
      {/* ─── HEADER + TOGGLES (identical to current FleetStat) ─── */}
      <div className="flex gap-3 items-center flex-wrap mb-4">
        <span className="text-sm font-semibold text-gray-700">Porównanie Y2Y</span>
        <div className="flex gap-1 ml-2">
          {[["flota", "Flota total"], ["pojazd", "Per pojazd"]].map(([m, l]) => (
            <button key={m} onClick={() => setYoyMode(m)}
              className={"px-3 py-1 rounded-lg text-xs font-medium transition-all " + (yoyMode === m ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {METRICS_LABELS.map(m => (
            <button key={m.id} onClick={() => setYoyMet(m.id)}
              className={"px-3 py-1 rounded-lg text-xs font-medium transition-all " + (yoyMet === m.id ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* ─── KPI STRIP (4 cards) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          {
            label: "YTD 2026",
            value: fmtFull(ytd26) + " €",
            sub: `${activeMonths} mies. · ${full25 ? (ytd26 / full25 * 100).toFixed(0) : 0}% rocznego 2025`,
            valueColor: "#1d4ed8",
            bg: "#eff6ff",
            borderColor: "#bfdbfe"
          },
          {
            label: "YTD 2025",
            value: fmtFull(ytd25) + " €",
            sub: "okres porównywalny",
            valueColor: "#64748b",
            bg: "#f8fafc",
            borderColor: "#e5e7eb"
          },
          {
            label: "ZMIANA YTD",
            value: (pctYtd >= 0 ? "+" : "") + pctYtd.toFixed(1) + "%",
            sub: `${pctYtd >= 0 ? "+" : ""}${fmtFull(ytd26 - ytd25)} €`,
            valueColor: pctYtd >= 0 ? "#15803d" : "#dc2626",
            bg: pctYtd >= 0 ? "#f0fdf4" : "#fef2f2",
            borderColor: pctYtd >= 0 ? "#bbf7d0" : "#fecaca"
          },
          {
            label: "PROJEKCJA ROCZNA",
            value: fmtFull(projection) + " €",
            sub: `vs ${fmtFull(full25)} € w 2025`,
            valueColor: "#6366f1",
            bg: "#f5f3ff",
            borderColor: "#ddd6fe"
          },
        ].map((card, i) => (
          <div key={i} style={{
            background: card.bg,
            borderRadius: 10,
            padding: "10px 14px",
            border: `1px solid ${card.borderColor}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: card.valueColor, lineHeight: 1.2 }}>{card.value}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ─── TABLE HEADER ─── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 68px 68px 52px",
        gap: 8,
        padding: "7px 12px",
        borderBottom: "1px solid #e5e7eb",
        background: "#f8fafc",
        borderRadius: "8px 8px 0 0",
      }}>
        {["", "PORÓWNANIE", "2026", "2025", "YoY"].map((h, i) => (
          <div key={i} style={{
            fontSize: 9,
            fontWeight: 600,
            color: i === 2 ? "#1d4ed8" : "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textAlign: i >= 2 ? "right" : "left",
          }}>{h}</div>
        ))}
      </div>

      {/* ─── MONTHLY ROWS ─── */}
      {MONTHS_NAMES.map((m, mi) => {
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
              gridTemplateColumns: "44px 1fr 68px 68px 52px",
              gap: 8,
              padding: "5px 12px",
              alignItems: "center",
              opacity: isFuture ? 0.28 : 1,
              background: mi % 2 === 0 ? "#fff" : "#fafbfc",
              borderBottom: isQEnd ? "none" : "1px solid #f3f4f6",
              transition: "background 0.15s",
            }}>
              {/* Month label */}
              <div style={{ fontSize: 11, fontWeight: 600, color: "#334155" }}>{m}</div>

              {/* Dual bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <div style={{
                    width: `${barW26}%`,
                    height: 8,
                    background: !isFuture && v26 >= v25
                      ? "linear-gradient(90deg, #3b82f6, #2563eb)"
                      : !isFuture
                        ? "linear-gradient(90deg, #f97316, #ea580c)"
                        : "#e5e7eb",
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                    minWidth: v26 ? 3 : 0,
                  }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <div style={{
                    width: `${barW25}%`,
                    height: 5,
                    background: "#e2e8f0",
                    borderRadius: 3,
                  }} />
                </div>
              </div>

              {/* 2026 value */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textAlign: "right" }}>{fmtV(v26)}</div>

              {/* 2025 value */}
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>{fmtV(v25)}</div>

              {/* YoY % */}
              <div style={{ textAlign: "right" }}>
                {pct !== null ? (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: pct >= 0 ? "#15803d" : "#dc2626",
                  }}>
                    {pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(0)}%
                  </span>
                ) : <span style={{ color: "#d1d5db", fontSize: 10 }}>—</span>}
              </div>
            </div>

            {/* Quarter summary row */}
            {isQEnd && (() => {
              const q = Math.floor(mi / 3);
              const q25 = qSum(data25, q);
              const q26 = qSum(data26, q);
              const hasQ = q26 > 0;
              const qPct = q25 && q26 ? ((q26 - q25) / q25 * 100) : null;

              return (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 68px 68px 52px",
                  gap: 8,
                  padding: "5px 12px",
                  background: "#f0f4ff",
                  borderTop: "1px solid #e0e7ff",
                  borderBottom: "1px solid #e0e7ff",
                  alignItems: "center",
                  opacity: hasQ ? 1 : 0.3,
                  marginBottom: 2,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#4338ca" }}>Q{q + 1}</div>
                  <div />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textAlign: "right" }}>{fmtV(q26)}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textAlign: "right" }}>{fmtV(q25)}</div>
                  <div style={{ textAlign: "right" }}>
                    {qPct !== null ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: qPct >= 0 ? "#15803d" : "#dc2626" }}>
                        {qPct >= 0 ? "+" : ""}{qPct.toFixed(1)}%
                      </span>
                    ) : <span style={{ color: "#d1d5db", fontSize: 10 }}>—</span>}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* ─── HALF-YEAR SUMMARY ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        {[0, 1].map(h => {
          const h25 = data25.slice(h * 6, h * 6 + 6).reduce((a, b) => a + b, 0);
          const h26 = data26.slice(h * 6, h * 6 + 6).reduce((a, b) => a + b, 0);
          const hasH = h26 > 0;
          const hPct = h25 && h26 ? ((h26 - h25) / h25 * 100) : null;

          return (
            <div key={h} style={{
              background: "#f8fafc",
              borderRadius: 10,
              padding: "10px 14px",
              border: "1px solid #e5e7eb",
              opacity: hasH ? 1 : 0.3,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>H{h + 1}</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8" }}>{fmtV(h26)}</span>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>vs {fmtV(h25)}</span>
                </div>
              </div>
              {hPct !== null ? (
                <span style={{
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 8,
                  background: hPct >= 0 ? "#f0fdf4" : "#fef2f2",
                  color: hPct >= 0 ? "#15803d" : "#dc2626",
                  border: `1px solid ${hPct >= 0 ? "#bbf7d0" : "#fecaca"}`,
                }}>
                  {hPct >= 0 ? "+" : ""}{hPct.toFixed(1)}%
                </span>
              ) : <span style={{ color: "#d1d5db" }}>—</span>}
            </div>
          );
        })}
      </div>

      {/* ─── YEARLY TOTAL ─── */}
      <div style={{
        marginTop: 8,
        background: "#f8fafc",
        borderRadius: 10,
        padding: "10px 14px",
        border: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>ROK TOTAL</div>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#1d4ed8" }}>{fmtV(data26.reduce((a, b) => a + b, 0))} <span style={{ fontSize: 10, fontWeight: 500 }}>({activeMonths} mies.)</span></span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>vs {fmtV(full25)}</span>
          </div>
        </div>
        {pctYtd ? (
          <span style={{
            fontSize: 14,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 8,
            background: pctYtd >= 0 ? "#f0fdf4" : "#fef2f2",
            color: pctYtd >= 0 ? "#15803d" : "#dc2626",
            border: `1px solid ${pctYtd >= 0 ? "#bbf7d0" : "#fecaca"}`,
          }}>
            {pctYtd >= 0 ? "+" : ""}{pctYtd.toFixed(1)}% YTD
          </span>
        ) : <span style={{ color: "#d1d5db" }}>—</span>}
      </div>
    </div>
  );
}