import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, X } from "lucide-react";

const toUint8Array = (base64Url) => {
  const padded = `${base64Url}${"=".repeat((4 - (base64Url.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = window.atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
};

export default function PushNotificationProvider({ token, api, children }) {
  const [promptVisible, setPromptVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [message, setMessage] = useState("");

  const subscribeCurrentDevice = async () => {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await (async () => {
      const { publicKey } = await api("/push/vapid-public-key", { token });
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(publicKey),
      });
    })();
    await api("/push/subscribe", {
      token,
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return undefined;
    let active = true;
    const prepare = async () => {
      try {
        await navigator.serviceWorker.ready;
        if (!active) return;
        if (Notification.permission === "granted") {
          await subscribeCurrentDevice();
          return;
        }
        if (
          Notification.permission === "default" &&
          localStorage.getItem("rahiPushPromptSeen") !== "true"
        ) {
          setPromptVisible(true);
        }
      } catch {
        // Push remains optional; the app continues normally if the browser blocks it.
      }
    };
    prepare();
    return () => { active = false; };
  }, [token]);

  const enable = async () => {
    setEnabling(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      localStorage.setItem("rahiPushPromptSeen", "true");
      if (permission !== "granted") {
        setMessage("Notifications were not enabled. You can allow them later in browser settings.");
        return;
      }
      await subscribeCurrentDevice();
      setPromptVisible(false);
      setMessage("Notifications enabled for this device.");
    } catch (error) {
      setMessage(error.message || "Unable to enable notifications right now.");
    } finally {
      setEnabling(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem("rahiPushPromptSeen", "true");
    setPromptVisible(false);
  };

  useEffect(() => {
    if (!message) return undefined;
    const id = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(id);
  }, [message]);

  return <>
    {children}
    {promptVisible && <aside className="fixed bottom-4 left-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/15"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><BellRing size={20} /></span><div><p className="font-bold text-slate-900">Enable ride notifications?</p><p className="mt-1 text-sm leading-5 text-slate-600">Get notified instantly when a ride request or offer arrives — even when Rahi is in the background.</p><div className="mt-3 flex gap-2"><button type="button" onClick={enable} disabled={enabling} className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: "#0d9488", color: "#fff" }}>{enabling ? "Enabling…" : "Enable"}</button><button type="button" onClick={dismiss} disabled={enabling} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Not now</button></div></div></div></aside>}
    {message && <aside className="fixed bottom-4 left-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-teal-900 shadow-xl shadow-slate-900/15"><CheckCircle2 size={20} className="mt-0.5 shrink-0" /><p className="flex-1 text-sm font-medium">{message}</p><button type="button" onClick={() => setMessage("")} aria-label="Dismiss message"><X size={17} /></button></aside>}
  </>;
}
