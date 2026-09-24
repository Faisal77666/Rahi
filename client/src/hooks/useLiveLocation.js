import { useEffect, useRef, useState } from 'react';

const SEND_INTERVAL_MS = 3000;

export default function useLiveLocation({ tripId, socket, enabled = true }) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState('checking');
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!enabled || !tripId) return undefined;
    console.log('[Rahi location] Starting geolocation watch.', { tripId, secureContext: window.isSecureContext, socketConnected: Boolean(socket?.connected) });
    if (!navigator.geolocation) {
      console.warn('[Rahi location] Geolocation is not supported by this browser.');
      setPermission('unsupported');
      setError('Live location is not supported by this browser.');
      return undefined;
    }

    setError('');
    setPermission('checking');
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        console.log('[Rahi location] Geolocation permission state:', result.state);
        setPermission(result.state);
        result.onchange = () => {
          console.log('[Rahi location] Geolocation permission changed:', result.state);
          setPermission(result.state);
        };
      }).catch(() => console.warn('[Rahi location] Browser does not expose geolocation permission state.'));
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updatedAt: new Date().toISOString(),
        };
        console.log('[Rahi location] GPS position received:', { tripId, lat: nextLocation.lat, lng: nextLocation.lng, accuracy: nextLocation.accuracy });
        setPermission('granted');
        setLocation(nextLocation);

        if (socket && Date.now() - lastSentAt.current >= SEND_INTERVAL_MS) {
          console.log('[Rahi location] Emitting update_location:', { tripId, lat: nextLocation.lat, lng: nextLocation.lng });
          socket.emit('update_location', { tripId, lat: nextLocation.lat, lng: nextLocation.lng });
          lastSentAt.current = Date.now();
        } else if (!socket) {
          console.warn('[Rahi location] GPS received, but Socket.io is not connected yet.');
        }
      },
      (positionError) => {
        console.warn('[Rahi location] Geolocation watch error:', { code: positionError.code, message: positionError.message, tripId });
        if (positionError.code === positionError.PERMISSION_DENIED) {
          setPermission('denied');
          setError('Location access is off. Enable it in your browser settings to share your live location.');
        } else if (positionError.code === positionError.TIMEOUT) {
          setError('Location request timed out. Please try again in a moment.');
        } else {
          setError('Unable to determine your location right now.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => {
      console.log('[Rahi location] Clearing geolocation watch.', { tripId });
      navigator.geolocation.clearWatch(watchId);
    };
  }, [tripId, socket, enabled]);

  return { location, error, permission };
}
