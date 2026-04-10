# FleetStat — Roadmap do komercjalizacji

**Ostatnia aktualizacja:** 1 kwietnia 2026

---

## Status projektu

FleetStat to aplikacja webowa (React + Firebase) do zarządzania flotą pojazdów. Hosting na Vercel, domena fleetstat.pl. Aplikacja jest w pełni funkcjonalna dla jednej firmy. Szacowany koszt wytworzenia: 70 000–100 000 PLN.

---

## ETAP 1 — Priorytet: Multi-tenancy i rejestracja (krytyczne)

### 1.1 Multi-tenancy — izolacja danych firm
- [ ] Przebudowa struktury Firebase: `firms/{firmId}/vehicles/...`
- [ ] Każda firma ma własne kolekcje (pojazdy, koszty, frachty, dokumenty, pauzy, sprawy)
- [ ] Middleware sprawdzający przynależność użytkownika do firmy
- [ ] Testy — dane jednej firmy nigdy nie widoczne dla innej
- **Szacowany czas:** 2–3 tygodnie
- **Koszt zlecenia:** 15 000–20 000 PLN

### 1.2 Rejestracja i onboarding
- [ ] Formularz rejestracji firmy (nazwa, NIP, email, hasło)
- [ ] Weryfikacja email
- [ ] Kreator wstępny: dodaj pierwszy pojazd, kierowcę
- [ ] Trial 14 dni bez płatności
- [ ] Zapraszanie pracowników do firmy (link/email)
- [ ] Role w firmie: właściciel, dyspozytor, księgowa
- **Szacowany czas:** 1–2 tygodnie
- **Koszt zlecenia:** 5 000–8 000 PLN

---

## ETAP 2 — Płatności i panel admina

### 2.1 System płatności (Stripe / Przelewy24)
- [ ] Integracja z bramką płatności
- [ ] Model cenowy: **29 PLN/pojazd/mc** (minimum 5 pojazdów = 145 PLN/mc)
  - Docelowo 39–49 PLN/pojazd dla nowych klientów po rozbudowie funkcji (GPS, tachograf, raporty)
  - Starzy klienci zachowują starą cenę (budowanie lojalności)
- [ ] Automatyczne faktury VAT
- [ ] Blokada dostępu po braku płatności (z grace period 7 dni)
- [ ] Zmiana liczby pojazdów, anulowanie subskrypcji
- [ ] Trial 14 dni bez płatności
- **Szacowany czas:** 2 tygodnie
- **Koszt zlecenia:** 8 000–12 000 PLN

### 2.2 Panel super-admina (dla Ciebie)
- [ ] Lista firm z liczbą pojazdów, użytkowników
- [ ] Status płatności każdej firmy
- [ ] Blokowanie/odblokowywanie kont
- [ ] Statystyki: ile firm, ile pojazdów łącznie, MRR
- [ ] Logi aktywności
- **Szacowany czas:** 1 tydzień
- **Koszt zlecenia:** 4 000–6 000 PLN

---

## ETAP 3 — Prawo i bezpieczeństwo

### 3.1 RODO / GDPR — obowiązkowe przed pierwszym klientem

**Dlaczego:** Przetwarzacie dane osobowe (imiona kierowców, emaile, NIP-y). Kary UODO: do 20 mln EUR, realistycznie 50–200 tys. PLN. Bez RODO żaden poważny klient nie podpisze umowy.

