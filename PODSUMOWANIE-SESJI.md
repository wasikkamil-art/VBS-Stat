# VBS-Stat (FleetStat) — Podsumowanie sesji prac

## PROJEKT
- **Nazwa**: VBS-Stat / FleetStat
- **URL produkcyjny**: https://fleetstat.pl
- **Hosting**: Vercel (auto-deploy z GitHub push na `main`)
- **Firebase Hosting (backup)**: https://vbs-stats.web.app
- **Firebase project ID**: `vbs-stats`
- **Firebase plan**: Blaze (pay-as-you-go)
- **GitHub repo**: https://github.com/wasikkamil-art/VBS-Stat.git
- **Ścieżka lokalna**: `/Users/kamilwasik/Desktop/VBS-Stat.nosync`
- **Technologie**: React (Vite), Firebase (Firestore, Auth, Storage, Cloud Functions v2, FCM)
- **Główny plik**: `src/App.jsx` (~9800 linii, jeden plik monolityczny)

---

## AKTUALNY STAN I PROBLEMY DO NAPRAWIENIA

### 1. CHRONOLOGIA WIADOMOŚCI NA CZACIE — AKTYWNY BUG
**Problem**: Wiadomości na czacie nie wyświetlają się w poprawnej kolejności chronologicznej. Wiadomości jednego użytkownika grupują się razem zamiast przeplatać się z wiadomościami drugiego.

**Przyczyna**: W Firestore istnieją wiadomości z DWOMA typami pól `timestamp`:
- **Stare wiadomości**: `timestamp` jako **string ISO** (np. `"2026-04-07T19:15:44Z"`)
- **Wiadomości z krótkiego okresu serverTimestamp**: `timestamp` jako **Firestore Timestamp** (obiekt z `seconds` i `nanoseconds`)

Firestore `orderBy("timestamp", "asc")` sortuje po **typie** danych — wszystkie Timestamp PRZED wszystkimi stringami, niezależnie od chronologii.

**Aktualne rozwiązanie (w kodzie, do zweryfikowania)**:
- Globalny helper `tsToMs(ts)` normalizuje oba typy do milisekund
- Client-side sort `.sort((a, b) => tsToMs(a.timestamp) - tsToMs(b.timestamp))` po pobraniu z Firestore
- `fmtTime(ts)` obsługuje oba formaty timestampów

**Najlepsze trwałe rozwiązanie**: Napisać skrypt migracyjny który skonwertuje WSZYSTKIE Firestore Timestamp w wiadomościach na stringi ISO. Wtedy Firestore `orderBy` będzie działać poprawnie i client-side sort nie będzie potrzebny.

```javascript
// Potrzebny skrypt migracyjny (do napisania):
// 1. Iteruj po wszystkich chatRooms/{roomId}/messages
// 2. Jeśli timestamp jest Firestore Timestamp (obiekt) → zamień na .toDate().toISOString()
// 3. Jeśli lastMessageAt w chatRooms jest Timestamp → zamień na ISO string
// 4. To samo dla lastRead map values
```

### 2. PUSH NOTIFICATIONS — DZIAŁAJĄ ale wymagają uwagi
**Status**: Push notifications działają na iOS (Safari PWA) i powinny działać na Android (Chrome).

**Kluczowe zasady techniczne**:

#### Cloud Function (`functions/index.js` → `onNewChatMessage`):
- Trigger: `onDocumentCreated` na `chatRooms/{roomId}/messages/{msgId}`
- Region: `europe-west1`
- Wysyła **DATA-ONLY message** (BEZ pola `notification`) — to jest KLUCZOWE dla iOS Safari PWA
- Tokeny przechowywane w kolekcji `fcmTokens` jako `{uid}_{tokenHash}`
- Multi-device: każde urządzenie ma osobny dokument z polami: `token`, `uid`, `platform`, `userAgent`, `updatedAt`
- Automatyczne czyszczenie nieaktywnych tokenów

#### Service Worker (`public/firebase-messaging-sw.js`):
- **STANDARDOWY `push` event listener** na samej górze — to obsługuje iOS Safari PWA
- Firebase compat jako backup (Chrome/Firefox) — w try/catch na dole pliku
- `notificationclick` handler — otwiera/przywraca okno FleetStat

