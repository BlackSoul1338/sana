import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, NoObjectGeneratedError, Output, type JSONValue, type LanguageModel } from 'ai';
import type { z } from 'zod';
import { AppError } from '../errors.js';

export type ModelTier = 'fast' | 'strong';

/** Порт доступа к моделям. В тестах подменяется mock-моделью из ai/test. */
export interface AiModels {
  provider: string;
  model(tier: ModelTier): LanguageModel;
  /** Настройки провайдера по уровню: быстрый ход диалога думает меньше. */
  providerOptions?(tier: ModelTier): Record<string, Record<string, JSONValue>>;
}

export type AiConfig = {
  AI_PROVIDER: 'google' | 'mock';
  GOOGLE_API_KEY?: string | undefined;
  AI_MODEL_FAST?: string | undefined;
  AI_MODEL_STRONG?: string | undefined;
  AI_THINKING_FAST?: 'minimal' | 'low' | 'medium' | 'high' | undefined;
  AI_THINKING_STRONG?: 'minimal' | 'low' | 'medium' | 'high' | undefined;
};

/**
 * Явный провайдер вместо строки модели: строка вида "google/..." в AI SDK ушла бы в Vercel AI Gateway.
 * Возвращает null, если AI не настроен — тогда AI-функции отвечают ошибкой ai_unavailable,
 * а места с шаблонным запасным вариантом (рекомендация шага) работают без модели.
 */
export function createAiModels(cfg: AiConfig): AiModels | null {
  if (cfg.AI_PROVIDER !== 'google') return null;
  if (!cfg.GOOGLE_API_KEY || !cfg.AI_MODEL_FAST) return null;
  const google = createGoogleGenerativeAI({ apiKey: cfg.GOOGLE_API_KEY });
  const fast = cfg.AI_MODEL_FAST;
  const strong = cfg.AI_MODEL_STRONG || fast;
  // Уровень «размышлений» задаётся только явно: не все модели его поддерживают (flash-lite отвечает быстрее без него).
  const thinking = { fast: cfg.AI_THINKING_FAST, strong: cfg.AI_THINKING_STRONG };
  return {
    provider: 'google',
    model: (tier) => google(tier === 'fast' ? fast : strong),
    providerOptions: (tier): Record<string, Record<string, JSONValue>> => {
      const level = thinking[tier];
      return level ? { google: { thinkingConfig: { thinkingLevel: level } } } : {};
    },
  };
}

export type StructuredCall<S extends z.ZodType> = {
  models: AiModels | null;
  tier: ModelTier;
  schema: S;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  /** Сколько раз повторить при нарушении схемы (кроме первой попытки). */
  schemaRetries?: number;
  /** Таймаут одного вызова, чтобы зависший ответ не держал запрос бесконечно. */
  timeoutMs?: number;
};

/**
 * Структурный вызов модели: generateText + Output.object, проверка Zod внутри AI SDK.
 * Нарушение схемы (NoObjectGeneratedError) — одна повторная попытка, затем понятная ошибка.
 */
export async function generateStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>> {
  if (!call.models) throw new AppError('ai_unavailable', 502, 'Модель не настроена (AI_PROVIDER/GOOGLE_API_KEY/AI_MODEL_FAST)');
  const attempts = 1 + (call.schemaRetries ?? 1);
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const { output } = await generateText({
        model: call.models.model(call.tier),
        output: Output.object({ schema: call.schema }),
        system: call.system,
        prompt: call.prompt,
        maxOutputTokens: call.maxOutputTokens ?? 8192,
        temperature: call.temperature ?? 0.2,
        maxRetries: 2,
        abortSignal: AbortSignal.timeout(call.timeoutMs ?? 60_000),
        ...(call.models.providerOptions ? { providerOptions: call.models.providerOptions(call.tier) } : {}),
      });
      return output as z.infer<S>;
    } catch (err) {
      lastError = err;
      if (!NoObjectGeneratedError.isInstance(err)) break;
    }
  }
  const reason = NoObjectGeneratedError.isInstance(lastError)
    ? `модель вернула ответ не по схеме (${lastError.finishReason ?? 'unknown'})`
    : lastError instanceof Error
      ? lastError.message.slice(0, 200)
      : 'неизвестная ошибка';
  throw new AppError('ai_unavailable', 502, `Не удалось получить ответ модели: ${reason}`);
}