**Dokumenty do przygotowania:**
- [ ] Polityka prywatności — jakie dane, po co, jak długo, komu (Firebase/Google, Vercel). Po polsku, link z każdej strony apki
- [ ] Regulamin SaaS — warunki korzystania, odpowiedzialność, płatności, wypowiedzenie
- [ ] Umowa powierzenia przetwarzania danych (DPA) — KLUCZOWE. Wy = procesor, firma transportowa = administrator. Bez tego klient korporacyjny nie podpisze kontraktu
- [ ] Rejestr czynności przetwarzania — wewnętrzny dokument: jakie dane, skąd, po co, jak długo, kto ma dostęp. Wymagany na kontrolę UODO
- [ ] Prawo do usunięcia danych — przycisk "Usuń konto i dane" lub procedura na żądanie
- [ ] Cookie banner — Vercel i Firebase stawiają ciasteczka. Gotowe: CookieYes / Cookiebot (darmowe do pewnego limitu)
- [ ] Checkbox akceptacji regulaminu + polityki prywatności przy rejestracji
- [ ] DPIA (ocena skutków) — zalecane bo GPS tracking kierowców = monitoring pracowników
- **IOD (Inspektor Ochrony Danych):** NIE wymagany na start. Przy 200+ firmach warto rozważyć (~2 000 PLN/mc)
- **Koszt u prawnika:** 2 000–5 000 PLN za komplet
- **Czas:** 1–2 tygodnie

### 3.2 Certyfikaty i licencje

#### Certyfikaty — co jest potrzebne
| Certyfikat | Wymagany? | Kiedy | Koszt |
|---|---|---|---|
| ISO 27001 (bezpieczeństwo informacji) | Nie, ale klienci korporacyjni pytają | Przy 100+ firmach | 15 000–40 000 PLN + audyt ~10 000 PLN/rok |
| SOC 2 | Nie (standard USA) | Nigdy, chyba że rynek USA | — |
| Licencja transportowa | Nie (to dla przewoźników, nie dla software) | Nigdy | — |
| NIS 2 (cyberbezpieczeństwo UE) | Nie (dotyczy dużych operatorów) | Nie dotyczy małych SaaS | — |
| Certyfikat deweloperski | Nie istnieje taki wymóg | Nigdy | — |

**Rekomendacja na start:** Zero certyfikatów. Wdrożenie realnych zabezpieczeń (Firestore Rules, backup, 2FA) jest ważniejsze niż papier. ISO 27001 rozważyć przy skali 100+ firm.

#### Licencje technologiczne — BRAK PRZECIWWSKAZAŃ do użytku komercyjnego
| Technologia | Licencja | Komercyjne użycie | Koszt |
|---|---|---|---|
| React | MIT (open source) | Tak, bez ograniczeń | 0 PLN |
| Vite | MIT | Tak, bez ograniczeń | 0 PLN |
| Tailwind CSS | MIT | Tak, bez ograniczeń | 0 PLN |
| Firebase | Google ToS | Tak — płacisz za użycie | Darmowy tier, potem pay-as-you-go |
| Vercel | Vercel ToS | Tak — **wymaga planu Pro przy komercji** | **$20/mc (~85 PLN)** |
| Firebase Auth | Google ToS | Tak | Darmowe do 50K użytkowników/mc |

**Jedyny obowiązkowy koszt licencyjny:** Vercel Pro $20/mc — plan Hobby (darmowy) jest tylko do użytku niekomercyjnego.

### 3.2 Bezpieczeństwo i architektura

#### Obecny stack technologiczny
| Warstwa | Technologia | Status |
|---------|-------------|--------|
| Frontend | React (Vite) — single file App.jsx | Działa produkcyjnie |
| Backend/DB | Firebase Firestore (serverless) | Brak serwera — klient łączy się bezpośrednio z bazą |
| Auth | Firebase Authentication (email/password) | Działa, brakuje 2FA |
| Storage | Firebase Storage | Działa |
| Hosting | Vercel (CDN globalny, SSL automatyczny) | Działa |
| PWA | Service Worker + manifest | Działa |

#### Plan rozwoju infrastruktury
| Skala | Rozwiązanie | Koszt/mc | Kiedy |
|-------|-------------|----------|-------|
| Teraz → 30 firm | Firebase + Cloud Functions | 0–50 PLN | Natychmiast |
| 30–100 firm | Firebase + Cloud Functions + osobna baza GPS | 50–200 PLN | Rok 1 |
| 100+ firm | Migracja na Supabase lub PostgreSQL + Node.js | 100–500 PLN | Rok 2+ |

