import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory cache for reverse geocoding results
// Key: lat_3decimals,lon_3decimals (approx 110m radius)
const geocodeCache = new Map<string, { placeName: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate-limiting helper for Nominatim (max 1 req/sec)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100;

function cleanPlaceName(data: any): string {
  if (!data) return 'Location name unavailable';

  const address = data.address || {};
  const local =
    address.village ||
    address.suburb ||
    address.hamlet ||
    address.neighbourhood ||
    address.town ||
    address.city ||
    address.locality ||
    address.road;

  const district =
    address.state_district ||
    address.county ||
    address.district ||
    address.city_district;

  const state = address.state;
  const country = address.country || 'India';

  const parts = [local, district, state, country].filter(
    (item, index, self) => Boolean(item) && self.indexOf(item) === index
  );

  if (parts.length >= 2) {
    return parts.join(', ');
  }

  // Fallback to display_name chunks
  if (data.display_name) {
    const segments = data.display_name
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    // Take first 3-4 segments
    return segments.slice(0, Math.min(4, segments.length)).join(', ');
  }

  return 'Location name unavailable';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');

    if (!latStr || !lonStr) {
      return NextResponse.json({
        success: false,
        placeName: 'Location name unavailable',
        error: 'Missing lat or lon parameters',
      });
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({
        success: false,
        placeName: 'Location name unavailable',
        error: 'Invalid coordinates',
      });
    }

    // Cache key rounded to 3 decimal places (~110 meters)
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        placeName: cached.placeName,
        cached: true,
      });
    }

    // Rate limiting delay
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();

    // Fetch from OpenStreetMap Nominatim with required User-Agent
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4 second timeout

    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'AgricartERP/1.0 (info@agricartfpc.in; Field Activity Tracking)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        placeName: 'Location name unavailable',
      });
    }

    const data = await res.json();
    const placeName = cleanPlaceName(data);

    // Save to cache
    geocodeCache.set(cacheKey, { placeName, timestamp: Date.now() });

    return NextResponse.json({
      success: true,
      placeName,
      raw: data.address || null,
    });
  } catch (err: any) {
    // If request aborts or errors, never fail with 500 - gracefully return "Location name unavailable"
    return NextResponse.json({
      success: false,
      placeName: 'Location name unavailable',
      error: err.message,
    });
  }
}
