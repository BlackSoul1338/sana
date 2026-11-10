import createClient, { type Middleware } from 'openapi-fetch';
import { env } from '@/shared/config';
import type { paths } from './schema';
import { supabase } from './supabase';

const auth: Middleware = {
  async onRequest({ request }) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: env.apiUrl });
api.use(auth);
