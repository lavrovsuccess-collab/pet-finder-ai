
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { PetReport, MatchResult, Notification, UserProfile } from './types';
import { findPetMatches } from './services/geminiService';
import { PetCard } from './components/PetCard';
import { ReportForm } from './components/ReportForm';
import { ConfirmModal } from './components/ConfirmModal';
import { MapView } from './components/MapView';
import { PawIcon, SearchIcon, PlusCircleIcon, LogoIcon, UserCircleIcon, BellIcon, GoogleIcon, MapPinIcon, PhoneIcon, PencilIcon, CalendarIcon, ChevronDownIcon, CrosshairIcon, MapIcon, CameraIcon } from './components/icons';
import { auth, db } from './src/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, onSnapshot, deleteDoc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

type View = 'home' | 'reportLost' | 'reportFound' | 'matching' | 'results' | 'account' | 'login' | 'editReport' | 'lostPetDetail' | 'petDetail' | 'publicProfile' | 'map' | 'privacy' | 'terms';

const initialLostPets: PetReport[] = [
    {
        id: 'lp1', userId: 'demo_user', type: 'lost', status: 'active', species: 'dog', petName: 'Бадди', breed: 'Золотистый ретривер', color: 'Золотистый',
        lastSeenLocation: 'Москва, Центральный парк, у фонтана',
        lat: 55.7558, lng: 37.6173,
        description: 'Очень дружелюбный, был в красном ошейнике с адресником. Любит играть в апорт.',
        contactInfo: 'owner@email.com',
        photos: ['https://picsum.photos/seed/buddy/600/400'],
        date: new Date(Date.now() - 86400000 * 2).toISOString() // 2 days ago
    },
    {
        id: 'lp2', userId: 'jane_doe', type: 'lost', status: 'active', species: 'cat', petName: 'Люси', breed: 'Сиамская кошка', color: 'Кремовый с темными отметинами',
        lastSeenLocation: 'Санкт-Петербург, ул. Дубовая, 123',
        lat: 59.9343, lng: 30.3351,
        description: 'Немного пуглива с незнакомцами. Яркие голубые глаза. Без ошейника.',
        contactInfo: 'jane.doe@email.com',
        photos: ['https://picsum.photos/seed/lucy/600/400'],
        date: new Date(Date.now() - 86400000 * 5).toISOString() // 5 days ago
    },
     {
        id: 'lp3', userId: 'demo_user', type: 'lost', status: 'active', species: 'dog', petName: 'Макс', breed: 'Немецкая овчарка', color: 'Черно-подпалый',
        lastSeenLocation: 'Новосибирск, Лес у Кленовой авеню',
        lat: 55.0084, lng: 82.9357,
        description: 'Правое ухо висит. Отзывается на кличку. Очень энергичный.',
        contactInfo: 'max.owner@email.com',
        photos: ['https://picsum.photos/seed/max/600/400'],
        date: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hours ago
    },
];

const initialFoundPets: PetReport[] = [
    {
        id: 'fp1', userId: 'animal_shelter', type: 'found', status: 'active', species: 'dog', petName: 'Найдёныш', breed: 'Дворняга', color: 'Коричневый',
        lastSeenLocation: 'Москва, Задний двор супермаркета "Продукты"',
        lat: 55.7600, lng: 37.6200,
        description: 'Очень ласковый, немного худой. Похоже, домашний, так как знает команды. Есть ошейник, но без адресника.',
        contactInfo: 'shelter@email.com',
        photos: ['https://picsum.photos/seed/found1/600/400'],
        date: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    },
    {
        id: 'fp2', userId: 'good_samaritan', type: 'found', status: 'active', species: 'dog', petName: '', breed: 'Лабрадор ретривер', color: 'Черный',
        lastSeenLocation: 'Екатеринбург, Детская площадка на ул. Солнечная',
        lat: 56.8389, lng: 60.6057,
        description: 'Выглядит ухоженным и здоровым. Бегал без поводка, очень игривый. Ищем хозяев!',
        contactInfo: 'samaritan@email.com',
        photos: ['https://picsum.photos/seed/found2/600/400'],
        date: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
    },
];

