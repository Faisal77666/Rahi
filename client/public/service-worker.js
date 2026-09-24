self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a new Rahi update." };
  }

  const title = payload.title || "Rahi";
  const options = {
    body: payload.body || "You have a new ride update.",
    icon: "/rahi-mark.svg",
    badge: "/rahi-badge.svg",
    tag: payload.tag || `rahi-${Date.now()}`,
    renotify: false,
    data: { url: payload.url || "/#requests" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/#requests", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingClient = clientsList.find((client) => client.url.startsWith(self.location.origin));
    if (existingClient) {
      await existingClient.focus();
      await existingClient.navigate(destination);
      return;
    }
    await clients.openWindow(destination);
  })());
});
