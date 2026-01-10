import React, { useState, useEffect, useRef } from 'react';
import type { PetReport } from '../types';
import { analyzePetImage } from '../services/geminiService';
import { MapPinIcon, TrashIcon } from './icons';

// Declare Leaflet on window
declare global {
  interface Window {
    L: any;
  }
}

interface ReportFormProps {
  formType: 'lost' | 'found';
  onSubmit: (report: Omit<PetReport, 'id' | 'type' | 'userId' | 'status' | 'date'>) => void;
  onCancel: () => void;
  initialData?: Omit<PetReport, 'id' | 'type' | 'userId'>;
  defaultContactInfo?: string;
}

export const ReportForm: React.FC<ReportFormProps> = ({ formType, onSubmit, onCancel, initialData, defaultContactInfo }) => {
  const [species, setSpecies] = useState<'dog' | 'cat' | 'other'>('dog');
  const [petName, setPetName] = useState('');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (initialData) {
      setSpecies(initialData.species || 'dog');
      setPetName(initialData.petName || '');
      setBreed(initialData.breed);
      setColor(initialData.color);
      setLastSeenLocation(initialData.lastSeenLocation);
      setDescription(initialData.description);
      setContactInfo(initialData.contactInfo);
      setPhotos(initialData.photos || []);
      if (initialData.lat && initialData.lng) {
          setCoordinates({ lat: initialData.lat, lng: initialData.lng });
      }
    } else if (defaultContactInfo) {
        setContactInfo(defaultContactInfo);
    }
  }, [initialData, defaultContactInfo]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isMapOpen) {
        // Cleanup map instance when closed
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        }
        return;
    }

    if (isMapOpen && mapContainerRef.current && window.L) {
        // Default center (Moscow) or current coordinates
        const initialLat = coordinates?.lat || 55.7558;
        const initialLng = coordinates?.lng || 37.6173;
        const initialZoom = coordinates ? 16 : 10;

        if (!mapInstanceRef.current) {
            // Disable default attributionControl to customize it (remove Leaflet prefix/flag)
            const map = window.L.map(mapContainerRef.current, {
                attributionControl: false
            }).setView([initialLat, initialLng], initialZoom);
            
            // Add attribution without the "Leaflet" prefix
            window.L.control.attribution({
                prefix: false
            }).addTo(map);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            // Custom icon to ensure it shows up without needing asset build steps
            const icon = window.L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #4F46E5; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            mapInstanceRef.current = map;

            // Handle map clicks
            map.on('click', (e: any) => {
                const { lat, lng } = e.latlng;
                updateMarker(lat, lng);
                fetchAddress(lat, lng);
            });

            // If coordinates exist, show marker immediately
            if (coordinates) {
                updateMarker(coordinates.lat, coordinates.lng);
            }
        }
    }
  }, [isMapOpen]);

  const updateMarker = (lat: number, lng: number) => {
      if (!mapInstanceRef.current || !window.L) return;

      // Use a standard marker for better visibility
      if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
      } else {
           markerRef.current = window.L.marker([lat, lng]).addTo(mapInstanceRef.current);
      }
      setCoordinates({ lat, lng });
  };

  const fetchAddress = async (lat: number, lng: number) => {
      try {
          // Using OpenStreetMap Nominatim for reverse geocoding (Free)
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
          const data = await response.json();
          
          if (data && data.display_name) {
              // Simplify address (take first 3 parts usually works well for street/city)
              const parts = data.display_name.split(', ');
              const simplified = parts.slice(0, 3).join(', ');
              setLastSeenLocation(simplified);
          } else {
              setLastSeenLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
      } catch (error) {
          console.error("Geocoding error:", error);
          setLastSeenLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      const remainingSlots = 5 - photos.length;
      
      if (remainingSlots <= 0) {
          setError("Максимальное количество фотографий: 5");
          return;
      }

      const filesToProcess = files.slice(0, remainingSlots);
      
      let processedCount = 0;
      const shouldAnalyze = photos.length === 0 && breed === '';

      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = async () => {
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            let dataUrl = event.target?.result as string;

             if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                dataUrl = canvas.toDataURL(file.type, 0.9);
             }
            
            setPhotos(prev => [...prev, dataUrl]);

            if (shouldAnalyze && processedCount === 0) {
              setIsAnalyzing(true);
              try {
                  const analysis = await analyzePetImage(dataUrl);
                  if (analysis) {
                      setSpecies(analysis.species);
                      setBreed(analysis.breed);
                      setColor(analysis.color);
                      setDescription(analysis.description);
                  }
              } catch (err) {
                  console.error("Failed to analyze image:", err);
              } finally {
                  setIsAnalyzing(false);
              }
            }
            processedCount++;
          };
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
      setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается вашим браузером');
      return;
    }

    setIsLocating(true);
    setError('');

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        setCoordinates({ lat: latitude, lng: longitude });
        
        if (isMapOpen && mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16);
            updateMarker(latitude, longitude);
            fetchAddress(latitude, longitude);
        } else {
             // If map is closed, just fetch address
             fetchAddress(latitude, longitude);
        }

        setIsLocating(false);
      },
      (err) => {
        console.error("Geolocation Error:", err);
        setIsLocating(false);
        let msg = 'Не удалось получить местоположение.';
        if (err.code === 1) msg = 'Доступ к геолокации запрещен.';
        else if (err.code === 2) msg = 'Местоположение недоступно.';
        else if (err.code === 3) msg = 'Время ожидания истекло.';
        setError(msg);
      },
      options
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      setError('Пожалуйста, загрузите хотя бы одну фотографию.');
      return;
    }
    
    setError('');
    onSubmit({
      species,
      petName,
      breed: breed || 'Не указана',
      color: color || 'Не указан',
      lastSeenLocation: lastSeenLocation || 'Не указано',
      lat: coordinates?.lat,
      lng: coordinates?.lng,
      description: description || 'Нет описания',
      contactInfo: contactInfo || 'Не указано',
      photos,
    });
  };

  const title = initialData 
    ? 'Редактировать объявление' 
    : formType === 'lost' ? 'Я потерял питомца' : 'Я нашел питомца';
  const locationLabel = formType === 'lost' ? 'Где видели в последний раз' : 'Где был найден';
  const submitButtonText = initialData ? 'Сохранить изменения' : 'Опубликовать';
  const nameLabel = formType === 'lost' ? 'Кличка питомца' : 'Кличка (если известна)';

  return (
    <div className="max-w-2xl mx-auto my-4 md:my-10 p-4 md:p-8 bg-white rounded-2xl shadow-xl">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-800 mb-6 md:mb-8">{title}</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        
        {/* Photo Upload Section */}
        <div className={`transition-all duration-500 ${isAnalyzing ? 'opacity-75 pointer-events-none' : ''}`}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
                Фотографии ({photos.length}/5)* 
                <span className="text-xs font-normal text-slate-500 ml-2 hidden sm:inline">(Первое фото будет использовано для ИИ-анализа)</span>
            </label>
            
            {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-4 mb-4">
                    {photos.map((photo, index) => (
                        <div key={index} className="relative group aspect-square">
                            <img src={photo} alt={`Pet ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-sm border border-slate-200" />
                            <button 
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors opacity-90 hover:opacity-100"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                            {index === 0 && isAnalyzing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {photos.length < 5 && (
                <div className="mt-1 flex items-center justify-center px-4 py-4 md:px-6 md:pt-5 md:pb-6 border-2 border-slate-300 border-dashed rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-8 w-8 md:h-12 md:w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-slate-600 justify-center pt-2 flex-col sm:flex-row items-center">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none mb-1 sm:mb-0">
                                <span>Добавить фото</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handlePhotoChange} accept="image/*" multiple />
                            </label>
                            <p className="pl-1 hidden sm:inline">или перетащите</p>
                        </div>
                        <p className="text-xs text-slate-500">PNG, JPG, GIF до 5 штук</p>
                    </div>
                </div>
            )}
        </div>

        <div>
             <label className="block text-sm font-medium text-slate-700 mb-2">Вид животного</label>
             <div className="flex gap-2 md:gap-4">
                 <label className={`flex-1 flex items-center justify-center px-2 py-2 md:px-4 border rounded-md cursor-pointer transition-all text-sm ${species === 'dog' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                     <input type="radio" name="species" value="dog" checked={species === 'dog'} onChange={() => setSpecies('dog')} className="sr-only"/>
                     <span>Собака</span>
                 </label>
                 <label className={`flex-1 flex items-center justify-center px-2 py-2 md:px-4 border rounded-md cursor-pointer transition-all text-sm ${species === 'cat' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                     <input type="radio" name="species" value="cat" checked={species === 'cat'} onChange={() => setSpecies('cat')} className="sr-only"/>
                     <span>Кошка</span>
                 </label>
                 <label className={`flex-1 flex items-center justify-center px-2 py-2 md:px-4 border rounded-md cursor-pointer transition-all text-sm ${species === 'other' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                     <input type="radio" name="species" value="other" checked={species === 'other'} onChange={() => setSpecies('other')} className="sr-only"/>
                     <span>Другое</span>
                 </label>
             </div>
        </div>

        <div>
            <label htmlFor="petName" className="block text-sm font-medium text-slate-700">{nameLabel}</label>
            <input type="text" id="petName" value={petName} onChange={(e) => setPetName(e.target.value)} className="mt-1 block w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label htmlFor="breed" className="block text-sm font-medium text-slate-700">Порода</label>
            <input type="text" id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} className="mt-1 block w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
          </div>
          <div>
            <label htmlFor="color" className="block text-sm font-medium text-slate-700">Окрас</label>
            <input type="text" id="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
            Описание и особые приметы
          </label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 block w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Опишите внешность, ошейник, шрамы и другие приметы..."></textarea>
        </div>

        <div>
          <label htmlFor="lastSeenLocation" className="block text-sm font-medium text-slate-700">{locationLabel}</label>
          <div className="relative mt-1">
            <input 
                type="text" 
                id="lastSeenLocation" 
                value={lastSeenLocation} 
                onChange={(e) => setLastSeenLocation(e.target.value)} 
                className="block w-full px-4 py-2 pr-24 md:pr-28 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                placeholder="Адрес или район"
            />
            <div className="absolute inset-y-0 right-0 flex items-center">
                <button 
                    type="button" 
                    onClick={() => setIsMapOpen(!isMapOpen)}
                    className={`px-2 h-full border-l border-slate-300 transition-colors hover:bg-slate-100 flex items-center justify-center gap-1 ${isMapOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}
                    title="Указать на карте"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                    </svg>
                    <span className="hidden md:inline text-xs">Карта</span>
                </button>
                <button 
                    type="button" 
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className={`px-3 h-full flex items-center transition-colors disabled:opacity-50 border-l border-slate-300 ${coordinates ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title="Определить мое местоположение"
                >
                    {isLocating ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <MapPinIcon className="h-5 w-5" />
                    )}
                </button>
            </div>
          </div>
          
          {/* Leaflet Map Container */}
          {isMapOpen && (
            <div className="mt-3 rounded-lg border border-slate-300 overflow-hidden shadow-inner animate-fade-in relative z-0">
                <div ref={mapContainerRef} className="w-full h-64 md:h-80 bg-slate-100" />
                <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500 border-t border-slate-200 flex justify-between">
                    <span>Нажмите на карту для выбора точки.</span>
                    <span className="text-indigo-600 font-medium">{coordinates ? `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}` : 'Точка не выбрана'}</span>
                </div>
            </div>
          )}

          {coordinates && !isMapOpen && (
              <p className="mt-1 text-xs text-green-600 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                  Точные координаты сохранены ({coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)})
              </p>
          )}
        </div>

        <div>
          <label htmlFor="contactInfo" className="block text-sm font-medium text-slate-700">Ваша контактная информация</label>
          <input type="text" id="contactInfo" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} className="mt-1 block w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 md:gap-4 pt-2 md:pt-4">
          <button type="button" onClick={onCancel} className="w-full sm:w-auto px-6 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
            Отмена
          </button>
          <button type="submit" className="w-full sm:w-auto px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            {submitButtonText}
          </button>
        </div>
      </form>
    </div>
  );
};