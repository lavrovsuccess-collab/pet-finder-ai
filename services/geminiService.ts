import type { PetReport, MatchResult } from '../types';

// OpenRouter API (работает из России!)
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Бесплатные модели с поддержкой изображений (проверено по OpenRouter API)
// Бесплатной Gemini с явным id на OpenRouter нет — роутер openrouter/free может выбрать её сам
const MODELS = [
  "openrouter/free",                      // Первый: роутер выбирает бесплатную модель (в т.ч. Gemini, если доступна)
  "allenai/molmo-2-8b:free",              // Резерв: бесплатная vision от AllenAI
  "nvidia/nemotron-nano-12b-v2-vl:free"  // Резерв: бесплатная vision от NVIDIA
];

/**
 * Очищает base64 от data URL префикса
 */
function cleanBase64(imageBase64: string): string {
  return imageBase64.replace(/^data:image\/\w+;base64,/, "");
}

/**
 * Добавляет data URL префикс если его нет
 */
function ensureDataUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:")) {
    return imageBase64;
  }
  return `data:image/jpeg;base64,${imageBase64}`;
}

/**
 * Очищает ответ от markdown ```json ... ```
 */
function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

/**
 * Выполняет запрос к OpenRouter API с перебором моделей
 */
async function callOpenRouter(messages: any[]): Promise<string | null> {
  console.log("📡 Отправляем запрос к OpenRouter API...");

  for (const model of MODELS) {
    try {
      console.log(`🔧 Пробуем модель: ${model}...`);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "PetFinder"
        },
        body: JSON.stringify({
          model: model,
          messages: messages
        })
      });

      const data = await response.json();

      // Если модель не найдена — пробуем следующую
      if (response.status === 404) {
        console.warn(`⚠️ Модель ${model} не найдена, пробуем следующую...`);
        continue;
      }

      if (!response.ok) {
        console.error(`❌ Ошибка API ${response.status}:`, data.error?.message || data);
        continue; 
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        console.warn(`⚠️ Модель ${model} вернула пустой ответ, пробуем следующую...`);
        continue;
      }

      console.log(`✅ Успех! Модель ${model} ответила`);
      console.log("📝 Сырой ответ:", text.substring(0, 500) + (text.length > 500 ? "..." : ""));

      return text;

    } catch (err) {
      console.error(`❌ Ошибка сети для модели ${model}:`, err);
    }
  }

  console.error("💀 Все модели отказали!");
  return null;
}

/**
 * Анализирует изображение питомца и возвращает его характеристики
 */
