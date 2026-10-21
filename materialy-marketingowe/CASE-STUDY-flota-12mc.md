# Flota pod lupą: 12 miesięcy, 6 aut, 338 frachtów

**Status: SZKIC ODŁOŻONY.** Materiał napisany 2026-10-21 na zapas — do użycia, gdy FleetStat
będzie gotowy do sprzedaży i zapadnie decyzja o wyjściu z treścią na zewnątrz. Nic z tego
nie zostało opublikowane. Przed publikacją przeczytaj **sekcję 11 (Przed publikacją)** —
są tam decyzje, które musi podjąć człowiek, nie skrypt.

**Źródło liczb:** `scripts/case-study-dane.mjs` (odpal ponownie, żeby odświeżyć okno).
**Okno:** 1.10.2025 – 30.09.2026. Wszystkie kwoty **netto, w EUR**.

---

## 1. Pięć liczb, od których warto zacząć

| | |
|---|---|
| Frachtów zrealizowanych | **338** |
| Obrót | **416 159 €** |
| Kilometrów | **373 111** |
| Stawka średnia | **1,115 €/km** |
| Marża operacyjna (12 mc) | **69 935 € = 16,8%** |

Sześć aut, pięciu kierowców, 243 nazwy zleceniodawców w bazie (patrz sekcja 10 — nazwy
nie są scalone, więc realnych podmiotów jest mniej). Poniżej siedem rzeczy, które
wyszły z tych danych — w tym cztery, których się nie spodziewaliśmy.

---

## 2. Wniosek 1: mniej frachtów, znacznie więcej pieniędzy

Półrocze do półrocza:

| | X.2025 – III.2026 | IV – IX.2026 | zmiana |
|---|---|---|---|
| Frachty | 181 | 157 | **−13,3%** |
| Obrót | 193 814 € | 222 345 € | **+14,7%** |
| Kilometry | 182 482 | 190 629 | +4,5% |
| Stawka | 1,062 €/km | 1,166 €/km | **+9,8%** |
| Średni fracht | 1 071 € | 1 416 € | **+32,3%** |
| Marża | 13 432 € (6,9%) | 56 503 € (**25,4%**) | **+43 071 €** |

Mniej zleceń, prawie tyle samo kilometrów, o 43 tysiące euro większa marża. Każdy fracht
niósł o trzecią część więcej pieniędzy przy tej samej robocie dyspozytora.

**To nie jest jednak cała prawda — i tu jest pouczające.** Z 14 540 € spadku kosztów
**6 035 € (41%) to pozycje kontraktowe, nie operacyjne**: refinansowanie leasingu
(−4 925 €), nowa OCPD (−3 460 €), niższy ZUS (−1 600 €). Te oszczędności przyszły z
podpisanych umów, nie z lepszej jazdy. Pozostałe 8 505 € to realna operacja — o tym w
punkcie 7.

> **Lekcja:** jeśli liczysz tylko obrót, nie zauważysz, że połowa poprawy przyszła z
> biurka, a nie z trasy. A wtedy w przyszłym roku będziesz oczekiwać powtórki, której nie
> będzie, bo leasingu nie zrefinansujesz drugi raz.

---

## 3. Wniosek 2: marża roczna kłamie

16,8% za rok brzmi stabilnie. Rozkład miesięczny nie:

| miesiąc | obrót | koszty | marża | % |
|---|---|---|---|---|
| X.2025 | 33 930 | 29 509 | 4 421 | 13,0% |
| XI.2025 | 35 060 | 35 937 | **−877** | **−2,5%** |
| XII.2025 | 34 184 | 32 007 | 2 177 | 6,4% |
| I.2026 | 29 880 | 31 385 | **−1 505** | **−5,0%** |
| II.2026 | 22 580 | 22 334 | 246 | 1,1% |
| III.2026 | 38 180 | 29 210 | 8 970 | 23,5% |
| IV.2026 | 43 630 | 28 998 | 14 632 | **33,5%** |
| V.2026 | 35 070 | 27 392 | 7 678 | 21,9% |
| VI.2026 | 27 311 | 24 565 | 2 746 | 10,1% |
| VII.2026 | 44 870 | 30 012 | 14 858 | 33,1% |
| VIII.2026 | 41 370 | 28 481 | 12 889 | 31,2% |
| IX.2026 | 30 094 | 26 395 | 3 699 | 12,3% |