**Rekomendacja: Firebase + Cloud Functions** — dodanie warstwy serwerowej bez migracji. Cloud Functions dają: logikę biznesową po stronie serwera, automatyczne emaile, generowanie PDF, webhooki (GPS, płatności, Trans.eu), scheduled tasks (backupy, raporty). Darmowe do 2 mln wywołań/mc. Czas wdrożenia: 1–2 tygodnie.

#### Krytyczne problemy do naprawienia (PRZED komercjalizacją)

**PRIORYTET 1 — Firestore Security Rules (brakuje!):**
- [ ] Napisać reguły bezpieczeństwa dla każdej kolekcji (vehicles, costs, frachty, docs, pauzy, sprawy)
- [ ] Reguły muszą sprawdzać `request.auth.uid` — czy użytkownik ma prawo do danego dokumentu
- [ ] Bez tego KAŻDY zalogowany user może czytać/pisać WSZYSTKIE dane
- **Wysiłek:** 1 dzień, ale krytyczne

**PRIORYTET 2 — Role po stronie serwera (Custom Claims):**
- [ ] Przenieść role (admin/dyspozytor/podgląd) z Firestore do Firebase Auth Custom Claims
- [ ] Role sprawdzane w tokenie JWT + Firestore Rules, nie tylko na frontendzie
- [ ] Teraz role ukrywają przyciski, ale nie blokują dostępu do danych
- **Wysiłek:** 2–3 dni

**PRIORYTET 3 — Cloud Functions (warstwa serwerowa):**
- [ ] Wdrożenie Firebase Cloud Functions
- [ ] Przeniesienie krytycznych operacji (zapis, usuwanie, zmiana ról) do funkcji serwerowych
- [ ] Walidacja danych po stronie serwera
- [ ] Webhook endpoint dla integracji GPS
- **Wysiłek:** 1–2 tygodnie

#### Zabezpieczenia do wdrożenia
- [ ] Automatyczny backup Firestore (codziennie do Cloud Storage)
- [ ] Logi aktywności użytkowników (kolekcja `audit_log`: kto/co/kiedy)
- [ ] Dwuskładnikowe uwierzytelnianie 2FA (Firebase Auth TOTP/SMS)
- [ ] Rate limiting na logowanie (ochrona brute-force)
- [ ] Content Security Policy — nagłówki HTTP w vercel.json
- [ ] CORS — ograniczenie dostępu tylko z fleetstat.pl
- [ ] Szyfrowanie wrażliwych danych (NIP, dane kierowców)
- **Szacowany czas:** 1–2 tygodnie
- **Koszt zlecenia:** 6 000–10 000 PLN

---

## ETAP 4 — Landing page i marketing

### 4.1 Strona sprzedażowa
- [ ] Landing page na fleetstat.pl (osobna od apki)
- [ ] Sekcje: funkcje, cennik, FAQ, demo, kontakt
- [ ] Formularz "Umów demo" / "Rozpocznij trial"
- [ ] Responsywna, szybka, SEO-friendly
- **Szacowany czas:** 3–5 dni
- **Koszt zlecenia:** 3 000–5 000 PLN

### 4.2 SEO i content marketing
- [ ] Optymalizacja na frazy: "zarządzanie flotą", "aplikacja dla firmy transportowej", "program do floty"
- [ ] Blog z artykułami branżowymi (czas pracy kierowcy, rozliczanie paliwa, przepisy transportowe)
- [ ] Google Ads kampania testowa (budżet 500–1000 PLN/mc)
- [ ] Profile na LinkedIn, Facebook (grupy transportowe)
- **Budżet miesięczny:** 500–2 000 PLN

### 4.3 Strategia pozyskiwania klientów
- [ ] Znaleźć 3–5 firm transportowych na pilota (za darmo lub symbolicznie)
- [ ] Zebrać feedback przez 3 miesiące
- [ ] Case study z pilotażu ("Firma X zarządza 15 pojazdami w FleetStat")
- [ ] Referencje i opinie na stronę
- [ ] Obecność na targach transportowych / spotkaniach branżowych

