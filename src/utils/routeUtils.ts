/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates the great-circle distance between two [lat, lng] coordinates in kilometers.
 */
export function getDistance(coord1: [number, number], coord2: [number, number]): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(coord2[0] - coord1[0]);
  const longitudeDelta = toRadians(coord2[1] - coord1[1]);
  const distancePart =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(coord1[0])) *
      Math.cos(toRadians(coord2[0])) *
      Math.sin(longitudeDelta / 2) ** 2;
  const boundedDistancePart = Math.min(1, Math.max(0, distancePart));
  return 6371 * 2 * Math.atan2(Math.sqrt(boundedDistancePart), Math.sqrt(1 - boundedDistancePart));
}

/**
 * Fetches an actual driving route between two points using the public OpenStreetMap OSRM API.
 */
export async function getDeliveryRoute(start: [number, number], end: [number, number]): Promise<[number, number][]> {
  const startLngLat = `${start[1]},${start[0]}`;
  const endLngLat = `${end[1]},${end[0]}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLngLat};${endLngLat}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates; // array of [longitude, latitude]
      if (Array.isArray(coords) && coords.length > 0) {
        return coords.map((c: number[]) => [c[1], c[0]]); // convert to [latitude, longitude]
      }
    }
    throw new Error(data.code === 'NoRoute' ? 'No driving route is available for these locations.' : 'Routing service returned no route.');
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Unable to fetch an actual road route from OSRM:', error);
    throw error;
  }
}

/**
 * Result shape returned by the Nominatim search API.
 */
export interface NominatimResult {
  lat: number;
  lng: number;
  displayName: string;
  barangay: string;
}

/**
 * Searches for locations using the OpenStreetMap Nominatim API,
 * bounded to the branch region for relevance.
 */
export async function searchLocations(query: string): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // Bounding box roughly covering the branch region
    const params = new URLSearchParams({
      q: `${query.trim()}`,
      limit: '6',
      bbox: '120.90,14.17,121.05,14.28'
    });

    const response = await fetch(
      `https://photon.komoot.io/api/?${params}`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Photon HTTP error: ${response.status}`);

    const data = await response.json();
    return data.features.map((item: any) => {
      const props = item.properties || {};
      const barangayRaw =
        props.district ||
        props.locality ||
        props.city ||
        props.name ||
        '';
      
      const barangay = barangayRaw ? `Brgy. ${barangayRaw.replace(/^Brgy\.?\s*/i, '')}` : '';
      const displayName = [props.name, props.district, props.city, props.state].filter(Boolean).join(', ');

      return {
        lat: item.geometry.coordinates[1],
        lng: item.geometry.coordinates[0],
        displayName: displayName,
        barangay,
      };
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Photon search failed:', error);
    return [];
  }
}

/**
 * Reverse geocodes a lat/lng pair using the Nominatim API.
 * Returns a structured address with barangay extracted.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; barangay: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
    });

    const response = await fetch(
      `https://photon.komoot.io/reverse?${params}`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Photon reverse HTTP error: ${response.status}`);

    const data = await response.json();
    const props = data.features?.[0]?.properties || {};

    const barangayRaw =
      props.district ||
      props.locality ||
      props.city ||
      props.name ||
      '';

    const barangay = barangayRaw ? `Brgy. ${barangayRaw.replace(/^Brgy\.?\s*/i, '')}` : '';
    const address = [props.name, props.district, props.city, props.state].filter(Boolean).join(', ');

    return { 
      address: address || `Pinned: [${lat.toFixed(5)}, ${lng.toFixed(5)}]`, 
      barangay 
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Nominatim reverse geocoding failed:', error);
    return {
      address: `[${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
      barangay: '',
    };
  }
}
