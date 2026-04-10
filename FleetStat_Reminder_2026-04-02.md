# FleetStat — Przypomnienie na 2 kwietnia 2026

Cześć Kamil! Oto zaplanowane zadania na dziś, z podsumowaniem co trzeba zrobić w każdym punkcie.

---

## 1. RODO / GDPR — wdrożenie zgodności

**Status w roadmapie:** Etap 3.1, wszystkie checkboxy niezaznaczone. Koszt u prawnika: 2 000–5 000 PLN.

**Co konkretnie trzeba zrobić:**

**Polityka prywatności** — dokument opisujący jakie dane zbieracie (imiona kierowców, emaile, NIP-y, dane pojazdów), po co, jak długo, komu je przekazujecie (Firebase/Google, Vercel). Musi być po polsku, link z każdej strony aplikacji. Wzory są dostępne online, ale warto dostosować do specyfiki FleetStat.

**Regulamin SaaS** — warunki korzystania z usługi: odpowiedzialność, płatności, wypowiedzenie, ograniczenia.

**Umowa powierzenia przetwarzania danych (DPA)** — to KLUCZOWY dokument. FleetStat = procesor danych, firma transportowa = administrator. Bez tego żaden poważny klient korporacyjny nie podpisze kontraktu. Umowa opisuje zakres przetwarzania, obowiązki obu stron, procedury w razie naruszenia.

**Rejestr czynności przetwarzania** — wewnętrzny dokument wymagany na kontrolę UODO: jakie dane, skąd, po co, jak długo, kto ma dostęp. Prosty Excel/tabela.

**DPIA (ocena skutków)** — zalecane, bo GPS tracking kierowców = monitoring pracowników. Dokument oceniający ryzyko dla praw osób, których dane dotyczą.

**Prawo do usunięcia danych** — przycisk "Usuń konto i dane" lub udokumentowana procedura na żądanie. Wymagane przez Art. 17 RODO.

**Cookie banner** — Vercel i Firebase stawiają ciasteczka. Gotowe rozwiązania: CookieYes lub Cookiebot (darmowe do pewnego limitu). Trzeba podłączyć do fleetstat.pl.

**Checkbox przy rejestracji** — akceptacja regulaminu + polityki prywatności. Musi być osobny checkbox, nie pre-zaznaczony.

**IOD (Inspektor Ochrony Danych)** — NIE wymagany na start. Rozważyć przy 200+ firmach (~2 000 PLN/mc).

**Rekomendacja:** Przygotuj drafty dokumentów samodzielnie (lub z AI), a potem daj prawnikowi do weryfikacji — to obniży koszt z 5 000 do ~2 000 PLN.

---

## 2. Certyfikaty — co jest potrzebne?

**Krótka odpowiedź: na start — nic.**

| Certyfikat | Wymagany? | Kiedy rozważyć | Koszt |
|---|---|---|---|
| ISO 27001 | Nie, ale klienci korporacyjni pytają | Przy 100+ firmach | 15 000–40 000 PLN + audyt ~10 000 PLN/rok |
| SOC 2 | Nie (standard USA) | Tylko jeśli rynek USA | — |
| Licencja transportowa | Nie (to dla przewoźników) | Nigdy | — |
| NIS 2 | Nie (dotyczy dużych operatorów) | Nie dotyczy małych SaaS | — |
| Certyfikat deweloperski | Nie istnieje taki wymóg | Nigdy | — |

**Wniosek:** Zero certyfikatów na start. Wdrożenie realnych zabezpieczeń (Firestore Rules, backup, 2FA) jest ważniejsze niż papier. ISO 27001 rozważyć dopiero przy skali 100+ firm.

---

## 3. Licencje technologiczne — czy pozwalają na komercję?

**Krótka odpowiedź: TAK, wszystkie pozwalają. Brak przeciwwskazań.**

| Technologia | Licencja | Komercyjne użycie | Koszt |
|---|---|---|---|
| React | MIT (open source) | Tak, bez ograniczeń | 0 PLN |
| Vite | MIT | Tak, bez ograniczeń | 0 PLN |
| Tailwind CSS | MIT | Tak, bez ograniczeń | 0 PLN |
| Firebase | Google ToS | Tak — płacisz za użycie | Darmowy tier → pay-as-you-go |
| Vercel | Vercel ToS | Tak — **wymaga planu Pro** | **$20/mc (~85 PLN)** |
| Firebase Auth | Google ToS | Tak | Darmowe do 50K użytkowników/mc |

**Jedyny obowiązkowy koszt:** Vercel Pro $20/mc — plan Hobby (darmowy) jest TYLKO do użytku niekomercyjnego. Trzeba upgradować przed pierwszym płacącym klientem.

---

## 4. Firestore Security Rules — PRIORYTET TECHNICZNY

**Status:** Brakuje reguł bezpieczeństwa. Bez tego KAŻDY zalogowany user może czytać/pisać WSZYSTKIE dane w bazie.

**Co trzeba zrobić:**

Napisać reguły bezpieczeństwa dla każdej kolekcji:
- vehicles, costs, frachty, docs, pauzy, sprawy
- Każda reguła musi sprawdzać `request.auth.uid`
- Użytkownik powinien mieć dostęp tylko do danych swojej firmy

**Przykładowa struktura reguł (do rozbudowy przy multi-tenancy):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Domyślnie — odmowa dostępu
    match /{document=**} {
      allow read, write: if false;
    }

    // Pojazdy — tylko zalogowani użytkownicy z właściwym firmId
    match /firms/{firmId}/vehicles/{vehicleId} {
      allow read, write: if request.auth != null
        && request.auth.token.firmId == firmId;
    }

    // Analogicznie dla costs, frachty, docs, pauzy, sprawy...
  }
}
```

**Wysiłek:** ~1 dzień, ale KRYTYCZNE przed jakimkolwiek wdrożeniem komercyjnym.

**Uwaga:** Obecna architektura (jednofirmowa) wymaga prostszych reguł — sprawdzanie `request.auth.uid != null`. Pełne reguły z `firmId` będą potrzebne po wdrożeniu multi-tenancy (Etap 1).

---

## Dodatkowe zadania z wczoraj

- **Push ostatnich zmian kodu** (notatki + pauza inne + logout)
- **Testy manualne CzasPracyModal** na produkcji

---

## Kontekst — gdzie jesteś w roadmapie

Jesteś na **Etapie 3 (Prawo i bezpieczeństwo)** — dokładnie tam, gdzie powinien być focus dziś. Etapy 1–2 (multi-tenancy, płatności) czekają, ale bez RODO i security rules nie ma sensu puszczać klientów.

**Priorytet dnia:** Firestore Security Rules (szybka wygrana, 1 dzień) → RODO drafty dokumentów → reszta.

Powodzenia! 💪
