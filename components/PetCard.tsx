
import React, { useState } from 'react';
import type { PetReport } from '../types';
import { PencilIcon, TrashIcon, SearchIcon, MapPinIcon, PhoneIcon, UserCircleIcon, CalendarIcon } from './icons';

interface PetCardProps {
  pet: PetReport;
  matchInfo?: {
    confidence: number;
    reasoning: string;
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  onFindMatches?: () => void;
  onClick?: () => void;
  onUserClick?: (userId: string) => void;
}

export const PetCard: React.FC<PetCardProps> = ({ pet, matchInfo, onEdit, onDelete, onToggleStatus, onFindMatches, onClick, onUserClick }) => {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  
  const isResolved = pet.status === 'resolved';
  
  // Refined badge colors
  const badgeClass = pet.type === 'lost' 
    ? 'bg-red-500/90 text-white shadow-red-200' 
    : 'bg-emerald-500/90 text-white shadow-emerald-200';
  
  const typeText = pet.type === 'lost' ? 'Потерян' : 'Найден';

  const displayPhoto = (pet.photos && pet.photos.length > 0) ? pet.photos[0] : '';
  const photoCount = pet.photos ? pet.photos.length : 0;

  const formattedDate = pet.date ? (() => {
      const date = new Date(pet.date);
      const dateStr = date.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
          year: '2-digit'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
      });
      return `${dateStr} ${timeStr}`;
  })() : '';

  const handleMapClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = pet.lat && pet.lng 
        ? `https://www.google.com/maps?q=${pet.lat},${pet.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pet.lastSeenLocation)}`;
      window.open(url, '_blank');
  };

  const handleUserClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onUserClick) {
          onUserClick(pet.userId);
      }
  };

  const handleToggleStatusClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleStatus) onToggleStatus();
  }

  return (
    <div 
      onClick={onClick}
      className={`group bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transform transition-all duration-300 ease-out flex flex-col h-full relative overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${isResolved ? 'opacity-90 grayscale-[0.3]' : ''}`}
    >
      {/* Status Overlay for Resolved */}
      {isResolved && (
          <div className="absolute top-0 right-0 left-0 bottom-0 z-20 bg-white/10 pointer-events-none flex items-center justify-center">
               <div className="bg-white/90 backdrop-blur-sm border-2 border-green-500 text-green-700 px-6 py-2 rounded-full font-bold text-lg shadow-2xl transform -rotate-12 uppercase tracking-widest pointer-events-auto">
                  Дома! 🏠
               </div>
          </div>
      )}

      {/* Image Section */}
      <div className="relative h-48 sm:h-56 flex-shrink-0 overflow-hidden">
        {displayPhoto ? (
             <img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src={displayPhoto} alt={pet.breed} />
        ) : (
             <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-medium">Нет фото</div>
        )}
        
        {/* Type Badge - Floating */}
        {!isResolved && (
            <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded shadow-sm uppercase tracking-wider ${badgeClass}`}>
                {typeText}
            </span>
        )}

        {/* Photo Count */}
        {photoCount > 1 && (
            <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                {photoCount}
            </span>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col flex-grow relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-1">
            <h3 className="text-lg font-bold text-slate-800 truncate pr-2" title={pet.petName}>
                {pet.petName || 'Без клички'}
            </h3>
            {formattedDate && (
                <div className="flex items-center text-slate-400 text-xs whitespace-nowrap pt-1">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                    <span>{formattedDate}</span>
                </div>
            )}
        </div>
        
        <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide truncate">
            {pet.breed} • {pet.color}
            {(pet.hasCollar || pet.isChipped) && (
              <span className="ml-1 text-slate-400">
                {pet.hasCollar && '• Ошейник'}
                {pet.isChipped && ' • Чип'}
              </span>
            )}
        </p>
        {pet.specialMarks && (
          <p className="text-xs text-slate-600 mb-2 line-clamp-1" title={pet.specialMarks}>
            📌 {pet.specialMarks}
          </p>
        )}
        
        {/* Info Grid */}
        <div className="bg-slate-50 rounded-lg p-2.5 mb-3 space-y-1.5">
            <div 
                className="flex items-start text-slate-600 group/location cursor-pointer"
                onClick={handleMapClick}
                title="Показать на карте"
            >
                <MapPinIcon className={`w-4 h-4 mr-2 flex-shrink-0 mt-0.5 transition-colors ${pet.lat ? 'text-red-500' : 'text-slate-400 group-hover/location:text-indigo-500'}`} />
                <span className="text-sm group-hover/location:text-indigo-600 transition-colors line-clamp-1 font-medium">
                    {pet.lastSeenLocation}
                </span>
            </div>
            
            <div className="flex items-center text-slate-600">
                <PhoneIcon className="w-4 h-4 mr-2 flex-shrink-0 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 truncate select-all">{pet.contactInfo}</span>
            </div>
        </div>
        
        {/* Description */}
        <p className="text-slate-600 text-sm mb-4 line-clamp-2 flex-grow min-h-[3em]">
            {pet.description}
        </p>

        {/* User Info & Actions */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
             {onUserClick ? (
                <div 
                    onClick={handleUserClick}
                    className="flex items-center gap-2 cursor-pointer group/user"
                >
                    <UserCircleIcon className="w-4 h-4 text-slate-300 group-hover/user:text-indigo-500 transition-colors" />
                    <span className="text-xs font-medium text-slate-400 group-hover/user:text-indigo-600 transition-colors max-w-[100px] truncate">
                        {pet.userId}
                    </span>
                </div>
            ) : <div></div>}
            
            {/* Context Actions (Edit/Delete icons only to save space) */}
            {onEdit && onDelete && (
                <div className="flex items-center gap-2">
                     <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5">
                        <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-600 transition-colors p-1.5">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
        
        {/* Match Info Box - Refined */}
        {matchInfo && !isResolved && (
           <div 
             className="mt-3 -mx-1 p-2 bg-blue-50/50 border border-blue-100 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors group/reasoning"
             onClick={(e) => {
                e.stopPropagation();
                setIsReasoningExpanded(!isReasoningExpanded);
             }}
           >
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Совпадение</span>
                    <span className="text-xs font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded shadow-sm">{Math.round(matchInfo.confidence)}%</span>
                </div>
                <p className={`text-xs text-slate-600 leading-snug ${isReasoningExpanded ? '' : 'line-clamp-1'}`}>
                    {matchInfo.reasoning}
                </p>
            </div>
        )}
      </div>
      
      {/* Primary Actions (Toggle / AI Search) */}
      {(onToggleStatus || (onFindMatches && !isResolved)) && (
          <div className="px-4 pb-4 pt-0 flex gap-3">
               {onToggleStatus && (
                <button 
                    onClick={handleToggleStatusClick} 
                    className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-lg transition-all shadow-sm border
                    ${isResolved 
                        ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50' 
                        : 'bg-green-600 text-white border-transparent hover:bg-green-700 hover:shadow'}`}
                    title={isResolved ? "Вернуть в активные" : "Отметить как найденного"}
                >
                    {isResolved ? '↺ Вернуть' : '🎉 Дома!'}
                </button>
               )}
               {onFindMatches && !isResolved && (
                  <button 
                    onClick={(e) => {e.stopPropagation(); onFindMatches();}} 
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow"
                  >
                    <SearchIcon className="w-4 h-4" />
                    <span>Поиск ИИ</span>
                  </button>
               )}
          </div>
      )}
    </div>
  );
};
