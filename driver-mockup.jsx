import { useState } from "react";

const MOCK_ORDER = {
  ref: "ESTE-0097",
  klient: "TFT LOGISTIC",
  zaladunek: {
    data: "2026-04-14",
    godzina: "14:00",
    adres: "sklumAvinguda L'orxa 101, junto al cementerio de Villalonga",
    kod: "ES 46720 Villalonga, Valencia",
    telefon: "",
  },
  rozladunek: {
    data: "2026-04-17",
    godzina: "09:00",
    adres: "strada Costiera 22",
    kod: "IT 34151 Trieste",
    telefon: "+39 339 286 5554",
  },
  towar: {
    opis: "Palety",
    palety: [
      { szt: 2, wymiary: "240×120×240" },
      { szt: 1, wymiary: "240×120×H200" },
      { szt: 1, wymiary: "120×120×H240" },
    ],
    iloscPalet: 4,
    wagaKg: 1206,
    zaladunekTyp: "Bok, tył, góra",
  },
  uwagi: "Solo + winda (paleciak)",
  dyspozytor: "Aro",
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "long",
    });
  } catch {
    return d;
  }
};

const fmtTime = (d, g) => {
  if (!d) return "";
  const dateStr = new Date(d + "T12:00:00").toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
  return g ? `${dateStr} · ${g}` : dateStr;
};

