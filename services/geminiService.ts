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
- Особые приметы и описание внешности

Верни ТОЛЬКО JSON без дополнительного текста:
{
  "species": "dog" или "cat",
  "breed": "порода",
  "color": "цвет",
  "description": "краткое описание особенностей внешности"
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

  // Берём первых 5 кандидатов с фотографиями (ограничение из-за размера запроса)
  const candidatesWithPhotos = candidates
    .filter(c => c.photos?.[0] && c.photos[0].length > 100)
    .slice(0, 5);

  console.log(`📸 Кандидатов с фото для сравнения: ${candidatesWithPhotos.length}`);

  if (candidatesWithPhotos.length === 0) {
    console.log("⚠️ Нет кандидатов с фотографиями");
    return [];
  }

  // Формируем контент сообщения с несколькими изображениями
  const content: any[] = [];

  // Текстовый промпт
  content.push({
    type: "text",
    text: `Ты — эксперт по поиску потерянных животных.

ЗАДАНИЕ: Сравни ПЕРВОЕ фото (искомое животное) с остальными фото (кандидаты).

ИСКОМОЕ ЖИВОТНОЕ:
- ID: ${targetPet.id}
- Порода: ${targetPet.breed || 'неизвестно'}
- Цвет: ${targetPet.color || 'неизвестно'}
- Описание: ${targetPet.description || 'нет'}

КАНДИДАТЫ:
${candidatesWithPhotos.map((c, i) => `${i + 1}. ID: "${c.id}", Порода: ${c.breed || 'неизвестно'}, Цвет: ${c.color || 'неизвестно'}`).join('\n')}

Внимательно сравни ВИЗУАЛЬНО искомое животное с каждым кандидатом.
Обрати внимание на: окрас, форму морды и ушей, размер, особые приметы.

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
