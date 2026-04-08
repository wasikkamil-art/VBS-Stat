// Firebase Messaging Service Worker — obsługuje push notifications w tle
// Kompatybilny z iOS Safari PWA + Chrome/Firefox

// ─── STANDARDOWY PUSH EVENT (działa na iOS Safari PWA) ───
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = {};
  let title = "FleetStat Czat";
  let body = "Nowa wiadomość";

  try {
    if (event.data) {
      const payload = event.data.json();
      console.log("[SW] Push payload:", JSON.stringify(payload));

      // FCM wysyła dane w różnych formatach
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      }
      if (payload.data) {
        data = payload.data;
      }
      // Czasem FCM pakuje notification w data
      if (payload.data?.title) {
        title = payload.data.title;
        body = payload.data.body || body;
      }
    }
  } catch (e) {
    console.log("[SW] Push parse error:", e);
    // Spróbuj jako tekst
    try { body = event.data?.text() || body; } catch (e2) {}
  }

  const opts = {
    body: body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.roomId || "chat",
    data: { url: "https://fleetstat.pl", roomId: data.roomId },
    vibrate: [200, 100, 200],
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, opts)
  );
});

// ─── KLIKNIĘCIE W POWIADOMIENIE → otwórz apkę ───
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("fleetstat.pl") && "focus" in client) return client.focus();
      }
      return clients.openWindow(e.notification.data?.url || "https://fleetstat.pl");
    })
  );
});

// ─── FIREBASE COMPAT (dla Chrome/Firefox — backup) ───
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ",
    authDomain: "vbs-stats.firebaseapp.com",
    projectId: "vbs-stats",
    storageBucket: "vbs-stats.firebasestorage.app",
    messagingSenderId: "331217061974",
    appId: "1:331217061974:web:375c8931f0cda74ec413f7",
  });

  const messaging = firebase.messaging();
  // onBackgroundMessage nie jest potrzebny — standardowy push event wyżej obsługuje wszystko
} catch (e) {
  console.log("[SW] Firebase compat init skip:", e.message);
}
