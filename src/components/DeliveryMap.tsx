/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Branch, Delivery } from '../types';
import { getDeliveryRoute, searchLocations, reverseGeocode, NominatimResult } from '../utils/routeUtils';

interface DeliveryMapProps {
  activeDelivery: Delivery | null;
  onMapClick?: (lat: number, lng: number) => void;
  // Must be dynamic: any registered branch name -> [lat, lng]
  branchCoordinates: Record<string, [number, number]>;
  height?: string;
  showSearch?: boolean;
  onLocationSelected?: (lat: number, lng: number, address: string, barangay: string) => void;
}

export default function DeliveryMap({
  activeDelivery,
  onMapClick,
  branchCoordinates,
  height,
  showSearch = false,
  onLocationSelected,
}: DeliveryMapProps) {
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Custom references to avoid tearing down and recreating all Leaflet elements on every tick
  const branchMarkersRef = useRef<L.Marker[]>([]);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const driverAccuracyCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeShadowRef = useRef<L.Polyline | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeError, setRouteError] = useState('');
  const [liveGpsUpdate, setLiveGpsUpdate] = useState<{
    deliveryId: string;
    coordinates: [number, number];
    updatedAt: string;
    accuracyMeters: number | null;
    etaMinutes: number;
  } | null>(null);
  const lastRouteRequestRef = useRef<{ deliveryId: string; requestedAt: number; isLive: boolean } | null>(null);
  const routeRequestGenerationRef = useRef(0);

  // Interactive configurations
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'truck' | 'tricycle'>('motorcycle');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchPinRef = useRef<L.Marker | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mapDelivery = activeDelivery && liveGpsUpdate?.deliveryId === activeDelivery.id
    ? {
        ...activeDelivery,
        driverCoordinates: liveGpsUpdate.coordinates,
        driverLocationUpdatedAt: liveGpsUpdate.updatedAt,
        driverLocationAccuracyMeters: liveGpsUpdate.accuracyMeters,
        etaMinutes: liveGpsUpdate.etaMinutes,
      }
    : activeDelivery;
  const driverLocationAgeMs = mapDelivery?.driverLocationUpdatedAt
    ? Date.now() - new Date(mapDelivery.driverLocationUpdatedAt).getTime()
    : null;
  const gpsStatus = driverLocationAgeMs === null
    ? 'Waiting for GPS'
    : driverLocationAgeMs > 30000
      ? 'GPS stale'
      : driverLocationAgeMs > 10000
        ? 'GPS delayed'
        : (mapDelivery?.driverLocationAccuracyMeters ?? Infinity) > 100
          ? 'Low accuracy'
          : 'GPS live';

  useEffect(() => {
    if (!activeDelivery || activeDelivery.status !== 'Out for Delivery') {
      setLiveGpsUpdate(null);
      return;
    }

    let isActive = true;
    let isRequestInFlight = false;
    const refreshGps = async () => {
      if (isRequestInFlight) return;
      const token = localStorage.getItem('silang_auth_token');
      if (!token) return;
      isRequestInFlight = true;

      try {
        const response = await fetch(`/api/deliveries/${encodeURIComponent(activeDelivery.id)}/location`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!isActive || !result?.driverLocationUpdatedAt || !Array.isArray(result.driverCoordinates)) return;
        setLiveGpsUpdate({
          deliveryId: activeDelivery.id,
          coordinates: [Number(result.driverCoordinates[0]), Number(result.driverCoordinates[1])],
          updatedAt: result.driverLocationUpdatedAt,
          accuracyMeters: result.driverLocationAccuracyMeters == null ? null : Number(result.driverLocationAccuracyMeters),
          etaMinutes: Number(result.etaMinutes),
        });
      } catch {
        // Keep the last confirmed GPS fix visible during temporary network loss.
      } finally {
        isRequestInFlight = false;
      }
    };

    void refreshGps();
    const intervalId = window.setInterval(refreshGps, 2000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [activeDelivery?.id, activeDelivery?.status]);

  // Store the onMapClick callback in a ref to avoid recreating the map when it changes
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const onLocationSelectedRef = useRef(onLocationSelected);
  useEffect(() => {
    onLocationSelectedRef.current = onLocationSelected;
  }, [onLocationSelected]);

  // Keep track of fitted states to prevent jarring map view resets on every GPS tick
  const lastFittedRef = useRef<{ id: string; status: string } | null>(null);

  // Initialize Map exactly ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Dynamic center: center between registered branch coordinates (fallback to Silang defaults only if none exist)
    const coords = Object.values(branchCoordinates || {}).filter(
      (c) => Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1])
    );
    const centerLat = coords.length ? coords.reduce((s, c) => s + c[0], 0) / coords.length : 14.2238;
    const centerLng = coords.length ? coords.reduce((s, c) => s + c[1], 0) / coords.length : 120.9747;


    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      scrollWheelZoom: true,
    });

    mapRef.current = map;
    setIsMapLoaded(true);

    // Click handler for creating deliveries: calls the latest callback ref if it's currently defined
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
      // If search mode is enabled, also reverse geocode and fire onLocationSelected
      if (onLocationSelectedRef.current) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        reverseGeocode(lat, lng).then(({ address, barangay }) => {
          if (onLocationSelectedRef.current) {
            onLocationSelectedRef.current(lat, lng, address, barangay);
          }
        });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsMapLoaded(false);
      }
    };
  }, []);

  // Keep Leaflet sized correctly when the container is resized or put into fullscreen.
  useEffect(() => {
    const resizeMap = () => {
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    };

    const observer = mapContainerRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resizeMap)
      : null;

    if (mapContainerRef.current) observer?.observe(mapContainerRef.current);
    window.addEventListener('resize', resizeMap);

    resizeMap();
    const resizeTimer = window.setTimeout(resizeMap, 150);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resizeMap);
      window.clearTimeout(resizeTimer);
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const wrapper = mapWrapperRef.current;
    if (!wrapper) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }

    setIsFullscreen(true);
    try {
      if (wrapper.requestFullscreen) {
        await wrapper.requestFullscreen();
      }
    } catch {
      // CSS fullscreen remains available when the browser blocks the native API.
    }
  }, []);

  const closeFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    } else {
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenActive = Boolean(document.fullscreenElement);
      setIsFullscreen(fullscreenActive);
      requestAnimationFrame(() => mapRef.current?.invalidateSize(true));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isFullscreen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // Tile layer manager
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let url = '';
    let attribution = '';
    if (mapLayer === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }

    const tileLayer = L.tileLayer(url, {
      attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
  }, [mapLayer, isMapLoaded]);

  // Recalculate the real road route from the latest rider GPS fix to the order destination.
  useEffect(() => {
    if (!mapDelivery) {
      setRouteCoords([]);
      setRouteError('');
      lastRouteRequestRef.current = null;
      routeRequestGenerationRef.current += 1;
      return;
    }
    const hasLiveLocation = Boolean(mapDelivery.driverLocationUpdatedAt) &&
      mapDelivery.status === 'Out for Delivery';
    const start = hasLiveLocation
      ? mapDelivery.driverCoordinates
      : branchCoordinates[mapDelivery.branch];
    const end = mapDelivery.coordinates;

    // Skip OSRM call if coordinates are missing or invalid
    const isValid = (c: [number, number]) =>
      Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1]);
    if (!isValid(start) || !isValid(end)) {
      setRouteCoords([]);
      setRouteError('A valid rider or customer location is not available.');
      routeRequestGenerationRef.current += 1;
      return;
    }

    const now = Date.now();
    const previousRequest = lastRouteRequestRef.current;
    const isNewDelivery = previousRequest?.deliveryId !== mapDelivery.id;
    const locationJustBecameLive = hasLiveLocation && !previousRequest?.isLive;
    if (!isNewDelivery && !locationJustBecameLive && now - previousRequest.requestedAt < 15000) return;

    lastRouteRequestRef.current = { deliveryId: mapDelivery.id, requestedAt: now, isLive: hasLiveLocation };
    if (isNewDelivery || locationJustBecameLive) setRouteCoords([]);
    const requestGeneration = ++routeRequestGenerationRef.current;
    setRouteError('');
    getDeliveryRoute(start, end).then((coords) => {
      if (routeRequestGenerationRef.current === requestGeneration) setRouteCoords(coords);
    }).catch((error: unknown) => {
      if (routeRequestGenerationRef.current !== requestGeneration) return;
      setRouteCoords([]);
      setRouteError(error instanceof Error ? error.message : 'Unable to load the driving route.');
    });
  }, [
    mapDelivery?.id,
    mapDelivery?.branch,
    mapDelivery?.coordinates,
    mapDelivery?.driverCoordinates,
    mapDelivery?.driverLocationUpdatedAt,
    mapDelivery?.status,
    liveGpsUpdate?.coordinates,
    liveGpsUpdate?.updatedAt,
    branchCoordinates,
  ]);

  useEffect(() => {
    if (!isMapLoaded || !mapDelivery || !mapDelivery.driverLocationUpdatedAt ||
      mapDelivery.status !== 'Out for Delivery') {
      driverAccuracyCircleRef.current?.remove();
      driverAccuracyCircleRef.current = null;
      return;
    }

    const coords = mapDelivery.driverCoordinates;
    if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
    const accuracyMeters = mapDelivery.driverLocationAccuracyMeters;
    if (accuracyMeters == null || !Number.isFinite(accuracyMeters) || accuracyMeters <= 0) return;

    if (!driverAccuracyCircleRef.current) {
      driverAccuracyCircleRef.current = L.circle(coords, {
        radius: accuracyMeters,
        color: '#f97316',
        weight: 1,
        fillColor: '#fb923c',
        fillOpacity: 0.12,
      }).addTo(mapRef.current!);
    } else {
      driverAccuracyCircleRef.current.setLatLng(coords);
      driverAccuracyCircleRef.current.setRadius(accuracyMeters);
    }
  }, [
    isMapLoaded,
    mapDelivery?.id,
    mapDelivery?.status,
    mapDelivery?.driverCoordinates,
    mapDelivery?.driverLocationUpdatedAt,
    mapDelivery?.driverLocationAccuracyMeters,
    liveGpsUpdate?.coordinates,
    liveGpsUpdate?.updatedAt,
    liveGpsUpdate?.accuracyMeters,
  ]);

  // 1. Create/Sync Static Branch Markers
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    branchMarkersRef.current.forEach((m) => m.remove());
    branchMarkersRef.current = [];


    const isValidCoord = (c: [number, number]) =>
      Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1]);

    const branchIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-blue-600 rounded-full opacity-30 animate-ping"></div>
          <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg font-bold text-xs">
            🏪
          </div>
          <div class="absolute -bottom-6 bg-blue-900 text-white text-[10px] px-1 py-0.5 rounded font-bold whitespace-nowrap shadow">
            Branch
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Render markers for ALL provided branches (no hardcoded Poblacion/Bypass)
    Object.entries(branchCoordinates).forEach(([branchName, coords]) => {
      if (!isValidCoord(coords)) {
        console.warn('DeliveryMap: skipping branch marker — invalid coordinates', branchName, coords);
        return;
      }

      const marker = L.marker(coords, { icon: branchIcon })
        .bindPopup(`<b>Silang Mini Mart - ${branchName}</b><br>Registered Store Branch`)
        .addTo(map);

      branchMarkersRef.current.push(marker);
    });

    return () => {
      branchMarkersRef.current.forEach((m) => m.remove());
      branchMarkersRef.current = [];
    };
  }, [isMapLoaded, branchCoordinates]);

  // 2. Active Delivery Destination & Path Setup
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (routeShadowRef.current) {
      routeShadowRef.current.remove();
      routeShadowRef.current = null;
    }

    if (mapDelivery) {
      const branchCoords = branchCoordinates[mapDelivery.branch];
      const customerCoords = mapDelivery.coordinates;

      // Guard: skip map rendering if any coordinate is NaN or missing
      const isValidCoord = (c: [number, number]) =>
        Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1]);

      const liveDriverCoords = mapDelivery.driverLocationUpdatedAt &&
        mapDelivery.status === 'Out for Delivery'
        ? mapDelivery.driverCoordinates
        : null;
      if (!isValidCoord(customerCoords) || (!liveDriverCoords && !isValidCoord(branchCoords))) {
        console.warn('DeliveryMap: skipping render — invalid coordinates', { branchCoords, customerCoords });
        return;
      }

      const customerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg text-sm">
              🏠
            </div>
            <div class="absolute -bottom-6 bg-green-800 text-white text-[10px] px-1 py-0.5 rounded font-bold whitespace-nowrap shadow">
              Customer
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      customerMarkerRef.current = L.marker(customerCoords, { icon: customerIcon })
        .bindPopup(`<b>Customer: ${mapDelivery.customerName}</b><br>${mapDelivery.address}`)
        .addTo(map);

      // Draw the neon road path
      const pathPoints = routeCoords.length > 0
        ? liveDriverCoords
          ? [liveDriverCoords, ...routeCoords.slice(1)]
          : routeCoords
        : [liveDriverCoords || branchCoords, customerCoords];

      routeShadowRef.current = L.polyline(pathPoints, {
        color: '#3b82f6',
        weight: 8,
        opacity: 0.35,
        className: 'route-glow-path',
      }).addTo(map);

      routePolylineRef.current = L.polyline(pathPoints, {
        color: mapLayer === 'satellite' ? '#ffeb3b' : '#0052cc',
        weight: 4,
        opacity: 0.9,
        className: 'route-main-path',
      }).addTo(map);

      // Fit map bounds (only when the active delivery ID changes, to prevent viewport reset)
      const shouldFit = !lastFittedRef.current ||
        lastFittedRef.current.id !== mapDelivery.id ||
        (Boolean(liveDriverCoords) && lastFittedRef.current.status !== 'LIVE');
      if (shouldFit) {
        map.fitBounds(pathPoints, { padding: [50, 50] });
        lastFittedRef.current = { id: mapDelivery.id, status: liveDriverCoords ? 'LIVE' : mapDelivery.status };
      }
    } else {
      // Fit to show both branches if no active delivery
      const shouldFitAll = !lastFittedRef.current || lastFittedRef.current.id !== 'NONE';
      if (shouldFitAll) {
        const points = Object.values(branchCoordinates).filter(
          (c) => Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1])
        );
        if (points.length >= 2) {
          map.fitBounds(points, { padding: [80, 80] });
        } else if (points.length === 1) {
          map.setView(points[0], 16, { animate: true });
        }
        lastFittedRef.current = { id: 'NONE', status: 'NONE' };
      }
    }

    return () => {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.remove();
        customerMarkerRef.current = null;
      }
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      if (routeShadowRef.current) {
        routeShadowRef.current.remove();
        routeShadowRef.current = null;
      }
    };
  }, [isMapLoaded, activeDelivery?.id, routeCoords, mapLayer, branchCoordinates]);

  useEffect(() => {
    if (!mapDelivery?.driverLocationUpdatedAt || mapDelivery.status !== 'Out for Delivery') return;
    const driverCoords = mapDelivery.driverCoordinates;
    const customerCoords = mapDelivery.coordinates;
    const isValidCoord = (coord: [number, number]) =>
      Array.isArray(coord) && coord.length === 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
    if (!isValidCoord(driverCoords) || !isValidCoord(customerCoords)) return;

    const pathPoints = routeCoords.length > 1
      ? [driverCoords, ...routeCoords.slice(1)]
      : [driverCoords, customerCoords];
    routePolylineRef.current?.setLatLngs(pathPoints);
    routeShadowRef.current?.setLatLngs(pathPoints);
    if (lastFittedRef.current?.id !== mapDelivery.id || lastFittedRef.current.status !== 'LIVE') {
      mapRef.current?.fitBounds(pathPoints, { padding: [50, 50] });
      lastFittedRef.current = { id: mapDelivery.id, status: 'LIVE' };
    }
  }, [
    mapDelivery?.id,
    mapDelivery?.driverCoordinates,
    mapDelivery?.driverLocationUpdatedAt,
    mapDelivery?.coordinates,
    mapDelivery?.status,
    liveGpsUpdate?.coordinates,
    liveGpsUpdate?.updatedAt,
    routeCoords,
  ]);

  // 3. Driver marker stays on the latest confirmed GPS fix.
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const showDriver = mapDelivery?.driverLocationUpdatedAt &&
      (mapDelivery.status === 'Out for Delivery' || mapDelivery.status === 'Delivered');

    const vehicleEmoji = vehicleType === 'truck' ? '🚚' : vehicleType === 'tricycle' ? '🛺' : '🏍️';
    const vehicleName = vehicleType === 'truck' ? 'Cargo Van' : vehicleType === 'tricycle' ? 'Tricycle' : 'Motor Rider';

    const driverIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-orange-500 rounded-full opacity-30 animate-pulse"></div>
          <div class="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg text-sm hover:scale-125 transition-all">
            ${vehicleEmoji}
          </div>
          <div class="absolute -bottom-6 bg-orange-800 text-white text-[10px] px-1 py-0.5 rounded font-bold whitespace-nowrap shadow">
            ${vehicleName}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (showDriver && mapDelivery) {
      const driverCoords = mapDelivery.driverCoordinates;
      const isValidCoord = (c: [number, number]) =>
        Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1]);

      if (!isValidCoord(driverCoords)) {
        console.warn('DeliveryMap: skipping driver marker — invalid driverCoordinates', driverCoords);
      } else {
        const lastUpdate = mapDelivery.driverLocationUpdatedAt
          ? new Date(mapDelivery.driverLocationUpdatedAt).toLocaleTimeString()
          : 'Unknown';
        const accuracy = mapDelivery.driverLocationAccuracyMeters;
        const popupText = `<b>Rider GPS</b><br>Vehicle: ${vehicleName}<br>Status: ${mapDelivery.status}<br>GPS accuracy: ${accuracy != null ? `±${Math.round(accuracy)} m` : 'Unknown'}<br>Last update: ${lastUpdate}<br>ETA estimate: ${mapDelivery.etaMinutes} mins`;

        if (!driverMarkerRef.current) {
          driverMarkerRef.current = L.marker(driverCoords, { icon: driverIcon })
            .bindPopup(popupText)
            .addTo(map);
        } else {
          driverMarkerRef.current.setIcon(driverIcon);
          driverMarkerRef.current.setPopupContent(popupText);
          driverMarkerRef.current.setLatLng(driverCoords);
        }
      }
    } else {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      driverAccuracyCircleRef.current?.remove();
      driverAccuracyCircleRef.current = null;
    }
  }, [
    isMapLoaded,
    mapDelivery?.id,
    mapDelivery?.status,
    mapDelivery?.driverCoordinates,
    mapDelivery?.driverLocationUpdatedAt,
    mapDelivery?.etaMinutes,
    mapDelivery?.driverLocationAccuracyMeters,
    liveGpsUpdate?.coordinates,
    liveGpsUpdate?.updatedAt,
    vehicleType
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      if (driverAccuracyCircleRef.current) {
        driverAccuracyCircleRef.current.remove();
        driverAccuracyCircleRef.current = null;
      }
    };
  }, []);

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    const results = await searchLocations(query);
    setSearchResults(results);
    setShowResults(results.length > 0);
    setIsSearching(false);
  }, []);

  // Debounced search on input change
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      handleSearch(value);
    }, 400);
  }, [handleSearch]);

  // Handle selecting a search result
  const handleSelectResult = useCallback((result: NominatimResult) => {
    const map = mapRef.current;
    if (!map) return;

    map.setView([result.lat, result.lng], 17, { animate: true });

    // Place a pin marker
    if (searchPinRef.current) {
      searchPinRef.current.remove();
    }
    const pinIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-red-500 rounded-full opacity-30 animate-ping"></div>
          <div class="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg text-sm">
            📍
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    searchPinRef.current = L.marker([result.lat, result.lng], { icon: pinIcon }).addTo(map);

    // Fire callbacks
    if (onMapClickRef.current) {
      onMapClickRef.current(result.lat, result.lng);
    }
    if (onLocationSelectedRef.current) {
      onLocationSelectedRef.current(result.lat, result.lng, result.displayName, result.barangay);
    }

    setShowResults(false);
    setSearchQuery(result.displayName.split(',').slice(0, 2).join(','));
  }, []);

  // Cleanup search pin on unmount
  useEffect(() => {
    return () => {
      if (searchPinRef.current) {
        searchPinRef.current.remove();
        searchPinRef.current = null;
      }
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={mapWrapperRef}
      className={`delivery-map-fullscreen relative overflow-hidden border border-slate-200 shadow-sm bg-slate-50 transition-all duration-300 ${
      isFullscreen
        ? 'fixed inset-0 z-[9999] h-[100dvh] w-screen rounded-none'
        : 'h-full w-full rounded-xl'
    }`}
    >
      <div
        id="map-container"
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full"
        style={!isFullscreen && height && height !== '100%' ? { minHeight: height } : undefined}
      />
      
      {/* Dynamic Layer Switcher & Fullscreen Map Control overlay (Left Corner) */}
      <div className="absolute top-2 left-2 flex flex-col gap-2 z-[1000]">
        <div className="bg-white/95 backdrop-blur px-1.5 py-1 rounded-xl shadow-md border border-slate-100 flex gap-1 items-center">
          <button
            type="button"
            onClick={() => setMapLayer('street')}
            className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
              mapLayer === 'street'
                ? 'bg-orange-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🗺️ Street
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('satellite')}
            className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
              mapLayer === 'satellite'
                ? 'bg-orange-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🛰️ Satellite
          </button>
        </div>

        <button
          type="button"
          onClick={isFullscreen ? closeFullscreen : toggleFullscreen}
          className="bg-white/95 backdrop-blur text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-md border border-slate-100 flex items-center justify-center gap-1 cursor-pointer w-fit"
          aria-label={isFullscreen ? 'Close fullscreen map' : 'Open map fullscreen'}
        >
          {isFullscreen ? '❌ Close Fullscreen' : '📺 Fullscreen View'}
        </button>

      </div>

      {mapDelivery?.status === 'Out for Delivery' && (
        <div className={`absolute bottom-3 left-3 z-[1001] rounded-lg border px-3 py-2 text-xs shadow ${
          gpsStatus === 'GPS live'
            ? 'border-emerald-200 bg-white/95 text-emerald-900'
            : gpsStatus === 'Low accuracy' || gpsStatus === 'GPS delayed'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-red-200 bg-red-50 text-red-900'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            <span className={`h-2 w-2 rounded-full ${
              gpsStatus === 'GPS live' ? 'bg-emerald-500' :
              gpsStatus === 'Low accuracy' || gpsStatus === 'GPS delayed' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            {gpsStatus}
            {mapDelivery.driverLocationAccuracyMeters != null &&
              ` · ±${Math.round(mapDelivery.driverLocationAccuracyMeters)} m`}
          </div>
          <div className="mt-0.5 text-[10px] opacity-75">
            {mapDelivery.driverLocationUpdatedAt
              ? `Last fix ${new Date(mapDelivery.driverLocationUpdatedAt).toLocaleTimeString()}`
              : 'Waiting for the rider’s first device location'}
          </div>
        </div>
      )}
      {mapDelivery?.status === 'Out for Delivery' && mapDelivery.driverLocationUpdatedAt && routeError && (
        <div className="absolute top-12 left-3 z-[1001] max-w-[85%] rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow">
          Road route unavailable: {routeError}. The rider marker still follows live GPS.
        </div>
      )}

      {/* Search Overlay */}
      {showSearch && (
        <div className="absolute top-2 right-2 z-[1001] w-64 sm:w-72">
          <div className="relative">
            <div className="flex items-center bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <span className="pl-3 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Hanapin ang lokasyon..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch(searchQuery);
                  }
                }}
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                className="flex-1 px-2 py-2 text-xs text-slate-700 bg-transparent outline-none placeholder:text-slate-400 font-medium"
              />
              {isSearching && (
                <div className="pr-3">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowResults(false);
                    if (searchPinRef.current) {
                      searchPinRef.current.remove();
                      searchPinRef.current = null;
                    }
                  }}
                  className="pr-3 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="mt-1 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-[200px] overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer"
                  >
                    <p className="text-[11px] font-semibold text-slate-700 line-clamp-1">
                      📍 {result.displayName.split(',').slice(0, 2).join(',')}
                    </p>
                    <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">
                      {result.displayName}
                    </p>
                    {result.barangay && (
                      <span className="inline-block mt-1 text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                        {result.barangay}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend details (Right corner) - only show when search is not active */}
      {!showSearch && (
        <div className="absolute top-2 right-2 hidden bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 shadow-md border border-slate-100 pointer-events-none z-10 sm:block">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>Store Branches</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span>
            <span>Customer Destination</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
            <span>Active Delivery Rider</span>
          </div>
        </div>
      )}

      {/* Interactive Vehicle Selection Tool */}
      {activeDelivery && (activeDelivery.status === 'Out for Delivery' || activeDelivery.status === 'Delivered') && (
        <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur p-2 rounded-xl text-[10px] font-bold text-slate-600 shadow-md border border-slate-100 z-10 space-y-1">
          <div className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest text-center leading-none">Vehicle type:</div>
          <div className="flex gap-1 justify-center">
            <button
              type="button"
              onClick={() => setVehicleType('motorcycle')}
              className={`p-1.5 rounded-lg text-sm transition-transform active:scale-95 ${
                vehicleType === 'motorcycle' ? 'bg-orange-100 border border-orange-300' : 'hover:bg-slate-100'
              }`}
              title="Motorcycle (Standard)"
            >
              🏍️
            </button>
            <button
              type="button"
              onClick={() => setVehicleType('truck')}
              className={`p-1.5 rounded-lg text-sm transition-transform active:scale-95 ${
                vehicleType === 'truck' ? 'bg-orange-100 border border-orange-300' : 'hover:bg-slate-100'
              }`}
              title="Cargo Van / Truck"
            >
              🚚
            </button>
            <button
              type="button"
              onClick={() => setVehicleType('tricycle')}
              className={`p-1.5 rounded-lg text-sm transition-transform active:scale-95 ${
                vehicleType === 'tricycle' ? 'bg-orange-100 border border-orange-300' : 'hover:bg-slate-100'
              }`}
              title="Silang Tricycle"
            >
              🛺
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur px-2.5 py-1 rounded text-[10px] text-slate-400 font-mono shadow border border-slate-100 pointer-events-none z-10">
        GPS Map • {mapLayer === 'street' ? 'OpenStreetMap' : 'Satellite Imagery'}
      </div>

    </div>
  );
}
