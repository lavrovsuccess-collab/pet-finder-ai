
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { PetReport, MatchResult, Notification, UserProfile } from './types';
import { findPetMatches } from './services/geminiService';
import { PetCard } from './components/PetCard';
import { ReportForm } from './components/ReportForm';
import { PawIcon, SearchIcon, PlusCircleIcon, LogoIcon, UserCircleIcon, BellIcon, GoogleIcon, MapPinIcon, PhoneIcon, PencilIcon, CalendarIcon, ChevronDownIcon, CrosshairIcon, MapIcon, CameraIcon } from './components/icons';
import { auth, db } from './src/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';

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

const Header = ({ currentUser, onViewChange, currentView, onLogout, onLogin }: { currentUser: string | null, onViewChange: (view: View) => void, currentView: View, onLogout: () => void, onLogin: () => void }) => (
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

const MapView: React.FC<{
    reports: PetReport[];
    onPetClick: (pet: PetReport) => void
}> = ({ reports, onPetClick }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);

    // Filter active pets with coordinates
    const activePets = useMemo(() => {
        return reports.filter(p => p.status !== 'resolved' && p.lat && p.lng);
    }, [reports]);

    useEffect(() => {
        if (!mapRef.current || !window.L) return;

        // Init map if not exists
        if (!mapInstanceRef.current) {
            const map = window.L.map(mapRef.current, {
                attributionControl: false
            });
            
            // Add attribution
            window.L.control.attribution({ prefix: false }).addTo(map);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            // Default view (will be overridden by bounds)
            map.setView([55.7558, 37.6173], 10); 

            mapInstanceRef.current = map;
        }

        const map = mapInstanceRef.current;

        // Clear existing markers
        map.eachLayer((layer: any) => {
            if (layer instanceof window.L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Helper to create custom colored icons
        const createIcon = (color: string) => {
             return window.L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="
                    background-color: ${color}; 
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                popupAnchor: [0, -10]
            });
        };

        const markers: any[] = [];

        activePets.forEach(pet => {
            if (!pet.lat || !pet.lng) return;

            const iconColor = pet.type === 'lost' ? '#EF4444' : '#22C55E'; // Red-500 or Green-500
            const marker = window.L.marker([pet.lat, pet.lng], { icon: createIcon(iconColor) });

            // Create popup content
            const container = document.createElement('div');
            container.className = "flex flex-col gap-2 min-w-[220px]";

            // Use mainPhoto instead of photos[0]
            const img = document.createElement('img');
            img.src = pet.mainPhoto || pet.photos?.[0] || 'https://via.placeholder.com/150?text=No+Photo';
            img.className = "w-full h-32 object-cover rounded-md shadow-sm";
            container.appendChild(img);

            // Status badge - убеждаемся, что type определен
            const petType = pet.type || 'lost'; // Значение по умолчанию
            const isLost = petType === 'lost';
            const statusBadge = document.createElement('div');
            statusBadge.innerText = isLost ? 'Потерян' : 'Найден';
            statusBadge.className = `inline-block px-2 py-1 rounded text-xs font-bold ${
                isLost ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`;
            statusBadge.style.width = 'fit-content';
            container.appendChild(statusBadge);

            const title = document.createElement('h3');
            title.innerText = pet.petName || 'Без клички';
            title.className = `font-bold text-lg m-0 leading-tight ${
                isLost ? 'text-red-600' : 'text-green-600'
            }`;
            container.appendChild(title);

            const subtitle = document.createElement('p');
            subtitle.innerText = `${pet.breed || 'Не указана'} • ${pet.color || 'Не указан'}`;
            subtitle.className = "text-sm text-slate-500 m-0 mt-0.5 uppercase tracking-wide";
            container.appendChild(subtitle);

            const btn = document.createElement('button');
            btn.innerText = "Подробнее";
            btn.className = "mt-2 px-3 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 transition-colors w-full";
            btn.onclick = (e) => {
                e.stopPropagation();
                // Данные уже нормализованы при загрузке, но убеждаемся, что type определен
                // для совместимости со старыми записями
                const petToShow: PetReport = {
                    ...pet,
                    type: pet.type || 'lost' // Гарантируем наличие type
                };
                // Вызываем onPetClick, который откроет то же модальное окно, что и из списка
                onPetClick(petToShow);
            };
            container.appendChild(btn);

            marker.bindPopup(container);
            marker.addTo(map);
            markers.push(marker);
        });

        // Fit bounds if markers exist
        if (markers.length > 0) {
            const group = window.L.featureGroup(markers);
            map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
        } else {
             // If no pets, maybe center on user or default
             map.setView([55.7558, 37.6173], 10);
        }

    }, [activePets, onPetClick]);

    const loading = false; // Больше не нужно, данные приходят через пропсы

    return (
        <div className="relative w-full h-[calc(100vh-64px)] z-0">
            <div ref={mapRef} className="w-full h-full" />

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-[500]">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="text-slate-600 font-medium">Загрузка объявлений...</p>
                    </div>
                </div>
            )}

            {/* Legend Overlay */}
            <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-[400] text-sm font-medium space-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm"></div>
                    <span>Потерянные</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm"></div>
                    <span>Найденные</span>
                </div>
            </div>
        </div>
    );
}

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
    
    const formattedDate = pet.date ? new Date(pet.date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) : 'Неизвестна';

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
                        </div>

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