Rozpiętość: **od −5,0% do +33,5%**. Dwa miesiące na minusie. Trzy z czterech miesięcy
powyżej 30% marży przypadły na okres kwiecień–sierpień.

> **Lekcja:** przy marży w okolicach 15% dwa słabe miesiące pod rząd zjadają kwartał.
> Kto zamyka książki raz do roku u księgowej, dowiaduje się o tym w marcu następnego roku
> — osiem miesięcy po tym, jak dało się jeszcze zareagować.

---

## 4. Wniosek 3: dwa identyczne auta, trzykrotnie różna marża

Najmocniejszy pojedynczy wniosek z całego zestawu.

| poj. | rejestracja | frachty | km | obrót | €/km | koszty | marża | marża % |
|---|---|---|---|---|---|---|---|---|
| v5 | WGM 0507M | 90 | 99 762 | 117 734 | 1,180 | 90 594 | 27 140 | **23,1%** |
| v3 | WGM 5367K | 79 | 90 111 | 103 225 | 1,146 | 80 035 | 23 190 | 22,5% |
| v4 | TK 314CL | 63 | 70 358 | 78 084 | 1,110 | 61 464 | 16 620 | 21,3% |
| v1 | WGM 0475M | 80 | 79 694 | 93 926 | 1,179 | 86 904 | 7 022 | **7,5%** |
| v2 | TK 130EF | 26 | 33 186 | 23 190 | 0,699 | 23 497 | −307 | −1,3% |
| v6 | TK 315CL | 0 | 0 | 0 | — | 3 729 | **−3 729** | — |

Porównaj **v5 i v1**. Ta sama klasa auta, ten sam typ tras, **praktycznie identyczna
stawka: 1,180 vs 1,179 €/km**. Koszty stałe też prawie równe — leasing co do euro taki
sam (17 461 € każde), serwis identyczny (1 800 €), ZUS identyczny (4 800 €).

Różnica jest jedna: **v5 przejechał 99 762 km, v1 — 79 694 km. Dwadzieścia tysięcy
kilometrów mniej.**

Efekt: marża **23,1% vs 7,5%**.

### Próg opłacalności — liczba, którą każdy przewoźnik powinien znać

Rozbijając koszty na stałe (leasing, wypłata, ZUS, OCPD, polisa) i zmienne (paliwo, myto,
serwis, hotele):

| poj. | stałe/rok | zmienne €/km | stawka €/km | marża jedn. | **próg km/rok** | próg km/mc | realne km/mc |
|---|---|---|---|---|---|---|---|
| v5 | 53 164 € | 0,375 | 1,180 | 0,805 | 66 046 | 5 504 | **8 314** |
| v3 | 48 435 € | 0,351 | 1,146 | 0,795 | 60 936 | 5 078 | 7 509 |
| v1 | 51 164 € | 0,448 | 1,179 | 0,730 | **70 077** | **5 840** | 6 641 |
| v4 | 33 843 € | 0,393 | 1,110 | 0,717 | 47 185 | 3 932 | 5 863 |
| v2 | 10 238 € | 0,400 | 0,699 | 0,299 | 34 213 | 2 851 | 2 766 |

**v1 jechał tylko 801 km/miesiąc powyżej własnego progu opłacalności.** Jedna awaria,
jeden tydzień postoju, jeden kierowca na L4 — i auto schodzi pod zero. v5 miał nad progiem
zapas 2 810 km/mc, czyli trzy i pół razy większy bufor.

Dla całej czynnej floty próg to **54 301 km na auto rocznie ≈ 4 525 km/mc**. Przejechaliśmy
373 111 km przy progu 271 506 km — **nadwyżka 37%**.

> **Lekcja:** auto nie przynosi strat, bo jeździ za tanio. Przynosi straty, bo jeździ za
> mało. Stawka 1,18 €/km jest świetna i bezużyteczna, jeśli auto stoi tydzień w miesiącu.
> **v6 to ten wniosek w czystej postaci: zero frachtów, 3 729 € kosztów, 3 729 € straty.**

---

## 5. Wniosek 4: karta paliwowa to szum. Kraj to pieniądz

