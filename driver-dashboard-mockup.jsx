import { useState } from "react";

export default function DriverDashboardMockup() {
  const [screen, setScreen] = useState("home"); // "home" | "zlecenia" | "serwis" | "dokumenty" | "tankowania" | "czas" | "mapa"

  // ── HOME DASHBOARD ──
  if (screen === "home") {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", padding: "24px 16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>FleetStat</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Siarhei Kolabu</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>WGM 5367K</div>
              <div style={{ color: "#64748b", fontSize: 11 }}>Solo · Winda</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>

          {/* ═══ KAFELEK: ZLECENIA (full width, duży) ═══ */}
          <div
            onClick={() => setScreen("zlecenia")}
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              cursor: "pointer",
              marginBottom: 12,
            }}
          >
            {/* Aktywne zlecenie — preview */}
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}>
                  📋
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Zlecenia</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>1 aktywne · 1 nadchodzące</div>
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#d1d5db" }}>›</div>
            </div>

            {/* Mini preview aktywnego zlecenia */}
            <div style={{ padding: "0 20px 16px" }}>
              <div style={{
                padding: "12px 14px", borderRadius: 12,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#15803d" }}>🚛 W trasie</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>REF: ESTE-0097</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>ES 46720</span>
                  <span style={{ color: "#d1d5db", fontSize: 12 }}>→</span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>IT 34151</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>17.04</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SIATKA KAFELKÓW (2 kolumny) ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

            {/* Serwis */}
            <div
              onClick={() => setScreen("serwis")}
              style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                🔧
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Serwis</div>
              <div style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                background: "#fef2f2", color: "#dc2626",
              }}>
                OC za 28 dni
              </div>
            </div>

            {/* Dokumenty */}
            <div
              onClick={() => setScreen("dokumenty")}
              style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                📄
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Dokumenty</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>CMR, zlecenia</div>
            </div>

            {/* Karta tankowań */}
            <div
              onClick={() => setScreen("tankowania")}
              style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                ⛽
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Tankowania</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Śr. 28.4 L/100</div>
            </div>

            {/* Czas pracy */}
            <div
              onClick={() => setScreen("czas")}
              style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                ⏱
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Czas pracy</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Pauzy, jazda</div>
            </div>

            {/* Mapa */}
            <div
              onClick={() => setScreen("mapa")}
              style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #ec4899, #db2777)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                🗺️
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Mapa</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Wkrótce</div>
            </div>

            {/* Pojazd */}
            <div
              onClick={() => setScreen("pojazd")}
              style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #64748b, #475569)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                🚛
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Pojazd</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Dane, wyposażenie</div>
            </div>

          </div>
        </div>

        {/* Wyloguj na dole */}
        <div style={{ padding: "16px 16px 32px", textAlign: "center" }}>
          <button style={{
            background: "none", border: "none", fontSize: 13, color: "#9ca3af", cursor: "pointer",
          }}>
            Wyloguj
          </button>
        </div>
      </div>
    );
  }

  // ── ZLECENIA LIST ──
  if (screen === "zlecenia") {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ padding: "16px 16px 0" }}>
          <button onClick={() => setScreen("home")}
            style={{ background: "none", border: "none", fontSize: 14, color: "#6b7280", cursor: "pointer", padding: "8px 0", minHeight: 44 }}>
            ← Powrót
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Zlecenia</div>
        </div>

        <div style={{ padding: "0 16px 32px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Aktywne (1)
          </div>

          {/* Active order */}
          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
            overflow: "hidden", marginBottom: 16, cursor: "pointer",
          }}>
            <div style={{ background: "#f0fdf4", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>🚛 W trasie</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>ESTE-0097</span>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>ES 46720 Villalonga</span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>14.04 · 14:00</span>
              </div>
              <div style={{ width: 1, height: 12, background: "#e5e7eb", marginLeft: 3.5 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>IT 34151 Trieste</span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>17.04 · 09:00</span>
              </div>
            </div>
            <div style={{ padding: "0 16px 14px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>
                4 palety · 1206 kg
              </span>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>
                Bok, tył, góra
              </span>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Nadchodzące (1)
          </div>

          {/* Upcoming order */}
          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
            overflow: "hidden", cursor: "pointer",
          }}>
            <div style={{ background: "#eff6ff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>📋 Zaplanowane</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>CRAFTER-0042</span>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>IT 34151 Trieste</span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>18.04</span>
              </div>
              <div style={{ width: 1, height: 12, background: "#e5e7eb", marginLeft: 3.5 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>DE 71034 Böblingen</span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>19.04</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── INNE EKRANY (placeholder) ──
  const titles = {
    serwis: "Serwis",
    dokumenty: "Dokumenty",
    tankowania: "Karta tankowań",
    czas: "Czas pracy",
    mapa: "Mapa",
    pojazd: "Pojazd",
  };

  const icons = {
    serwis: "🔧",
    dokumenty: "📄",
    tankowania: "⛽",
    czas: "⏱",
    mapa: "🗺️",
    pojazd: "🚛",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <button onClick={() => setScreen("home")}
          style={{ background: "none", border: "none", fontSize: 14, color: "#6b7280", cursor: "pointer", padding: "8px 0", minHeight: 44 }}>
          ← Powrót
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
          {icons[screen]} {titles[screen]}
        </div>
      </div>
      <div style={{ padding: "0 16px", textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{icons[screen]}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>{titles[screen]}</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
          {screen === "mapa" ? "Wkrótce — integracja GPS" : "Widok w budowie"}
        </div>
      </div>
    </div>
  );
}
