// Add this to handle periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'weather-update') {
    console.log('Periodic sync received');
    event.waitUntil(
      fetch('http://localhost:5000/api/force-update')
        .then(response => response.json())
        .then(data => console.log('Background update completed', data))
    );
  }
});

// Enhanced push handler
self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {
    title: 'Weather Update',
    body: 'New weather information available',
    icon: '/icons/weather.png'
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: '/icons/badge.png',
      data: payload.data,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view') {
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
  }
});

// Enhanced install prompt for iOS
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) return preloadResponse;
          return await fetch(event.request);
        } catch (e) {
          return new Response(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Weatherly</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="apple-mobile-web-app-capable" content="yes">
                <link rel="manifest" href="/manifest.json">
                <script>
                  window.location.href = '/?source=pwa';
                </script>
              </head>
              <body></body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }
      })()
    );
  }
});