---

## ETAP 5 — Rozwój produktu

### 5.1 Raporty i eksporty
- [ ] Raport miesięczny per pojazd (PDF)
- [ ] Raport kosztów z podziałem na kategorie
- [ ] Raport czasu pracy kierowców
- [ ] Eksport do Excel wszystkich danych
- [ ] Automatyczne raporty email (co miesiąc)

### 5.2 GPS na żywo — tracking pojazdów (PRIORYTET)

**Status: PARTNERSTWO Z FIRMĄ GPS — w trakcie realizacji**

#### Partner: firma WiedziszWszystko (monitoring GPS)
- Partner dostarcza hardware (trackery OBD2) + montaż + karty SIM
- FleetStat dostarcza software (mapa, alerty, raporty, integracja z resztą systemu)
- Wspólna oferta dla klientów: tracking + zarządzanie flotą w jednym pakiecie

#### Model współpracy
- Partner zajmuje się: sprzedaż/wynajem urządzeń GPS, montaż u klienta, serwis hardware, SIM
- FleetStat zajmuje się: integracja danych GPS w aplikacji, mapa na żywo, raporty, alerty
- Podział przychodów lub doliczenie GPS do abonamentu FleetStat
- Klient dostaje jedno rozwiązanie zamiast dwóch osobnych systemów

#### Model cenowy GPS
- FleetStat (29 PLN) + GPS (~15 PLN) = **~44 PLN/pojazd/mc** — pełen pakiet
- Nadal 2–3x taniej od konkurencji (Samsara 115–140 PLN, Flotman niepubl.)

#### Funkcje do zbudowania (integracja z danymi od partnera)
- [ ] Integracja API z systemem GPS partnera
- [ ] Mapa na żywo z pozycją wszystkich pojazdów (Google Maps / Leaflet)
- [ ] Historia tras z odtwarzaniem (playback)
- [ ] Geofencing — alerty: pojazd wyjechał z trasy / wszedł w strefę
- [ ] Automatyczny odczyt przebiegu z OBD2 (koniec ręcznego wpisywania km)
- [ ] Zużycie paliwa z OBD2 (raport tankowania, anomalie)
- [ ] Alerty prędkości i stylu jazdy (ostre hamowanie, przyspieszanie)
- [ ] Czas jazdy vs postoju — automatyczne uzupełnianie czasu pracy
- [ ] Kody błędów silnika (DTC) — powiadomienie o awarii
- **Szacowany czas:** 3–5 tygodni (szybciej dzięki partnerstwu — gotowe API)
- **Koszt zlecenia:** 15 000–25 000 PLN (niższy — bez budowania backendu GPS od zera)

#### Przewaga partnerstwa
- Nie budujemy hardware od zera — partner ma doświadczenie i serwis
- Szybsze wejście na rynek z GPS
- Klient dostaje profesjonalny montaż + gwarancję sprzętu
- Możliwość wspólnej sprzedaży — partner poleca FleetStat swoim klientom, my polecamy GPS partnera
- Skalowalność — partner obsługuje logistykę hardware, my skupiamy się na software

### 5.3 Integracje
- [ ] Import danych z tachografu (pliki DDD)
- [ ] Integracja z programami księgowymi (fakturowanie)
- [ ] API dla klientów Enterprise
- [ ] Integracja z Trans.eu (import zleceń z giełdy do FleetStat)

### 5.4 Dodatkowe funkcje
- [ ] Powiadomienia push (przegląd za 7 dni, faktura po terminie)
- [ ] Planowanie tras (z uwzględnieniem czasu pracy kierowcy)
- [ ] Moduł paliwa (tankowania, karty paliwowe, porównanie z OBD2)
- [ ] Czat / komunikator wewnątrzfirmowy
- [ ] Dashcam integracja (opcja przyszłościowa)

---

## Model cenowy

**29 PLN / pojazd / miesiąc** (min. 5 pojazdów = 145 PLN/mc)

