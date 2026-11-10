import type { z } from 'zod';
import type { bcb } from '@sana/contracts';

export type FieldState = bcb.FieldState;
export type Question = bcb.Question;
export type FieldChangeT = z.infer<typeof bcb.FieldChange>;
export type FieldStatus = bcb.FieldStatus;
