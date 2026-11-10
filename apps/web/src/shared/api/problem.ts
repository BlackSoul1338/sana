import type { Problem } from '@sana/contracts';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

export class ApiProblem extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super(problem.detail || problem.title);
    this.name = 'ApiProblem';
    this.problem = problem;
  }
  get code() {
    return this.problem.code;
  }
  get status() {
    return this.problem.status;
  }
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value;
}

export function toApiProblem(error: unknown, status: number): ApiProblem {
  if (isProblem(error)) return new ApiProblem(error);
  return new ApiProblem({
    type: 'about:blank',
    title: 'Ошибка сети',
    status,
    detail: 'Сервер не ответил. Проверьте соединение и попробуйте ещё раз.',
    code: 'internal',
  });
}

/** Unwraps an openapi-fetch result, throwing problem+json as ApiProblem. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw toApiProblem(result.error, result.response.status);
  }
  return result.data as T;
}

/**
 * Puts field-level errors onto a react-hook-form instance.
 * Returns true when at least one error was mapped, so callers can skip a generic toast.
 */
export function applyProblemToForm<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): boolean {
  if (!(error instanceof ApiProblem) || !error.problem.errors?.length) return false;
  const unmapped: string[] = [];
  for (const { path, message } of error.problem.errors) {
    const field = knownFields.find((f) => path === f || path.startsWith(`${f}.`));
    if (field) setError(field as Path<T>, { type: 'server', message });
    else unmapped.push(message);
  }
  // Forms render errors.root, so everything without a visible field goes there.
  if (unmapped.length) setError('root' as Path<T>, { type: 'server', message: unmapped.join('. ') });
  return true;
}

export function problemMessage(error: unknown): string {
  if (error instanceof ApiProblem) return error.message;
  // fetch() itself rejects with a TypeError when the server is unreachable.
  if (error instanceof TypeError) return 'Сервер недоступен. Проверьте соединение и попробуйте ещё раз.';
  if (error instanceof Error) return error.message;
  return 'Что-то пошло не так';
}