#### Rejestracja tokenów (`registerFCMToken` w App.jsx):
- Krokowa diagnostyka: SW check → PushManager → Notification API → FCM init → Permission → SW register → Token → Save
- Czeka na aktywację Service Workera (ważne na iOS)
- Zapisuje `platform` (ios/android/desktop) i `userAgent` do Firestore
- VAPID key: `BFS79b5DBeiWgH98Uzmw4nbdK4vn7ggvop2W4acNbPBgO9Q2QaChaxOH5u9sNEdmXnG9cf-7sXzRdRg_-l1OO8M`

#### Przycisk "Włącz powiadomienia push" w ChatTab:
- Duży niebieski przycisk na górze listy pokojów
- Wymaga user gesture (kliknięcie) — wymagane na iOS
- Po rejestracji znika i zapamiętuje się w `localStorage("pushRegistered")`
- Auto-rejestracja w tle gdy `Notification.permission === "granted"` (ale NIE ukrywa przycisku)

#### Foreground notifications:
- `onMessage` handler w App.jsx — pokazuje natywne `new Notification()` gdy apka jest otwarta
- iOS nie wyświetla powiadomień gdy PWA jest na pierwszym planie

#### Wymagania iOS:
- iOS 16.4+ (użytkownik ma 26.4)
- Aplikacja MUSI być dodana do ekranu głównego (PWA standalone)
- Otwierać z ekranu głównego, NIE z Safari
- Permission musi być z user gesture

### 3. PRZYCISK PUSH — "Włącz powiadomienia push"
Przycisk pojawia się na każdym urządzeniu dopóki nie kliknie się go i rejestracja nie przejdzie. Na komputerze trzeba kliknąć raz żeby zniknął.

---

## ARCHITEKTURA CZATU

### Firestore struktura:
```
chatRooms/{roomId}
  ├── name: string
  ├── type: "channel" | "dm" | "group" | "self"
  ├── members: string[] (UIDs)
  ├── lastMessage: string
  ├── lastMessageAt: string (ISO)
  ├── lastSender: string (email)
  ├── lastRead: { [uid]: string|Timestamp }  ← MIXED TYPES (bug)
  ├── typing: { [uid]: timestamp|null }
  └── messages/{msgId}  (subcollection)
        ├── text: string
        ├── senderId: string (UID)
        ├── senderEmail: string
        ├── senderName: string
        ├── timestamp: string (ISO) | Firestore Timestamp  ← MIXED TYPES (bug)
        ├── fileUrl?: string
        ├── fileName?: string
        ├── replyTo?: { id, text, senderName }
        ├── reactions?: { [emoji]: string[] (UIDs) }
        ├── edited?: boolean
        └── deleted?: boolean
```

### Typy pokojów:
- **channel** — widoczny dla wszystkich zalogowanych
- **dm** — prywatna rozmowa 1:1
- **group** — grupa wybranych osób
- **self** — notatki do siebie (ikona ołówka, brak powiadomień)

### Kluczowe mechanizmy:
1. **Rooms listener** — `onSnapshot` na `chatRooms` z `orderBy("lastMessageAt", "desc")`
   - Stabilizowany `activeRoom` — aktualizuje się TYLKO przy zmianie name/type/members
   - Unika kaskadowych re-renderów
2. **Messages listener** — `onSnapshot` na `chatRooms/{id}/messages` z `orderBy("timestamp", "asc")`
   - Client-side sort przez `tsToMs()` (z powodu mixed types)
3. **Room detail listener** — osobny `onSnapshot` na dokument pokoju dla `typing` i `lastRead`
   - `lastReadMap` w osobnym state (nie w `activeRoom`)
4. **Auto-scroll** — scrolluje na dół gdy: (a) zmiana pokoju, (b) moja wiadomość, (c) jestem blisko dołu
   - `lastMsgIdRef` do detekcji nowych wiadomości
   - `isRoomSwitch` gdy `lastMsgIdRef.current === null`
5. **Unread indicators** — niebieska kropka + badge z liczbą w sidebar
   - `chatUnreadCount` na poziomie App (listener na chatRooms)
   - `lastRead` update z dedup przez `lastReadTsRef`

### Funkcje czatu:
- Edycja wiadomości
- Usuwanie wiadomości (soft delete — `deleted: true`)
- Reply (cytowanie)
- Reakcje emoji
- Upload plików (Firebase Storage)
- Wyszukiwanie w wiadomościach
- Typing indicator
- Read receipts (✓✓)
- Zarządzanie pokojami (tworzenie, zmiana nazwy, dodawanie członków)
- Dźwięk powiadomienia (AudioContext)

