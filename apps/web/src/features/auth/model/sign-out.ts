import { supabase } from '@/shared/api';

export async function signOut() {
  await supabase.auth.signOut();
}
