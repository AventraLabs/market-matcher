// Phase 12: minimal push service worker. Only handles showing a
// notification and focusing/opening the app on click — no offline caching,
// that's a separate concern this phase doesn't touch.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Market Matcher", body: event.data.text() };
  }
  const { title, body, url } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Market Matcher", {
      body: body || "",
      icon: "/favicon.ico",
      data: { url: url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