### Prognoza przychodów (średnia 35 PLN/pojazd po podwyżkach)

| Scenariusz | Firmy | Śr. pojazdów | Pojazdy | MRR | Roczny przychód |
|------------|-------|-------------|---------|-----|-----------------|
| Start (6 mc) | 10 | 15 | 150 | 5 250 PLN | 63 000 PLN |
| Rok 1 | 50 | 15 | 750 | 26 250 PLN | 315 000 PLN |
| Rok 2 | 100 | 15 | 1 500 | 52 500 PLN | 630 000 PLN |
| Rok 3 | 200 | 15 | 3 000 | 105 000 PLN | 1 260 000 PLN |

### Wartość produktu (mnożnik 3–5x rocznego przychodu)

| Etap | Przychód roczny | Wartość biznesowa |
|------|-----------------|-------------------|
| Przed komercjalizacją | 0 PLN | 70–100 tys. PLN (koszt wytworzenia) |
| Po wdrożeniu (bez klientów) | 0 PLN | 150–220 tys. PLN (koszt wytworzenia) |
| 50 firm | 315 000 PLN | ~1 000 000 PLN |
| 100 firm | 630 000 PLN | ~2 500 000 PLN |
| 200 firm | 1 260 000 PLN | ~5 000 000 PLN |

### Analiza konkurencji (stan: kwiecień 2026)

#### Polska

| System | Cena/pojazd/mc | Hardware | Segment | Główne funkcje |
|--------|---------------|----------|---------|----------------|
| **FleetStat** | **29 PLN** | Nie | Małe firmy (5–50 aut) | Koszty, faktury, czas pracy EU, dokumenty, rentowność, PWA |
| Flotman | niepubl. | Tak (GPS) | Małe–duże | GPS na żywo, paliwo, tachograf, alerty |
| MOTO Flota Manager | niepubl. | Tak (GPS) | Małe–duże | Monitoring GPS, kontrola floty |
| LINQO | niepubl. | Zależy | Wszystkie | Modułowy, integracja Trans.eu |
| Trans.eu | 465–1000+ PLN/mc (za stanowisko) | Nie | Giełda frachtów | Giełda ładunków, komunikator, TransRisk — NIE zarządzanie flotą |

#### Świat (dostępne globalnie)

| System | Cena/pojazd/mc | Hardware | Segment | Główne funkcje |
|--------|---------------|----------|---------|----------------|
| Fleetio (USA) | $4–10 (17–43 PLN) | Nie | Małe–średnie | Maintenance, paliwo, inspekcje, przypomnienia |
| Simply Fleet | od $5 | Nie | Małe | Maintenance, paliwo — bardzo prosty |
| Samsara | $27–33 (115–140 PLN) | Tak ($99–148) | Średnie–duże | GPS, kamery, compliance, kontrakt 3-letni |
| Webfleet (TomTom) | niepubl. | Tak | Średnie–duże | Routing, tachograf, OEM |
| Azuga | niepubl. | Tak | Małe–średnie | GPS, compliance, godziny (tylko USA) |

#### Szczegółowe porównanie funkcji

| Funkcja | FleetStat | Fleetio | Flotman | Samsara | Trans.eu |
|---------|-----------|---------|---------|---------|----------|
| Zarządzanie pojazdami | ✅ | ✅ | ✅ | ✅ | ❌ |
| Koszty operacyjne | ✅ | ✅ | Częściowo | ✅ | ❌ |
| Faktury / frachty | ✅ | ❌ | ❌ | ❌ | ❌ |
| Czas pracy EU (9/11/24/45h) | ✅ | ❌ | Częściowo | ❌ | ❌ |
| Dokumenty z alertami | ✅ | ✅ | ❌ | Częściowo | ❌ |
| Rentowność per pojazd | ✅ | ❌ | ❌ | ❌ | ❌ |
| GPS na żywo | ✅ (w planie — OBD2 tracker) | Opcja | ✅ | ✅ | ❌ |
| Tachograf | Podstawowy | ❌ | ✅ | ❌ | ❌ |
| Język polski | ✅ | ❌ | ✅ | ❌ | ✅ |
| PWA mobilna | ✅ | App | App | App | App |
| Bez kontraktu | ✅ | Roczny | Roczny | 3-letni | Roczny |
| Bez hardware | ✅ | ✅ | ❌ | ❌ | ✅ |

