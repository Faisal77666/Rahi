import { createContext, useContext, useEffect, useRef, useState } from "react";
import { BellRing, Volume2, VolumeX, X } from "lucide-react";
import { useRahiSocket } from "../realtime/SocketProvider";

const SoundContext = createContext({ enabled: false, toggle: () => {} });
const events = ["new_request", "price_countered", "request_accepted", "request_rejected"];

const soundPattern = {
  new_request: [[740, 0], [988, 0.14]],
  price_countered: [[660, 0], [784, 0.12]],
  request_accepted: [[523, 0], [659, 0.16]],
  request_rejected: [[392, 0]],
};

const toastTint = {
  new_request: "border-teal-100 bg-teal-50 text-teal-900",
  price_countered: "border-amber-100 bg-amber-50 text-amber-900",
  request_accepted: "border-emerald-100 bg-emerald-50 text-emerald-900",
  request_rejected: "border-rose-100 bg-rose-50 text-rose-900",
};

export const useNotificationSound = () => useContext(SoundContext);

export function SoundToggle() {
  const { enabled, toggle } = useNotificationSound();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute notification sounds" : "Enable notification sounds"}
      title={enabled ? "Mute notification sounds" : "Enable notification sounds"}
      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
    >
      {enabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
    </button>
  );
}

export default function NotificationSoundProvider({ children }) {
  const socket = useRahiSocket();
  const audioContextRef = useRef(null);
  const [enabled, setEnabled] = useState(() => localStorage.getItem("rahiSoundEnabled") === "true");
  const enabledRef = useRef(enabled);
  const [promptVisible, setPromptVisible] = useState(() => localStorage.getItem("rahiSoundPromptSeen") !== "true");
  const [toast, setToast] = useState(null);

  const ensureAudioRunning = async ({ create = false } = {}) => {
    if (!audioContextRef.current && create) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn("[Rahi sound] Web Audio API is not supported by this browser.");
        return null;
      }
      audioContextRef.current = new AudioContext();
      console.log("[Rahi sound] Created the shared AudioContext.");
    }

    const context = audioContextRef.current;
    if (!context) {
      console.warn("[Rahi sound] No AudioContext exists yet. Enable sounds first.");
      return null;
    }

    console.log("[Rahi sound] AudioContext state before sound:", context.state);
    if (context.state === "suspended") {
      console.log("[Rahi sound] AudioContext is suspended; calling resume().");
      try {
        await context.resume();
        console.log("[Rahi sound] resume() succeeded. New state:", context.state);
      } catch (error) {
        console.warn("[Rahi sound] resume() failed:", error);
        return null;
      }
    }

    if (context.state !== "running") {
      console.warn("[Rahi sound] AudioContext is not running:", context.state);
      return null;
    }
    return context;
  };

  const prepareAudio = () => ensureAudioRunning({ create: true });

  const playSound = async (event) => {
    if (!enabledRef.current) {
      console.log("[Rahi sound] Sound attempt skipped because notifications are muted.");
      return;
    }
    const context = await ensureAudioRunning();
    if (!context || !soundPattern[event]) return;
    const now = context.currentTime;
    soundPattern[event].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.5, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 4);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 4.02);
    });
  };

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const play = (event = "new_request") => {
    if (document.visibilityState === "visible" && document.hasFocus()) {
      void playSound(event);
    }
  };

  const enable = async () => {
    await prepareAudio();
    enabledRef.current = true;
    localStorage.setItem("rahiSoundEnabled", "true");
    localStorage.setItem("rahiSoundPromptSeen", "true");
    setEnabled(true);
    await playSound("new_request");
    setPromptVisible(false);
  };
  const decline = () => {
    localStorage.setItem("rahiSoundPromptSeen", "true");
    setPromptVisible(false);
  };
  const toggle = async () => {
    if (enabled) {
      localStorage.setItem("rahiSoundEnabled", "false");
      setEnabled(false);
      return;
    }
    await prepareAudio();
    enabledRef.current = true;
    localStorage.setItem("rahiSoundEnabled", "true");
    localStorage.setItem("rahiSoundPromptSeen", "true");
    setEnabled(true);
    await playSound("new_request");
  };

  useEffect(() => {
    if (!socket) return undefined;
    const handlers = Object.fromEntries(events.map((event) => [event, (payload) => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      play(event);
      setToast({ event, ...payload });
    }]));
    events.forEach((event) => socket.on(event, handlers[event]));
    return () => events.forEach((event) => socket.off(event, handlers[event]));
  }, [socket, enabled]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  return (
    <SoundContext.Provider value={{ enabled, toggle, play }}>
      {children}
      {promptVisible && (
        <aside className="fixed bottom-4 right-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/15">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><BellRing size={20} /></span>
            <div><p className="font-bold text-slate-900">Enable notification sounds?</p><p className="mt-1 text-sm leading-5 text-slate-600">Hear a gentle alert for new ride activity while Rahi is open.</p><div className="mt-3 flex gap-2"><button type="button" onClick={enable} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "#0d9488", color: "#fff" }}>Enable sounds</button><button type="button" onClick={decline} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Not now</button></div></div>
          </div>
        </aside>
      )}
      {toast && (
        <aside className={`fixed right-4 top-4 z-[80] w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-4 shadow-xl shadow-slate-900/15 ${toastTint[toast.event]}`}>
          <div className="flex gap-3"><BellRing size={20} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-bold">{toast.title || "Rahi update"}</p><p className="mt-1 text-sm">{toast.body}</p></div><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="grid h-7 w-7 place-items-center rounded-lg"><X size={17} /></button></div>
        </aside>
      )}
    </SoundContext.Provider>
  );
}
