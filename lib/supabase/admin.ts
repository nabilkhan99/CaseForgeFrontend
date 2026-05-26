import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with service role key (bypasses RLS).
 * Only use in API routes / server components — never expose to the client.
 */
export function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client');
    }
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
