import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bike, CarFront, Flag, MapPin, MapPinOff, Navigation } from 'lucide-react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useRoute from '../../hooks/useRoute';
import RouteLayer from './RouteLayer';
import DestinationSearch from './DestinationSearch';

const toPoint = (location) => location ? [location.lat, location.lng] : null;

const markerIcon = (kind, vehicleType) => {
  const Icon = kind === 'driver' ? (vehicleType === 'motorcycle' ? Bike : CarFront) : kind === 'destination' ? Flag : MapPin;
  const color = kind === 'driver' ? '#0d9488' : kind === 'destination' ? '#2563eb' : '#4f46e5';
  const label = kind === 'driver' ? 'Driver' : kind === 'destination' ? 'Destination' : 'Passenger';
  const svg = renderToStaticMarkup(<Icon size={20} strokeWidth={2.5} />);
  return L.divIcon({
    className: '',
    html: `<div aria-label="${label}" style="display:grid;place-items:center;width:42px;height:42px;border-radius:15px;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 8px 18px rgba(15,23,42,.22)">${svg}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
};

const passengerIcon = markerIcon('passenger');
const destinationIcon = markerIcon('destination');

function useSmoothedPosition(target) {
  const [position, setPosition] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (!target) return undefined;
    const from = current.current || target;
    const startedAt = performance.now();
    let frameId;
    const animate = (now) => {
      const progress = Math.min((now - startedAt) / 1200, 1);
      const eased = progress * (2 - progress);
      const next = {
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased,
      };
      current.current = next;
      setPosition(next);
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [target?.lat, target?.lng]);
  return position;
}

function FitMapToLocations({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 2) map.fitBounds(points, { padding: [36, 36], maxZoom: 15, animate: true });
    else if (points.length === 1) map.flyTo(points[0], 15, { animate: true });
  }, [map, points.map((point) => point.join(',')).join('|')]);
  return null;
}

function KeepMapResponsive() {
  const map = useMap();
  useEffect(() => {
    let timerId;
    const invalidate = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => map.invalidateSize({ pan: false, animate: false }), 100);
    };
    const observer = new ResizeObserver(invalidate);
    observer.observe(map.getContainer());
    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);
    invalidate();
    return () => {
      window.clearTimeout(timerId);
      observer.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
    };
  }, [map]);
  return null;
}

export default function TripMap({ tripId, session, socket, ownLocation, locationPermission, onMarkArrived, completing, api }) {
  const [otherLocation, setOtherLocation] = useState(null);
  const [sharingStopped, setSharingStopped] = useState(false);
  const [destination, setDestination] = useState(null);
  const [tripPhase, setTripPhase] = useState('to_pickup');
  useEffect(() => {
    if (!socket || !tripId) return undefined;
    const receiveLocation = (payload) => {
      console.log('[Rahi location] Received location_updated:', { payloadTripId: payload.tripId, currentTripId: tripId, senderId: payload.userId, ownUserId: session.user.id, lat: payload.lat, lng: payload.lng });
      if (String(payload.tripId) !== String(tripId)) {
        console.warn('[Rahi location] Ignored location for a different trip.', { payloadTripId: payload.tripId, currentTripId: tripId });
        return;
      }
      if (String(payload.userId) === String(session.user.id)) return;
      console.log('[Rahi location] Accepted other participant location for this trip.', { tripId, lat: payload.lat, lng: payload.lng });
      setOtherLocation({ lat: payload.lat, lng: payload.lng, updatedAt: payload.updatedAt });
      setSharingStopped(false);
    };
    const stopSharing = (payload) => {
      if (String(payload.tripId) === String(tripId)) setSharingStopped(true);
    };
    socket.on('location_updated', receiveLocation);
    socket.on('location_sharing_stopped', stopSharing);
    socket.on('stop_sharing', stopSharing);
    return () => {
      socket.off('location_updated', receiveLocation);
      socket.off('location_sharing_stopped', stopSharing);
      socket.off('stop_sharing', stopSharing);
    };
  }, [socket, tripId, session.user.id]);

  const driverTarget = session.user.role === 'driver' ? ownLocation : otherLocation;
  const passengerTarget = session.user.role === 'passenger' ? ownLocation : otherLocation;
  const driverLocation = useSmoothedPosition(driverTarget);
  const passengerLocation = useSmoothedPosition(passengerTarget);
  const driverIcon = useMemo(() => markerIcon('driver', session.user.vehicleType), [session.user.vehicleType]);
  const routeTarget = tripPhase === 'to_destination' ? destination : passengerLocation;
  const { route, error: routeError } = useRoute({ from: driverLocation, to: routeTarget, api, token: session.token });

  const markerPoints = [toPoint(driverLocation), toPoint(passengerLocation), toPoint(destination)].filter(Boolean);
  const fitPoints = tripPhase === 'to_destination' ? [toPoint(driverLocation), toPoint(destination)].filter(Boolean) : [toPoint(driverLocation), toPoint(passengerLocation)].filter(Boolean);
  const locationStatus = !ownLocation
    ? locationPermission === 'denied' ? 'Your location permission is blocked' : 'Waiting for your location permission'
    : !otherLocation ? "Waiting for the other person's location" : 'Both locations active';
  const distanceLabel = route ? `${route.distance < 1000 ? Math.round(route.distance) + ' m' : (route.distance / 1000).toFixed(1) + ' km'} away` : '—';
  const etaLabel = route?.duration ? `${Math.max(1, Math.round(route.duration / 60))} min` : '—';
  const phaseLabel = tripPhase === 'to_destination' ? 'To destination' : 'To pickup';
  const nextInstruction = route?.steps?.find((step) => step.instruction)?.instruction || (routeError ? 'Route unavailable — try again shortly.' : locationStatus);
  const completeTrip = () => onMarkArrived?.({ distanceMeters: route?.distance, destinationName: destination?.name || destination?.address || '', phase: tripPhase });

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="relative h-[320px] sm:h-[390px] lg:h-[460px]">
      {markerPoints.length === 0 ? <div className="grid h-full place-items-center bg-slate-50 px-6 text-center"><div><MapPinOff className="mx-auto text-slate-400" size={34} /><p className="mt-3 font-semibold text-slate-700">{locationStatus}</p><p className="mt-1 text-sm text-slate-500">The map will appear after a real GPS position is received.</p></div></div> : <MapContainer center={markerPoints[0]} zoom={13} className="h-full w-full" zoomControl={false} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <KeepMapResponsive />
        <FitMapToLocations points={fitPoints.length ? fitPoints : markerPoints} />
        {driverLocation && <Marker position={toPoint(driverLocation)} icon={driverIcon} />}
        {passengerLocation && <Marker position={toPoint(passengerLocation)} icon={passengerIcon} />}
        {destination && <Marker position={toPoint(destination)} icon={destinationIcon} />}
        {route ? <RouteLayer geometry={route.geometry} /> : driverLocation && routeTarget && <Polyline positions={[toPoint(driverLocation), toPoint(routeTarget)]} pathOptions={{ color: '#0d9488', weight: 3, dashArray: '7 9', opacity: 0.72 }} />}
      </MapContainer>}
      <DestinationSearch api={api} token={session.token} onSelect={(suggestion) => setDestination(suggestion)} />
      <div className="absolute bottom-3 left-3 right-3 z-[500] flex items-center justify-between gap-2 rounded-2xl border border-white/60 bg-white/85 px-3 py-2 shadow-lg shadow-slate-900/10 backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-4 sm:px-4 sm:py-3">
        <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-800 sm:text-sm"><span className={`h-2 w-2 shrink-0 rounded-full ${ownLocation && otherLocation && !sharingStopped ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />{sharingStopped ? 'Sharing paused' : `${phaseLabel} · Live`}</p><p className="mt-0.5 truncate text-[11px] text-slate-600 sm:mt-1 sm:text-xs">Next: {nextInstruction}</p></div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-2 text-xs font-bold text-teal-800 sm:gap-1.5 sm:px-3 sm:text-sm"><Navigation size={15} /><span>{distanceLabel}</span><span className="text-teal-500">·</span><span>{etaLabel}</span></div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><CarFront size={16} className="text-teal-600" />Driver</span><span className="inline-flex items-center gap-1.5"><MapPin size={16} className="text-indigo-600" />Passenger</span>{destination && <span className="inline-flex items-center gap-1.5"><Flag size={16} className="text-blue-600" />Destination</span>}{session.user.role === 'driver' && tripPhase === 'to_pickup' && <button type="button" onClick={() => setTripPhase('to_destination')} disabled={!destination} title={!destination ? 'Choose a destination first' : undefined} className="ml-auto rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-200" style={{ backgroundColor: destination ? '#2563eb' : '#e2e8f0', color: destination ? '#fff' : '#64748b' }}>Picked up passenger</button>}{session.user.role === 'driver' && <button type="button" onClick={completeTrip} disabled={completing} className="rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-200" style={{ backgroundColor: completing ? '#e2e8f0' : '#0d9488', color: completing ? '#64748b' : '#fff' }}>{completing ? 'Completing…' : 'Complete trip'}</button>}</div>
  </section>;
}