const fmtNow = () => {
  const now = new Date();
  return `${now.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })} · ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function DriverMockup() {
  const [view, setView] = useState("list");
  const [zaladowano, setZaladowano] = useState(null);
  const [rozladowano, setRozladowano] = useState(null);
  const [zdjecieZal, setZdjecieZal] = useState(null);
  const [zdjecieCMR, setZdjecieCMR] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);

  const o = MOCK_ORDER;

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          background: "#f8f9fb",
          minHeight: "100vh",
          maxWidth: 430,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b, #334155)",
            padding: "20px 16px 16px",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-lg font-bold">FleetStat</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                Siarhei Kolabu
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-sm font-medium">WGM 5367K</div>
              <div style={{ color: "#64748b", fontSize: 11 }}>
                Solo · Winda
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* Active order card */}
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Aktywne (1)
          </div>

          <div
            onClick={() => setView("detail")}
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            {/* Status bar */}
            <div
              style={{
                background: zaladowano && rozladowano ? "#f0fdf4" : zaladowano ? "#eff6ff" : "#fffbeb",
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: zaladowano && rozladowano ? "#15803d" : zaladowano ? "#2563eb" : "#92400e",
                }}
              >
                {zaladowano && rozladowano
                  ? "✅ Rozładowano"
                  : zaladowano
                  ? "🚛 W trasie"
                  : "📋 Oczekuje na załadunek"}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                {o.ref}
              </span>
            </div>

            {/* Route */}
            <div style={{ padding: "14px 16px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {o.zaladunek.kod.split(",")[0]}
                </span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>
                  {fmtTime(o.zaladunek.data, o.zaladunek.godzina)}
                </span>
              </div>
              <div
                style={{
                  width: 1,
                  height: 16,
                  background: "#e5e7eb",
                  marginLeft: 3.5,
                }}
              />
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#10b981",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {o.rozladunek.kod.split(",")[0]}
                </span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>
                  {fmtTime(o.rozladunek.data, o.rozladunek.godzina)}
                </span>
              </div>
            </div>

            {/* Quick info */}
            <div
              style={{
                padding: "0 16px 14px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "#f3f4f6",
                  color: "#6b7280",
                  fontWeight: 500,
                }}
              >
                {o.towar.iloscPalet} palet · {o.towar.wagaKg} kg
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "#f3f4f6",
                  color: "#6b7280",
                  fontWeight: 500,
                }}
              >
                {o.towar.zaladunekTyp}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#fff",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              maxWidth: 430,
              width: "100%",
              display: "flex",
            }}
          >
            {[
              { id: "zlecenia", label: "Zlecenia", icon: "📋" },
              { id: "pojazd", label: "Pojazd", icon: "🚛" },
              { id: "serwis", label: "Serwis", icon: "🔧" },
              { id: "spalanie", label: "Spalanie", icon: "⛽" },
              { id: "czas", label: "Czas", icon: "⏱" },
            ].map((t) => (
              <button
                key={t.id}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: t.id === "zlecenia" ? "#111827" : "#9ca3af",
                }}
              >
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600 }}>
                  {t.label}
                </span>
                {t.id === "zlecenia" && (
                  <div
                    style={{
                      width: 20,
                      height: 2,
                      background: "#111827",
                      borderRadius: 1,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ──
  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#f8f9fb",
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        paddingBottom: 40,
      }}
    >
      {/* Back */}
      <div style={{ padding: "16px 16px 0" }}>
        <button
          onClick={() => setView("list")}
          style={{
            background: "none",
            border: "none",
            fontSize: 14,
            color: "#6b7280",
            cursor: "pointer",
            padding: "8px 0",
          }}
        >
          ← Powrót
        </button>
      </div>

      {/* Header card */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b, #334155)",
            borderRadius: 16,
            padding: "20px",
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
              REF: {o.ref}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 20,
                background: zaladowano && rozladowano ? "rgba(34,197,94,0.2)" : zaladowano ? "rgba(59,130,246,0.2)" : "rgba(251,191,36,0.2)",
                color: zaladowano && rozladowano ? "#4ade80" : zaladowano ? "#60a5fa" : "#fbbf24",
              }}
            >
              {zaladowano && rozladowano
                ? "Rozładowano"
                : zaladowano
                ? "W trasie"
                : "Oczekuje"}
            </span>
          </div>
          <div style={{ color: "#fff", fontSize: 13, marginTop: 4 }}>
            {o.klient}
          </div>
        </div>
      </div>

      {/* TRASA */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          {/* Załadunek */}
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #f3f4f6" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#3b82f6",
                  border: "2px solid #bfdbfe",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Załadunek
              </span>
            </div>
            <div style={{ paddingLeft: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                {o.zaladunek.kod}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 2 }}>
                {o.zaladunek.adres}
              </div>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                {fmtDate(o.zaladunek.data)} · {o.zaladunek.godzina}
              </div>
              {o.zaladunek.telefon && (
                <a
                  href={`tel:${o.zaladunek.telefon}`}
                  style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none", display: "block", marginTop: 4 }}
                >
                  📞 {o.zaladunek.telefon}
                </a>
              )}
            </div>
          </div>

          {/* Rozładunek */}
          <div style={{ padding: "12px 16px 16px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#10b981",
                  border: "2px solid #a7f3d0",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#10b981",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Rozładunek
              </span>
            </div>
            <div style={{ paddingLeft: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                {o.rozladunek.kod}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 2 }}>
                {o.rozladunek.adres}
              </div>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                {fmtDate(o.rozladunek.data)} · {o.rozladunek.godzina}
              </div>
              {o.rozladunek.telefon && (
                <a
                  href={`tel:${o.rozladunek.telefon}`}
                  style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none", display: "block", marginTop: 4 }}
                >
                  📞 {o.rozladunek.telefon}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TOWAR */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Towar
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Ilość palet</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {o.towar.iloscPalet}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Waga łączna</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {o.towar.wagaKg} kg
              </div>
            </div>
          </div>

          {/* Wymiary palet */}
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
            Wymiary palet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {o.towar.palety.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                  {p.szt}× {p.wymiary}
                </span>
              </div>
            ))}
          </div>

          {/* Załadunek typ */}
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              fontSize: 13,
              color: "#92400e",
              fontWeight: 500,
            }}
          >
            Załadunek: {o.towar.zaladunekTyp}
          </div>
        </div>
      </div>

      {/* UWAGI */}
      {o.uwagi && (
        <div style={{ padding: "0 16px 16px" }}>
          <div
            style={{
              background: "#fffbeb",
              borderRadius: 12,
              border: "1px solid #fde68a",
              padding: "12px 16px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
              Uwagi
            </div>
            <div style={{ fontSize: 13, color: "#78350f" }}>{o.uwagi}</div>
          </div>
        </div>
      )}

      {/* ═══════ STATUSY KIEROWCY ═══════ */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Status realizacji
          </div>

          {/* ZAŁADUNEK STATUS */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              marginBottom: 8,
              background: zaladowano ? "#f0fdf4" : "#f8fafc",
              border: `1px solid ${zaladowano ? "#bbf7d0" : "#e5e7eb"}`,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: zaladowano ? 8 : 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: zaladowano ? "#15803d" : "#374151" }}>
                  {zaladowano ? "✅ Załadowano" : "📦 Załadunek"}
                </div>
                {zaladowano && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {zaladowano}
                  </div>
                )}
              </div>
              {!zaladowano && (
                <button
                  onClick={() => setShowConfirm("zaladunek")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#3b82f6",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Potwierdź
                </button>
              )}
            </div>
            {zaladowano && zdjecieZal && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>📸</span>
                <span style={{ fontSize: 12, color: "#15803d", fontWeight: 500 }}>
                  Zdjęcie towaru dodane
                </span>
              </div>
            )}
          </div>

          {/* ROZŁADUNEK STATUS */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              marginBottom: 8,
              background: rozladowano ? "#f0fdf4" : "#f8fafc",
              border: `1px solid ${rozladowano ? "#bbf7d0" : "#e5e7eb"}`,
              opacity: zaladowano ? 1 : 0.5,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: rozladowano ? 8 : 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: rozladowano ? "#15803d" : "#374151" }}>
                  {rozladowano ? "✅ Rozładowano" : "📦 Rozładunek"}
                </div>
                {rozladowano && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {rozladowano}
                  </div>
                )}
              </div>
              {zaladowano && !rozladowano && (
                <button
                  onClick={() => setShowConfirm("rozladunek")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#10b981",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Potwierdź
                </button>
              )}
            </div>
          </div>

          {/* CMR STATUS */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: zdjecieCMR ? "#f0fdf4" : "#f8fafc",
              border: `1px solid ${zdjecieCMR ? "#bbf7d0" : "#e5e7eb"}`,
              opacity: rozladowano ? 1 : 0.5,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: zdjecieCMR ? "#15803d" : "#374151" }}>
                  {zdjecieCMR ? "✅ CMR dodany" : "📄 CMR"}
                </div>
                {zdjecieCMR && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    Zdjęcie CMR dodane
                  </div>
                )}
              </div>
              {rozladowano && !zdjecieCMR && (
                <button
                  onClick={() => {
                    setZdjecieCMR(fmtNow());
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#6366f1",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📷 Dodaj zdjęcie
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ CONFIRMATION MODAL ═══════ */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 36px",
              width: "100%",
              maxWidth: 430,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              {showConfirm === "zaladunek"
                ? "📦 Potwierdź załadunek"
                : "📦 Potwierdź rozładunek"}
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
              {showConfirm === "zaladunek"
                ? "Czy towar został załadowany? Zostanie zapisana data i godzina."
                : "Czy towar został rozładowany? Zostanie zapisana data i godzina."}
            </div>

            {showConfirm === "zaladunek" && (
              <button
                onClick={() => {
                  setZdjecieZal(true);
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "1px dashed #d1d5db",
                  background: zdjecieZal ? "#f0fdf4" : "#f9fafb",
                  color: zdjecieZal ? "#15803d" : "#6b7280",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {zdjecieZal ? "✅ Zdjęcie dodane" : "📷 Dodaj zdjęcie towaru (opcjonalne)"}
              </button>
            )}

            <button
              onClick={() => {
                const ts = fmtNow();
                if (showConfirm === "zaladunek") {
                  setZaladowano(ts);
                } else {
                  setRozladowano(ts);
                }
                setShowConfirm(null);
              }}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 14,
                border: "none",
                background:
                  showConfirm === "zaladunek" ? "#3b82f6" : "#10b981",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showConfirm === "zaladunek"
                ? "📦 Potwierdzam załadunek"
                : "✅ Potwierdzam rozładunek"}
            </button>

            <button
              onClick={() => setShowConfirm(null)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "transparent",
                color: "#6b7280",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
