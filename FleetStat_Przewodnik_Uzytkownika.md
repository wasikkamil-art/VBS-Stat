# FleetStat — Przewodnik dla nowego użytkownika

*VBS Transport · wersja kwiecień 2026*

FleetStat to wewnętrzna aplikacja firmy VBS do zarządzania flotą, frachtami, kosztami i rentownością. Ten dokument wyjaśnia jak z niej korzystać — od logowania po codzienną pracę.

---

## 1. Logowanie i dostęp

Aplikacja działa w przeglądarce pod adresem **https://fleetstat.pl**. Żeby zalogować się po raz pierwszy, admin (Kamil) musi założyć Ci konto i nadać rolę. Po utworzeniu konta logujesz się mailem i hasłem — cała praca odbywa się online, nie ma nic do instalowania.

Dane są zapisywane w chmurze w czasie rzeczywistym — jeśli ktoś inny doda fracht lub koszt, zobaczysz to natychmiast bez odświeżania strony.

## 2. Role użytkowników

W aplikacji są trzy role:

- **Admin** — pełny dostęp do wszystkiego: zakładki użytkowników, mailingu, ustawień, importu/eksportu kosztów, wszystkich edycji. Tę rolę ma tylko Kamil.
- **Dyspozytor** — standardowa rola operacyjna. Domyślnie widzi frachty, faktury, koszty, pojazdy, serwis, rentowność, dokumenty, IMI, sprawy, chat.
- **Podgląd** — ograniczona rola tylko do odczytu najważniejszych informacji (dashboard, frachty, pojazdy, serwis, dokumenty, IMI, chat).

Admin może indywidualnie dla każdego użytkownika włączać i wyłączać zakładki, więc jeden dyspozytor może np. widzieć rentowność, a drugi nie. Jeśli brakuje Ci jakiejś zakładki w menu — zgłoś to adminowi.

## 3. Układ aplikacji

Po lewej stronie znajduje się menu z zakładkami. Na górze każdej strony widzisz tytuł i przyciski akcji (np. "+ Dodaj fracht"). Dane filtruje się zwykle rokiem (2026 / 2025 / Wszystkie) i miesiącem — filtry są u góry każdej zakładki z danymi.

## 4. Zakładki — co tu robimy

**Dashboard.** Widok podsumowujący — pokazuje najważniejsze liczby (przychód, koszty, zysk, rentowność) oraz porównanie rok-do-roku. To pierwsze, co widzisz po zalogowaniu.

**Frachty.** Rejestr wszystkich zleceń transportowych. Każdy fracht to jedna trasa: pojazd, kierowca, kraj, kwota netto, waluta, data, numer zlecenia. Dodajesz fracht przyciskiem "+ Dodaj fracht" i wypełniasz formularz. Frachty są podstawą rachunku przychodów i rentowności.

**Faktury (FV).** Wystawione faktury sprzedażowe. Powiązane z frachtami — kilka frachtów może być na jednej fakturze. Tu kontrolujesz co zostało już zafakturowane, a co jeszcze nie.

**Rejestr kosztów.** Wszystkie koszty firmy: paliwo, autostrady, naprawy, leasing, ubezpieczenia itd. Każdy koszt przypisujesz do pojazdu, kategorii i miesiąca. Dodajesz przyciskiem "+ Dodaj koszt". Import/eksport Excela jest dostępny tylko dla admina.

**Pojazdy.** Lista wszystkich ciągników i naczep z danymi technicznymi, numerami rejestracyjnymi, datami przeglądów i OC.

**Serwis.** Historia napraw i przeglądów pojazdów. Tu widać co i kiedy było serwisowane, co jest zaplanowane i ile to kosztowało.

**Rentowność.** Tu aplikacja sama liczy zysk na pojeździe i na miesiącu — bierze przychody z frachtów i odejmuje koszty. Widzisz tabelę "ile zarobił każdy pojazd" oraz porównania rok-do-roku. To podstawowy widok do decyzji biznesowych.

**Dokumenty.** Miejsce na skany i pliki (OC, przeglądy, umowy, certyfikaty). Wrzucasz plik, podpinasz do pojazdu lub kierowcy, ustawiasz datę ważności — aplikacja sama przypomni, kiedy coś wygasa.

**IMI.** Ewidencja zgłoszeń IMI (delegowanie kierowców w UE) — kto, gdzie, kiedy, na ile.

**Sprawy.** Wewnętrzny system zadań i notatek — coś jak lista rzeczy do zrobienia wspólna dla całego zespołu.

**Chat.** Komunikator wewnętrzny zespołu — szybkie wiadomości między dyspozytorami i adminem, bez potrzeby wychodzenia z aplikacji.

## 5. Codzienne operacje

**Dodawanie frachtu.** Wejdź w zakładkę Frachty → "+ Dodaj fracht" → wybierz pojazd, kierowcę, kraje, wpisz kwotę i walutę, zapisz. Fracht od razu zasili dashboard i rentowność.

**Dodawanie kosztu.** Zakładka Rejestr kosztów → "+ Dodaj koszt" → wybierz pojazd, kategorię, miesiąc, wpisz kwotę, zapisz. Koszt pojawi się w rentowności tego pojazdu.

**Filtrowanie.** Prawie każda zakładka ma filtr roku (2026 / 2025 / Wszystkie) i miesięcy — używaj ich żeby zawęzić widok. Na rentowności możesz porównywać okresy rok do roku.

**Edycja i usuwanie.** Kliknij w wiersz (fracht, koszt, pojazd) żeby go otworzyć i edytować. Usuwanie jest dostępne, ale uważaj — nie ma kosza, zmiany są natychmiastowe w bazie.

## 6. Dobre praktyki

Wpisuj dane na bieżąco, a nie raz na tydzień — dzięki temu dashboard pokazuje prawdziwy obraz firmy w czasie rzeczywistym. Używaj jednolitych nazw kategorii kosztów (żeby rentowność grupowała się prawidłowo). Jeśli nie masz pewności do jakiego pojazdu przypisać koszt wspólny (np. biuro), ustal z Kamilem jedną zasadę i jej się trzymaj. Przed zamknięciem miesiąca warto sprawdzić, czy wszystkie frachty mają faktury i wszystkie koszty są wpisane.

## 7. Co zrobić jak coś nie działa

Jeśli zakładka nie ładuje się albo dane wyglądają dziwnie — najpierw odśwież stronę (Ctrl+R lub Cmd+R). Jeśli nadal nie działa, zrób screenshot i zgłoś adminowi (Kamilowi) na chacie albo mailem. Nie edytuj rzeczy, których nie rozumiesz, szczególnie w zakładkach z importem/eksportem.

---

**W razie pytań:** Kamil (admin) — wasik.kamil@gmail.com
