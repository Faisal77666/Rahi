const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';
const ORS_GEOCODING_URL = 'https://api.openrouteservice.org/geocode/search';

const coordinatesFrom = (value) => {
  if (typeof value !== 'string') return null;
  const [latValue, lngValue] = value.split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(latValue) || !Number.isFinite(lngValue) || latValue < -90 || latValue > 90 || lngValue < -180 || lngValue > 180) return null;
  return { lat: latValue, lng: lngValue };
};

const orsKey = (res) => {
  if (process.env.ORS_API_KEY) return process.env.ORS_API_KEY;
  res.status(503).json({ message: 'Map routing is not configured yet. Add ORS_API_KEY to the server .env file.' });
  return null;
};

const orsFailure = (response, res, fallbackMessage) => {
  if (response.status === 429) return res.status(429).json({ message: 'The map service daily quota has been reached. Please try again later.' });
  if (response.status === 401) return res.status(503).json({ message: 'Map service is unavailable due to its server configuration.' });
  if (response.status === 403) return res.status(503).json({ message: 'OpenRouteService rejected the configured key. Verify the ORS account and create a key with Directions and Geocoding access.' });
  return res.status(502).json({ message: fallbackMessage });
};

exports.getRoute = async (req, res) => {
  const from = coordinatesFrom(req.query.from);
  const to = coordinatesFrom(req.query.to);
  if (!from || !to) return res.status(400).json({ message: 'Use valid from and to coordinates in lat,lng format.' });
  const key = orsKey(res);
  if (!key) return undefined;

  try {
    const url = new URL(ORS_DIRECTIONS_URL);
    // ORS Core 9.9 basic GET Directions accepts only profile, start and end.
    url.search = new URLSearchParams({ start: `${from.lng},${from.lat}`, end: `${to.lng},${to.lat}` }).toString();
    const response = await fetch(url, { headers: { Authorization: key, Accept: 'application/json, application/geo+json' } });
    if (!response.ok) console.warn('[Rahi maps] ORS directions request failed.', { status: response.status });
    if (!response.ok) return orsFailure(response, res, 'Unable to calculate a driving route right now.');
    const data = await response.json();
    const route = data.features?.[0];
    const summary = route?.properties?.summary;
    if (!route?.geometry || !summary) return res.status(404).json({ message: 'No drivable route was found for these locations.' });
    return res.status(200).json({
      route: {
        geometry: route.geometry,
        distance: summary.distance,
        duration: summary.duration,
        steps: (route.properties?.segments || []).flatMap((segment) => segment.steps || []).map((step) => ({
          instruction: step.instruction || 'Continue',
          distance: step.distance,
          duration: step.duration,
          maneuver: step.type,
        })),
      },
    });
  } catch (error) {
    return res.status(502).json({ message: 'Unable to reach the map routing service right now.' });
  }
};

exports.searchPlaces = async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2) return res.status(200).json({ suggestions: [] });
  const key = orsKey(res);
  if (!key) return undefined;

  try {
    const url = new URL(ORS_GEOCODING_URL);
    url.search = new URLSearchParams({ text: query, 'boundary.country': 'PK', size: '5' }).toString();
    const response = await fetch(url, { headers: { Authorization: key, Accept: 'application/json' } });
    if (!response.ok) console.warn('[Rahi maps] ORS geocoding request failed.', { status: response.status });
    if (!response.ok) return orsFailure(response, res, 'Unable to search places right now.');
    const data = await response.json();
    return res.status(200).json({
      suggestions: (data.features || []).map((feature) => ({
        id: feature.properties?.id || feature.properties?.gid || feature.properties?.label,
        name: feature.properties?.name || feature.properties?.label,
        address: feature.properties?.label || feature.properties?.locality || '',
        lat: feature.geometry?.coordinates?.[1],
        lng: feature.geometry?.coordinates?.[0],
      })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    });
  } catch (error) {
    return res.status(502).json({ message: 'Unable to reach the place search service right now.' });
  }
};
