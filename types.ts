
export interface PetReport {
  id: string;
  userId: string; // ID пользователя, создавшего объявление
  type: 'lost' | 'found';
  status: 'active' | 'resolved'; // Статус объявления: активно или питомец вернулся домой
  species: 'dog' | 'cat' | 'other';
  petName?: string;
  breed: string;
  color: string;
  lastSeenLocation: string;
  city?: string;   // Город/населённый пункт (для поиска)
  region?: string; // Область (для поиска)
  lat?: number; // Широта
  lng?: number; // Долгота
  description: string;
  specialMarks?: string;   // Особые приметы: пятна, шрамы, хромота и т.д.
  hasCollar?: boolean;     // Есть ли ошейник
  collarColor?: string;    // Цвет ошейника (если есть)
  isChipped?: boolean;     // Чипировано ли животное
  keptByFinder?: boolean; // Только для "Нашёл": оставил у себя (true) или сфоткал и ушёл (false)
  contactInfo: string;
  photos: string[]; // base64 encoded images (Array)
  date: string; // Дата публикации (ISO string)
  lostDate?: string; // Дата потери (только для type: 'lost', ISO string)
}

export interface MatchResult {
  id: string; // ID совпавшего 'lost' питомца
  confidence: number;
  reasoning: string;
}

export interface Notification {
  id: string;
  userId: string;          // Кому адресовано уведомление (хозяин потерянного)
  // Компактные данные для отображения (без вложенных PetReport)
  lostPetId: string;
  lostPetName: string;
  lostPetPhoto: string;    // URL или base64 первого фото
  foundPetId: string;
  foundPetLocation: string;
  foundPetPhoto: string;
  confidence: number;      // Процент совпадения
  reasoning: string;       // Обоснование ИИ
  timestamp: number;
  read: boolean;
}

export interface UserProfile {
  userId: string;
  name: string;
  phone: string;
  email: string;
}