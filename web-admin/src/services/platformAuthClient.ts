import { createClient, SupabaseClient } from '@supabase/supabase-js';

const platformUrl = import.meta.env.VITE_PLATFORM_SUPABASE_URL || 'http://127.0.0.1:55321';
const platformKey = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

let clientInstance: SupabaseClient | null = null;

export function getPlatformAuthClient(): SupabaseClient {
  if (!clientInstance) {
    clientInstance = createClient(platformUrl, platformKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return clientInstance;
}

export const platformAuthClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getPlatformAuthClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