Paliwo to **28,7% wszystkich kosztów** — 99 455 € w 12 miesięcy. Od maja 2026 mamy
transakcyjny widok na 25 031 litrów ON z czterech kart i piętnastu krajów.

Najpierw to, czego się spodziewaliśmy — że karty różnią się ceną:

| karta | transakcje | litry | €/L |
|---|---|---|---|
| Andamur | 45 | 2 611 | **1,371** |
| e100 | 28 | 1 573 | 1,665 |
| Eurowag | 351 | 20 660 | 1,702 |
| tankpool | 3 | 187 | 1,860 |

Wygląda, jakby Andamur był o 33 grosze na litrze tańszy od Eurowag. **Przy 25 tys. litrów
to byłoby 8 tys. € na pięć miesięcy — i to jest nieprawda.**

Andamur tankuje się głównie w Hiszpanii. Eurowag — we Francji i Niemczech. Porównywaliśmy
kartę z geografią. Po rozdzieleniu jednego od drugiego — **ta sama karta, ten sam kraj**:

| kraj | porównanie | różnica |
|---|---|---|
| Hiszpania | Andamur 1,342 vs Eurowag 1,346 | **0,004 €/L** |
| Niemcy | Eurowag 1,771 vs e100 1,810 | 0,039 €/L |
| Francja | Eurowag 1,807 vs e100 1,846 | 0,039 €/L |
| Polska | Eurowag 1,476 vs e100 1,535 | 0,059 €/L |

**Karta jest warta najwyżej 6 groszy na litrze.** A kraj?

| kraj | litry | €/L |
|---|---|---|
| Hiszpania | 3 240 | **1,345** |
| Portugalia | 63 | 1,465 |
| Polska | 4 312 | 1,482 |
| Czechy | 423 | 1,513 |
| Luksemburg | 422 | 1,514 |
| Bułgaria | 218 | 1,502 |
| Niemcy | 5 325 | 1,774 |
| Austria | 415 | 1,782 |
| Belgia | 824 | 1,800 |
| **Francja** | **8 528** | **1,806** |
| Włochy | 556 | **1,855** |
| Holandia | 50 | 1,869 |

**Rozpiętość 0,51 €/L — ponad dziesięć razy więcej, niż daje wybór karty.**

Średnia floty: **1,666 €/L**. Największy wolumen — 8 528 litrów, jedna trzecia wszystkiego —
poszedł w **najdroższym pasie Europy**.

Praktycznie: **każdy 1 000 litrów przesunięty z pasa drogiego (FR/DE/BE/IT/AT ≈ 1,80 €/L)
do taniego (ES/PL/CZ/LU ≈ 1,43 €/L) to 361 € w kieszeni.** Każdy jeden grosz na średniej
cenie litra to 250 € na pięć miesięcy, czyli ok. 600 €/rok.

> **Lekcja:** negocjowanie rabatu na karcie to godziny rozmów o sześciu groszach.
> Powiedzenie kierowcy „dolej w Hiszpanii, nie we Francji" to czterdzieści groszy — i jedna
> wiadomość. Tylko trzeba wiedzieć, że to czterdzieści, a nie sześć. **My przez pół roku
> optymalizowaliśmy nie to, co trzeba, bo nie mieliśmy tych danych rozdzielonych.**

### Spalanie — mniejsza sprawa, ale nie zero

| poj. | rejestracja | litry | km | L/100km |
|---|---|---|---|---|
| v4 | TK 314CL | 5 904 | 36 029 | 16,39 |
| v5 | WGM 0507M | 6 902 | 44 721 | 15,43 |
| v1 | WGM 0475M | 6 288 | 42 244 | 14,88 |
| v3 | WGM 5367K | 5 938 | 40 878 | **14,53** |

Flota: **15,27 L/100km**. Wśród trzech aut tej samej klasy (v1/v3/v5) rozpiętość to
0,9 L/100km. **Każde 1 L/100km różnicy = 2 731 € na pięć miesięcy.** v4 odstaje bardziej,
ale to inna klasa pojazdu — tego nie porównujemy.

---

## 6. Wniosek 5: Niemcy. 160 przejazdów = połowa myta

Myto to **20 748 € rocznie, 6,0% kosztów**. Transakcyjny rozkład (VII–IX.2026, 6 335 €):

