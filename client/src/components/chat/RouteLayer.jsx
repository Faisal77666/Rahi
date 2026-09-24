import { Polyline } from 'react-leaflet';

export default function RouteLayer({ geometry }) {
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const positions = geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  return <Polyline positions={positions} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.88, lineCap: 'round', lineJoin: 'round' }} />;
}
