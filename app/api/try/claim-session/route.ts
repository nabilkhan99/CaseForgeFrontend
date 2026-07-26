import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        // Require authentication
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { sessionId } = await request.json();

        if (!sessionId) {
            return NextResponse.json(
                { error: 'sessionId is required' },
                { status: 400 }
            );
        }

        // Use admin client to update the session (bypasses RLS)
        const admin = getSupabaseAdmin();
        const { data, error } = await admin
            .from('clinical_sessions')
            .update({ user_id: user.id })
            .eq('id', sessionId)
            .is('user_id', null)
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error claiming session:', error);
            return NextResponse.json(
                { error: 'Failed to claim session' },
                { status: 500 }
            );
        }

        if (!data) {
            // Session either doesn't exist or already has a user
            return NextResponse.json(
                { error: 'Session not available for claiming', alreadyClaimed: true },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            sessionId: data.id,
            userId: user.id,
        });
    } catch (error) {
        console.error('Claim session error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