export async function analyzePetImage(imageBase64: string): Promise<{
  species: string;
  breed: string;
  color: string;
  description: string;
  specialMarks?: string;
  hasCollar?: boolean;
  collarColor?: string;
  shortTitle?: string;
} | null> {
  console.log("🔍 analyzePetImage: Начинаем анализ фото...");

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Проанализируй животное на фотографии.

Определи:
- Вид животного (dog или cat)
- Породу (или "неизвестно" если не можешь определить)
- Основной цвет шерсти
- Ошейник: есть ли на животном ошейник (hasCollar: true/false), и если есть — цвет (collarColor)
- Особые приметы (specialMarks): уникальные пятна, шрамы, форму ушей, хвоста, отметины, хромоту — всё что помогает идентифицировать
- Краткое описание (description)
- shortTitle: краткое название для объявления «Нашёл» (2–5 слов): вид + окрас + заметные приметы. Примеры: «Коричневая собака с ошейником», «Белая пушистая кошечка», «Рыжий кот с пятнами»

Верни ТОЛЬКО JSON без дополнительного текста:
{
  "species": "dog" или "cat",
  "breed": "порода",
  "color": "цвет",
  "description": "краткое описание",
  "specialMarks": "особые приметы: пятна, шрамы, форма ушей, хвост и т.д.",
  "hasCollar": true или false,
  "collarColor": "цвет ошейника" или "",
  "shortTitle": "краткое название для объявления: вид + окрас + приметы (2–5 слов)"
}`
        },
        {
          type: "image_url",
          image_url: {
            url: ensureDataUrl(imageBase64)
          }
        }
      ]
    }
  ];

  const responseText = await callOpenRouter(messages);

  if (!responseText) {
    console.error("🚫 analyzePetImage: Не удалось получить ответ");
    return null;
  }

  try {
    const cleanedJson = cleanJsonResponse(responseText);
    console.log("🧹 Очищенный JSON:", cleanedJson);

    const result = JSON.parse(cleanedJson);
    console.log("✅ analyzePetImage результат:", result);
    return result;

  } catch (err) {
    console.error("❌ Ошибка парсинга JSON:", err);
    console.error("📄 Текст ответа:", responseText);
    return null;
  }
}

/**
 * Генерирует текстовое описание питомца
 */
export async function generatePetDescription(imageBase64: string): Promise<string | null> {
  console.log("📝 generatePetDescription: Генерируем описание...");

  const analysis = await analyzePetImage(imageBase64);

  if (!analysis) {
    return null;
  }

  const speciesRu = analysis.species === 'dog' ? 'Собака' : 'Кот/Кошка';
  const description = `${speciesRu}, порода: ${analysis.breed}, цвет: ${analysis.color}. ${analysis.description}`;

  console.log("✅ Описание:", description);
  return description;
}

/**
 * Ищет совпадения между целевым питомцем и списком кандидатов
 * Отправляем фотографии для визуального сравнения!
 */
export async function findPetMatches(
  targetPet: PetReport,
  candidates: PetReport[]
): Promise<MatchResult[]> {
  console.log("🔎 findPetMatches: Начинаем визуальный поиск совпадений...");
  console.log(`🎯 Ищем питомца: ${targetPet.id} (${targetPet.breed || 'порода неизвестна'})`);
  console.log(`📋 Всего кандидатов: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("⚠️ Нет кандидатов для сравнения");
    return [];
  }

  const candidatesWithPhotos = candidates.filter(c => c.photos?.[0] && c.photos[0].length > 100);

  console.log(`📸 Кандидатов с фото для сравнения: ${candidatesWithPhotos.length}`);

  if (candidatesWithPhotos.length === 0) {
    console.log("⚠️ Нет кандидатов с фотографиями");
    return [];
  }

  const content: any[] = [];
  const targetMarks = targetPet.specialMarks || targetPet.description || '';
  const targetCollar = targetPet.hasCollar ? (targetPet.collarColor ? `ошейник ${targetPet.collarColor}` : 'ошейник') : '';

  content.push({
    type: "text",
    text: `Ты — эксперт-криминалист по идентификации животных. Сравнивай ТОЛЬКО визуально, игнорируй текст о породе.

ЗАДАНИЕ: Сравни ПЕРВОЕ фото (искомое животное) с остальными фото (кандидаты).

ИСКОМОЕ ЖИВОТНОЕ:
- ID: ${targetPet.id}
- Цвет: ${targetPet.color || 'неизвестно'}
- Особые приметы: ${targetMarks || 'не указаны'}
- Ошейник: ${targetCollar || 'нет'}

КАНДИДАТЫ:
${candidatesWithPhotos.map((c, i) => `${i + 1}. ID: "${c.id}", Цвет: ${c.color || 'неизвестно'}, Приметы: ${(c.specialMarks || '').slice(0, 80)}`).join('\n')}

ОБРАТИ ОСОБОЕ ВНИМАНИЕ:
- Уникальные пятна, отметины, шрамы
- Форма и постановка ушей
- Хвост (длина, форма, окрас кончика)
- Морда (рисунок, маска)
- Ошейник (наличие, цвет)
- Общие пропорции тела
Если животное одноцветное — сравнивай оттенок и текстуру шерсти.

Верни ТОЛЬКО JSON (без markdown):
{
  "matches": [
    {
      "id": "ID кандидата",
      "confidence": число от 0 до 100,
      "reasoning": "почему похож или не похож"
    }
  ]
}

Включи ВСЕХ кандидатов. confidence 80-100 = очень похож, 50-79 = есть сходство, 0-49 = мало похож.`
  });

  // Фото искомого питомца
  if (targetPet.photos?.[0]) {
    content.push({
      type: "image_url",
      image_url: {
        url: ensureDataUrl(targetPet.photos[0])
      }
    });
  }

  // Фото каждого кандидата
  candidatesWithPhotos.forEach((candidate) => {
    content.push({
      type: "image_url",
      image_url: {
        url: ensureDataUrl(candidate.photos[0])
      }
    });
  });

  console.log(`📤 Отправляем ${content.length} частей (текст + ${candidatesWithPhotos.length + 1} фото) в OpenRouter...`);

  const messages = [{ role: "user", content }];
  const responseText = await callOpenRouter(messages);

  if (!responseText) {
    console.error("🚫 findPetMatches: Не удалось получить ответ от API");
    return [];
  }

  try {
    const cleanedJson = cleanJsonResponse(responseText);
    console.log("🧹 Очищенный JSON:", cleanedJson);

    const result = JSON.parse(cleanedJson);
    const matches: MatchResult[] = result.matches || [];

    console.log(`✅ findPetMatches: Найдено ${matches.length} результатов`);
    matches.forEach(m => {
      console.log(`   - ${m.id}: ${m.confidence}% — ${m.reasoning}`);
    });

    // Сортируем по убыванию confidence
    return matches.sort((a, b) => b.confidence - a.confidence);

  } catch (err) {
    console.error("❌ Ошибка парсинга JSON:", err);
    console.error("📄 Текст ответа:", responseText);
    return [];
  }
}