#### Przewaga FleetStat

- **Jedyny system na rynku PL łączący:** koszty + faktury + czas pracy EU + dokumenty + rentowność w jednym narzędziu
- **Najtańszy** wśród kompletnych rozwiązań (29 PLN vs 50–200 PLN u konkurencji)
- **Bez hardware** — zero inwestycji na start, wystarczy przeglądarka
- **Bez kontraktu** — miesiąc do miesiąca, zero ryzyka dla klienta
- **Celowany w niszę:** małe firmy transportowe (5–50 aut) które nie potrzebują kombajnów jak Samsara/Webfleet
- **Luka rynkowa:** Fleetio (najbliższy konkurent) nie ma fakturowania, czasu pracy EU ani polskiego; Flotman wymaga GPS hardware; Trans.eu to giełda, nie zarządzanie flotą

---

## Podsumowanie kosztów komercjalizacji

| Etap | Koszt | Czas (samodzielnie) |
|------|-------|---------------------|
| Multi-tenancy + onboarding | 20 000–28 000 PLN | 3–5 tygodni |
| Płatności + panel admina | 12 000–18 000 PLN | 3 tygodnie |
| Prawo + bezpieczeństwo + Cloud Functions | 8 000–14 000 PLN | 2–3 tygodnie |
| Landing page + marketing start | 3 000–5 000 PLN | 1 tydzień |
| GPS tracking (integracja z partnerem + mapa) | 15 000–25 000 PLN | 3–5 tygodni |
| **ŁĄCZNIE** | **58 000–92 000 PLN** | **12–17 tygodni** |

---

## ETAP 6 — Ekspansja europejska (po ustabilizowaniu rynku PL)

**Warunek wejścia:** stabilna baza 30–50 firm w Polsce, przetestowany produkt, powtarzalny model sprzedaży.

### 6.1 Faza 1 — Europa Środkowo-Wschodnia (CEE)
Rynki: Rumunia (~30 000 firm), Bułgaria (~15 000), Czechy, Słowacja, Litwa, Łotwa.
Duży transport, słaba lokalna konkurencja SaaS, niska bariera wejścia.

- [ ] Wielojęzyczność (i18n) — wyciągnięcie tekstów z App.jsx do plików JSON
- [ ] Tłumaczenie: angielski (bazowy), potem rumuński, czeski
- [ ] Landing page po angielsku
- [ ] Płatności w EUR (Stripe obsługuje całą UE)
- [ ] Wielowalutowość kosztów/frachów (EUR, RON, CZK)
- [ ] GDPR compliance (angielska wersja RODO)
- [ ] Marketing: grupy Facebook/LinkedIn dla transportu w CEE
- **Cena:** 7 EUR/pojazd/mc (~29 PLN)
- **Szacowany koszt:** 17 000–27 000 PLN
- **Szacowany czas:** 3–4 tygodnie

### 6.2 Faza 2 — Europa Zachodnia
Rynki: Niemcy (~100 000 firm), Francja (~40 000), Holandia (~15 000), Belgia.
Wyższe oczekiwania, ale 2–3x wyższe ceny.

- [ ] Tłumaczenie: niemiecki, francuski, niderlandzki
- [ ] Cena: 9–15 EUR/pojazd/mc
- [ ] Support po angielsku/niemiecku
- [ ] Integracje z lokalnymi systemami (tachograf cyfrowy, pakiet mobilności UE)
- [ ] Certyfikaty (ISO, DSGVO — niemiecki RODO)
- [ ] Strefy czasowe (kierowca jedzie przez 3 kraje)

