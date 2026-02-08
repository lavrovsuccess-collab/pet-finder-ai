import React, { useRef, useEffect, useMemo } from 'react';
import type { PetReport } from '../types';

// Declare Leaflet on window
declare global {
  interface Window {
    L: any;
  }
}

interface MapViewProps {
  reports: PetReport[];
  onPetClick: (pet: PetReport) => void;
  filterType: 'all' | 'lost' | 'found';
  setFilterType: (v: 'all' | 'lost' | 'found') => void;
  speciesFilter: string;
  setSpeciesFilter: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  userLocation: { lat: number; lng: number } | null;
  isLocatingUser: boolean;
  onUseMyLocation: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  reports, onPetClick,
  filterType, setFilterType,
  speciesFilter, setSpeciesFilter,
  dateFilter, setDateFilter,
  userLocation,
  isLocatingUser, onUseMyLocation
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const activePets = useMemo(() => reports.filter(p => p.lat && p.lng), [reports]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;
    const map = window.L.map(mapRef.current, { attributionControl: false, zoomControl: false });
    window.L.control.attribution({ prefix: false }).addTo(map);
    window.L.control.zoom({ position: 'bottomright' }).addTo(map);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    map.setView([55.7558, 37.6173], 10);
    mapInstanceRef.current = map;
  }, []);

  // Update markers when filtered data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    if (clusterGroupRef.current) map.removeLayer(clusterGroupRef.current);
    clusterGroupRef.current = window.L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true
    });

    const createIcon = (color: string) => window.L.divIcon({
      className: 'custom-map-marker',
      html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 3px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });

    const markers: any[] = [];

    activePets.forEach(pet => {
      if (!pet.lat || !pet.lng) return;
      const isLost = (pet.type || 'lost') === 'lost';
      const marker = window.L.marker([pet.lat, pet.lng], { icon: createIcon(isLost ? '#EF4444' : '#22C55E') });

      const container = document.createElement('div');
      container.className = 'flex flex-col gap-2 min-w-[220px]';

      const img = document.createElement('img');
      img.src = pet.mainPhoto || pet.photos?.[0] || 'https://via.placeholder.com/150?text=No+Photo';
      img.className = 'w-full h-32 object-cover rounded-md shadow-sm';
      container.appendChild(img);

      const badge = document.createElement('div');
      badge.innerText = isLost ? 'Потерян' : 'Найден';
      badge.className = `inline-block px-2 py-1 rounded text-xs font-bold ${isLost ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`;
      badge.style.width = 'fit-content';
      container.appendChild(badge);

      const title = document.createElement('h3');
      title.innerText = pet.petName || 'Без клички';
      title.className = `font-bold text-lg m-0 leading-tight ${isLost ? 'text-red-600' : 'text-green-600'}`;
      container.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.innerText = `${pet.breed || 'Не указана'} \u2022 ${pet.color || 'Не указан'}`;
      subtitle.className = 'text-sm text-slate-500 m-0 mt-0.5 uppercase tracking-wide';
      container.appendChild(subtitle);

      const timeAgo = document.createElement('p');
      const diff = Date.now() - new Date(pet.date).getTime();
      const hrs = Math.floor(diff / 3600000);
      const days = Math.floor(hrs / 24);
      timeAgo.innerText = days > 0 ? `${days} дн. назад` : hrs > 0 ? `${hrs} ч. назад` : 'Только что';
      timeAgo.className = 'text-xs text-slate-400 m-0';
      container.appendChild(timeAgo);

      const btn = document.createElement('button');
      btn.innerText = 'Подробнее';
      btn.className = 'mt-2 px-3 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 transition-colors w-full';
      btn.onclick = (e) => {
        e.stopPropagation();
        onPetClick({ ...pet, type: pet.type || 'lost' });
      };
      container.appendChild(btn);

      marker.bindPopup(container);
      clusterGroupRef.current.addLayer(marker);
      markers.push(marker);
    });

    map.addLayer(clusterGroupRef.current);

    if (markers.length > 0) {
      map.fitBounds(clusterGroupRef.current.getBounds(), { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView([55.7558, 37.6173], 10);
    }
  }, [activePets, onPetClick]);

  // Center map and show user marker when "Моё местоположение" is used
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    // Remove previous user marker
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 14);
      const userIcon = window.L.divIcon({
        className: 'user-location-marker',
        html: `<div style="background:#4285F4;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const marker = window.L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      marker.addTo(map);
      userMarkerRef.current = marker;
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] z-0 map-controls-wrapper">
      <div ref={mapRef} className="w-full h-full" />

      {/* My Location - Google Maps style, below zoom controls */}
      <div className="absolute bottom-2 right-2 z-[400] flex flex-col items-end map-my-location-btn">
        <button
          onClick={onUseMyLocation}
          disabled={isLocatingUser}
          className="w-10 h-10 flex items-center justify-center bg-white rounded shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-slate-200/80 hover:bg-slate-50 active:bg-slate-100 transition-all disabled:opacity-60"
          title="Моё местоположение"
        >
          {isLocatingUser ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#4285F4' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" style={{ color: '#4285F4' }}>
              <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      <div className="absolute top-3 left-3 right-3 z-[400] pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Type toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Все</button>
              <button onClick={() => setFilterType('lost')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'lost' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>Потерянные</button>
              <button onClick={() => setFilterType('found')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'found' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}>Найденные</button>
            </div>

            {/* Species */}
            <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
              <option value="all">Все виды</option>
              <option value="dog">Собаки</option>
              <option value="cat">Кошки</option>
              <option value="other">Другие</option>
            </select>

            {/* Date */}
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
              <option value="all">За все время</option>
              <option value="today">За 24 часа</option>
              <option value="3days">За 3 дня</option>
              <option value="week">За неделю</option>
              <option value="month">За месяц</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md z-[400] text-xs font-medium space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <span>Потерянные</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          <span>Найденные</span>
        </div>
      </div>
    </div>
  );
};
