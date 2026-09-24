import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);
const socketUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export const useRahiSocket = () => useContext(SocketContext);

export default function SocketProvider({ token, children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    const nextSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    const reportPresence = () => {
      nextSocket.emit('presence:update', {
        focused: document.visibilityState === 'visible' && document.hasFocus(),
      });
    };
    nextSocket.on('connect', reportPresence);
    window.addEventListener('focus', reportPresence);
    window.addEventListener('blur', reportPresence);
    document.addEventListener('visibilitychange', reportPresence);
    setSocket(nextSocket);
    return () => {
      nextSocket.off('connect', reportPresence);
      window.removeEventListener('focus', reportPresence);
      window.removeEventListener('blur', reportPresence);
      document.removeEventListener('visibilitychange', reportPresence);
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
