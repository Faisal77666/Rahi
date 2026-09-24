import { useEffect, useRef, useState } from 'react';

const ROUTE_REFRESH_MS = 20000;
const SIGNIFICANT_MOVE_METERS = 75;

const distanceInMeters = (first, second) => {
  const radius = 6371000;
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(second.lat - first.lat);
  const dLng = radians(second.lng - first.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function useRoute({ from, to, api, token }) {
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const lastRequest = useRef(null);

  useEffect(() => {
    if (!from || !to) return undefined;
    const intervalId = window.setInterval(() => setRefreshTick((tick) => tick + 1), ROUTE_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [Boolean(from && to)]);

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      setError('');
      return undefined;
    }
    const previous = lastRequest.current;
    const movedEnough = !previous || Math.max(distanceInMeters(previous.from, from), distanceInMeters(previous.to, to)) >= SIGNIFICANT_MOVE_METERS;
    const dueForRefresh = !previous || Date.now() - previous.at >= ROUTE_REFRESH_MS;
    if (!movedEnough && !dueForRefresh) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');
    lastRequest.current = { from: { ...from }, to: { ...to }, at: Date.now() };
    api(`/route?from=${encodeURIComponent(`${from.lat},${from.lng}`)}&to=${encodeURIComponent(`${to.lat},${to.lng}`)}`, { token })
      .then((data) => {
        if (!cancelled) setRoute(data.route);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setRoute(null);
          setError(requestError.message || 'Route is temporarily unavailable.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from?.lat, from?.lng, to?.lat, to?.lng, refreshTick, api, token]);

  return { route, error, loading };
}
