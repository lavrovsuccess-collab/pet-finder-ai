import React, { useRef, useEffect, useMemo } from 'react';
import type { PetReport } from '../types';
import { CrosshairIcon } from './icons';

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
  searchCoords: { lat: number; lng: number } | null;
  setSearchCoords: (v: { lat: number; lng: number } | null) => void;
  searchRadius: number;
  setSearchRadius: (v: number) => void;
  isLocatingUser: boolean;
  onUseMyLocation: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  reports, onPetClick,
  filterType, setFilterType,
  speciesFilter, setSpeciesFilter,
  dateFilter, setDateFilter,
  searchCoords, setSearchCoords,
  searchRadius, setSearchRadius,
  isLocatingUser, onUseMyLocation
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);

  const activePets = useMemo(() => reports.filter(p => p.lat && p.lng), [reports]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;
    const map = window.L.map(mapRef.current, { attributionControl: false });
    window.L.control.attribution({ prefix: false }).addTo(map);
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

  // User location marker + radius circle
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
    if (radiusCircleRef.current) { map.removeLayer(radiusCircleRef.current); radiusCircleRef.current = null; }

    if (searchCoords) {
      const userIcon = window.L.divIcon({
        className: 'user-location-marker',
        html: `<div style="width:16px;height:16px;background:#4F46E5;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(79,70,229,0.3),0 2px 8px rgba(0,0,0,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      userMarkerRef.current = window.L.marker([searchCoords.lat, searchCoords.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('Центр поиска');

      radiusCircleRef.current = window.L.circle([searchCoords.lat, searchCoords.lng], {
        radius: searchRadius * 1000,
        color: '#6366F1',
        fillColor: '#6366F1',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6 4'
      }).addTo(map);

      map.fitBounds(radiusCircleRef.current.getBounds(), { padding: [30, 30] });
    }
  }, [searchCoords, searchRadius]);

  // Click on map to set search center
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const onClick = (e: any) => {
      setSearchCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [setSearchCoords]);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] z-0">
      <div ref={mapRef} className="w-full h-full" />

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

            {/* Radius */}
            {searchCoords && (
              <select value={searchRadius} onChange={(e) => setSearchRadius(Number(e.target.value))} className="px-2 py-1.5 text-xs border border-indigo-300 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                <option value={1}>1 км</option>
                <option value={3}>3 км</option>
                <option value={5}>5 км</option>
                <option value={10}>10 км</option>
                <option value={25}>25 км</option>
                <option value={50}>50 км</option>
              </select>
            )}

            {/* Clear radius */}
            {searchCoords && (
              <button onClick={() => setSearchCoords(null)} className="px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                Сбросить точку
              </button>
            )}

            {/* Count */}
            <span className="ml-auto text-xs text-slate-500 font-medium whitespace-nowrap">
              {activePets.length} {activePets.length === 1 ? 'объявление' : activePets.length < 5 ? 'объявления' : 'объявлений'}
            </span>
          </div>

          {!searchCoords && (
            <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">Нажмите на карту, чтобы задать точку поиска по радиусу</p>
          )}
        </div>
      </div>

      {/* My Location button */}
      <button
        onClick={onUseMyLocation}
        disabled={isLocatingUser}
        className="absolute bottom-6 right-4 z-[400] bg-white hover:bg-slate-50 text-slate-700 p-3 rounded-full shadow-lg border border-slate-200 transition-all hover:shadow-xl disabled:opacity-60"
        title="Моё местоположение"
      >
        {isLocatingUser ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <CrosshairIcon className="h-5 w-5" />
        )}
      </button>

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
        {searchCoords && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
            <span>Ваша точка</span>
          </div>
        )}
      </div>
    </div>
  );
};