const ResultsView: React.FC<{ 
    pet: PetReport, 
    matches: MatchResult[], 
    candidates: PetReport[], 
    error?: string,
    onBack: () => void,
    onPetClick: (pet: PetReport) => void,
    onUserClick: (userId: string) => void
}> = ({ pet, matches, candidates, error, onBack, onPetClick, onUserClick }) => {
    const matchedPets = useMemo(() => {
        return matches.map(match => {
            const petDetails = candidates.find(p => p.id === match.id);
            return petDetails ? { ...petDetails, matchInfo: { confidence: match.confidence, reasoning: match.reasoning } } : null;
        }).filter(Boolean) as (PetReport & { matchInfo: { confidence: number, reasoning: string } })[];
    }, [matches, candidates]);

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
            </div>

            {error ? (
                 <div className="max-w-3xl mx-auto p-8 bg-red-50 border border-red-200 rounded-xl text-center">
                     <div className="inline-flex bg-red-100 p-4 rounded-full mb-4">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                         </svg>
                     </div>
                     <h3 className="text-xl font-bold text-red-800 mb-2">Что-то пошло не так</h3>
                     <p className="text-red-700 mb-6">{error}</p>
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

                        {matchedPets.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {matchedPets.map((p, index) => (
                                    <div key={p.id} className="relative group animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
                                        {/* Floating match score badge */}
                                        <div className="absolute -top-3 -right-2 z-20 flex flex-col items-center">
                                            <div className={`text-sm font-bold px-3 py-1.5 rounded-full shadow-lg border-2 border-white ${
                                                p.matchInfo.confidence > 0.8 ? 'bg-green-500 text-white' :
                                                p.matchInfo.confidence > 0.5 ? 'bg-blue-500 text-white' :
                                                'bg-yellow-500 text-white'
                                            }`}>
                                                {(p.matchInfo.confidence * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                        
                                        <PetCard pet={p} matchInfo={p.matchInfo} onClick={() => onPetClick(p)} onUserClick={onUserClick} />
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
    const myLostPets = allLostPets.filter(p => p.userId === currentUser);
    const myFoundPets = allFoundPets.filter(p => p.userId === currentUser);
    const myNotifications = notifications.filter(n => n.userId === currentUser);
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
                                const isMyLostPet = n.lostPet.userId === currentUser;
                                const notificationText = isMyLostPet 
                                    ? `Найдено возможное совпадение для вашего питомца "${n.lostPet.petName || 'Без имени'}"!`
                                    : `Ваше объявление о находке может совпадать с потерянным питомцем "${n.lostPet.petName || 'Без имени'}".`;
                                
                                const secondaryText = isMyLostPet
                                    ? `Найденный питомец (${n.foundPet.breed}, ${n.foundPet.color}) был замечен в "${n.foundPet.lastSeenLocation}".`
                                    : `Владелец потерянного питомца (${n.lostPet.breed}, ${n.lostPet.color}) ищет его.`;

                                const imageSrc = isMyLostPet 
                                    ? (n.foundPet.photos?.[0] || '') 
                                    : (n.lostPet.photos?.[0] || '');

                                return (
                                    <div key={n.id} className={`p-3 md:p-4 rounded-lg flex items-start gap-3 md:gap-4 transition-colors ${n.read ? 'bg-slate-100' : 'bg-green-50 border border-green-200 shadow-sm'}`}>
                                        <img src={imageSrc} alt="Matched pet" className="w-12 h-12 md:w-16 md:h-16 rounded-md object-cover bg-slate-200 flex-shrink-0"/>
                                        <div className="flex-grow min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm md:text-base leading-snug">
                                                {notificationText}
                                            </p>
                                            <p className="text-xs md:text-sm text-slate-600 mt-1 line-clamp-2">
                                                {secondaryText}
                                            </p>
                                            <p className="text-xs text-blue-700 mt-1 italic">
                                                Уверенность ИИ: <strong>{(n.matchResult.confidence * 100).toFixed(0)}%</strong>.
                                            </p>
                                        </div>
                                        {!n.read && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onMarkAsRead(n.id); }} 
                                                className="px-2 py-1 md:px-3 md:py-1 text-[10px] md:text-xs font-medium text-indigo-600 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50 hover:text-indigo-700 transition-colors self-start whitespace-nowrap ml-1 shadow-sm"
                                            >
                                                Отметить
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
  
  // Computed значения для обратной совместимости
  const lostPets = useMemo(() => reports.filter(p => p.type === 'lost'), [reports]);
  const foundPets = useMemo(() => reports.filter(p => p.type === 'found'), [reports]);
  
  // User Profiles storage
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(() => {
      const saved = localStorage.getItem('userProfiles');
      return saved ? JSON.parse(saved) : {};
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSearchPet, setActiveSearchPet] = useState<PetReport | null>(null);
  const [currentLostPet, setCurrentLostPet] = useState<PetReport | null>(null);
  const [editingPet, setEditingPet] = useState<PetReport | null>(null);
  const [viewingPet, setViewingPet] = useState<PetReport | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  // Reset breed filter when species changes
  useEffect(() => {
    setBreedFilter('all');
  }, [speciesFilter]);

  // localStorage больше не нужен для reports - данные в Firebase
  useEffect(() => { 
    try {
      localStorage.setItem('notifications', JSON.stringify(notifications)); 
    } catch (error) {
      console.error("Failed to save notifications to localStorage:", error);
    }
  }, [notifications]);
  
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
          lat: data.lat,
          lng: data.lng,
          description: data.description || '',
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
      // Explicitly type status as 'active' | 'resolved' to avoid type widening to string
      const newStatus: 'active' | 'resolved' = pet.status === 'resolved' ? 'active' : 'resolved';
      
      try {
        const reportRef = doc(db, 'reports', pet.id);
        await updateDoc(reportRef, { status: newStatus });
        // onSnapshot автоматически обновит стейт reports
      } catch (error) {
        console.error('Error updating report status:', error);
        alert('Не удалось изменить статус объявления. Попробуйте еще раз.');
      }
  };

  const handleStartAiSearch = useCallback(async (petToMatch: PetReport) => {
    if (!currentUser) {
        alert("Пожалуйста, войдите в систему для поиска.");
        setView('login');
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
        
        // Filter out 'resolved' pets from the search candidates
        // If searching for a lost pet (isSearchingFound = false), look in foundPets that are ACTIVE.
        // If searching for a found pet (isSearchingFound = true), look in lostPets that are ACTIVE.
        const sourceCandidates = isSearchingFound ? lostPets : foundPets;
        const candidates = sourceCandidates.filter(p => p.status !== 'resolved');

        if (candidates.length > 0) {
            const matchResults = await findPetMatches(petWithBase64, candidates);
            // Sort results by confidence descending (highest match first)
            matchResults.sort((a, b) => b.confidence - a.confidence);
            
            setMatches(matchResults);
            
            const newNotifications = matchResults.map(match => {
                const matchedCandidate = candidates.find(p => p.id === match.id);
                if (matchedCandidate && matchedCandidate.userId) {
                    const notificationLostPet = isSearchingFound ? matchedCandidate : petToMatch;
                    const notificationFoundPet = isSearchingFound ? petToMatch : matchedCandidate;

                    return {
                        id: `notif-${Date.now()}-${Math.random()}`,
                        userId: matchedCandidate.userId,
                        lostPet: notificationLostPet,
                        foundPet: notificationFoundPet,
                        matchResult: match,
                        timestamp: Date.now(),
                        read: false,
                    } as Notification;
                }
                return null;
            }).filter((n): n is Notification => n !== null);

            if (newNotifications.length > 0) {
                setNotifications(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
                    return [...uniqueNew, ...prev];
                });
            }
        } else {
            setMatches([]);
        }
        setView('results');
    } catch (e: any) {
        console.error("AI Search Error:", e);
        setError(e.message || "Произошла неизвестная ошибка при поиске.");
        setView('results'); // Show results view but with error state
    }
  }, [currentUser, lostPets, foundPets]);

  const handleReportSubmit = useCallback((reportData: Omit<PetReport, 'id' | 'type' | 'userId' | 'status' | 'date'>, formType: 'lost' | 'found' | 'edit') => {
    if (!currentUser) {
        alert("Пожалуйста, войдите в систему, чтобы подать объявление.");
        setView('login');
        return;
    }
    
    // Данные уже сохранены в Firebase через ReportForm
    // onSnapshot автоматически обновит стейт reports
    
    if (formType === 'lost') {
      // onSnapshot обновит reports автоматически, пользователь увидит объявление в списке
      setView('home');
    } else if (formType === 'found') {
      setView('home');
    } else if (formType === 'edit' && editingPet) {
        // Для редактирования данные уже обновлены в Firebase через ReportForm
        setEditingPet(null);
        setView('account');
    }
  }, [currentUser, editingPet]);
  
  const handleDelete = async (petId: string) => {
    if (window.confirm("Вы уверены, что хотите удалить это объявление?")) {
      try {
        const reportRef = doc(db, 'reports', petId);
        await deleteDoc(reportRef);
        // onSnapshot автоматически обновит стейт reports
      } catch (error) {
        console.error('Error deleting report:', error);
        alert('Не удалось удалить объявление. Попробуйте еще раз.');
      }
    }
  };

  const handleEdit = (pet: PetReport) => {
    setEditingPet(pet);
    setView('editReport');
  };

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? {...n, read: true} : n));
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
        alert("Геолокация не поддерживается вашим браузером");
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
            alert("Не удалось определить местоположение. Проверьте разрешения браузера.");
            setIsLocatingUser(false);
        }
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
         return activeSearchPet && <ResultsView pet={activeSearchPet} matches={matches} candidates={candidates} error={error} onBack={() => setView('home')} onPetClick={handlePetClick} onUserClick={handleUserClick} />;
      case 'map':
          return <MapView reports={reports} onPetClick={handlePetClick} />;
      case 'privacy':
          return <PrivacyPolicyView onBack={() => setView('home')} />;
      case 'terms':
          return <TermsView onBack={() => setView('home')} />;
      case 'home':
      default:
        const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        
        const filterPetByTerms = (pet: PetReport) => {
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

            // 4. Location Filter (Enhanced with Radius)
            if (searchCoords) {
                // Geo-search active
                if (pet.lat && pet.lng) {
                     const distance = getDistanceFromLatLonInKm(searchCoords.lat, searchCoords.lng, pet.lat, pet.lng);
                     if (distance > searchRadius) return false;
                } else {
                    // Exclude pets without coordinates when in geo-mode
                    return false;
                }
            } else if (locationFilter) {
                // Text search fallback
                if (!pet.lastSeenLocation.toLowerCase().includes(locationFilter.toLowerCase())) {
                    return false;
                }
            }

            // 5. Search Text
            if (searchTerms.length === 0) return true;
            const petDataString = [
                pet.petName || '',
                pet.breed,
                pet.color,
                pet.lastSeenLocation,
                pet.description
            ].join(' ').toLowerCase();
            
            return searchTerms.every(term => petDataString.includes(term));
        };

        const filteredLostPets = lostPets.filter(filterPetByTerms);
        const filteredFoundPets = foundPets.filter(filterPetByTerms);

        const renderEmptyState = (type: 'lost' | 'found') => {
            const emptyStateTitle = type === 'lost' ? 'Нет потерянных' : 'Нет находок';
            const emptyStateSubtitle = type === 'lost' ? 'Все питомцы дома!' : 'Пока никто не сообщал о находках.';

            return (
                <div className="text-center py-12 md:py-16 px-4 md:px-6 bg-white rounded-xl shadow-lg">
                {searchTerm || locationFilter || speciesFilter !== 'all' || breedFilter !== 'all' || dateFilter !== 'all' ? (
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
                    <div className="relative w-full max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="h-4 w-4 md:h-5 md:w-5 text-slate-400" /></div>
                        <input type="text" placeholder="Искать по описанию..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 md:pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>

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
                    </div>
                </div>

                {(filterType === 'all' || filterType === 'lost') && (
                    <section id="lost-pets" className="mb-12 md:mb-16">
                        <div className="text-center mb-6 md:mb-8">
                            <h2 className="text-2xl md:text-4xl font-bold text-slate-800">Недавно потерянные</h2>
                            <p className="text-sm md:text-base text-slate-600 mt-1 md:mt-2">Можете помочь им воссоединиться с семьей?</p>
                        </div>
                        {filteredLostPets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {filteredLostPets.map(pet => (
                            <PetCard
                                key={pet.id}
                                pet={pet}
                                onFindMatches={pet.status !== 'resolved' ? () => handleStartAiSearch(pet) : undefined}
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
                        {filteredFoundPets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {filteredFoundPets.map(pet => (
                            <PetCard
                                key={pet.id}
                                pet={pet}
                                onFindMatches={pet.status !== 'resolved' ? () => handleStartAiSearch(pet) : undefined}
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
      <Header currentUser={currentUser} onViewChange={setView} currentView={view} onLogout={handleLogout} onLogin={() => setIsLoginModalOpen(true)} />
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess} 
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