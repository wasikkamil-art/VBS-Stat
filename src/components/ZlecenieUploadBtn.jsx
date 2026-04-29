// ZlecenieUploadBtn — przycisk uploadu PDF zlecenia do Firebase Storage.
// Wydzielone z App.jsx 2026-04-29 (#5c krok 6) — używane w 3 miejscach:
// FrachtyTab (lista admin), FVTab (faktury), FrachtyModal (modal).

import { useState, useRef } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export default function ZlecenieUploadBtn({ frachtId, onUploaded, label = "+ Dodaj zlecenie", fullWidth = false }) {
  // onUploaded(url, parsedData) — parsedData = { nrZlecenia, nrRef, zaladunekAdres, ... }
  const [status, setStatus] = useState("idle");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    try {
      const path = `documents/${frachtId}/zlecenie_${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);

      // AI parsowanie zlecenia — wyciąga pełne dane operacyjne
      setStatus("reading");
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const isPDF = file.type === "application/pdf";
      const body = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: isPDF ? "document" : "image", source: { type: "base64", media_type: file.type, data: base64 } },
            { type: "text", text: `Przeanalizuj to zlecenie transportowe i wyciągnij dane operacyjne.
Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "nrZlecenia": "numer zlecenia lub null",
  "nrRef": "numer referencyjny lub skrócony identyfikator lub null",
  "zaladunekFirma": "nazwa firmy w której odbywa się załadunek (np. VANKING) lub null",
  "zaladunekKodPocztowy": "sam kod pocztowy załadunku (np. ES 46720) lub null",
  "zaladunekMiasto": "samo miasto załadunku (np. Villalonga) lub null",
  "zaladunekAdres": "ulica i numer budynku załadunku lub null",
  "zaladunekTelefon": "telefon kontaktowy na załadunku lub null",
  "dataZaladunku": "YYYY-MM-DD lub null",
  "godzZaladunku": "HH:MM lub null",
  "rozladunekFirma": "nazwa firmy 1. rozładunku lub null",
  "dokodPocztowy": "sam kod pocztowy 1. rozładunku (np. IT 34151) lub null",
  "dokodMiasto": "samo miasto 1. rozładunku (np. Trieste) lub null",
  "rozladunekAdres": "ulica i numer 1. rozładunku lub null",
  "rozladunekTelefon": "telefon kontaktowy na 1. rozładunku lub null",
  "dataRozladunku": "YYYY-MM-DD lub null",
  "godzRozladunku": "HH:MM lub null",
  "rozladunekFirma2": "nazwa firmy 2. rozładunku lub null",
  "dokodPocztowy2": "kod pocztowy 2. rozładunku lub null",
  "dokodMiasto2": "miasto 2. rozładunku lub null",
  "rozladunekAdres2": "ulica 2. rozładunku lub null",
  "rozladunekTelefon2": "telefon 2. rozładunku lub null",
  "dataRozladunku2": "YYYY-MM-DD 2. rozładunku lub null",
  "godzRozladunku2": "HH:MM 2. rozładunku lub null",
  "zleceniodawcaFirma": "nazwa firmy zleceniodawcy lub null",
  "zleceniodawcaOsoba": "imię i nazwisko osoby kontaktowej zleceniodawcy lub null",
  "zleceniodawcaTelefon": "telefon zleceniodawcy lub null",
  "zleceniodawcaEmail": "email zleceniodawcy lub null",
  "klient": "nazwa klienta/zleceniodawcy (skrócona)",
  "towarOpis": "krótki opis towaru (np. Palety, Kartony)",
  "towarIloscPalet": "ilość palet/sztuk (cyfra) lub null",
  "towarPalety": "wymiary towaru, każda pozycja w nowej linii (np. 2× 240x120x240\\n1× 120x120xH240) lub null",
  "wagaLadunku": "waga w kg (sama cyfra) lub null",
  "zaladunekTyp": "typ załadunku (bok, tył, góra) lub null",
  "uwagi": "uwagi operacyjne istotne dla kierowcy (BEZ cen, BEZ warunków płatności) lub null"
}
NIE podawaj cen frachtu, warunków płatności, NIP, danych spedytora ani warunków umowy.` }
          ]
        }]
      };
      try {
        const resp = await fetch("/api/claude", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
        });
        const data = await resp.json();
        const text = data.content?.find(b => b.type === "text")?.text || "{}";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        onUploaded(url, parsed);
      } catch { onUploaded(url, { nrZlecenia: null }); }

      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className={fullWidth ? "w-full" : ""}>
      {status === "idle" && (
        <button onClick={() => fileRef.current?.click()}
          className={`text-xs px-2 py-1 rounded-lg border border-dashed font-medium transition-all hover:bg-gray-50 ${fullWidth ? "w-full text-center" : ""}`}
          style={{ borderColor: "#d1d5db", color: "#6b7280" }}>
          {label}
        </button>
      )}
      {status === "uploading" && <span className="text-xs text-gray-400 animate-pulse">⬆️ wysyłam…</span>}
      {status === "done"      && <span className="text-xs text-green-600">✅ wgrane!</span>}
      {status === "error"     && <button onClick={() => setStatus("idle")} className="text-xs text-red-500">⚠️ błąd — spróbuj ponownie</button>}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ═══════ GEO PICKER — mini mapa Leaflet do wyboru lokalizacji ═══════
