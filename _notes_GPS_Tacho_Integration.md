# Integracja GPS + Tachograf + Kalendarz Czasu Pracy

## Status: CZEKAMY NA API od widziszwszystko.eu

### GPS - widziszwszystko.eu
- Panel: https://beta.widziszwszystko.eu/app/reports/dynamic/list
- Dokumentacja: https://doc.widziszwszystko.eu/docs
- API: REST/HTTPS, dedykowane — napisano na serwis po dostep
- Potrzebne: endpoint pozycji pojazdow, lista pojazdow, historia tras, dane logowania

### Pliki DDD (odczyt tachografu)
- Format binarny TLV, regulacja EU 2016/799
- Parsery open-source:
  - readesm-js (JavaScript/TypeScript) - https://github.com/densolo/readesm-js
  - tachoparser (Gen1/Gen2/Gen2v2, output JSON) - https://github.com/traconiq/tachoparser
- Zawieraja: aktywnosci kierowcy z timestampami, dane pojazdu, zdarzenia, podpisy RSA

### 3 zrodla danych do kalendarza
1. GPS (widziszwszystko.eu API) — prawda fizyczna
2. Plik DDD (odczyt z tachografu) — prawda prawna
3. Reczne wpisy (kolekcja pauzy) — fallback

### Silnik regul 561/2006
- Dzienna jazda: max 9h (2x/tydzien 10h)
- Przerwa: 45min po 4.5h (mozna dzielic 15+30)
- Odpoczynek dzienny: 11h regularny, 9h skrocony (max 3x miedzy tygodniowymi)
- Odpoczynek tygodniowy: 45h regularny, 24h skrocony (dlug do nadrobienia w 3 tyg)
- Tygodniowa jazda: max 56h
- Dwutygodniowa jazda: max 90h
- Cykl: 28 dni, powrot do bazy
- Podwojna obsada: odpoczynek 9h w 30h
- Prom/pociag: przerwanie odpoczynku max 2x, lacznie max 1h
- Okres kontroli: 56 dni (od 2026)

### Kalendarz cyklu — wizja
- Siatka Pn-Nd (klasyczny kalendarz miesieczny)
- Nalozony cykl 28 dni (nadrzedny)
- Start = dzien wyjazdu z bazy (nie 1-szy miesiaca)
- Kafelek dnia: mini timeline + ikony tacho + sumy + alerty
- Klikniecie → rozwiniety timeline 00:00-24:00
- Panel dlugow na gorze: "do nadrobienia X h pauzy", limity tydzien/2tyg, cykl

### Ikony tachografu (SVG inline, bez zewnetrznych plikow)
- Kierownica (niebieski) = Jazda
- Skrzyzowane narzedzia (zolty) = Inna praca
- Kwadrat z przekatna (szary) = Dyspozycyjnosc
- Lozko (zielony) = Odpoczynek/Przerwa

### Widocznosc
- Kierowca: widzi swoj kalendarz w panelu kierowcy
- Dyspozytor/Admin: widzi wszystkich w panelu kierowcow

### Reorganizacja menu (przy okazji)
- Lewy panel za dlugi — pogrupowac zakladki
- Np. Pojazdy → rozwijane: Serwis, Dokumenty, IMI, SIPSI

### Preview mockupow
- tacho_icons_preview.html — ikony + timeline + kafelki dnia