---

## KOMENDY DEPLOY

```bash
# Ścieżka projektu
cd /Users/kamilwasik/Desktop/VBS-Stat.nosync

# Build + deploy na Vercel (przez git push)
git add src/App.jsx && git commit -m "opis zmian" && git push

# Deploy Cloud Functions
firebase deploy --only functions

# Deploy Firestore rules
firebase use vbs-stats && firebase deploy --only firestore:rules

# Deploy Firebase Hosting (backup)
npm run build && firebase deploy --only hosting

# Logi Cloud Functions
firebase functions:log --only onNewChatMessage | tail -15

# Jeśli git lock file blokuje:
rm -f .git/index.lock
```

**WAŻNE**: Produkcyjna domena `fleetstat.pl` wskazuje na **Vercel** (auto-deploy z git push), NIE na Firebase Hosting. Firebase Hosting (`vbs-stats.web.app`) to backup.

---

## KLUCZOWE PLIKI

| Plik | Opis |
|------|------|
| `src/App.jsx` | Główna aplikacja React (~9800 linii, monolityczny) |
| `functions/index.js` | Cloud Functions: role, email, push notifications |
| `public/firebase-messaging-sw.js` | Service Worker dla push notifications |
| `public/manifest.json` | PWA manifest |
| `public/icon-192.png`, `icon-512.png` | Ikony PWA |
| `firestore.rules` | Reguły bezpieczeństwa Firestore |
| `ZASADY-VBS-STAT.md` | Dokumentacja projektu (dane, flota, koszty, procesy) |

---

## FIREBASE CONFIG

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ",
  authDomain: "vbs-stats.firebaseapp.com",
  projectId: "vbs-stats",
  storageBucket: "vbs-stats.firebasestorage.app",
  messagingSenderId: "331217061974",
  appId: "1:331217061974:web:375c8931f0cda74ec413f7",
  measurementId: "G-EJTBVPYH1X",
};
```

---

## KOLEKCJE FIRESTORE

| Kolekcja | Opis |
|----------|------|
| `chatRooms` | Pokoje czatu z subcollection `messages` |
| `fcmTokens` | Tokeny push notifications (format: `{uid}_{tokenHash}`) |
| `users` | Dane użytkowników (role: admin, dyspozytor, podglad) |
| `fleet` | Dane flotowe (dokumenty per klucz) |
| `config` | Konfiguracja systemowa |
| `operacyjne` | Dane operacyjne |
| `emailLogs` | Logi wysłanych emaili |
| `emailRecipients` | Odbiorcy emaili |
| `pauzy` | Pauzy kierowców |
| `sprawy` | Sprawy/tickety |
| `rentownosc` | Dane rentowności |

---

## UŻYTKOWNICY I ROLE

- **Admin**: Kamil (wasik.kamil@gmail.com) — pełny dostęp
- **Dyspozytor**: dyspozytor — dostęp do frachtów, spraw, czatu
- **Podgląd**: podglad — tylko odczyt

Użytkownicy w Firestore `users/{uid}` z polem `role`. Cloud Function `onRoleChange` synchronizuje rolę z Firebase Auth Custom Claims.

---

## TODO NA PRZYSZŁOŚĆ

1. **Migracja timestampów** — skonwertować WSZYSTKIE Firestore Timestamp na ISO strings w messages i chatRooms (naprawia chronologię)
2. **Panel kierowcy z CMR** — skanowanie dokumentów telefonem (Canvas API, Firebase Storage)
3. **SendGrid na Cloud Functions** — przenieść emailing na backend
4. **Code splitting** — rozbić App.jsx (~550KB) na mniejsze moduły (lazy loading)
5. **Rate limiting** — ochrona API endpoints
6. **Weryfikacja kosztów sty–maj 2025** — czy stare dane są netto czy brutto

---

## ZNANE PROBLEMY

1. **Mixed timestamp types** — wiadomości czatu mają mieszankę string ISO i Firestore Timestamp. Client-side sort (`tsToMs`) jest workaround. Trwałe rozwiązanie: skrypt migracyjny.
2. **Wolne ładowanie na telefonie** — App.jsx jest za duży (~550KB). Potrzebny code splitting.
3. **Push na iOS** — działa ale wymaga: dodania do ekranu głównego, iOS 16.4+, kliknięcia "Włącz powiadomienia push" z poziomu PWA.
