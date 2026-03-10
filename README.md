# FleetOS — Instrukcja wdrożenia

## Wymagania
- Konto Google (do Firebase)
- Konto GitHub (darmowe) → github.com
- Konto Vercel (darmowe) → vercel.com

---

## KROK 1 — Utwórz projekt Firebase

1. Wejdź na **console.firebase.google.com**
2. Kliknij **"Add project"** → wpisz nazwę np. `fleetOS`
3. Google Analytics → możesz wyłączyć → **Create project**
4. Po utworzeniu kliknij **"Web"** (ikona `</>`)
5. Wpisz nazwę apki np. `fleetOS` → kliknij **Register app**
6. Skopiuj cały blok `firebaseConfig` — będzie wyglądał tak:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "fleetOS.firebaseapp.com",
  projectId: "fleetOS",
  storageBucket: "fleetOS.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## KROK 2 — Włącz Firestore Database

1. W lewym menu Firebase kliknij **Firestore Database**
2. Kliknij **Create database**
3. Wybierz **Start in test mode** → Next → wybierz region (np. `eur3`) → Enable
4. Gotowe — baza danych działa

> ⚠️ Test mode wygasa po 30 dniach. Przed wygaśnięciem wejdź w **Rules** i zmień datę lub wklej:
> ```
> rules_version = '2';
> service cloud.firestore {
>   match /databases/{database}/documents {
>     match /{document=**} {
>       allow read, write: if true;
>     }
>   }
> }
> ```

---

## KROK 3 — Wklej konfigurację Firebase do aplikacji

Otwórz plik `src/App.jsx` i znajdź sekcję:

```js
const firebaseConfig = {
  apiKey:            "WKLEJ_API_KEY",
  authDomain:        "WKLEJ_AUTH_DOMAIN",
  ...
```

Zastąp wszystkie wartości `"WKLEJ_..."` swoimi danymi z kroku 1.

---

## KROK 4 — Wrzuć projekt na GitHub

1. Wejdź na **github.com** → zaloguj się → kliknij **New repository**
2. Nazwa: `fleetOS` → **Create repository**
3. Na swoim komputerze zainstaluj **Git** (jeśli nie masz): git-scm.com
4. Otwórz terminal/wiersz poleceń w folderze z projektem i wpisz:

```bash
git init
git add .
git commit -m "FleetOS init"
git branch -M main
git remote add origin https://github.com/TWOJA_NAZWA/fleetOS.git
git push -u origin main
```

> Zamiast `TWOJA_NAZWA` wpisz swoją nazwę użytkownika GitHub.

---

## KROK 5 — Wdróż na Vercel

1. Wejdź na **vercel.com** → zaloguj się przez GitHub
2. Kliknij **"Add New Project"**
3. Znajdź repozytorium `fleetOS` → kliknij **Import**
4. Framework: wybierz **Vite** (powinno wykryć automatycznie)
5. Kliknij **Deploy**
6. Za 2-3 minuty aplikacja jest dostępna pod adresem np.:
   `https://fleet-os.vercel.app`

---

## KROK 6 — Aktualizacje w przyszłości

Gdy chcesz zaktualizować aplikację (np. po zmianach od Claude):
1. Zastąp plik `src/App.jsx` nową wersją
2. W terminalu:
```bash
git add .
git commit -m "Aktualizacja"
git push
```
Vercel automatycznie wykryje zmiany i wdroży nową wersję w ciągu 2 minut.

---

## Struktura projektu

```
fleetOS/
├── src/
│   ├── App.jsx        ← cała aplikacja (tu wklejasz nowe wersje)
│   ├── main.jsx       ← punkt wejścia React
│   └── index.css      ← style Tailwind
├── public/
│   └── truck.svg      ← ikona aplikacji
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Uruchomienie lokalne (opcjonalnie)

Jeśli chcesz testować lokalnie przed wdrożeniem:

```bash
npm install
npm run dev
```

Aplikacja uruchomi się na `http://localhost:5173`

---

## Problemy?

- **Biała strona po wdrożeniu** → sprawdź czy firebaseConfig jest poprawnie wklejony
- **Dane nie zapisują się** → sprawdź Firestore Rules czy są aktywne
- **Błąd przy `git push`** → GitHub może prosić o zalogowanie przez token: Settings → Developer settings → Personal access tokens
