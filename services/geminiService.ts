import { GoogleGenAI, Type } from "@google/genai";
import type { PetReport, MatchResult } from '../types';

// Инициализация ключа Gemini из переменной окружения VITE_SUPER_GEMINI_KEY
const API_KEY = import.meta.env.VITE_SUPER_GEMINI_KEY;

let aiInstance: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!API_KEY || String(API_KEY).trim() === '') {
    throw new Error(
      "ИИ-поиск недоступен: не настроен ключ API Gemini. " +
      "Убедитесь, что переменная VITE_SUPER_GEMINI_KEY задана в окружении (локально в .env и на Vercel в Environment Variables)."
    );
  }
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: API_KEY });
  return aiInstance;
}

const fileToGenerativePart = (dataUrl: string) => {
  // Check if dataUrl is valid
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  const mimeType = match[1];
  const data = match[2];
  return {
    inlineData: {
      data,
      mimeType,
    },
  };
};

export const analyzePetImage = async (imageBase64: string): Promise<{
    species: 'dog' | 'cat' | 'other';
    breed: string;
    color: string;
    description: string;
} | null> => {
  const model = "gemini-1.5-flash";
  const imagePart = fileToGenerativePart(imageBase64);

  if (!imagePart) {
    console.warn("No valid image part created for analysis.");
    return null;
  }

  const prompt = `Проанализируй фотографию животного для объявления о пропаже/находке.
  Определи вид животного (собака, кошка или другое), наиболее вероятную породу, основной окрас и составь краткое описание примет.
  Верни ответ строго в формате JSON.`;

  try {
    const response = await getAi().models.generateContent({
      model: model,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                species: { type: Type.STRING, enum: ["dog", "cat", "other"] },
                breed: { type: Type.STRING, description: "Название породы или 'Метис/Беспородный'" },
                color: { type: Type.STRING, description: "Основной окрас" },
                description: { type: Type.STRING, description: "Краткое описание внешности и примет (3-4 предложения)" }
            },
            required: ["species", "breed", "color", "description"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing pet image:", error);
    return null;
  }
};

// Deprecated alias kept for backward compatibility if needed elsewhere, but forwarded to new logic
export const generatePetDescription = async (imageBase64: string): Promise<string> => {
    const result = await analyzePetImage(imageBase64);
    return result ? result.description : "";
};

export const findPetMatches = async (targetPet: PetReport, candidates: PetReport[]): Promise<MatchResult[]> => {
  if (candidates.length === 0) {
    return [];
  }
  
  const model = "gemini-1.5-flash";

  // Use the first photo for matching to save tokens, or if empty handle gracefully
  const targetPhoto = targetPet.photos && targetPet.photos.length > 0 ? targetPet.photos[0] : null;

  if (!targetPhoto) {
    throw new Error("Target pet has no photos for analysis.");
  }

  const targetImagePart = fileToGenerativePart(targetPhoto);
  if (!targetImagePart) {
    throw new Error("Failed to process target pet image.");
  }

  const targetIsFound = targetPet.type === 'found';
  const targetTypeLabel = targetIsFound ? 'найденного' : 'потерянного';
  const candidateTypeLabel = targetIsFound ? 'потерянных' : 'найденных';

  // Construct the multipart content
  const parts: any[] = [];

  // 1. System Instruction
  parts.push({ text: `Ты — эксперт, ИИ-детектив по поиску домашних животных.
  Твоя задача — сравнить ИСКОМОГО питомца (которого ${targetIsFound ? 'нашли' : 'потеряли'}) со списком КАНДИДАТОВ.
  
  Я предоставлю данные и фото искомого питомца первым.
  Затем я предоставлю список кандидатов. Для каждого кандидата я дам описание и, если есть, фотографию.
  
  Проанализируй визуальное сходство (порода, окрас, пятна, морда) и текстовые описания.
  Визуальное сходство имеет решающее значение. Если фотографии показывают одно и то же животное (или очень похожее), ставь высокую уверенность.
  
  Верни JSON с массивом "matches" (до 10 наиболее вероятных совпадений, отсортированных по убыванию уверенности). Не включай кандидатов с уверенностью < 0.1.` });

  // 2. Target Pet Info
  parts.push({ text: `
  === ИСКОМЫЙ ПИТОМЕЦ (${targetTypeLabel.toUpperCase()}) ===
  Порода: ${targetPet.breed}
  Окрас: ${targetPet.color}
  Место: ${targetPet.lastSeenLocation}
  Описание: ${targetPet.description}
  Изображение:
  `});
  parts.push(targetImagePart);

  // 3. Candidates
  parts.push({ text: `
=== СПИСОК КАНДИДАТОВ (${candidateTypeLabel.toUpperCase()}) ===
Ниже представлены кандидаты для проверки:` });

  // We limit candidates to 20 to ensure we don't overload the request context with too many images if the DB grows, 
  // though Gemini Flash can handle many.
  const candidatesToAnalyze = candidates.slice(0, 20);

  for (const candidate of candidatesToAnalyze) {
    const candidatePhoto = candidate.photos && candidate.photos.length > 0 ? candidate.photos[0] : null;

    parts.push({ text: `
--- КАНДИДАТ ID: ${candidate.id} ---
Порода: ${candidate.breed}, Окрас: ${candidate.color}
Место: ${candidate.lastSeenLocation}
Описание: ${candidate.description}
Изображение:` });
    
    if (candidatePhoto && candidatePhoto.startsWith('data:')) {
        const candidatePart = fileToGenerativePart(candidatePhoto);
        if (candidatePart) {
            parts.push(candidatePart);
        } else {
            parts.push({ text: "[Ошибка изображения кандидата]" });
        }
    } else {
        // If it's a URL (e.g. seed data) or missing, we treat it as text-only/url ref for this demo unless we fetch it.
        parts.push({ text: "[Изображение доступно по URL, визуальный анализ пропущен, ориентируйся на описание]" });
    }
  }

  try {
    const response = await getAi().models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {            type: Type.STRING,            description: "ID совпавшего питомца."          },
                  confidence: {            type: Type.NUMBER,            description: "Оценка уверенности от 0.0 до 1.0."          },
                  reasoning: {            type: Type.STRING,            description: "Объяснение почему это совпадение, на русском языке."          }
                },
                required: ['id', 'confidence', 'reasoning']
              }
            }
          }
        }
      }
    });

    let jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response from AI model");
    }

    // Cleanup potentially wrapped JSON
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    const result = JSON.parse(jsonText);
    return result.matches || [];
  } catch (e: any) {
    console.error("AI Search Error:", e);
    throw new Error(e.message || "Failed to analyze matches with AI.");
  }
};
