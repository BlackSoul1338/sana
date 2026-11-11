import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(['google', 'mock']).default('mock'),
  GOOGLE_API_KEY: z.string().optional(),
  AI_MODEL_FAST: z.string().optional(),
  AI_MODEL_STRONG: z.string().optional(),
  AI_THINKING_FAST: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  AI_THINKING_STRONG: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  PORT: z.coerce.number().int().default(8787),
  EVIDENCE_BUCKET: z.string().default('evidence'),
  /** Comma-separated origins allowed by CORS, e.g. the deployed web app. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Читает и проверяет переменные окружения один раз. */
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Некорректные переменные окружения:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
