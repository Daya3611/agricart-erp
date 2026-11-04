import { GpsCoordinate, LocationCaptureStatus } from '@/types/field-activity';

export interface GeolocationResult {
  success: boolean;
  coords: GpsCoordinate | null;
  status: LocationCaptureStatus;
  error?: string;
}

// In-memory client geocode cache
const clientGeocodeCache = new Map<string, string>();

/**
 * Reverse geocode latitude and longitude into a human-readable place name.
 * Uses our internal rate-limited API route which connects to OpenStreetMap Nominatim.
 * Never throws or blocks if network is down or reverse geocoding fails.
 */
export async function reverseGeocodeLocation(lat: number, lon: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  // Check in-memory cache
  if (clientGeocodeCache.has(cacheKey)) {
    return clientGeocodeCache.get(cacheKey)!;
  }

  // Check localStorage cache if available
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`geo_${cacheKey}`);
      if (stored) {
        clientGeocodeCache.set(cacheKey, stored);
        return stored;
      }
    } catch { }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.placeName && data.placeName !== 'Location name unavailable') {
        clientGeocodeCache.set(cacheKey, data.placeName);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`geo_${cacheKey}`, data.placeName);
          } catch { }
        }
        return data.placeName;
      }
    }
  } catch (err) {
    // Graceful offline fallback
    console.debug('Reverse geocode request completed with offline fallback:', err);
  }

  return 'Location name unavailable';
}

/**
 * Real GPS capture using browser Geolocation API.
 * Automatically reverse geocodes coordinates to obtain human-readable place name.
 * Never fabricates coordinates if permission is denied or location is unavailable.
 */
export async function captureCurrentGps(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
): Promise<GeolocationResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      success: false,
      coords: null,
      status: 'unavailable',
      error: 'Geolocation is not supported by your browser or device.',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = Number(pos.coords.latitude.toFixed(6));
        const longitude = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);
        const isoNow = new Date(pos.timestamp || Date.now()).toISOString();

        // Attempt reverse geocoding in background with fallback
        let placeName = 'Location name unavailable';
        try {
          placeName = await reverseGeocodeLocation(latitude, longitude);
        } catch {
          placeName = 'Location name unavailable';
        }

        const coords: GpsCoordinate = {
          latitude,
          longitude,
          accuracy,
          placeName,
          capturedAt: isoNow,
          timestamp: isoNow,
          altitude: pos.coords.altitude !== null ? Number(pos.coords.altitude.toFixed(1)) : null,
          heading: pos.coords.heading !== null ? Math.round(pos.coords.heading) : null,
          speed: pos.coords.speed !== null ? Number(pos.coords.speed.toFixed(1)) : null,
        };

        resolve({
          success: true,
          coords,
          status: 'captured',
        });
      },
      (err) => {
        let status: LocationCaptureStatus = 'unavailable';
        let errorMsg = 'Failed to capture GPS location.';

        if (err.code === err.PERMISSION_DENIED) {
          status = 'denied';
          errorMsg = 'Location permission was denied. Please allow location access in your browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          status = 'unavailable';
          errorMsg = 'Location information is unavailable on this device or network.';
        } else if (err.code === err.TIMEOUT) {
          status = 'unavailable';
          errorMsg = 'Location request timed out. Please check signal and retry.';
        }

        resolve({
          success: false,
          coords: null,
          status,
          error: errorMsg,
        });
      },
      options
    );
  });
}

/**
 * Format captured timestamp into 12-hour local time (e.g. "11:07 PM")
 */
export function formatCapturedTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

/**
 * Format structured GPS Location Details for UI cards.
 * Returns place name, coordinates, accuracy in ±X m, and formatted capture time.
 */
export function formatGpsDisplay(coords?: GpsCoordinate | null): {
  placeName: string;
  coordinates: string;
  accuracy: string;
  capturedTime: string;
} {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return {
      placeName: 'Location not captured',
      coordinates: '—',
      accuracy: '—',
      capturedTime: '—',
    };
  }

  const placeName = coords.placeName && coords.placeName.trim()
    ? coords.placeName
    : 'Location name unavailable';

  const coordinates = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  const accuracy = coords.accuracy ? `±${coords.accuracy} m` : 'Accuracy unavailable';
  const capturedTime = formatCapturedTime(coords.capturedAt || coords.timestamp);

  return {
    placeName,
    coordinates,
    accuracy,
    capturedTime,
  };
}

/**
 * Format GPS coordinate into a human-readable string.
 */
export function formatGpsCoordinates(coords?: GpsCoordinate | null): string {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return 'Not captured';
  }
  const latDir = coords.latitude >= 0 ? 'N' : 'S';
  const lonDir = coords.longitude >= 0 ? 'E' : 'W';
  const latStr = Math.abs(coords.latitude).toFixed(4);
  const lonStr = Math.abs(coords.longitude).toFixed(4);
  const acc = coords.accuracy ? ` (±${coords.accuracy}m)` : '';
  return `${latStr}° ${latDir}, ${lonStr}° ${lonDir}${acc}`;
}

/**
 * Format GPS into compact string for tables/PDF.
 */
export function formatGpsCompact(coords?: GpsCoordinate | null): string {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return '—';
  }
  return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

/**
 * Generate Google Maps link for given coordinates.
 */
export function getGoogleMapsUrl(coords?: GpsCoordinate | null): string | null {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return null;
  }
  return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
}
