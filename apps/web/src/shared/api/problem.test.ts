import { describe, expect, it, vi } from 'vitest';
import { ApiProblem, applyProblemToForm } from './problem';

const problem = (errors: { path: string; message: string }[]) =>
  new ApiProblem({ type: 'x', title: 'x', status: 422, detail: 'x', code: 'validation_failed', errors });

describe('applyProblemToForm', () => {
  it('maps known fields, including nested paths, onto the field', () => {
    const setError = vi.fn();
    applyProblemToForm(problem([{ path: 'requirements.skills.python', message: 'нет такого' }]), setError, ['requirements.skills']);
    expect(setError).toHaveBeenCalledWith('requirements.skills', { type: 'server', message: 'нет такого' });
  });

  it('puts everything else on root, where forms render it', () => {
    const setError = vi.fn();
    const handled = applyProblemToForm(
      problem([
        { path: '(root)', message: 'Первое' },
        { path: 'other', message: 'Второе' },
      ]),
      setError,
      ['title'],
    );
    expect(handled).toBe(true);
    expect(setError).toHaveBeenCalledWith('root', { type: 'server', message: 'Первое. Второе' });
  });

  it('leaves non-field errors to the caller', () => {
    expect(applyProblemToForm(new Error('boom'), vi.fn(), ['title'])).toBe(false);
  });
});
