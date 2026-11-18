import { createClient } from '@supabase/supabase-js';

const platformUrl = import.meta.env.VITE_PLATFORM_SUPABASE_URL || 'http://127.0.0.1:55321';
const platformKey = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY || '';

export const platformAuthClient = createClient(platformUrl, platformKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
