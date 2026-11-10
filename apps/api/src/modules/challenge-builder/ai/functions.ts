import { z } from 'zod';
import { bcb, looseEnum, type TaskCard, type TaskRequirements } from '@sana/contracts';
import { generateStructured, type AiModels } from '../../../platform/ai/index.js';
import { FIELD_ORDER, FIELD_TITLES } from '../readiness.js';
import type { FieldState } from '../types.js';
import { ANALYZE_SYSTEM_V1, COMPOSE_SYSTEM_V1, REQUIREMENTS_SYSTEM_V1, analyzePrompt, composePrompt, requirementsPrompt } from './prompts.js';

export type DialogMessage = { role: 'user' | 'assistant'; text: string };

export const formatDialog = (messages: DialogMessage[]) =>
  messages.map((m) => `${m.role === 'user' ? 'Бизнес' : 'Ассистент'}: ${m.text}`).join('\n\n');

export async function analyzeDraft(models: AiModels | null, messages: DialogMessage[]): Promise<bcb.AiAnalysis> {
  return generateStructured({
    models,
    tier: 'fast',
    schema: bcb.AiAnalysis,
    system: ANALYZE_SYSTEM_V1,
    prompt: analyzePrompt(formatDialog(messages)),
    maxOutputTokens: 4096,
    temperature: 0.1,
    timeoutMs: 45_000,
  });
}

export async function composeCard(models: AiModels | null, messages: DialogMessage[], fields: FieldState[]): Promise<bcb.AiCard> {
  const fieldText = fields.map((f) => `- ${f.key} (${FIELD_TITLES[f.key]}): ${f.status}${f.status !== 'missing' ? ` — ${f.value}` : ''}`).join('\n');
  return generateStructured({
    models,
    tier: 'strong',
    schema: bcb.AiCard,
    system: COMPOSE_SYSTEM_V1,
    prompt: composePrompt(formatDialog(messages), fieldText),
    maxOutputTokens: 6144,
    temperature: 0.2,
    timeoutMs: 60_000,
  });
}

export const cardText = (card: TaskCard) => FIELD_ORDER.map((k) => `${FIELD_TITLES[k]}: ${card[k].text}`).join('\n');

/** Требования предлагает модель, но схема ограничивает навыки справочником; итог правит бизнес. */
export async function suggestRequirements(
  models: AiModels | null,
  card: TaskCard,
  skills: { slug: string; title: string }[],
): Promise<TaskRequirements> {
  const slugs = skills.map((s) => s.slug) as [string, ...string[]];
  const Schema = z.object({
    topic: z.string(),
    difficulty: z.number(),
    estHours: z.number(),
    skills: z.array(z.object({ slug: looseEnum(slugs), required: z.boolean() })),
  });
  const out = await generateStructured({
    models,
    tier: 'fast',
    schema: Schema,
    system: REQUIREMENTS_SYSTEM_V1,
    prompt: requirementsPrompt(cardText(card), skills.map((s) => `${s.slug} — ${s.title}`).join('\n')),
    maxOutputTokens: 2048,
    temperature: 0.1,
    timeoutMs: 30_000,
  });
  return normalizeRequirements(out);
}

/** Модель могла выйти за диапазоны (в схеме их нет для совместимости) — приводим в коде. */
export function normalizeRequirements(r: { topic: string; difficulty: number; estHours: number; skills: { slug: string; required: boolean }[] }): TaskRequirements {
  const skills = [...new Map(r.skills.map((s) => [s.slug, s])).values()].slice(0, 8);
  if (skills.length && !skills.some((s) => s.required)) skills[0] = { ...skills[0]!, required: true };
  return {
    topic: (r.topic || 'общее').trim().toLowerCase().slice(0, 60),
    difficulty: Math.min(3, Math.max(1, Math.round(r.difficulty || 2))),
    estHours: Math.min(400, Math.max(4, Math.round(r.estHours || 40))),
    skills,
  };
}
