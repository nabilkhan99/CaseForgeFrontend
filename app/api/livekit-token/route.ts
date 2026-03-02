import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

export async function POST(req: NextRequest) {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
        return NextResponse.json(
            { error: 'LiveKit credentials not configured' },
            { status: 500 }
        );
    }

    const { sessionId, stationId, userId
    } = await req.json();

    if (!sessionId) {
        return NextResponse.json(
            { error: 'sessionId is required' },
            { status: 400 }
        );
    }

    // Room name: one room per clinical session
    const roomName = `clinical-${sessionId}`;
    const participantIdentity = userId || `user-${sessionId}`;

    // Room metadata passed to the agent — carries station/user context
    const roomMetadata = JSON.stringify({
        station_id: stationId || null,
        user_id: userId || null,
        session_id: sessionId,
    });

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: participantIdentity,
        name: 'Student',
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
                agentName: '',  // empty string matches the default agent
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
