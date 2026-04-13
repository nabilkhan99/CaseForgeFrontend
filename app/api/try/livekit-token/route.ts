import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { createClient } from '@supabase/supabase-js';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
        return NextResponse.json(
            { error: 'LiveKit credentials not configured' },
            { status: 500 }
        );
    }

    const { sessionId, stationId } = await req.json();

    if (!sessionId || !stationId) {
        return NextResponse.json(
            { error: 'sessionId and stationId are required' },
            { status: 400 }
        );
    }

    // Validate that this station is a free trial station
    const supabase = getSupabaseAdmin();
    const { data: station, error } = await supabase
        .from('stations')
        .select('id, is_free_trial')
        .eq('id', stationId)
        .eq('is_free_trial', true)
        .eq('is_active', true)
        .maybeSingle();

    if (error || !station) {
        return NextResponse.json(
            { error: 'This station is not available for free trial' },
            { status: 403 }
        );
    }

    // Room name: one room per clinical session
    const roomName = `clinical-${sessionId}`;
    const participantIdentity = `guest-${sessionId}`;

    // Room metadata — user_id is null for guest sessions
    const roomMetadata = JSON.stringify({
        station_id: stationId,
        user_id: null,
        session_id: sessionId,
    });

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: participantIdentity,
        name: 'Guest Student',
        ttl: '15m',
        metadata: roomMetadata,
    });

    at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
    });

    // Dispatch the clinical-master agent into this room
    at.roomConfig = new RoomConfiguration({
        metadata: roomMetadata,
        agents: [
            new RoomAgentDispatch({
                agentName: '',
                metadata: roomMetadata,
            }),
        ],
    });

    const token = await at.toJwt();

    return NextResponse.json({
        token,
        serverUrl: LIVEKIT_URL,
        roomName,
    });
}
