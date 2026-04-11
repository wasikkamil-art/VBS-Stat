# VBS-Stat — Handoff: moduł Płatności (stan na 2026-04-10)

Dokument do przekazania kontekstu do nowego czatu. Pokrywa wszystko co zostało zrobione w module **Płatności (PaymentsTab)** oraz powiązane zmiany w FleetStat email.

---

## 1. Stos / środowisko

- **Repo:** `VBS-Stat.nosync` (git, branch `main`, push do GitHub `wasikkamil-art/VBS-Stat`)
- **Główny plik:** `src/App.jsx` — monolit React (~12 000+ linii, jeden plik)
- **Backend:** Firebase Firestore + Firebase Storage + Cloud Functions (`functions/index.js`)
- **Proxy AI:** `/api/claude` (Vercel) → Anthropic API
- **Model AI do parsowania faktur:** `claude-haiku-4-5-20251001` (~5× tańszy niż Sonnet 4, używany w `PaymentForm.parseOneInvoice`)
- **Karta do Anthropic API:** firmowa (zmieniona z prywatnej)
- **Timezone:** Europe/Warsaw (UTC+1/+2) — wszędzie daty ISO składamy ręcznie z liczb, NIE przez `new Date().toISOString()` dla lokalnych dat (patrz bug poniżej)

## 2. Co robi moduł Płatności

Kalendarz faktur kosztowych do zapłaty + lista + parser AI. Kolekcja Firestore: `payments`.

### Model danych (doc w `payments`)

```
{
  contractor: string,          // nazwa kontrahenta/sprzedawcy
  invoiceNumber: string,       // nr FV
  sellerNip: string,           // NIP sprzedawcy (nowe pole)
  bankAccount: string,         // IBAN/NRB (nowe pole)
  category: string,            // id z PAY_CATEGORIES
  currency: string,            // PLN/EUR/USD (PAY_CURRENCIES)
  netto: number,
  brutto: number,
  vat: number,
  issueDate: "YYYY-MM-DD",
  dueDate: "YYYY-MM-DD",
  status: "topay"|"paid"|"overdue",  // ad-hoc (nie-cykliczna)
  note: string,

  // Split udziału firma/prywat
  split: { enabled: bool, companyPct: number },

  // Pliki (załącznik oryginalnej FV w Storage)
  fileUrl, filePath, fileName, fileType, fileSize,

  // Cykliczność
  recurring: { enabled: bool, interval: "monthly"|..., ... },
  paidInstances: string[],     // klucze instancji oznaczonych jako zapłacone

  createdAt: ISO string,
}
```

### Kluczowe funkcje / helpery

- `expandPayment(p, windowStart, windowEnd)` — generuje wirtualne instancje z szablonu cyklicznego w danym oknie. Każda instancja ma `instanceKey` (np. `YYYY-MM-DD`) i flagę `isInstance:true`.
- `statusOf(inst)` → `"topay" | "paid" | "overdue"` — patrzy na `paidInstances` dla cyklicznych, `status` dla ad-hoc, + porównanie `dueDate` z dziś dla overdue.
- `uploadPaymentFile(file)` — wgrywa do Firebase Storage pod `payments/{ts}_{rand}_{safeName}`, zwraca `{fileUrl, filePath, fileName, fileType, fileSize}`.
- `PAY_CATEGORIES`, `PAY_CURRENCIES` — stałe.
- `fmtMoney(v, cur)` — formatowanie kwot.

## 3. Zrealizowane funkcjonalności (chronologicznie)

1. **Zmiana karty Anthropic** z prywatnej na firmową.
2. **Switch parsera na Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — ~5× tańszy. Prompt parsujący pozostał.
3. **DayModal** — klik na dzień kalendarza otwiera modal ze wszystkimi fakturami danego dnia (rozwiązuje "3 widoczne z 20 na jeden dzień"). Kalendarz pokazuje max 2 skrócone wpisy + "+N więcej →".
4. **`PaymentStatusBlock`** w formularzu edycji — status zapłacona/niezapłacona dostępny z poziomu edycji (dla ad-hoc toggle, dla cyklicznych lista instancji z checkboxami).
5. **Fix month nav (timezone bug)** — `new Date(2026, 2, 1).toISOString().slice(0,7)` w UTC+1 zwracało `"2026-02"` bo lokalna północ 1 marca = 28 lutego 23:00 UTC. Fix: `prevMonth`/`nextMonth` składają stringi `YM` ręcznie z liczb:
   ```jsx
   const nextMonth = () => {
     let y = curYear, m = curMon + 1;
     if (m > 12) { m = 1; y += 1; }
     setCursorYM(`${y}-${String(m).padStart(2,"0")}`);
   };
   ```
   `windowStart/windowEnd` używają `"T12:00:00"` (południe lokalne).