### 6.3 Faza 3 — Pełna skala EU
- [ ] API dla klientów Enterprise
- [ ] Integracje GPS (Navifleet, Flotman, Samsara)
- [ ] Moduł tachografu cyfrowego (pliki DDD — wymóg UE)
- [ ] White-label dla partnerów/resellerów
- [ ] Lokalne zespoły sprzedażowe lub partnerzy w kluczowych krajach

### Prognoza finansowa — Europa

| Scenariusz | Firmy | Pojazdy | MRR | Roczny przychód |
|---|---|---|---|---|
| Rok 1 (PL) | 50 | 750 | 5 600 EUR | 67 000 EUR |
| Rok 2 (PL + CEE) | 150 | 2 250 | 15 750 EUR | 189 000 EUR |
| Rok 3 (+ zachód EU) | 350 | 5 250 | 47 000 EUR | 564 000 EUR |
| Rok 4 (skala EU) | 700 | 10 500 | 94 000 EUR | 1 130 000 EUR |

**Wartość firmy przy 1 mln EUR rocznego przychodu (mnożnik 5x): ~5 mln EUR (~21 mln PLN)**

### Rynek docelowy

- UE: ~600 000 firm transportowych
- Polska: ~40 000 firm
- CEE łącznie: ~130 000 firm
- Potrzebujemy 0,1% rynku UE (700 firm) żeby dojść do 1 mln EUR/rok
- Przewaga: cena 2–5x niższa od konkurencji, prosty produkt dla małych firm

---

## Dziennik sesji

### 3 kwietnia 2026

**Zrobione:**

- **Wykres trendy — poprawki danych i wyrównanie** — seria intensywnych poprawek sekcji trendów i porównania Y2Y (20 commitów, wszystkie 3 kwi):
  - Fix: Y2Y porównanie — aktywne miesiące wg kalendarza, nie danych 2026 (`1a0fd94`)
  - Tabela sumaryczna pod wykresem trendy: total 25/26 + różnica kwoty (`de6078c`)
  - Fix: trendy i frachty liczone po `dataZaladunku || dataZlecenia` — spójność z zakładką Frachty (`6497e7b`)
  - Fix: frachty — liczy się tylko `dataZaladunku` (fallback `dataZlecenia` gdy brak), `dataRozladunku` nie wpływa na miesiąc (`63fb886`)
  - Sumy miesięczne wbudowane w oś X wykresu — idealne wyrównanie (`9c0e11b`)
  - Liczne iteracyjne poprawki App.jsx (commits `e1fc583` → `abed284` — ok. 15 commitów)

**Do zrobienia następnym razem (priorytet):**

