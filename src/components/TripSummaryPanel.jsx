// TripSummaryPanel — prezentacja metryk trasy frachtu (punktualność, czas, km,
// średnie spalanie, ocena ok/warn/alarm). Wydzielone z App.jsx 2026-04-28
// (TODO #5c krok 2). Współdzielone między admin (FrachtyTab + VehicleOrdersSection
// + FrachtyModal) a kierowca (DriverPanel po zakończeniu trasy).
//
// Variants:
//   - "full" (default) — pełny widok z spalaniem + szczegóły (admin)
//   - "compact" — siatka 2-kolumnowa, mniejszy padding (zagnieżdżona lista)
//   - "driver" — bez spalania (kierowca nie widzi metryki paliwa)

import { computeTripStats, fmtTripDuration, SPALANIE_DEFAULT_NORMA, SPALANIE_DEFAULT_ALARM } from "../utils/tripStats";

// Kafelek pojedynczej metryki — kolory wg statusu (ok/warn/alarm/neutral)
function TripTile({ label, value, sub, status }) {
  const palette = {
    ok:    { bg: "#f0fdf4", border: "#bbf7d0", label: "#15803d", value: "#166534" },
    warn:  { bg: "#fffbeb", border: "#fde68a", label: "#92400e", value: "#78350f" },
    alarm: { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", value: "#991b1b" },
    neutral: { bg: "#f8fafc", border: "#e5e7eb", label: "#6b7280", value: "#111827" },
  }[status || "neutral"];
  return (
    <div style={{
      padding: 12, borderRadius: 12, background: palette.bg,
      border: `1px solid ${palette.border}`, minHeight: 74,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: palette.label, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: palette.value, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function TripSummaryPanel({ fracht, vehicle, driverEvents = [], fuelEntries = [], variant = "full" }) {
  const stats = computeTripStats(fracht, vehicle, driverEvents, fuelEntries);
  if (!stats) return null;

  const { punktZal, punktRoz, czasTrasyMin, czasPlanowanyMin, kmRzeczywiste, kmPlanowane, sredniaPredkosc, spalanie, ocenaOgolna } = stats;

  // Czy jest sens w ogóle renderować — wymagamy przynajmniej jednej metryki
  const hasAny = punktZal || punktRoz || czasTrasyMin || kmRzeczywiste || spalanie;
  if (!hasAny) return null;

  // Nagłówek z oceną ogólną
  const ocenaPalette = {
    ok:    { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", icon: "✅", text: "Trasa zakończona OK" },
    warn:  { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "⚠️", text: "Trasa z zastrzeżeniami" },
    alarm: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: "🚨", text: "Trasa — przekroczenia" },
  }[ocenaOgolna];

  const isCompact = variant === "compact";
  const isDriver = variant === "driver";
  const showSpalanie = !isDriver;  // Kierowca nie widzi spalania (ograniczony panel)

  const punktZalStatus = punktZal?.status || null;
  const punktRozStatus = punktRoz?.status || null;

  // Czas planowany — różnica względem rzeczywistego (tylko info)
  const czasDiffMin = (czasTrasyMin != null && czasPlanowanyMin != null) ? czasTrasyMin - czasPlanowanyMin : null;
  const czasDiffText = czasDiffMin == null ? null :
    czasDiffMin > 0 ? `+${fmtTripDuration(czasDiffMin)} vs plan` :
    czasDiffMin < 0 ? `-${fmtTripDuration(Math.abs(czasDiffMin))} vs plan` :
    "dokładnie wg planu";

  // Km — różnica od planu
  const kmDiff = (kmRzeczywiste != null && kmPlanowane != null) ? kmRzeczywiste - kmPlanowane : null;
  const kmDiffText = kmDiff == null ? null :
    Math.abs(kmDiff) < 5 ? "≈ plan" :
    kmDiff > 0 ? `+${kmDiff} km vs plan` : `${kmDiff} km vs plan`;

  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: `1px solid ${ocenaPalette.border}`,
      padding: isCompact ? 12 : 16,
      marginTop: isCompact ? 8 : 16,
      marginBottom: isCompact ? 8 : 16,
    }}>
      {/* Nagłówek z oceną */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 10,
        background: ocenaPalette.bg, border: `1px solid ${ocenaPalette.border}`,
        marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{ocenaPalette.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ocenaPalette.color, textTransform: "uppercase", letterSpacing: 0.5 }}>Podsumowanie trasy</div>
            <div style={{ fontSize: 13, color: ocenaPalette.color, fontWeight: 600 }}>{ocenaPalette.text}</div>
          </div>
        </div>
      </div>

      {/* Metryki — siatka */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isCompact ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
      }}>
        {/* Punktualność załadunku */}
        {punktZal && (
          <TripTile
            label="Załadunek"
            value={punktZal.onTime ? "Na czas" : `+${punktZal.minutes} min`}
            sub={punktZal.onTime ? "w tolerancji 15 min" : "spóźnienie"}
            status={punktZalStatus === "late" ? "alarm" : "ok"}
          />
        )}
        {/* Punktualność rozładunku */}
        {punktRoz && (
          <TripTile
            label="Rozładunek"
            value={punktRoz.onTime ? "Na czas" : `+${punktRoz.minutes} min`}
            sub={punktRoz.onTime ? "w tolerancji 15 min" : "spóźnienie"}
            status={punktRozStatus === "late" ? "alarm" : "ok"}
          />
        )}
        {/* Czas trasy */}
        {czasTrasyMin != null && (
          <TripTile
            label="Czas trasy"
            value={fmtTripDuration(czasTrasyMin)}
            sub={czasDiffText || (czasPlanowanyMin ? `plan: ${fmtTripDuration(czasPlanowanyMin)}` : null)}
            status="neutral"
          />
        )}
        {/* Km rzeczywiste */}
        {kmRzeczywiste != null && (
          <TripTile
            label="Kilometry"
            value={`${kmRzeczywiste.toLocaleString("pl-PL")} km`}
            sub={kmDiffText || (kmPlanowane ? `plan: ${kmPlanowane} km` : null)}
            status="neutral"
          />
        )}
        {/* Średnia prędkość */}
        {sredniaPredkosc != null && (
          <TripTile
            label="Średnia prędkość"
            value={`${sredniaPredkosc} km/h`}
            sub={null}
            status="neutral"
          />
        )}
        {/* Spalanie (ukryte dla kierowcy) */}
        {showSpalanie && spalanie && (
          <TripTile
            label="Spalanie"
            value={`${spalanie.avgL100km} l/100km`}
            sub={
              spalanie.status === "ok"    ? "w normie" :
              spalanie.status === "warn"  ? "powyżej normy" :
              spalanie.status === "alarm" ? "przekroczenie alarmu" : null
            }
            status={spalanie.status || "neutral"}
          />
        )}
      </div>

      {/* Dodatkowe info w wersji pełnej */}
      {!isCompact && !isDriver && spalanie && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
          Spalanie wyliczone z {spalanie.tankings} pełnych tankowań pojazdu w okresie trasy (±3 dni).
          Porównanie: norma {Number(vehicle?.spalanieNorma) || SPALANIE_DEFAULT_NORMA} / alarm {Number(vehicle?.spalanieAlarm) || SPALANIE_DEFAULT_ALARM} l/100km.
        </div>
      )}
      {!isCompact && kmRzeczywiste == null && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
          Km rzeczywiste: brak odczytu z CAN. Sprawdź konfigurację Atlas API dla tego pojazdu.
        </div>
      )}
    </div>
  );
}
