import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         * - coaching-session/mock-* (static coaching station runners in
         *   public/coaching-session/: no auth needed, and the password_pending
         *   gate would otherwise redirect a signed-in tutor off the runner)
         */
        '/((?!_next/static|_next/image|favicon.ico|sca-cases|coaching-session/mock-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
