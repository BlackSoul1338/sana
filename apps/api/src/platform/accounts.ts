import { createClient } from '@supabase/supabase-js';
import { AppError, conflict, invalid } from './errors.js';

/**
 * Account creation without a confirmation e-mail: the free Supabase mailer sends a few letters per hour
 * and only to the project's team, so e-mail sign-up cannot serve a public demo.
 */
export interface AccountsPort {
  create(email: string, password: string): Promise<{ userId: string }>;
}

export function supabaseAccounts(url: string, secretKey: string): AccountsPort {
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async create(email, password) {
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
      if (data.user) return { userId: data.user.id };
      if (error?.code === 'email_exists') throw conflict('Такой аккаунт уже есть — попробуйте войти');
      if (error?.code === 'weak_password') throw invalid('Пароль слишком простой', [{ path: 'password', message: 'Пароль слишком простой' }]);
      if (error?.code === 'email_address_invalid') throw invalid('Адрес почты не подходит', [{ path: 'email', message: 'Адрес почты не подходит' }]);
      throw new AppError('internal', 500, `Не удалось создать аккаунт: ${error?.message ?? 'нет ответа'}`);
    },
  };
}

/** Accounts for tests: remembers e-mails to report duplicates. */
export function fakeAccounts(): AccountsPort {
  const taken = new Set<string>();
  return {
    async create(email) {
      if (taken.has(email)) throw conflict('Такой аккаунт уже есть — попробуйте войти');
      taken.add(email);
      return { userId: crypto.randomUUID() };
    },
  };
}