| kraj | przejazdy | € | % | €/przejazd |
|---|---|---|---|---|
| **Niemcy** | **160** | **3 391** | **53,5%** | **21,20** |
| Polska | 1 567 | 1 057 | 16,7% | 0,67 |
| Francja | 83 | 864 | 13,6% | 10,41 |
| Austria | 282 | 370 | 5,8% | 1,31 |
| Belgia | 130 | 197 | 3,1% | 1,51 |
| pozostałe (6 krajów) | 362 | 456 | 7,2% | — |

**Sto sześćdziesiąt przejazdów przez Niemcy kosztowało trzy razy tyle, co tysiąc pięćset
sześćdziesiąt siedem przejazdów przez Polskę.** Jeden niemiecki przejazd: 21,20 €. Jeden
polski: 0,67 €. Trzydziestokrotna różnica na zdarzenie.

W sierpniu myto skoczyło z 1 731 € do 2 522 € — **+46% w jednym miesiącu**. Pierwsza myśl:
błąd dostawcy albo zgubiona faktura. Zderzenie z trasami pokazało co innego: w sierpniu
cztery frachty zahaczyły o Niemcy zamiast iść przez Francję i Hiszpanię. **Nie było żadnego
błędu — zmieniła się geografia zleceń.**

Przy okazji: w Hiszpanii i Portugalii opłat praktycznie nie ma (hiszpańskie autostrady są
w większości bezpłatne od 2021). **Brak opłat w rozliczeniu nie znaczy, że auto stało** —
żeby to rozstrzygnąć, trzeba zderzyć myto z kilometrami i tachografem, nie z samym mytem.
Tę pomyłkę popełniliśmy raz i policzyliśmy stracony dzień, którego nie było.

> **Lekcja:** myto nie jest kosztem stałym ani liniowym do kilometrów. Jest funkcją tego,
> przez które kraje prowadzisz trasę. Fracht do Niemiec przy tej samej stawce €/km jest
> **mniej opłacalny** niż fracht do Hiszpanii — i bez rozbicia myta na kraje tego nie widać.

---

## 7. Wniosek 6: 4 653 € mandatów, a potem osiem miesięcy zera

| miesiąc | mandaty |
|---|---|
| X.2025 | 640 € |
| XI.2025 | 2 195 € |
| XII.2025 | 0 |
| I.2026 | 1 818 € |
| **II – IX.2026** | **0 € — osiem miesięcy pod rząd** |

**4 653 € w pierwszych czterech miesiącach, zero w kolejnych ośmiu.** To 1,3% rocznych
kosztów skupione w trzech miesiącach i **największa pojedyncza pozycja operacyjna** w
poprawie marży półrocze do półrocza (z 8 505 € operacyjnego spadku kosztów mandaty to
4 653 €, czyli 55%).

Pięć pozycji, wszystkie podpięte pod konkretne auta: TK 314CL (640 €), WGM 0475M
(2× 750 €), WGM 0507M (1 445 €), TK 130EF (1 068 €).

⚠️ **Czego te dane NIE mówią:** nie wiemy z nich, *dlaczego* mandaty się skończyły.
Korelacja z wdrożeniem monitoringu jest, ale w tym samym okresie zmienił się też skład
kierowców i struktura tras. Zestawienie pokazuje fakt, nie przyczynę — i tak powinno
zostać opisane.

---

## 8. Wniosek 7: karta kierowcy pracuje 55% dni

Z 93 plików tachografu (DDD), pięciu kierowców:

| kierowca | okres | dni z kartą | dni pracy | wykorzystanie | h jazdy | km | h/dzień | km/h |
|---|---|---|---|---|---|---|---|---|
| Siarhei K. | VII.2025–VIII.2026 | 422 | 238 | 56,4% | 1 571 | 72 079 | 6,6 | 45,9 |
| Volodymyr L. | VIII.2025–VII.2026 | 350 | 218 | **62,3%** | 1 453 | 65 575 | 6,7 | 45,1 |
| Volodymyr I. | XII.2025–IX.2026 | 278 | 156 | 56,1% | 953 | 65 661 | 6,1 | **68,9** |
| Mirosław T. | VIII.2025–VII.2026 | 346 | 175 | **50,6%** | 1 036 | 58 691 | 5,9 | 56,6 |
| Mykola O. | IX–X.2026 | 35 | 5 | 14,3% | 27 | 1 486 | 5,4 | 54,7 |