- **Firestore Security Rules** — krytyczne przed komercjalizacją (PRIORYTET #1 — ciągle niezrobione!)
- **RODO** — polityka prywatności, umowa powierzenia danych (DPA), rejestr czynności, prawo do usunięcia
- Testy manualne: nowe statusy pojazdów + emaile raportowe na produkcji
- Landing page fleetstat.pl
- Weryfikacja licencji Vercel Pro (obowiązek przy użytku komercyjnym)

---

### 2 kwietnia 2026 (aktualizacja — wieczór)

**Zrobione:**

- **Custom Claims wdrożone** — Firebase Cloud Functions + role tokenowe (JWT), priorytet #2 bezpieczeństwa z listy ZREALIZOWANY (`e38f086`)
- Nowe statusy pojazdów: "W trasie", "Pauza", "Załadunek za Xd", "Czeka na zlecenie" (`44d9888`)
- Fix: race condition przy zmianie statusu frachtów — debounce + pendingWrites (`c97ba02`)
- Fix: timezone bug w statusach + porównania oparte na stringach ISO (`06c8205`)
- Email raporty statusów floty: scheduler 3x/dzień + zakładka odbiorców + integracja SendGrid (`5224dd9`)
- 3 warstwy ochrony przed utratą danych (`f3dbe4e`)
- Poprawki emaili: Bus+Przyczepa z wymiarami zamiast imion kierowców (`70cae3b`), usunięcie tablic rejestracyjnych z treści (`dcb3bb4`)
- Usunięcie tymczasowych debug logów ze statusów pojazdów (`b044693`)

**Do zrobienia następnym razem (priorytet):**

- **Firestore Security Rules** — krytyczne przed komercjalizacją (PRIORYTET #1 — ciągle niezrobione!)
- **RODO** — polityka prywatności, umowa powierzenia danych (DPA), rejestr czynności, prawo do usunięcia
- Testy manualne: nowe statusy pojazdów + emaile raportowe na produkcji
- Landing page fleetstat.pl
- Weryfikacja licencji Vercel Pro (obowiązek przy użytku komercyjnym)

---

### 2 kwietnia 2026

**Zrobione:**

- Brak nowych commitów od poprzedniej sesji — kod pozostaje bez zmian
- Automatyczny przegląd historii git (20 ostatnich commitów) — ostatni commit: `202d449 Add .gitignore to protect sensitive files`
- Roadmap i dokumentacja aktualne

**Do zrobienia następnym razem (priorytet):**

- **Firestore Security Rules** — krytyczne przed komercjalizacją (PRIORYTET #1): napisać reguły dla każdej kolekcji
- **RODO** — polityka prywatności, umowa powierzenia danych (DPA), rejestr czynności, prawo do usunięcia
- **Push kodu** — wysłanie ostatnich zmian (notatki w CzasPracy, pauza inne, logout 30 min) na produkcję
- **Testy manualne** CzasPracyModal na produkcji
- Weryfikacja licencji Vercel Pro (obowiązek przy użytku komercyjnym)

---

### 1 kwietnia 2026

**Zrobione:**

- Podłączenie CzasPracyModal do kart pojazdów w Przeglądzie (zastąpił stary inline panel)
- Usunięcie starego panelu Czas pracy (104 linie kodu usunięte)
- Aktualizacja sekcji przeglądu na dashboardzie pod nowy format statusów
- Dodanie godziny startu do wpisów — automatyczne wyliczanie godziny końca na podstawie typu pauzy
- Dodanie "Pauza inne" z polem na własną liczbę godzin (np. 34h)
- Dodanie notatek do każdego wpisu Czas pracy
- Zmiana auto-logout z 10 min sztywnego na 30 min bezczynności z lepszym wykrywaniem aktywności (11 typów eventów)
- Wycena aplikacji: 70 000–100 000 PLN (koszt wytworzenia)
- Roadmap komercjalizacji

**Dodane do roadmapy:**

- Model cenowy 29 PLN/pojazd + prognozy finansowe (PL i EU)
- Analiza konkurencji: Flotman, Fleetio, Samsara, Trans.eu, Simply Fleet, Webfleet, Azuga
- Porównanie funkcji — FleetStat jedyny w PL łączący koszty + faktury + czas pracy + dokumenty
- GPS tracking z partnerem WidziszWszystko (OBD2 + montaż)
- Ekspansja EU: CEE → zachód, prognoza do 1 mln EUR/rok
- Stack technologiczny + plan rozwoju infrastruktury (Firebase → Cloud Functions → PostgreSQL)
- Analiza bezpieczeństwa — 3 krytyczne priorytety (Firestore Rules, Custom Claims, Cloud Functions)
- Wiadomość do szefa z podsumowaniem projektu
- Dodanie `.gitignore` — ochrona wrażliwych plików (klucze, env, node_modules)

**Do zrobienia następnym razem (2 kwietnia):**

- **RODO** — wdrożenie: polityka prywatności, umowa powierzenia, rejestr czynności, IOD, prawo do usunięcia
- **Certyfikaty** — czy potrzebne ISO 27001, SOC 2, certyfikaty transportowe
- **Licencje** — czy React, Firebase, Vercel, Tailwind pozwalają na komercyjne użycie
- **Firestore Security Rules** — napisanie reguł bezpieczeństwa (priorytet #1)
- Push ostatnich zmian kodu (notatki + pauza inne + logout)
- Testy manualne CzasPracyModal na produkcji
