/**
 * Проверка доступа к Gemini: структурный вызов на каждой модели из аргументов (или AI_MODEL_FAST/STRONG).
 *   pnpm ai:smoke                       — модели из .env
 *   pnpm ai:smoke gemini-3.8-flash ...  — сравнить кандидатов
 */
import { z } from 'zod';
import { createAiModels, generateStructured } from '../src/platform/ai/index.js';
import { looseEnum } from '@sana/contracts';

const Schema = z.object({
  city: z.string(),
  confidence: looseEnum(['high', 'medium', 'low']),
  facts: z.array(z.string()),
});

const fromArgs = process.argv.slice(2);
const models = fromArgs.length
  ? fromArgs
  : [process.env.AI_MODEL_FAST, process.env.AI_MODEL_STRONG].filter((m): m is string => !!m);
if (!models.length) {
  console.error('Укажите модели аргументами или AI_MODEL_FAST/AI_MODEL_STRONG в .env');
  process.exit(1);
}

let failed = 0;
for (const name of models) {
  const ai = createAiModels({ AI_PROVIDER: 'google', GOOGLE_API_KEY: process.env.GOOGLE_API_KEY, AI_MODEL_FAST: name });
  const started = Date.now();
  try {
    const out = await generateStructured({
      models: ai,
      tier: 'fast',
      schema: Schema,
      system: 'Отвечай по-русски строго по схеме.',
      prompt: 'Какая столица Казахстана? Дай два коротких факта о ней.',
      maxOutputTokens: 2048,
    });
    console.log(`✔ ${name}: ${((Date.now() - started) / 1000).toFixed(1)}s →`, JSON.stringify(out));
  } catch (err) {
    failed++;
    console.log(`✘ ${name}: ${((Date.now() - started) / 1000).toFixed(1)}s → ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