Razem: **5 041 godzin jazdy, 263 492 km, 792 dni pracy na 1 431 dni z kartą = 55,3%.**

Średnio **6,3 h jazdy na dzień pracy** — przy dopuszczalnych 9 h (dwa razy w tygodniu 10 h).
To **70% dostępnego limitu czasu jazdy**, a nie 100%. Nie znaczy, że kierowcy się obijają:
w te dni wchodzą załadunki, rozładunki, oczekiwanie na rampie i odpoczynki wymagane
rozporządzeniem 561/2006. Znaczy, że **między limitem prawa a realnym wykorzystaniem auta
jest 30% zapasu, i to tam, nie w stawce, leży reszta pieniędzy**.

Jeden kierowca robi 68,9 km na godzinę jazdy, drugi 45,1. **To nie ranking kierowców** —
to różnica między trasą Hiszpania–Francja autostradą a dostawami po trzech adresach w
Paryżu. Bez rozbicia na typ trasy taka tabela jest krzywdząca i bezużyteczna.

---

## 9. Struktura kosztów — gdzie w ogóle są te pieniądze

| kategoria | € / 12 mc | % kosztów | €/km |
|---|---|---|---|
| Wypłaty | 104 199 | **30,1%** | 0,279 |
| Paliwo | 99 455 | **28,7%** | 0,267 |
| Leasing | 56 116 | 16,2% | 0,150 |
| Opłaty drogowe | 20 748 | 6,0% | 0,056 |
| ZUS | 16 000 | 4,6% | 0,043 |
| Inne | 10 193 | 2,9% | 0,027 |
| Uruchomienie | 9 250 | 2,7% | 0,025 |
| Serwis | 8 885 | 2,6% | 0,024 |
| OCPD | 8 452 | 2,4% | 0,023 |
| Mandaty | 4 653 | 1,3% | 0,012 |
| Polisa | 3 944 | 1,1% | 0,011 |
| Hotele | 2 665 | 0,8% | 0,007 |
| Telefon / SlickShift / IMI | 1 664 | 0,5% | 0,005 |
| **Razem** | **346 224** | 100% | **0,928** |

**Trzy pozycje to 75% kosztów: wypłaty, paliwo, leasing.** Wszystko poniżej 3% to szum —
można nad tym siedzieć tygodniami i nie zmienić wyniku. Przy koszcie 0,928 €/km i stawce
1,115 €/km **marża jednostkowa to 0,187 €/km. Osiemnaście groszy na kilometrze.**

### Puste przebiegi

Licznik vs kilometry przypisane do frachtów (9 miesięcy z danymi licznikowymi):
**299 598 km na liczniku, 274 937 km we frachtach → 8,2% bez przypisanego frachtu.**

Rozstrzał miesięczny jest duży: od −3,5% (sierpień) do 25,2% (wrzesień). Przy koszcie
zmiennym 0,39 €/km te 8,2% to rząd **9,6 tys. €
na tych dziewięciu miesiącach**.

⚠️ Ta liczba jest najsłabsza z całego raportu. Mieszają się w niej trzy rzeczy: realne
puste przebiegi, kilometry prywatne/serwisowe oraz różnica metody (km frachtowe pochodzą
z routingu, licznikowe z raportu). Ujemne miesiące dowodzą, że to nie jest czysty pomiar
pustych przebiegów. **Traktować jako sygnał, nie jako kwotę.**

---

## 10. Czego te dane NIE mówią

Krótka lista, żeby nikt nie zbudował wniosku na piasku:

1. **Puste przebiegi 8,2%** — patrz wyżej, pomiar niedomknięty. Nie cytować jako liczby.
2. **Mandaty → zero** — fakt potwierdzony, przyczyna nie.
3. **243 nazwy klientów** w bazie, nienormalizowane („Crafter", „Crafter Zawody",
   „CRAFTER ZAWODY" to prawdopodobnie jeden podmiot). Koncentracja TOP3 = 6,6% obrotu jest
   policzona poprawnie z tego, co jest w bazie, ale **nie odpowiada na pytanie o realne
   uzależnienie od klienta**. Wymaga ręcznego scalenia nazw.
4. **Paliwo i myto transakcyjnie dopiero od V/VII.2026** — te sekcje opisują krótsze okno
   niż reszta i nie da się ich rzetelnie przeliczyć na rok.
5. **Wypłaty traktowane jako koszt stały** w progu opłacalności, bo tak się zachowują
   empirycznie (v1 zrobił 20 tys. km mniej od v5, wypłatę miał niższą o 6%). Przy
   rozliczeniu czysto kilometrowym próg wyszedłby inaczej.
6. **v2 i v6** mają niepełne dane — v6 zero frachtów przy 3 729 € kosztów, v2 cztery
   miesiące aktywności. Nie wyciągać z nich wniosków o rentowności typu pojazdu.
7. **Jedna firma, sześć aut.** To studium przypadku, nie badanie branży. Nic tu nie
   uprawnia do zdania „w polskim transporcie jest tak, że…".

---

## 11. Przed publikacją — decyzje dla człowieka

Zanim to gdziekolwiek pójdzie:

- [ ] **Czy ujawniamy stawki i marże?** Materiał pokazuje 1,115 €/km i 16,8% marży.
      Przeczytają to także zleceniodawcy. To decyzja biznesowa, nie redakcyjna.
- [ ] **Czy ujawniamy rejestracje?** WGM 0475M itd. są rozpoznawalne. Alternatywa: „Auto A"…„Auto F".
- [ ] **Nazwiska kierowców — raczej do anonimizacji.** Sekcja 8 wiąże konkretną osobę z
      wykorzystaniem czasu pracy. RODO plus zwykła przyzwoitość. Propozycja: inicjały albo
      „Kierowca 1–5".
- [ ] **Nazwy klientów** (sekcja 10 pkt 3) — jeśli zostaje, wylatują nazwy własne.
- [ ] **Czy wspominamy FleetStat?** Wersja mocniejsza nie wspomina wcale — materiał działa
      sam, a narzędzie wychodzi w rozmowie. Wersja sprzedażowa dodaje jedno zdanie na końcu.
- [ ] **Logo** `public/app-fleetstat.png` w nagłówku, gdy to idzie do PDF/slajdu.
- [ ] **Odświeżyć okno** — `node scripts/case-study-dane.mjs 2026-01 2026-12` po zamknięciu
      grudnia da pełny rok kalendarzowy, który czyta się lepiej niż X–IX.

## 12. Metodyka

- **Okno:** 1.10.2025 – 30.09.2026, tylko miesiące zamknięte. Kolekcja `costs` zawiera
  przedpłacone pozycje cykliczne kilka miesięcy w przód — wejście w miesiąc niezamknięty
  da koszty bez paliwa i wypłat, czyli marżę z sufitu.
- **Kwoty netto EUR.** Przeliczenia z PLN po kursie NBP z dnia transakcji.
- **Frachty** przypisane do miesiąca po `dataZaladunku`. Kilometry: `kmWszystkie`, a gdy
  brak — `kmLadowne`.
- **Marża** = obrót z frachtów − wszystkie koszty przypisane do pojazdu, w tym wypłaty
  i ZUS. To marża operacyjna, nie zysk księgowy: nie ma w niej amortyzacji, kosztów
  administracji ani podatku.
- **Próg opłacalności** = koszty stałe ÷ (stawka − koszt zmienny na km). Stałe: leasing,
  wypłata, ZUS, OCPD, polisa, uruchomienie, telefon, SlickShift, IMI. Zmienne: paliwo,
  opłaty drogowe, serwis, hotele, mandaty, inne.
- **Paliwo** z transakcji kart (Eurowag, e100, Andamur, tankpool), tylko produkt ON;
  AdBlue liczony osobno. **Spalanie** = litry ÷ kilometry z licznika, nie z frachtów.
- **Tachograf** z plików DDD. Każde zrzucenie karty to nowy plik obejmujący cały jej
  okres, więc per kierowca brany jest **tylko najszerszy plik** — sumowanie liczyłoby te
  same dni po kilka razy.
- **Powtarzalność:** `node scripts/case-study-dane.mjs [od] [do]`.
