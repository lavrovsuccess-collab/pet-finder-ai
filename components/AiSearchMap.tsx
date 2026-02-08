import React, { useRef, useEffect } from 'react';
import type { PetReport } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface AiSearchMapProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  matchedPets: PetReport[];
  centerPet: PetReport;
  onPetClick?: (pet: PetReport) => void;
}

export const AiSearchMap: React.FC<AiSearchMapProps> = ({
  center,
  radiusKm,
  matchedPets,
  centerPet,
  onPetClick,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;

    const map = window.L.map(mapRef.current, { attributionControl: false, zoomControl: false });
    window.L.control.zoom({ position: 'bottomright' }).addTo(map);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    map.setView([center.lat, center.lng], 12);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    const circle = window.L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: '#6366f1',
      fillColor: '#6366f1',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const createIcon = (color: string) =>
      window.L.divIcon({
        className: 'ai-search-marker',
        html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

    const centerIcon = window.L.divIcon({
      className: 'ai-search-marker-center',
      html: `<div style="background:#6366f1;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const centerMarker = window.L.marker([center.lat, center.lng], { icon: centerIcon });
    centerMarker.addTo(map);
    markersRef.current.push(centerMarker);

    matchedPets.forEach((pet) => {
      if (!pet.lat || !pet.lng) return;
      const isLost = (pet.type || 'lost') === 'lost';
      const marker = window.L.marker([pet.lat, pet.lng], {
        icon: createIcon(isLost ? '#EF4444' : '#22C55E'),
      });
      marker.on('click', () => onPetClick?.(pet));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    const allLayers = [circleRef.current, ...markersRef.current];
    const group = window.L.featureGroup(allLayers);
    map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 14 });
  }, [center, radiusKm, matchedPets, onPetClick]);

  return (
    <div className="w-full h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div ref={mapRef} className="w-full h-full min-h-[280px]" />
    </div>
  );
};