// Haversine formula to calculate distance
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LoginModal: React.FC<{ isOpen: boolean; onClose: () => void; onLoginSuccess: (user: { uid: string; displayName: string | null; email: string | null }) => void }> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Сброс состояния при закрытии модального окна
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('login');
      setEmail('');
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      onLoginSuccess({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка при входе через Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      let result;
      if (activeTab === 'login') {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }
      
      const user = result.user;
      onLoginSuccess({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email
      });
      onClose();
      setEmail('');
      setPassword('');
    } catch (err: any) {
      const errorMessage = activeTab === 'login' 
        ? 'Ошибка при входе' 
        : 'Ошибка при регистрации';
      setError(err.message || errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Затемненный фон */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Модальное окно */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 md:p-8">
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <XIcon className="w-6 h-6" />
        </button>

        {/* Заголовок */}
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">
          {activeTab === 'login' ? 'Вход в PetFinder' : 'Регистрация в PetFinder'}
        </h2>

        {/* Табы */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'login'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'register'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Кнопка входа через Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full mb-6 inline-flex items-center justify-center gap-3 py-3 px-4 border border-slate-300 rounded-lg shadow-sm bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon className="w-5 h-5" />
          <span>Войти через Google</span>
        </button>

        {/* Разделитель */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">или</span>
          </div>
        </div>

        {/* Форма входа/регистрации по Email/Пароль */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? (activeTab === 'login' ? 'Вход...' : 'Регистрация...') 
              : (activeTab === 'login' ? 'Войти' : 'Зарегистрироваться')
            }
          </button>
        </form>
      </div>
    </div>
  );
};

const Header = ({ currentUser, onViewChange, currentView, onLogout, onLogin, unreadCount }: { currentUser: string | null, onViewChange: (view: View) => void, currentView: View, onLogout: () => void, onLogin: () => void, unreadCount: number }) => (
    <header className="bg-white shadow-md sticky top-0 z-50">
        <nav className="container mx-auto px-4 md:px-6 py-2.5 md:py-3 flex justify-between items-center">
            <div className="flex items-center cursor-pointer" onClick={() => onViewChange('home')}>
                <LogoIcon className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                <h1 className="ml-2 md:ml-3 text-lg md:text-2xl font-bold text-orange-500 truncate max-w-[150px] sm:max-w-none">Поиск Питомцев</h1>
            </div>
            
             <div className="hidden md:flex gap-6 absolute left-1/2 transform -translate-x-1/2">
                <button 
                    onClick={() => onViewChange('home')}
                    className={`text-sm font-medium transition-colors ${currentView === 'home' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Объявления
                </button>
                 <button 
                    onClick={() => onViewChange('map')}
                    className={`text-sm font-medium transition-colors flex items-center gap-1 ${currentView === 'map' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <MapIcon className="w-4 h-4" />
                    Карта
                </button>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                 {/* Mobile Map Button */}
                 <button onClick={() => onViewChange('map')} className="md:hidden p-2 text-slate-600 hover:text-indigo-600">
                    <MapIcon className="w-6 h-6" />
                 </button>

                 {currentUser ? (
                     <>
                        <button onClick={() => onViewChange('account')} className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors">
                            <BellIcon className="w-5 h-5 md:w-6 md:h-6" />
                            {unreadCount > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                        </button>
                        <button onClick={() => onViewChange('account')} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors">
                            <UserCircleIcon className="w-5 h-5 md:w-5 md:h-5"/>
                            <span className="hidden sm:inline">{currentUser}</span>
                        </button>
                        <button onClick={onLogout} className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors">
                            Выйти
                        </button>
                     </>
                 ) : (
                    <button onClick={onLogin} className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
                        Войти
                    </button>
                 )}
            </div>
        </nav>
    </header>
);

const TermsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
        <div className="container mx-auto px-4 py-8 md:py-12 animate-fade-in max-w-4xl">
            <button 
                onClick={onBack}
                className="mb-6 flex items-center text-slate-600 hover:text-indigo-600 transition-colors font-medium text-sm md:text-base"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Вернуться
            </button>

            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-slate-100 prose prose-slate max-w-none">
                <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-6">Пользовательское соглашение</h1>
                
                <p className="text-slate-600 mb-6">Дата вступления в силу: 24 ноября 2025 г.</p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. Введение</h3>
                <p className="text-slate-700 mb-4">
                    Добро пожаловать в "Поиск Питомцев AI". Используя наше веб-приложение, вы соглашаетесь с данными условиями. Пожалуйста, внимательно ознакомьтесь с ними.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. Использование сервиса</h3>
                <p className="text-slate-700 mb-4">
                    Вы обязуетесь использовать сервис только в законных целях и не нарушать права третьих лиц. Запрещается публикация ложной информации, спама или оскорбительного контента.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. Ответственность</h3>
                <p className="text-slate-700 mb-4">
                    Администрация сервиса не несет ответственности за достоверность информации, опубликованной пользователями, а также за любые последствия, возникшие в результате использования этой информации. Мы предоставляем платформу для обмена информацией "как есть".
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. Контент пользователей</h3>
                <p className="text-slate-700 mb-4">
                    Публикуя объявления, вы предоставляете нам неисключительное право на использование, отображение и распространение вашего контента (текста и фотографий) в рамках работы сервиса. Вы гарантируете, что обладаете необходимыми правами на публикуемые материалы.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5. Изменения условий</h3>
                <p className="text-slate-700 mb-4">
                    Мы оставляем за собой право изменять данное пользовательское соглашение в любое время. Продолжение использования сервиса после внесения изменений означает ваше согласие с новыми условиями.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">6. Контакты</h3>
                <p className="text-slate-700">
                    При возникновении вопросов или претензий, пожалуйста, свяжитесь с нами по адресу: support@petfinder-ai-demo.com
                </p>
            </div>
        </div>
    );
};

const PrivacyPolicyView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
        <div className="container mx-auto px-4 py-8 md:py-12 animate-fade-in max-w-4xl">
            <button 
                onClick={onBack}
                className="mb-6 flex items-center text-slate-600 hover:text-indigo-600 transition-colors font-medium text-sm md:text-base"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Вернуться
            </button>

            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-slate-100 prose prose-slate max-w-none">
                <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-6">Политика конфиденциальности</h1>
                
                <p className="text-slate-600 mb-6">Дата вступления в силу: 24 ноября 2025 г.</p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. Общие положения</h3>
                <p className="text-slate-700 mb-4">
                    Мы (команда "Поиск Питомцев AI") уважаем вашу конфиденциальность и обязуемся защищать ваши персональные данные. 
                    Настоящая Политика конфиденциальности описывает, как мы собираем, используем и обрабатываем информацию при использовании вами нашего веб-приложения.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. Собираемые данные</h3>
                <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-4">
                    <li><strong>Информация о питомце:</strong> Фотографии, описание, порода, кличка и другие характеристики животного.</li>
                    <li><strong>Контактные данные:</strong> Номер телефона, имя и email, которые вы добровольно указываете в объявлении или профиле для связи с другими пользователями.</li>
                    <li><strong>Геолокация:</strong> Данные о местоположении (координаты), которые вы предоставляете при создании объявления для указания места пропажи или находки, а также при использовании фильтра "Рядом со мной".</li>
                </ul>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. Использование Искусственного Интеллекта</h3>
                <p className="text-slate-700 mb-4">
                    Наше приложение использует технологии искусственного интеллекта (Gemini API от Google) для:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-4">
                    <li>Анализа фотографий питомцев с целью автоматического определения породы, окраса и вида.</li>
                    <li>Сравнения фотографий потерянных и найденных животных для поиска совпадений.</li>
                </ul>
                <p className="text-slate-700 mb-4">
                    Загружаемые вами изображения обрабатываются API Google. Мы не используем ваши данные для обучения моделей ИИ без вашего явного согласия.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. Публичность данных</h3>
                <p className="text-slate-700 mb-4">
                    Пожалуйста, учитывайте, что <strong>объявления о потерянных и найденных животных являются публичными</strong>. 
                    Любая информация, которую вы включаете в описание объявления (включая фото и контакты), доступна для просмотра другим пользователям сервиса.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5. Хранение данных</h3>
                <p className="text-slate-700 mb-4">
                    В текущей демонстрационной версии приложения большинство данных хранится локально в вашем браузере (Local Storage). 
                    Мы не передаем ваши данные третьим лицам, за исключением случаев обработки изображений через Gemini API.
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">6. Ваши права</h3>
                <p className="text-slate-700 mb-4">
                    Вы имеете право в любой момент:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-4">
                    <li>Редактировать или удалять свои объявления.</li>
                    <li>Изменять информацию в своем профиле.</li>
                    <li>Прекратить использование сервиса.</li>
                </ul>

                <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">7. Контакты</h3>
                <p className="text-slate-700">
                    Если у вас есть вопросы касательно данной политики, пожалуйста, свяжитесь с нами по адресу: support@petfinder-ai-demo.com
                </p>
            </div>
        </div>
    );
};


// MapView moved to components/MapView.tsx

const PublicProfileView: React.FC<{ 
    userId: string, 
    allLostPets: PetReport[], 
    allFoundPets: PetReport[],
    profiles: Record<string, UserProfile>,
    onBack: () => void,
    onPetClick: (pet: PetReport) => void
}> = ({ userId, allLostPets, allFoundPets, profiles, onBack, onPetClick }) => {
    const userLostPets = allLostPets.filter(p => p.userId === userId);
    const userFoundPets = allFoundPets.filter(p => p.userId === userId);
    const allUserPets = [...userLostPets, ...userFoundPets];
    
    // Determine contact info priority: Profile > Most Recent Post > Fallback
    const userProfile = profiles[userId];
    let contactInfo = 'Контакты скрыты или не указаны';
    
    if (userProfile) {
        const parts = [];
        if (userProfile.name) parts.push(userProfile.name);
        if (userProfile.phone) parts.push(userProfile.phone);
        if (userProfile.email) parts.push(userProfile.email);
        if (parts.length > 0) contactInfo = parts.join(', ');
    } else if (allUserPets.length > 0) {
        contactInfo = allUserPets[0].contactInfo;
    }

    const displayName = userProfile?.name || userId;

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 animate-fade-in">
            <button 
                onClick={onBack}
                className="mb-4 md:mb-6 flex items-center text-slate-600 hover:text-indigo-600 transition-colors font-medium text-sm md:text-base"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Назад
            </button>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden mb-8 md:mb-10">
                <div className="bg-indigo-600 h-24 md:h-32 w-full relative">
                    <div className="absolute -bottom-10 md:-bottom-12 left-6 md:left-8 bg-white p-1 md:p-1.5 rounded-full">
                        <div className="bg-slate-200 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-slate-400 shadow-inner">
                            <UserCircleIcon className="w-14 h-14 md:w-16 md:h-16" />
                        </div>
                    </div>
                </div>
                <div className="pt-12 md:pt-16 px-6 md:px-8 pb-6 md:pb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{displayName}</h1>
                            <p className="text-sm md:text-base text-slate-500">@{userId}</p>
                        </div>
                        <div className="bg-indigo-50 px-4 py-3 md:px-6 md:py-4 rounded-xl border border-indigo-100 flex items-center gap-3 md:gap-4 shadow-sm">
                            <div className="bg-white p-1.5 md:p-2 rounded-full shadow-sm">
                                <PhoneIcon className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] md:text-xs font-bold text-indigo-400 uppercase tracking-wider">Контакты пользователя</p>
                                <p className="text-sm md:text-lg font-semibold text-indigo-800 select-all break-all">{contactInfo}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8 md:space-y-12">
                {userLostPets.length > 0 && (
                    <section>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6 pl-2 border-l-4 border-red-500">
                            Объявления о пропаже ({userLostPets.length})
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {userLostPets.map(pet => (
                                <PetCard key={pet.id} pet={pet} onClick={() => onPetClick(pet)} />
                            ))}
                        </div>
                    </section>
                )}

                {userFoundPets.length > 0 && (
                    <section>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6 pl-2 border-l-4 border-green-500">
                            Объявления о находке ({userFoundPets.length})
                        </h2>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {userFoundPets.map(pet => (
                                <PetCard key={pet.id} pet={pet} onClick={() => onPetClick(pet)} />
                            ))}
                        </div>
                    </section>
                )}

                {userLostPets.length === 0 && userFoundPets.length === 0 && (
                    <div className="text-center py-8 md:py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-500">У этого пользователя нет активных объявлений.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const PetDetailView: React.FC<{ 
    pet: PetReport; 
    onBack: () => void;
    onUserClick: (userId: string) => void;
}> = ({ pet, onBack, onUserClick }) => {
    const badgeClass = pet.type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
    const typeText = pet.type === 'lost' ? 'Потерян' : 'Найден';
    const isResolved = pet.status === 'resolved';

    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    
    const photos = pet.photos && pet.photos.length > 0 ? pet.photos : [''];
    
    const mapLink = pet.lat && pet.lng 
        ? `https://www.google.com/maps?q=${pet.lat},${pet.lng}` 
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pet.lastSeenLocation)}`;
    
    const formattedDate = pet.date ? (() => {
      const date = new Date(pet.date);
      const dateStr = date.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
      });
      return `${dateStr} ${timeStr}`;
    })() : 'Неизвестна';

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 animate-fade-in">
            <button 
                onClick={onBack}
                className="mb-4 md:mb-6 flex items-center text-slate-600 hover:text-indigo-600 transition-colors font-medium text-sm md:text-base"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Назад
            </button>

            <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 ${isResolved ? 'grayscale-[0.2]' : ''}`}>
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Gallery Section */}
                    <div className="h-auto bg-slate-50 flex flex-col relative">
                         {isResolved && (
                            <div className="absolute top-4 right-4 z-30">
                                <span className="px-3 py-1.5 md:px-4 md:py-2 bg-green-600 text-white font-bold text-sm rounded-full shadow-lg border-2 border-white uppercase tracking-wide">
                                    🎉 Дома!
                                </span>
                            </div>
                         )}
                         <div className="relative h-[300px] md:h-[400px] w-full flex items-center justify-center overflow-hidden bg-slate-200">
                             {photos[activePhotoIndex] ? (
                                <img 
                                    src={photos[activePhotoIndex]} 
                                    alt={`${pet.breed} - ${activePhotoIndex + 1}`} 
                                    className="w-full h-full object-contain p-2 md:p-4"
                                />
                             ) : (
                                 <span className="text-slate-400">Нет фото</span>
                             )}
                             {!isResolved && (
                                <span className={`absolute top-4 left-4 md:top-6 md:left-6 text-xs md:text-sm font-bold px-3 py-1 md:px-4 md:py-1.5 rounded-full shadow-sm ${badgeClass} uppercase tracking-wide`}>
                                    {typeText}
                                </span>
                             )}
                        </div>
                        
                        {photos.length > 1 && (
                            <div className="flex gap-2 p-2 md:p-4 overflow-x-auto bg-white border-t border-slate-200 justify-center">
                                {photos.map((photo, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActivePhotoIndex(idx)}
                                        className={`relative h-12 w-12 md:h-16 md:w-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                                            activePhotoIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-transparent hover:border-slate-300'
                                        }`}
                                    >
                                        <img src={photo} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-6 md:p-12 flex flex-col">
                        <div className="mb-4 md:mb-6">
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">{pet.petName || 'Кличка не указана'}</h1>
                            <p className="text-base md:text-lg text-slate-500 font-medium">{pet.breed} • {pet.color}</p>
                        </div>

                        <div className="space-y-4 mb-6 md:mb-8 bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-100">
                            <div className="flex items-start">
                                <div className="bg-white p-1.5 md:p-2 rounded-lg mr-3 md:mr-4 shadow-sm flex-shrink-0">
                                     <MapPinIcon className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 md:mb-1">Местоположение</h3>
                                    <p className="text-slate-800 text-sm md:text-base font-medium break-words leading-snug">{pet.lastSeenLocation}</p>
                                    <a 
                                        href={mapLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs md:text-sm text-indigo-600 hover:text-indigo-800 hover:underline mt-1 inline-flex items-center"
                                    >
                                        <span>Показать на карте</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 ml-1">
                                            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                                            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-white p-1.5 md:p-2 rounded-lg mr-3 md:mr-4 shadow-sm flex-shrink-0">
                                     <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 md:mb-1">Дата публикации</h3>
                                    <p className="text-slate-800 text-sm md:text-base font-medium">{formattedDate}</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-white p-1.5 md:p-2 rounded-lg mr-3 md:mr-4 shadow-sm flex-shrink-0">
                                     <PhoneIcon className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 md:mb-1">Контакты</h3>
                                    <p className="text-indigo-700 text-sm md:text-lg font-semibold select-all break-all">{pet.contactInfo}</p>
                                </div>
                            </div>
                            
                             <div className="flex items-start">
                                <div className="bg-white p-1.5 md:p-2 rounded-lg mr-3 md:mr-4 shadow-sm flex-shrink-0">
                                     <PawIcon className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 md:mb-1">Вид</h3>
                                    <p className="text-slate-800 text-sm md:text-base capitalize">
                                        {pet.species === 'dog' ? 'Собака' : pet.species === 'cat' ? 'Кошка' : 'Другое'}
                                    </p>
                                </div>
                            </div>

                            {(pet.hasCollar || pet.isChipped || (pet.type === 'found' && pet.keptByFinder !== undefined)) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {pet.hasCollar && <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">Ошейник{pet.collarColor ? `: ${pet.collarColor}` : ''}</span>}
                                {pet.isChipped && <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">Чипирован</span>}
                                {pet.type === 'found' && pet.keptByFinder === false && <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">Сфотографировал и ушёл</span>}
                                {pet.type === 'found' && pet.keptByFinder === true && <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">Оставил у себя</span>}
                            </div>
                            )}
                        </div>

                        {pet.specialMarks && (
                        <div className="mb-6">
                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2 flex items-center">
                                <span>Особые приметы</span>
                                <div className="ml-4 h-px bg-slate-200 flex-grow"></div>
                            </h3>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">{pet.specialMarks}</p>
                        </div>
                        )}

                        <div className="flex-grow">
                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3 flex items-center">
                                <span>Описание</span>
                                <div className="ml-4 h-px bg-slate-200 flex-grow"></div>
                            </h3>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">{pet.description}</p>
                        </div>
                        
                         <div className="mt-8 md:mt-10 pt-4 md:pt-6 border-t border-slate-100 text-slate-400 text-xs font-mono flex flex-wrap gap-2 justify-between items-center">
                            <span>ID: {pet.id}</span>
                            <button 
                                onClick={() => onUserClick(pet.userId)}
                                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors bg-slate-50 hover:bg-indigo-50 px-3 py-1 rounded-md max-w-full"
                            >
                                <UserCircleIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">Автор: {pet.userId}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MatchingView: React.FC<{ pet: PetReport }> = ({ pet }) => {
    const searchTargetText = pet.type === 'found' ? 'найденного вами питомца' : 'вашего потерянного питомца';
    const dbTargetText = pet.type === 'found' ? 'потерянных' : 'найденных';
    
    const [status, setStatus] = useState('Инициализация ИИ-анализа...');
    const statuses = [
        'Анализ фото на породу и окрас...',
        `Поиск в базе данных ${dbTargetText} питомцев...`,
        'Сравнение данных о местоположении...',
        'Финализация потенциальных совпадений...'
    ];

    useEffect(() => {
        let currentStatusIndex = 0;
        const interval = setInterval(() => {
            currentStatusIndex++;
            if (currentStatusIndex < statuses.length) {
                setStatus(statuses[currentStatusIndex]);
            } else {
                clearInterval(interval);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="text-center py-12 md:py-20 px-6 container mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-800 mb-4">Ищем совпадения...</h2>
            <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto mb-8">Наш ИИ анализирует фотографию и данные {searchTargetText}. Пожалуйста, подождите.</p>
            <div className="flex justify-center items-center flex-col lg:flex-row gap-8">
                <div className="animate-pulse w-full max-w-xs">
                    <PetCard pet={pet} />
                </div>
                <div className="flex flex-col items-center justify-center gap-4 w-16">
                    <SearchIcon className="w-10 h-10 md:w-16 md:h-16 text-indigo-500 animate-pulse" />
                </div>
                <div className="flex flex-col items-center justify-center w-full max-w-xs md:max-w-sm h-auto aspect-square md:h-[452px] bg-white rounded-xl shadow-lg border border-slate-200 p-6 md:p-8">
                     <PawIcon className="w-12 h-12 md:w-20 md:h-20 text-indigo-500 animate-spin-slow mb-4 md:mb-6" />
                     <h3 className="text-lg md:text-2xl font-bold text-slate-700 mb-2 md:mb-4">Анализ в процессе</h3>
                     <p className="text-sm md:text-base text-slate-500 h-10 md:h-12 text-center">{status}</p>
                     <style>{`
                        @keyframes spin-slow {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                        .animate-spin-slow {
                            animation: spin-slow 3s linear infinite;
                        }
                     `}</style>
                </div>
            </div>
        </div>
    );
};

const RADIUS_OPTIONS = [1, 3, 10, 30] as const;

const AiSearchMapInline: React.FC<{
  center: { lat: number; lng: number };
  radiusKm: number;
  matchedPets: PetReport[];
  onPetClick: (pet: PetReport) => void;
}> = ({ center, radiusKm, matchedPets, onPetClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || !(window as any).L || mapInstanceRef.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, { attributionControl: false, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19
    }).addTo(map);
    map.setView([center.lat, center.lng], 12);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !(window as any).L) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;

    if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; }
    const circle = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1, weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const createIcon = (color: string) => L.divIcon({
      className: 'ai-search-marker',
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });

    const centerIcon = L.divIcon({
      html: `<div style="background:#6366f1;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
    const centerMarker = L.marker([center.lat, center.lng], { icon: centerIcon });
    centerMarker.addTo(map);
    markersRef.current.push(centerMarker);

    matchedPets.forEach((pet) => {
      if (!pet.lat || !pet.lng) return;
      const isLost = (pet.type || 'lost') === 'lost';
      const marker = L.marker([pet.lat, pet.lng], { icon: createIcon(isLost ? '#EF4444' : '#22C55E') });
      marker.on('click', () => onPetClick(pet));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    const group = L.featureGroup([circle, ...markersRef.current]);
    map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 14 });
  }, [center, radiusKm, matchedPets, onPetClick]);

  return (
    <div className="w-full h-[280px] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

// Утилита: извлечение номера телефона из contactInfo и генерация ссылок
const parsePhone = (contactInfo: string): string | null => {
    const cleaned = contactInfo.replace(/[\s\-\(\)]/g, '');
    const match = cleaned.match(/(\+?\d{10,15})/);
    if (match) {
        let phone = match[1];
        // Нормализация: 89... → +79...
        if (phone.startsWith('8') && phone.length === 11) {
            phone = '+7' + phone.slice(1);
        }
        if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }
        return phone;
    }
    return null;
};

const parseEmail = (contactInfo: string): string | null => {
    const match = contactInfo.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match ? match[0] : null;
};

// Компонент кнопок быстрой связи
const QuickContactButtons: React.FC<{ contactInfo: string, ownerName?: string, compact?: boolean }> = ({ contactInfo, ownerName, compact }) => {
    const phone = parsePhone(contactInfo);
    const email = parseEmail(contactInfo);
    const whatsappText = encodeURIComponent('Здравствуйте! Я нашёл(а) питомца, который может быть вашим. Посмотрите, пожалуйста, фото на сайте Поиск Питомцев.');

    if (!phone && !email) return null;

    if (compact) {
        return (
            <div className="flex flex-wrap gap-2">
                {phone && (
                    <>
                        <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                            <PhoneIcon className="w-3.5 h-3.5" /> Позвонить
                        </a>
                        <a href={`https://wa.me/${phone.replace('+', '')}?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#1da851] transition-colors shadow-sm">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.462-1.494A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.326-.733-6.016-1.971l-.42-.312-2.646.886.886-2.646-.312-.42A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                            WhatsApp
                        </a>
                        <a href={`https://t.me/${phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0088cc] text-white text-xs font-bold rounded-lg hover:bg-[#006da3] transition-colors shadow-sm">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                            Telegram
                        </a>
                    </>
                )}
                {email && !phone && (
                    <a href={`mailto:${email}?subject=Найден похожий питомец&body=Здравствуйте! Я нашёл(а) питомца, который может быть вашим.`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        Написать на почту
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            {phone && (
                <>
                    <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-md text-sm">
                        <PhoneIcon className="w-5 h-5" /> Позвонить {phone}
                    </a>
                    <a href={`https://wa.me/${phone.replace('+', '')}?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#1da851] transition-colors shadow-md text-sm">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.462-1.494A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.326-.733-6.016-1.971l-.42-.312-2.646.886.886-2.646-.312-.42A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                        WhatsApp
                    </a>
                    <a href={`https://t.me/${phone}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#0088cc] text-white font-bold rounded-xl hover:bg-[#006da3] transition-colors shadow-md text-sm">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        Telegram
                    </a>
                </>
            )}
            {email && !phone && (
                <a href={`mailto:${email}?subject=Найден похожий питомец&body=Здравствуйте! Я нашёл(а) питомца, который может быть вашим.`} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md text-sm">
                    Написать на почту
                </a>
            )}
        </div>
    );
};


const ResultsView: React.FC<{ 
    pet: PetReport, 
    matches: MatchResult[], 
    candidates: PetReport[], 
    error?: string,
    aiSearchRadius: number,
    setAiSearchRadius: (r: number) => void,
    onSearchAgain: () => void,
    onBack: () => void,
    onPetClick: (pet: PetReport) => void,
    onUserClick: (userId: string) => void
}> = ({ pet, matches, candidates, error, aiSearchRadius, setAiSearchRadius, onSearchAgain, onBack, onPetClick, onUserClick }) => {
    const matchedPets = useMemo(() => {
        return matches.map(match => {
            const petDetails = candidates.find(p => p.id === match.id);
            return petDetails ? { ...petDetails, matchInfo: { confidence: match.confidence, reasoning: match.reasoning } } : null;
        }).filter(Boolean) as (PetReport & { matchInfo: { confidence: number, reasoning: string } })[];
    }, [matches, candidates]);

    const bestMatch = matchedPets.length > 0 ? matchedPets[0] : null;
    const hasHighMatch = bestMatch && bestMatch.matchInfo.confidence >= 60;

    const colTitle = pet.type === 'found' ? 'Ваш запрос (найден)' : 'Ваш запрос (потерян)';

    return (
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12 min-h-screen">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <button 
                        onClick={onBack}
                        className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors font-medium text-sm mb-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Назад к поиску
                    </button>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Результаты ИИ-поиска</h2>
                    {!error && (
                        <p className="text-slate-500 mt-1">
                            Мы сравнили вашего питомца с базой данных. Вот наиболее вероятные совпадения.
                        </p>
                    )}
                </div>
                {!error && pet.lat != null && pet.lng != null && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-600">Радиус:</span>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                {RADIUS_OPTIONS.map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setAiSearchRadius(r)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${aiSearchRadius === r ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        {r} км
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={onSearchAgain}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                        >
                            <SearchIcon className="w-4 h-4" />
                            Искать снова
                        </button>
                    </div>
                )}
            </div>

            {error ? (
                 <div className="max-w-3xl mx-auto p-8 bg-red-50 border border-red-200 rounded-xl text-center">
                     <div className="inline-flex bg-red-100 p-4 rounded-full mb-4">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                         </svg>
                     </div>
                     <h3 className="text-xl font-bold text-red-800 mb-2">Что-то пошло не так</h3>
                     <p className="text-red-700 mb-6 text-left whitespace-pre-line max-w-2xl mx-auto">{error}</p>
                     <button onClick={onBack} className="px-6 py-2 bg-white text-red-700 border border-red-200 font-semibold rounded-lg shadow-sm hover:bg-red-50">
                         Вернуться назад
                     </button>
                </div>
            ) : (
                 <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
                    
                    {/* Left Sidebar: Target Pet */}
                    <div className="w-full lg:w-1/3 xl:w-1/4 flex-shrink-0">
                         <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4 lg:sticky lg:top-24">
                            <div className="flex items-center gap-2 mb-4 text-indigo-900 font-bold uppercase tracking-wider text-xs">
                                <div className="p-1.5 bg-indigo-100 rounded-lg">
                                    <SearchIcon className="w-4 h-4"/>
                                </div>
                                {colTitle}
                            </div>
                            
                            {/* Card Wrapper with shadow tweak */}
                            <div className="shadow-sm hover:shadow-md transition-shadow rounded-xl overflow-hidden">
                                <PetCard pet={pet} onClick={() => onPetClick(pet)} onUserClick={onUserClick} />
                            </div>

                            <div className="mt-4 flex items-start gap-2 text-xs text-indigo-700/80 leading-relaxed">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                                </svg>
                                <p>Это эталонное объявление. Результаты справа отсортированы по степени сходства с ним.</p>
                            </div>
                         </div>
                    </div>

                    {/* Right Content: Matches Grid */}
                    <div className="w-full lg:w-2/3 xl:w-3/4">
                        <div className="flex items-center gap-3 mb-6">
                             <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                                <PawIcon className="w-6 h-6 text-white"/>
                             </div>
                             <h3 className="text-2xl font-bold text-slate-800">
                                Найденные совпадения <span className="text-slate-400 font-normal ml-1 text-lg">({matches.length})</span>
                             </h3>
                        </div>

                        {pet.lat != null && pet.lng != null && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-600">
                                    <MapIcon className="w-4 h-4" />
                                    Зона поиска (радиус {aiSearchRadius} км)
                                </div>
                                <AiSearchMapInline
                                    center={{ lat: pet.lat, lng: pet.lng }}
                                    radiusKm={aiSearchRadius}
                                    matchedPets={matchedPets}
                                    onPetClick={onPetClick}
                                />
                            </div>
                        )}

                        {matchedPets.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {matchedPets.map((p, index) => (
                                    <div key={p.id} className="relative group animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
                                        {/* Floating match score badge */}
                                        <div className="absolute -top-3 -right-2 z-20 flex flex-col items-center">
                                            <div className={`text-sm font-bold px-3 py-1.5 rounded-full shadow-lg border-2 border-white ${
                                                p.matchInfo.confidence > 80 ? 'bg-green-500 text-white' :
                                                p.matchInfo.confidence > 50 ? 'bg-blue-500 text-white' :
                                                'bg-yellow-500 text-white'
                                            }`}>
                                                {Math.round(p.matchInfo.confidence)}%
                                            </div>
                                        </div>
                                        
                                        {/* Quick contact under each match card */}
                                        <PetCard pet={p} matchInfo={p.matchInfo} onClick={() => onPetClick(p)} onUserClick={onUserClick} />
                                        {p.contactInfo && p.matchInfo.confidence >= 60 && (
                                            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                                                <p className="text-xs font-bold text-green-800 mb-1">Свяжитесь с владельцем!</p>
                                                <p className="text-[10px] text-green-600 mb-2 leading-relaxed">Ваш звонок может спасти животное. Не уходите от питомца!</p>
                                                <QuickContactButtons contactInfo={p.contactInfo} compact />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                                <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <SearchIcon className="w-10 h-10 text-slate-300"/>
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 mb-3">Совпадений не найдено</h3>
                                <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                                    К сожалению, мы не нашли питомцев с высокой степенью сходства.
                                    Попробуйте обновить поиск позже или проверить параметры фильтрации на главной.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const LoginView: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="w-full max-w-md p-6 md:p-8 space-y-6 md:space-y-8 bg-white rounded-2xl shadow-xl text-center">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Добро пожаловать!</h2>
                    <p className="mt-2 text-xs md:text-sm text-slate-600">
                        Войдите, чтобы создавать объявления и получать уведомления.
                    </p>
                </div>
                <div className="mt-8">
                     <button
                        onClick={onLogin}
                        type="button"
                        className="w-full inline-flex justify-center items-center gap-4 py-3 px-4 border border-slate-300 rounded-md shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                    >
                        <GoogleIcon className="w-5 h-5" />
                        <span>Войти с помощью Google</span>
                    </button>
                </div>
                 <p className="mt-4 text-[10px] md:text-xs text-slate-500">
                    Мы симулируем вход в Google для демонстрационных целей.
                </p>
            </div>
        </div>
    );
};

const AccountView: React.FC<{
    currentUser: string;
    allLostPets: PetReport[];
    allFoundPets: PetReport[];
    notifications: Notification[];
    userProfile: UserProfile | null;
    onSaveProfile: (profile: UserProfile, photoBase64?: string) => void;
    onEdit: (pet: PetReport) => void;
    onDelete: (petId: string) => void;
    onToggleStatus: (pet: PetReport) => void;
    onMarkAsRead: (notificationId: string) => void;
    onFindMatches: (pet: PetReport) => void;
    onPetClick: (pet: PetReport) => void;
    onUserClick: (userId: string) => void;
}> = ({ currentUser, allLostPets, allFoundPets, notifications, userProfile, onSaveProfile, onEdit, onDelete, onToggleStatus, onMarkAsRead, onFindMatches, onPetClick, onUserClick }) => {
    // Используем Firebase UID для фильтрации объявлений
    const currentUserId = localStorage.getItem('petFinderUserId');
    const myLostPets = allLostPets.filter(p => p.userId === currentUserId);
    const myFoundPets = allFoundPets.filter(p => p.userId === currentUserId);
    const myNotifications = notifications.filter(n => n.userId === currentUserId);
    const unreadCount = myNotifications.filter(n => !n.read).length;

    const [name, setName] = useState(userProfile?.name || '');
    const [phone, setPhone] = useState(userProfile?.phone || '');
    const [email, setEmail] = useState(userProfile?.email || '');
    const [photoBase64, setPhotoBase64] = useState<string>('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isNotificationsExpanded, setIsNotificationsExpanded] = useState(true);

    // Функция для сжатия изображения
    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
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

                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL(file.type, 0.9);
                        resolve(dataUrl);
                    } else {
                        reject(new Error('Failed to get canvas context'));
                    }
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                const compressedImage = await compressImage(file);
                setPhotoBase64(compressedImage);
            } catch (error) {
                console.error('Error compressing image:', error);
            }
        }
    };

    // Загрузка данных из Firestore при монтировании компонента
    useEffect(() => {
        const loadUserProfile = async () => {
            try {
                const userId = localStorage.getItem('petFinderUserId');
                if (userId && currentUser) {
                    const userDocRef = doc(db, 'users', userId);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        setName(data.name || '');
                        setPhone(data.phone || '');
                        setEmail(data.email || '');
                        setPhotoBase64(data.photoBase64 || '');
                        
                        // Обновляем локальный профиль
                        onSaveProfile({
                            userId: currentUser,
                            name: data.name || '',
                            phone: data.phone || '',
                            email: data.email || ''
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading user profile from Firestore:', error);
            }
        };
        
        loadUserProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);
        await onSaveProfile({
            userId: currentUser,
            name,
            phone,
            email
        }, photoBase64); // Передаем photoBase64 вместе с профилем
        
        setTimeout(() => setIsSavingProfile(false), 1000);
    };

    return (
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-800 mb-6 md:mb-10 truncate">ЛК: {currentUser}</h2>
            
            {/* Profile Settings */}
            <div className="mb-8 md:mb-12 bg-white p-4 md:p-6 rounded-xl shadow-md border border-slate-100">
                 <h3 className="text-lg md:text-xl font-bold text-slate-700 mb-4 md:mb-6 flex items-center gap-2">
                     <UserCircleIcon className="w-5 h-5 md:w-6 md:h-6 text-indigo-600"/>
                     Настройки профиля
                 </h3>
                 
                 {/* Avatar Upload */}
                 <div className="mb-6 md:mb-8 flex justify-center">
                    <label className="cursor-pointer group">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-indigo-200 group-hover:border-indigo-400 transition-colors bg-slate-100 flex items-center justify-center">
                            {photoBase64 ? (
                                <img 
                                    src={photoBase64} 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <CameraIcon className="w-12 h-12 md:w-16 md:h-16 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                {photoBase64 && (
                                    <CameraIcon className="w-8 h-8 md:w-10 md:h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                            </div>
                        </div>
                    </label>
                 </div>
                 
                 <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
                     <div>
                         <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Ваше имя</label>
                         <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Иван Иванов"
                            className="w-full px-3 py-2 md:px-4 md:py-2 bg-slate-50 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                         />
                     </div>
                     <div>
                         <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Телефон</label>
                         <input 
                            type="tel" 
                            value={phone} 
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+7 (999) 000-00-00"
                            className="w-full px-3 py-2 md:px-4 md:py-2 bg-slate-50 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                         />
                     </div>
                     <div>
                         <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Email</label>
                         <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@example.com"
                            className="w-full px-3 py-2 md:px-4 md:py-2 bg-slate-50 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                         />
                     </div>
                     <div className="md:col-span-3 flex justify-end mt-2 md:mt-0">
                         <button 
                            type="submit" 
                            disabled={isSavingProfile}
                            className={`w-full md:w-auto px-6 py-2 rounded-md text-white font-medium transition-colors text-sm ${isSavingProfile ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                         >
                             {isSavingProfile ? 'Сохранено!' : 'Сохранить контакты'}
                         </button>
                     </div>
                 </form>
                 <p className="text-[10px] md:text-xs text-slate-500 mt-2">* Эти данные будут автоматически подставляться в новые объявления.</p>
            </div>

            {/* Notifications Section */}
            <div className="mb-8 md:mb-12">
                <div 
                    onClick={() => setIsNotificationsExpanded(!isNotificationsExpanded)}
                    className="flex items-center justify-between cursor-pointer group mb-3 md:mb-4 select-none"
                >
                    <h3 className="text-lg md:text-2xl font-bold text-slate-700 flex items-center gap-2 md:gap-3">
                        <BellIcon className="w-5 h-5 md:w-6 md:h-6"/> 
                        Уведомления
                        {unreadCount > 0 && (
                             <span className="bg-red-500 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{unreadCount}</span>
                        )}
                    </h3>
                     <div className={`p-1 rounded-full group-hover:bg-slate-200 transition-all duration-200 ${isNotificationsExpanded ? 'bg-slate-100' : ''}`}>
                        <ChevronDownIcon className={`w-5 h-5 md:w-6 md:h-6 text-slate-500 transition-transform duration-300 ${isNotificationsExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isNotificationsExpanded ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}>
                    {myNotifications.length > 0 ? (
                        <div className="space-y-3 md:space-y-4">
                            {myNotifications.map(n => {
                                const notificationText = `Возможно, вашего питомца "${n.lostPetName}" нашли!`;
                                const secondaryText = n.foundPetLocation 
                                    ? `Найденный питомец был замечен в "${n.foundPetLocation}".`
                                    : 'Посмотрите объявление для подробностей.';

                                // Находим объявление найденного питомца для перехода
                                const foundPetReport = [...allFoundPets, ...allLostPets].find(p => p.id === n.foundPetId);

                                return (
                                    <div 
                                        key={n.id} 
                                        className={`p-3 md:p-4 rounded-lg flex items-start gap-3 md:gap-4 transition-colors cursor-pointer ${n.read ? 'bg-slate-100 hover:bg-slate-200' : 'bg-green-50 border border-green-200 shadow-sm hover:bg-green-100'}`}
                                        onClick={() => { if (foundPetReport) onPetClick(foundPetReport); }}
                                    >
                                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-md bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xl md:text-2xl">
                                            {n.confidence >= 80 ? '🎯' : '🔍'}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm md:text-base leading-snug">
                                                {notificationText}
                                            </p>
                                            <p className="text-xs md:text-sm text-slate-600 mt-1 line-clamp-2">
                                                {secondaryText}
                                            </p>
                                            <p className="text-xs text-blue-700 mt-1 italic">
                                                Уверенность ИИ: <strong>{Math.round(n.confidence)}%</strong>
                                            </p>
                                            {n.reasoning && (
                                                <p className="text-[10px] md:text-xs text-slate-500 mt-1 line-clamp-2">{n.reasoning}</p>
                                            )}
                                            <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString('ru-RU')}</p>
                                        </div>
                                        {!n.read && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onMarkAsRead(n.id); }} 
                                                className="px-2 py-1 md:px-3 md:py-1 text-[10px] md:text-xs font-medium text-indigo-600 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50 hover:text-indigo-700 transition-colors self-start whitespace-nowrap ml-1 shadow-sm"
                                            >
                                                Прочитано
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 md:py-8 px-6 bg-white rounded-xl shadow-sm border border-slate-100">
                            <p className="text-sm md:text-base text-slate-600">У вас пока нет уведомлений.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* My Pets Section */}
            <div>
                <h3 className="text-lg md:text-2xl font-bold text-slate-700 mb-3 md:mb-4">Мои объявления</h3>
                <div className="space-y-6 md:space-y-8">
                     <div>
                        <h4 className="text-base md:text-xl font-semibold text-slate-600 mb-3 md:mb-4">Потерянные ({myLostPets.length})</h4>
                        {myLostPets.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                                {myLostPets.map(pet => <PetCard key={pet.id} pet={pet} onEdit={() => onEdit(pet)} onDelete={() => onDelete(pet.id)} onToggleStatus={() => onToggleStatus(pet)} onFindMatches={() => onFindMatches(pet)} onClick={() => onPetClick(pet)} onUserClick={onUserClick} />)}
                            </div>
                        ) : <p className="text-sm text-slate-500">У вас нет объявления о потерянных питомцах.</p>}
                     </div>
                     <div>
                        <h4 className="text-base md:text-xl font-semibold text-slate-600 mb-3 md:mb-4">Найденные ({myFoundPets.length})</h4>
                        {myFoundPets.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                                {myFoundPets.map(pet => <PetCard key={pet.id} pet={pet} onEdit={() => onEdit(pet)} onDelete={() => onDelete(pet.id)} onToggleStatus={() => onToggleStatus(pet)} onFindMatches={() => onFindMatches(pet)} onClick={() => onPetClick(pet)} onUserClick={onUserClick} />)}
                            </div>
                        ) : <p className="text-sm text-slate-500">У вас нет объявлений о найденных питомцах.</p>}
                     </div>
                </div>
            </div>
        </div>
    );
};

const LostPetDetailView: React.FC<{ 
  lostPet: PetReport, 
  onBack: () => void 
}> = ({ lostPet, onBack }) => {
    return (
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
            <div className="text-center mb-8 md:mb-12">
                <h2 className="text-2xl md:text-4xl font-bold text-slate-800">Объявление создано!</h2>
                <p className="text-sm md:text-base text-slate-600 mt-2 max-w-2xl mx-auto">Мы уведомим вас, если наш ИИ найдет совпадение.</p>
            </div>
            <div className="max-w-sm mx-auto mb-8 md:mb-10">
                 <PetCard pet={lostPet} />
            </div>
            <div className="flex justify-center items-center pb-8">
                <button onClick={onBack} className="w-full md:w-auto px-8 py-4 text-lg font-semibold text-white bg-indigo-600 rounded-md shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105">
                    Вернуться на главную
                </button>
            </div>
        </div>
    );
};

const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Image conversion error:", error);
        throw error;
    }
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [previousView, setPreviousView] = useState<View>('home');
  const [deleteConfirmPetId, setDeleteConfirmPetId] = useState<string | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  
  // Helper to migrate old data structure (single photo) to new (array photos) and add status/date
  const migratePetData = (data: any[]): PetReport[] => {
      return data.map(p => {
          const newPet = { ...p };
          // Ensure species exists
          if (!newPet.species) newPet.species = 'dog';
          
          // Migrate photo -> photos
          if (!newPet.photos) {
              newPet.photos = newPet.photo ? [newPet.photo] : [];
          }
          
          // Migrate status
          if (!newPet.status) {
              newPet.status = 'active';
          }

          // Migrate date
          if (!newPet.date) {
              newPet.date = new Date().toISOString();
          }

          return newPet as PetReport;
      });
  };

  const initPets = (key: string, initial: PetReport[]) => {
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return migratePetData(parsed);
        } catch (e) {
            return initial;
        }
    }
    return initial;
  };

  // Единый источник правды - все объявления из Firebase
  const [reports, setReports] = useState<PetReport[]>([]);
  
  // Computed значения для обратной совместимости (сортировка: новые сверху)
  const lostPets = useMemo(() => 
    reports
      .filter(p => p.type === 'lost')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
    [reports]
  );
  const foundPets = useMemo(() => 
    reports
      .filter(p => p.type === 'found')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
    [reports]
  );
  
  // User Profiles storage
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(() => {
      const saved = localStorage.getItem('userProfiles');
      return saved ? JSON.parse(saved) : {};
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeSearchPet, setActiveSearchPet] = useState<PetReport | null>(null);
  const [currentLostPet, setCurrentLostPet] = useState<PetReport | null>(null);
  const [editingPet, setEditingPet] = useState<PetReport | null>(null);
  const [viewingPet, setViewingPet] = useState<PetReport | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [aiSearchRadius, setAiSearchRadius] = useState<number>(10);
  const [pendingAutoSearch, setPendingAutoSearch] = useState<{ userId: string, type: 'lost' | 'found' } | null>(null);
  const [locationFilter, setLocationFilter] = useState('');
  
  // New State for Geolocation
  const [searchCoords, setSearchCoords] = useState<{lat: number, lng: number} | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(10); // Default 10km
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('petFinderUser'));
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [breedFilter, setBreedFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [collarFilter, setCollarFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [keptByFinderFilter, setKeptByFinderFilter] = useState<'all' | 'yes' | 'no'>('all');

  const petPendingDelete = useMemo(
    () => (deleteConfirmPetId ? reports.find(p => p.id === deleteConfirmPetId) : null),
    [deleteConfirmPetId, reports]
  );

  // Reset breed filter when species changes
  useEffect(() => {
    setBreedFilter('all');
  }, [speciesFilter]);

  // Подписка на уведомления из Firestore (query по userId)
  useEffect(() => {
    const userId = localStorage.getItem('petFinderUserId');
    if (!userId) {
      setNotifications([]);
      return;
    }
    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const allNotifs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Notification))
        .sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(allNotifs);
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });
    return () => unsubscribe();
  }, [currentUser]);
  
  useEffect(() => {
      try {
          localStorage.setItem('userProfiles', JSON.stringify(profiles));
      } catch(error) {
          console.error("Failed to save profiles to localStorage:", error);
      }
  }, [profiles]);

  // Track Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userName = user.displayName || user.email || `User_${user.uid.slice(0, 6)}`;
        localStorage.setItem('petFinderUser', userName);
        localStorage.setItem('petFinderUserId', user.uid);
        setCurrentUser(userName);
      } else {
        // User is signed out
        if (!localStorage.getItem('petFinderUser')) {
          setCurrentUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time подписка на коллекцию reports - единый источник правды
  useEffect(() => {
    const reportsCollection = collection(db, 'reports');
    
    const unsubscribe = onSnapshot(reportsCollection, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Нормализуем данные и убеждаемся, что все обязательные поля присутствуют
        return {
          id: doc.id,
          type: data.type || 'lost',
          status: data.status || 'active',
          userId: data.userId || 'unknown',
          species: data.species || 'dog',
          petName: data.petName || '',
          breed: data.breed || 'Не указана',
          color: data.color || 'Не указан',
          lastSeenLocation: data.lastSeenLocation || 'Не указано',
          city: data.city,
          region: data.region,
          lat: data.lat,
          lng: data.lng,
          description: data.description || '',
          specialMarks: data.specialMarks,
          hasCollar: data.hasCollar,
          collarColor: data.collarColor,
          isChipped: data.isChipped,
          keptByFinder: data.keptByFinder,
          lostDate: data.lostDate,
          contactInfo: data.contactInfo || '',
          photos: data.photos || (data.mainPhoto ? [data.mainPhoto] : []),
          mainPhoto: data.mainPhoto || data.photos?.[0] || null,
          date: data.date?.toDate?.()?.toISOString() || data.date || new Date().toISOString()
        } as PetReport;
      });
      
      setReports(reportsData);
    }, (error) => {
      console.error('Error listening to reports:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (user: { uid: string; displayName: string | null; email: string | null }) => {
    const userName = user.displayName || user.email || `User_${user.uid.slice(0, 6)}`;
    localStorage.setItem('petFinderUser', userName);
    localStorage.setItem('petFinderUserId', user.uid);
    setCurrentUser(userName);
    setIsLoginModalOpen(false);
  };
  
  const handleLogout = async () => {
    try {
      // Sign out from Firebase
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
    localStorage.removeItem('petFinderUser');
    localStorage.removeItem('petFinderUserId');
    setCurrentUser(null);
    setView('home');
  };
  
  const handleSaveProfile = async (profile: UserProfile, photoBase64?: string) => {
      // Сохраняем в локальное состояние
      setProfiles(prev => ({
          ...prev,
          [profile.userId]: profile
      }));
      
      // Сохраняем в Firestore (используем uid из Firebase Auth)
      try {
          const userId = localStorage.getItem('petFinderUserId') || auth.currentUser?.uid;
          if (userId) {
              const dataToSave: any = {
                  name: profile.name,
                  phone: profile.phone,
                  email: profile.email
              };
              if (photoBase64 !== undefined) {
                  dataToSave.photoBase64 = photoBase64;
              }
              await setDoc(doc(db, 'users', userId), dataToSave, { merge: true }); // merge: true позволяет обновлять только указанные поля
          }
      } catch (error) {
          console.error('Error saving profile to Firestore:', error);
      }
  };

  const handlePetClick = (pet: PetReport) => {
    setViewingPet(pet);
    setPreviousView(view);
    setView('petDetail');
  };
  
  const handleUserClick = (userId: string) => {
      setViewingProfileId(userId);
      setPreviousView(view);
      setView('publicProfile');
  };

  const handleToggleStatus = async (pet: PetReport) => {
      // Проверка прав доступа: только владелец может изменять статус
      const currentUserId = localStorage.getItem('petFinderUserId');
      
      if (pet.userId !== currentUserId) {
        toast.error('Вы можете изменять статус только своих объявлений');
        return;
      }
      
      // Explicitly type status as 'active' | 'resolved' to avoid type widening to string
      const newStatus: 'active' | 'resolved' = pet.status === 'resolved' ? 'active' : 'resolved';
      
      try {
        const reportRef = doc(db, 'reports', pet.id);
        await updateDoc(reportRef, { status: newStatus });
        // onSnapshot автоматически обновит стейт reports
      } catch (error) {
        console.error('Error updating report status:', error);
        toast.error('Не удалось изменить статус объявления. Попробуйте еще раз.');
      }
  };

  const handleStartAiSearch = useCallback(async (petToMatch: PetReport) => {
    if (!currentUser) {
        toast('Пожалуйста, войдите в систему для поиска', { icon: '🔐' });
        setView('login');
        return;
    }
    const currentUserId = localStorage.getItem('petFinderUserId');
    if (!currentUserId || petToMatch.userId !== currentUserId) {
        toast('ИИ-поиск доступен только для ваших объявлений', { icon: '🔒' });
        return;
    }
    
    setError(undefined); // Reset previous errors
    setView('matching');
    setActiveSearchPet(petToMatch);

    try {
        let petWithBase64 = { ...petToMatch };
        // For AI matching, we typically just need the first photo to identify
        const primaryPhoto = petToMatch.photos && petToMatch.photos.length > 0 ? petToMatch.photos[0] : '';

        if (primaryPhoto.startsWith('http')) {
            try {
                const base64Photo = await imageUrlToBase64(primaryPhoto);
                petWithBase64.photos = [base64Photo, ...petToMatch.photos.slice(1)];
            } catch (error) {
                console.error("Failed to convert image URL to base64:", error);
                throw new Error("Не удалось загрузить изображение для анализа. Возможно, сайт-источник блокирует доступ. Попробуйте загрузить фото с вашего устройства.");
            }
        }

        const isSearchingFound = petToMatch.type === 'found';
        const sourceCandidates = isSearchingFound ? lostPets : foundPets;
        let candidates = sourceCandidates.filter(p => p.status !== 'resolved');

        // Для "Потерял" используем lostDate (дату потери), если указана
        const refDate = petToMatch.type === 'lost' && petToMatch.lostDate
            ? new Date(petToMatch.lostDate).getTime()
            : petToMatch.date ? new Date(petToMatch.date).getTime() : 0;
        const now = Date.now();
        const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

        candidates = candidates.filter(c => {
            if (c.species !== petToMatch.species) return false;
            const cDate = c.date ? new Date(c.date).getTime() : 0;
            if (isSearchingFound) {
                // "Нашёл" ищет среди "Потерял": не старше 3 месяцев, не позже даты находки
                if (cDate < threeMonthsAgo) return false;
                if (refDate && cDate > refDate) return false;
            } else {
                // "Потерял" ищет среди "Нашёл": от (даты потери - 14 дней) до сегодня, не старше 3 месяцев
                const bufferDays = 14 * 24 * 60 * 60 * 1000;
                const searchFrom = refDate ? refDate - bufferDays : threeMonthsAgo;
                if (cDate < searchFrom) return false;
                if (cDate < threeMonthsAgo) return false;
            }
            return true;
        });

        const centerLat = petToMatch.lat;
        const centerLng = petToMatch.lng;
        const hasCoords = centerLat != null && centerLng != null;

        if (hasCoords) {
            candidates = candidates.filter(c => {
                if (!c.lat || !c.lng) return false;
                return getDistanceFromLatLonInKm(centerLat, centerLng, c.lat, c.lng) <= aiSearchRadius;
            });
        }

        const scoreCandidate = (c: PetReport): number => {
            let s = 0;
            const cColor = (c.color || '').toLowerCase();
            const tColor = (petToMatch.color || '').toLowerCase();
            if (cColor && tColor && (cColor.includes(tColor) || tColor.includes(cColor))) s += 3;
            const cMarks = (c.specialMarks || '').toLowerCase();
            const tMarks = (petToMatch.specialMarks || '').toLowerCase();
            const marksWords = [...new Set([...cMarks.split(/\s+/), ...tMarks.split(/\s+/)])].filter(w => w.length > 2);
            if (marksWords.some(w => cMarks.includes(w) && tMarks.includes(w))) s += 3;
            if (c.hasCollar === petToMatch.hasCollar) s += 2;
            if (hasCoords && c.lat && c.lng) {
                const d = getDistanceFromLatLonInKm(centerLat!, centerLng!, c.lat, c.lng);
                if (d < 1) s += 3; else if (d < 5) s += 2; else if (d < 10) s += 1;
            }
            const cD = c.date ? new Date(c.date).getTime() : 0;
            if (refDate && Math.abs(cD - refDate) < 7 * 24 * 60 * 60 * 1000) s += 1;
            return s;
        };

        candidates = [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

        const candidatesWithPhotos = candidates.filter(c => c.photos?.[0] && c.photos[0].length > 100);
        const topCandidates = candidatesWithPhotos.slice(0, 8);

        if (topCandidates.length > 0) {
            const matchResults = await findPetMatches(petWithBase64, topCandidates);
            // Sort results by confidence descending (highest match first)
            matchResults.sort((a, b) => b.confidence - a.confidence);
            
            setMatches(matchResults);
            
            // Сохраняем уведомления в Firestore (только >= 60%)
            const NOTIFICATION_THRESHOLD = 60;
            const highConfidenceMatches = matchResults.filter(m => m.confidence >= NOTIFICATION_THRESHOLD);
            
            for (const match of highConfidenceMatches) {
                const matchedCandidate = topCandidates.find(p => p.id === match.id);
                if (matchedCandidate && matchedCandidate.userId) {
                    const lostPet = isSearchingFound ? matchedCandidate : petToMatch;
                    const foundPet = isSearchingFound ? petToMatch : matchedCandidate;
                    
                    try {
                        await addDoc(collection(db, 'notifications'), {
                            userId: lostPet.userId,
                            lostPetId: lostPet.id,
                            lostPetName: lostPet.petName || 'Без клички',
                            lostPetPhoto: '',
                            foundPetId: foundPet.id,
                            foundPetLocation: foundPet.lastSeenLocation || '',
                            foundPetPhoto: '',
                            confidence: match.confidence,
                            reasoning: (match.reasoning || '').substring(0, 500),
                            timestamp: Date.now(),
                            read: false,
                        });
                    } catch (err) {
                        console.error('Failed to save notification to Firestore:', err);
                    }
                }
            }
        } else {
            setMatches([]);
            if (candidates.length === 0 && sourceCandidates.filter(p => p.status !== 'resolved').length > 0) {
                toast('В радиусе поиска нет подходящих объявлений. Попробуйте позже.', { icon: '🔍' });
            }
        }
        setView('results');
    } catch (e: any) {
        console.error("AI Search Error:", e);
        setError(e.message || "Произошла неизвестная ошибка при поиске.");
        setView('results'); // Show results view but with error state
    }
  }, [currentUser, lostPets, foundPets, aiSearchRadius]);

  const handleReportSubmit = useCallback((reportData: Omit<PetReport, 'id' | 'type' | 'userId' | 'status' | 'date'>, formType: 'lost' | 'found' | 'edit') => {
    console.log('🏠 [App] handleReportSubmit вызван, formType:', formType);
    console.log('🏠 [App] currentUser:', currentUser);
    
    if (!currentUser) {
        console.log('❌ [App] Нет currentUser, переходим на login');
        toast('Пожалуйста, войдите в систему, чтобы подать объявление', { icon: '🔐' });
        setView('login');
        return;
    }
    
    // Данные уже сохранены в Firebase через ReportForm
    // onSnapshot автоматически обновит стейт reports
    
    if (formType === 'lost' || formType === 'found') {
      console.log(`✅ [App] Устанавливаем флаг авто-поиска для ${formType}`);
      const userId = localStorage.getItem('petFinderUserId');
      if (userId) {
        setPendingAutoSearch({ userId, type: formType });
      }
      toast('Запускаем ИИ-поиск совпадений...', { icon: '🔍', duration: 4000 });
      setView('home');
    } else if (formType === 'edit' && editingPet) {
        console.log('✅ [App] Переходим на account (edit)');
        setEditingPet(null);
        setView('account');
    }
  }, [currentUser, editingPet]);

  // Автопоиск: когда reports обновятся из Firebase и есть pending флаг (для "Нашёл" и "Потерял")
  useEffect(() => {
    if (!pendingAutoSearch) return;
    const { userId, type } = pendingAutoSearch;
    
    // Для "found" ищем свежее found-объявление, для "lost" — свежее lost-объявление
    const targetPets = type === 'found' ? foundPets : lostPets;
    const myPets = targetPets
      .filter(p => p.userId === userId && p.status === 'active')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (myPets.length > 0) {
      const newest = myPets[0];
      // Проверяем что оно свежее (< 60 секунд)
      const age = Date.now() - new Date(newest.date).getTime();
      if (age < 60000) {
        console.log(`🤖 [AutoSearch] Запускаем авто-поиск для ${type}:`, newest.id);
        setPendingAutoSearch(null);
        handleStartAiSearch(newest);
      }
    }
  }, [foundPets, lostPets, pendingAutoSearch, handleStartAiSearch]);

  const handleDelete = async (petId: string) => {
    // Проверка прав доступа: только владелец может удалить
    const pet = reports.find(p => p.id === petId);
    const currentUserId = localStorage.getItem('petFinderUserId');
    
    if (!pet || pet.userId !== currentUserId) {
      toast.error('Вы можете удалять только свои объявления');
      return;
    }
    
    setDeleteConfirmPetId(petId);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmPetId) return;
    if (isDeletingReport) return;

    const pet = reports.find(p => p.id === deleteConfirmPetId);
    const currentUserId = localStorage.getItem('petFinderUserId');

    if (!pet || pet.userId !== currentUserId) {
      toast.error('Вы можете удалять только свои объявления');
      setDeleteConfirmPetId(null);
      return;
    }

    try {
      setIsDeletingReport(true);
      const reportRef = doc(db, 'reports', deleteConfirmPetId);
      await deleteDoc(reportRef);
      toast.success('Объявление удалено');
      setDeleteConfirmPetId(null);
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Не удалось удалить объявление. Попробуйте еще раз.');
    } finally {
      setIsDeletingReport(false);
    }
  }, [deleteConfirmPetId, isDeletingReport, reports]);

  const handleEdit = (pet: PetReport) => {
    // Проверка прав доступа: только владелец может редактировать
    const currentUserId = localStorage.getItem('petFinderUserId');
    
    if (pet.userId !== currentUserId) {
      toast.error('Вы можете редактировать только свои объявления');
      return;
    }
    
    setEditingPet(pet);
    setView('editReport');
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
        toast.error('Геолокация не поддерживается вашим браузером');
        return;
    }
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setSearchCoords({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
            setLocationFilter("📍 Мое местоположение");
            setIsLocatingUser(false);
        },
        (err) => {
            console.error(err);
            toast.error('Не удалось определить местоположение. Проверьте разрешения браузера.');
            setIsLocatingUser(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationFilter(e.target.value);
    if (searchCoords) {
        setSearchCoords(null); // Switch back to text mode if user types
    }
  };

  // Helper to get available breeds based on current pets and species filter
  const availableBreeds = useMemo(() => {
    const allPets = [...lostPets, ...foundPets];
    const filteredBySpecies = speciesFilter === 'all' 
        ? allPets 
        : allPets.filter(p => p.species === speciesFilter);
    
    const breeds = new Set(filteredBySpecies.map(p => p.breed).filter(b => b && b !== 'Не указана'));
    return Array.from(breeds).sort();
  }, [lostPets, foundPets, speciesFilter]);
  
  const getFormattedContact = (userId: string | null) => {
      if (!userId || !profiles[userId]) return '';
      const p = profiles[userId];
      const parts = [];
      if (p.name) parts.push(p.name);
      if (p.phone) parts.push(p.phone);
      if (p.email) parts.push(p.email);
      return parts.join(', ');
  };

  // ===== Общая фильтрация (используется и списком, и картой) =====
  const filterPet = useCallback((pet: PetReport) => {
    // 1. Species Filter
    if (speciesFilter !== 'all' && pet.species !== speciesFilter) return false;

    // 2. Breed Filter
    if (breedFilter !== 'all' && pet.breed !== breedFilter) return false;

    // 3. Date Filter
    if (dateFilter !== 'all') {
      const petDate = new Date(pet.date).getTime();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today' && (now - petDate) > oneDay) return false;
      if (dateFilter === '3days' && (now - petDate) > (3 * oneDay)) return false;
      if (dateFilter === 'week' && (now - petDate) > (7 * oneDay)) return false;
      if (dateFilter === 'month' && (now - petDate) > (30 * oneDay)) return false;
    }

    // 4. Collar Filter
    if (collarFilter !== 'all') {
      if (collarFilter === 'yes' && !pet.hasCollar) return false;
      if (collarFilter === 'no' && pet.hasCollar) return false;
    }

    // 5. KeptByFinder Filter (only for found)
    if (keptByFinderFilter !== 'all' && pet.type === 'found') {
      if (keptByFinderFilter === 'yes' && pet.keptByFinder !== true) return false;
      if (keptByFinderFilter === 'no' && pet.keptByFinder !== false) return false;
    }

    // 6. Location Filter (Enhanced with Radius)
    if (searchCoords) {
      if (pet.lat && pet.lng) {
        const distance = getDistanceFromLatLonInKm(searchCoords.lat, searchCoords.lng, pet.lat, pet.lng);
        if (distance > searchRadius) return false;
      } else {
        return false;
      }
    } else if (locationFilter && locationFilter !== '📍 Мое местоположение') {
      const q = locationFilter.toLowerCase();
      const matchLocation =
        (pet.city && pet.city.toLowerCase().includes(q)) ||
        (pet.region && pet.region.toLowerCase().includes(q)) ||
        pet.lastSeenLocation.toLowerCase().includes(q);
      if (!matchLocation) return false;
    }

    return true;
  }, [speciesFilter, breedFilter, dateFilter, collarFilter, keptByFinderFilter, searchCoords, searchRadius, locationFilter]);

  // Отфильтрованные списки (общие для карты и главной)
  const filteredLostPets = useMemo(() => lostPets.filter(filterPet), [lostPets, filterPet]);
  const filteredFoundPets = useMemo(() => foundPets.filter(filterPet), [foundPets, filterPet]);

  // Фильтр для карты — без радиуса и локации (только тип, вид, порода, дата)
  const filterPetForMap = useCallback((pet: PetReport) => {
    if (speciesFilter !== 'all' && pet.species !== speciesFilter) return false;
    if (breedFilter !== 'all' && pet.breed !== breedFilter) return false;
    if (dateFilter !== 'all') {
      const petDate = new Date(pet.date).getTime();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today' && (now - petDate) > oneDay) return false;
      if (dateFilter === '3days' && (now - petDate) > (3 * oneDay)) return false;
      if (dateFilter === 'week' && (now - petDate) > (7 * oneDay)) return false;
      if (dateFilter === 'month' && (now - petDate) > (30 * oneDay)) return false;
    }
    return true;
  }, [speciesFilter, breedFilter, dateFilter]);

  const filteredReportsForMap = useMemo(() => {
    let filtered = reports.filter(p => p.status !== 'resolved').filter(filterPetForMap);
    if (filterType === 'lost') filtered = filtered.filter(p => p.type === 'lost');
    if (filterType === 'found') filtered = filtered.filter(p => p.type === 'found');
    return filtered;
  }, [reports, filterPetForMap, filterType]);

  const renderContent = () => {
    switch (view) {
      case 'login':
        return <LoginView onLogin={handleLogin} />;
      case 'account':
        return currentUser && (
            <AccountView 
                currentUser={currentUser} 
                allLostPets={lostPets} 
                allFoundPets={foundPets} 
                notifications={notifications} 
                userProfile={profiles[currentUser] || null}
                onSaveProfile={handleSaveProfile}
                onEdit={handleEdit} 
                onDelete={handleDelete} 
                onToggleStatus={handleToggleStatus}
                onMarkAsRead={handleMarkAsRead} 
                onFindMatches={handleStartAiSearch} 
                onPetClick={handlePetClick} 
                onUserClick={handleUserClick} 
            />
        );
      case 'reportLost':
        return <ReportForm formType="lost" onSubmit={(data) => handleReportSubmit(data, 'lost')} onCancel={() => setView('home')} defaultContactInfo={getFormattedContact(currentUser)} />;
      case 'reportFound':
        return <ReportForm formType="found" onSubmit={(data) => handleReportSubmit(data, 'found')} onCancel={() => setView('home')} defaultContactInfo={getFormattedContact(currentUser)} />;
      case 'editReport':
        return editingPet && <ReportForm formType={editingPet.type} onSubmit={(data) => handleReportSubmit(data, 'edit')} onCancel={() => setView('account')} initialData={editingPet} />;
      case 'lostPetDetail':
        return currentLostPet && <LostPetDetailView 
            lostPet={currentLostPet} 
            onBack={() => setView('home')} 
        />;
      case 'petDetail':
        return viewingPet && <PetDetailView pet={viewingPet} onBack={() => setView(previousView)} onUserClick={handleUserClick} />;
      case 'publicProfile':
        return viewingProfileId && <PublicProfileView userId={viewingProfileId} allLostPets={lostPets} allFoundPets={foundPets} profiles={profiles} onBack={() => setView(previousView)} onPetClick={handlePetClick} />;
      case 'matching':
        return activeSearchPet && <MatchingView pet={activeSearchPet} />;
      case 'results':
         const candidates = activeSearchPet?.type === 'found' ? lostPets : foundPets;
         return activeSearchPet && (
           <ResultsView
             pet={activeSearchPet}
             matches={matches}
             candidates={candidates}
             error={error}
             aiSearchRadius={aiSearchRadius}
             setAiSearchRadius={setAiSearchRadius}
             onSearchAgain={() => handleStartAiSearch(activeSearchPet)}
             onBack={() => setView('account')}
             onPetClick={handlePetClick}
             onUserClick={handleUserClick}
           />
         );
      case 'map':
          return <MapView 
            reports={filteredReportsForMap} 
            onPetClick={handlePetClick}
            filterType={filterType}
            setFilterType={setFilterType}
            speciesFilter={speciesFilter}
            setSpeciesFilter={setSpeciesFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            userLocation={searchCoords}
            isLocatingUser={isLocatingUser}
            onUseMyLocation={handleUseMyLocation}
          />;
      case 'privacy':
          return <PrivacyPolicyView onBack={() => setView('home')} />;
      case 'terms':
          return <TermsView onBack={() => setView('home')} />;
      case 'home':
      default:
        const homeFilteredLost = filteredLostPets;
        const homeFilteredFound = filteredFoundPets;

        const renderEmptyState = (type: 'lost' | 'found') => {
            const emptyStateTitle = type === 'lost' ? 'Нет потерянных' : 'Нет находок';
            const emptyStateSubtitle = type === 'lost' ? 'Все питомцы дома!' : 'Пока никто не сообщал о находках.';

            return (
                <div className="text-center py-12 md:py-16 px-4 md:px-6 bg-white rounded-xl shadow-lg">
                {locationFilter || speciesFilter !== 'all' || breedFilter !== 'all' || dateFilter !== 'all' || collarFilter !== 'all' || keptByFinderFilter !== 'all' || searchCoords ? (
                    <><SearchIcon className="w-12 h-12 md:w-16 md:h-16 mx-auto text-slate-400 mb-4" /><h3 className="text-lg md:text-2xl font-bold text-slate-800">Ничего не найдено</h3><p className="text-sm md:text-base text-slate-600 mt-2">Попробуйте изменить параметры фильтрации.</p></>
                ) : (
                    <><PawIcon className="w-12 h-12 md:w-16 md:h-16 mx-auto text-slate-400 mb-4" /><h3 className="text-lg md:text-2xl font-bold text-slate-800">{emptyStateTitle}</h3><p className="text-sm md:text-base text-slate-600 mt-2">{emptyStateSubtitle}</p></>
                )}
                </div>
            );
        };

        return (
            <>
              <div className="relative h-[50vh] md:h-[60vh] bg-cover bg-center flex items-center justify-center text-white" style={{backgroundImage: "url('https://images.unsplash.com/photo-1548681528-6a5c45b66b42?q=80&w=2070&auto=format&fit=crop')"}}>
                <div className="absolute inset-0 bg-black/50"></div>
                <div className="relative z-10 text-center px-4">
                  <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-3 md:mb-4 leading-tight" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.5)'}}>Каждая лапа заслуживает свой дом</h1>
                  <p className="text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-snug" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}>ИИ-поиск для воссоединения потерянных питомцев.</p>
                  <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 w-full max-w-sm sm:max-w-none mx-auto">
                    <button onClick={() => currentUser ? setView('reportFound') : setView('login')} className="w-full sm:w-56 rounded-md bg-emerald-600/90 px-6 sm:px-8 py-3 md:py-4 text-lg font-semibold text-white shadow-lg hover:bg-emerald-500 transition-transform active:scale-95 hover:scale-105">Нашел питомца</button>
                    <button onClick={() => currentUser ? setView('reportLost') : setView('login')} className="w-full sm:w-56 rounded-md bg-sky-600/90 px-6 sm:px-8 py-3 md:py-4 text-lg font-semibold text-white shadow-lg hover:bg-sky-500 transition-transform active:scale-95 hover:scale-105">Потерял питомца</button>
                  </div>
                </div>
              </div>
              <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
                <div className="flex flex-col md:flex-row justify-center items-center gap-3 md:gap-4 mb-8 md:mb-10 flex-wrap">
                    <div className="flex gap-2 flex-wrap justify-center w-full md:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto justify-between md:justify-start">
                            <button 
                                onClick={() => setFilterType('all')}
                                className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${filterType === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Все
                            </button>
                            <button 
                                onClick={() => setFilterType('lost')}
                                className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${filterType === 'lost' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Потерянные
                            </button>
                            <button 
                                onClick={() => setFilterType('found')}
                                className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${filterType === 'found' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Найденные
                            </button>
                        </div>

                        {/* Location Filter Input Group */}
                        <div className="flex gap-2 w-full md:w-auto flex-1">
                            <div className="relative flex-grow min-w-[160px]">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPinIcon className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Город или район"
                                    value={locationFilter}
                                    onChange={handleLocationInputChange}
                                    className="block w-full pl-9 pr-10 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                />
                                <button
                                    onClick={handleUseMyLocation}
                                    className={`absolute inset-y-0 right-0 pr-3 pl-2 flex items-center cursor-pointer transition-colors border-l border-slate-100 ml-1 ${isLocatingUser || searchCoords ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
                                    title="Искать рядом со мной"
                                >
                                    {isLocatingUser ? (
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <CrosshairIcon className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            
                            {searchCoords && (
                                <select 
                                    value={searchRadius} 
                                    onChange={(e) => setSearchRadius(Number(e.target.value))} 
                                    className="w-24 pl-2 pr-6 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                    title="Радиус поиска"
                                >
                                    <option value={1}>1 км</option>
                                    <option value={3}>3 км</option>
                                    <option value={5}>5 км</option>
                                    <option value={10}>10 км</option>
                                    <option value={25}>25 км</option>
                                    <option value={50}>50 км</option>
                                </select>
                            )}
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <select 
                                value={speciesFilter} 
                                onChange={(e) => setSpeciesFilter(e.target.value)} 
                                className="flex-1 md:flex-none block w-full md:w-36 pl-2 md:pl-3 pr-8 md:pr-10 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                            <option value="all">Все виды</option>
                            <option value="dog">Собаки</option>
                            <option value="cat">Кошки</option>
                            <option value="other">Другие</option>
                            </select>

                            <select 
                                value={breedFilter} 
                                onChange={(e) => setBreedFilter(e.target.value)} 
                                className="flex-1 md:flex-none block w-full md:w-40 pl-2 md:pl-3 pr-8 md:pr-10 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                            <option value="all">Все породы</option>
                            {availableBreeds.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                            </select>
                        </div>

                         <select 
                            value={dateFilter} 
                            onChange={(e) => setDateFilter(e.target.value)} 
                            className="w-full md:w-44 pl-2 md:pl-3 pr-8 md:pr-10 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                           <option value="all">За все время</option>
                           <option value="today">За 24 часа</option>
                           <option value="3days">За 3 дня</option>
                           <option value="week">За неделю</option>
                           <option value="month">За месяц</option>
                        </select>

                        <select
                            value={collarFilter}
                            onChange={(e) => setCollarFilter(e.target.value as 'all' | 'yes' | 'no')}
                            className="w-full md:w-40 pl-2 md:pl-3 pr-8 md:pr-10 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">Ошейник: любой</option>
                            <option value="yes">С ошейником</option>
                            <option value="no">Без ошейника</option>
                        </select>

                        {(filterType === 'all' || filterType === 'found') && (
                            <select
                                value={keptByFinderFilter}
                                onChange={(e) => setKeptByFinderFilter(e.target.value as 'all' | 'yes' | 'no')}
                                className="w-full md:w-48 pl-2 md:pl-3 pr-8 md:pr-10 py-2 text-xs md:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="all">Нашедший: все</option>
                                <option value="yes">Оставил у себя</option>
                                <option value="no">Сфотографировал</option>
                            </select>
                        )}
                    </div>
                </div>

                {(filterType === 'all' || filterType === 'lost') && (
                    <section id="lost-pets" className="mb-12 md:mb-16">
                        <div className="text-center mb-6 md:mb-8">
                            <h2 className="text-2xl md:text-4xl font-bold text-slate-800">Недавно потерянные</h2>
                            <p className="text-sm md:text-base text-slate-600 mt-1 md:mt-2">Можете помочь им воссоединиться с семьей?</p>
                        </div>
                        {homeFilteredLost.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {homeFilteredLost.map(pet => (
                            <PetCard
                                key={pet.id}
                                pet={pet}
                                onClick={() => handlePetClick(pet)}
                                onUserClick={handleUserClick}
                            />
                            ))}
                        </div>
                        ) : (
                        renderEmptyState('lost')
                        )}
                    </section>
                )}
                
                {(filterType === 'all' || filterType === 'found') && (
                    <section id="found-pets">
                        <div className="text-center mb-6 md:mb-8">
                            <h2 className="text-2xl md:text-4xl font-bold text-slate-800">Недавно найденные</h2>
                            <p className="text-sm md:text-base text-slate-600 mt-1 md:mt-2">Помогите этим питомцам найти своих хозяев.</p>
                        </div>
                        {homeFilteredFound.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {homeFilteredFound.map(pet => (
                            <PetCard
                                key={pet.id}
                                pet={pet}
                                onClick={() => handlePetClick(pet)}
                                onUserClick={handleUserClick}
                            />
                            ))}
                        </div>
                        ) : (
                        renderEmptyState('found')
                        )}
                    </section>
                )}
              </div>
            </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentUser={currentUser} onViewChange={setView} currentView={view} onLogout={handleLogout} onLogin={() => setIsLoginModalOpen(true)} unreadCount={notifications.filter(n => !n.read).length} />
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess} 
      />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
      <ConfirmModal
        isOpen={deleteConfirmPetId !== null}
        title="Удалить объявление?"
        description={
          petPendingDelete
            ? `Вы точно хотите удалить объявление${petPendingDelete.petName ? ` “${petPendingDelete.petName}”` : ''}? Это действие нельзя отменить.`
            : 'Вы точно хотите удалить это объявление? Это действие нельзя отменить.'
        }
        confirmText="Удалить"
        cancelText="Отмена"
        confirmVariant="danger"
        isConfirmLoading={isDeletingReport}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (isDeletingReport) return;
          setDeleteConfirmPetId(null);
        }}
      />
      <main className="flex-grow">
        {renderContent()}
      </main>
      <footer className="bg-slate-800 text-slate-400 text-center p-4 text-xs md:text-sm flex flex-col items-center gap-2">
        <p>&copy; {new Date().getFullYear()} Поиск Питомцев AI. Помогаем питомцам найти дорогу домой.</p>
        <div className="flex gap-4">
            <button 
                onClick={() => setView('privacy')} 
                className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
            >
                Политика конфиденциальности
            </button>
            <button
                onClick={() => setView('terms')}
                className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
            >
                Пользовательское соглашение
            </button>
        </div>
      </footer>
    </div>
  );
}


// force update key