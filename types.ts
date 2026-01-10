
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
  lat?: number; // Широта
  lng?: number; // Долгота
  description: string;
  contactInfo: string;
  photos: string[]; // base64 encoded images (Array)
  date: string; // Дата публикации (ISO string)
}

export interface MatchResult {
  id: string; // ID совпавшего 'lost' питомца
  confidence: number;
  reasoning: string;
}

export interface Notification {
  id: string;
  userId: string;
  lostPet: PetReport;
  foundPet: PetReport;
  matchResult: MatchResult;
  timestamp: number;
  read: boolean;
}

export interface UserProfile {
  userId: string;
  name: string;
  phone: string;
  email: string;
}