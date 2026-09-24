export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // The app remains fully usable when a browser does not support service workers.
    });
  });
};