6. **Nowe pola z parsera AI:** `sellerNip`, `bankAccount` — dodane do promptu, form state, UI.
7. **FleetStat email fix** (`functions/index.js` `buildEmailHTML`): kolumna "Kod rozładunku" przemianowana na **"Kod / Termin"**, pokazuje `kod · data` jeśli jest `dataRozladunku`. Trzy ścieżki: `activeF`, `nextF`, `wolny`. Helper `fmtDate(d)` linia 153.
8. **Multi-invoice upload (Option A)** — można wgrać kilka plików na raz. Parsowanie równoległe przez `Promise.allSettled`, progress bar, kolejka `aiQueue` w `PaymentsTab`. Po zapisie formularza `saveForm` popuje następną z kolejki i remountuje form przez `formKey`.
9. **Załącznik oryginalnej FV** — PDF/obraz idzie do Firebase Storage, link do pobrania widoczny w liście, modalu dnia i szczegółach. Metadane spłaszczone: `fileUrl`, `filePath`, `fileName`, `fileType`, `fileSize`.
10. **Bug fix: attachments lost on queued invoices** — parsowane wyniki miały metadane pliku pod `_file`, ale `PaymentForm` czyta `initial.fileUrl` (flat). Fix: spłaszczamy `_file` na top-level PRZED pushem do `aiQueue`:
    ```jsx
    setAiQueue(success.slice(1).map(r => ({
      ...r,
      fileUrl: r._file?.fileUrl || "",
      filePath: r._file?.filePath || "",
      ...
    })));
    ```
11. **Admin-only delete w liście** — czerwony przycisk 🗑 w wierszu, widoczny tylko dla `isAdmin` (Kamil). `deleteRec(id)` usuwa z Firestore i (jeśli jest) plik ze Storage.
12. **Drag & drop** — można przeciągnąć pliki z folderu systemu na strefę upload w PaymentsTab. `onDragOver`, `onDragLeave`, `onDrop` + stan `isDragging` + niebieskie podświetlenie. Shared helper `processFiles(files)` dla kliknięcia i dropu. Uwaga: NIE dawać `pointer-events-none` na wewnętrzny flex — łamie klik w button "Wgraj".
13. **Search/filters (ostatni commit c640bbb)** — wyszukiwanie po:
    - **tekst** (case-insensitive, substring): `contractor`, `invoiceNumber`, `sellerNip`, `bankAccount`
    - **zakres dat** (Od / Do) po `dueDate`
    - Przycisk "✕ Wyczyść" resetuje wszystkie filtry wyszukiwania
    - Gdy jakikolwiek filtr wyszukiwania jest aktywny:
      - źródłem listy staje się `allInstances` (cross-month, ±window) zamiast `monthInstances`
      - okno `windowStart/windowEnd` automatycznie rozszerza się, jeśli `dateFrom/dateTo` wychodzą poza ±6/+18 miesięcy
      - widok kalendarza się chowa (tylko lista)
    - `hasSearchFilters = !!(searchQuery.trim() || dateFrom || dateTo)`

## 4. Ostatnie commity (git log)

```
c640bbb Payments: add search by invoice #, client, NIP and date range filter
27a395c Payments: drag & drop invoices onto AI upload zone
88d3335 Payments list: admin-only delete button per row
3b4e457 Payments: fix attachments lost on queued invoices in multi-upload
2c9573c Payments: attach original invoice file to record + download links
3417b44 Payments: multi-invoice AI upload with review queue
3f174fa Email: show unload date next to code in fleet status report
928288e Payments: fix month nav timezone bug + add bank account & NIP fields
c3b13a5 Payments: day modal + per-day badge + status toggle in edit form
95c09b9 Payments AI parser: switch to Claude Haiku 4.5 (~5x cheaper)
0446c0b feat(payments): AI invoice parsing — upload PDF/image, auto-fill form
af06a8b fix(rules): allow read/write on payments collection
fc155f0 feat: add Płatności module — calendar of invoices to pay
```

## 5. Znane pułapki / zasady pracy w tym repo

- **Jeden plik `src/App.jsx`** — wszystko tam jest. Używać `grep`/`Grep` do nawigacji, nie zgadywać linii.
- **Timezone:** NIGDY `new Date().toISOString().slice(0,10)` dla dat lokalnych. Składać ręcznie `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}` albo używać `"T12:00:00"`.
- **Verify syntax przed commitem:**
  ```bash
  node -e "const fs=require('fs');const src=fs.readFileSync('src/App.jsx','utf8');require('esbuild').transformSync(src,{loader:'jsx'});console.log('OK')"
  ```
  `npx esbuild` nie działa w sandboxie (exec format error) — używać `node -e` z `transformSync`.
- **Commit convention:** krótki tytuł, pusta linia, bullet points, stopka `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.
- **Push po każdej kompletnej zmianie.** User chce widzieć efekty na produkcji.
- **isAdmin** = Kamil (sprawdzane po emailu `wasik.kamil@gmail.com`). Nowe destrukcyjne akcje → `{isAdmin && ...}`.

## 6. Otwarte / potencjalne follow-upy (NIC nie zlecone jeszcze)

To lista rzeczy które mogłyby być przydatne ale **user ich nie zgłosił** — nie ruszać bez prośby:

- Paginacja listy gdy wyników >100
- Eksport wyszukanych faktur do Excela (mógłby użyć `xlsx` skill)
- Statystyki roczne per kontrahent
- Powiadomienia o zbliżającym się terminie (email/push)
- Podpowiedzi autocomplete w polu kontrahent na podstawie historii
- OCR dla zdjęć faktur papierowych niższej jakości

## 7. Kontekst użytkownika

- **Imię:** Kamil (wasik.kamil@gmail.com) — admin, jedyny ktoś kto używa modułu Płatności
- **Styl komunikacji:** polski, zwięzły, często z literówkami, bez punktuacji. Rozumie kod ale nie chce czytać długich postambuł — liczy się efekt i link do pliku/deploy.
- **Workflow:** zmiana → push → sprawdzenie na produkcji → feedback.

---

**Stan na:** 2026-04-10, commit `c640bbb` na `main`.
