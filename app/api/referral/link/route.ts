import { NextResponse } from 'next/server';
import { BrevoClient, BrevoError } from '@getbrevo/brevo';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { validateSelfServeCode } from '@/lib/commerce/advocates';
import { REWARD_BY_PLAN, REFEREE_REWARD_BY_PLAN, referralUrl } from '@/lib/commerce/referrals';
import { shareUrlFor } from '@/lib/commerce/shareToken';
import { sendReferralEmail } from '@/lib/email/referralEmail';

/**
 * PUBLIC "send me my referral link" endpoint, backing the modal on
 * /gp-portfolio-tool.
 *
 * Until now referral codes could only be minted two ways: automatically by the
 * Stripe webhook (buyers) or by hand in the admin panel. Neither reaches the
 * largest warm audience we have — the tens of thousands of trainees who use the
 * free portfolio tool and have never bought anything. This is the self-serve
 * path for them.
 *
 * Follows the house pattern for a public email-capture POST (app/api/waitlist):
 * validate, normalise, insert, treat a unique violation as success, then email.
 * The one difference is that a repeat submitter must get their EXISTING link
 * back rather than an error — `referral_codes.owner_email` is UNIQUE, and the
 * whole point of the modal is "give me my link", which is the same request the
 * second time as the first.
 */

/** Shape returned to the modal on success. */
interface LinkResponse {
    /** The link they share, https://origin/r/CODE. */
    referralUrl: string;
    /** Their private tracker page, https://origin/share/CODE/TOKEN. */
    shareUrl: string;
    /** True when the code already existed (a repeat submitter). */
    existing: boolean;
    /** Whether the email actually went out — surfaced so the modal can adapt. */
    emailSent: boolean;
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

/** Columns we need back from `referral_codes`. */
const CODE_COLUMNS = 'code, owner_email, active';

/**
 * Add the address to the Brevo marketing list so the "occasional updates"
 * half of the modal notice is delivered by a channel that carries Brevo's
 * unsubscribe footer — which is what makes the PECR promise in that notice
 * true. No list configured means no marketing, so this is a clean no-op.
 *
 * Never throws: a failure here must not cost someone the link they asked for.
 */
async function addToMarketingList(email: string): Promise<void> {
    const brevoKey = process.env.BREVO_API_KEY;
    const listIdRaw = process.env.BREVO_REFERRAL_LIST_ID;
    if (!brevoKey || !listIdRaw) return;

    const listId = Number(listIdRaw);
    if (!Number.isInteger(listId)) {
        console.warn('[referral-link] BREVO_REFERRAL_LIST_ID is not an integer', { listIdRaw });
        return;
    }

    try {
        const brevo = new BrevoClient({ apiKey: brevoKey });
        await brevo.contacts.createContact({
            email,
            listIds: [listId],
            updateEnabled: true,
        });
    } catch (err) {
        // 400 "Contact already exist" is the common, harmless case.
        const detail = err instanceof BrevoError ? `${err.statusCode} ${err.message}` : String(err);
        console.warn('[referral-link] Brevo list add failed', { email, detail });
    }
}

/** Look up an existing code for this owner. Null when they have none. */
async function findExistingCode(supabase: SupabaseAdmin, ownerEmail: string) {
    const { data, error } = await supabase
        .from('referral_codes')
        .select(CODE_COLUMNS)
        .eq('owner_email', ownerEmail)
        .maybeSingle();

    if (error) {
        console.error('[referral-link] lookup failed', { ownerEmail, error });
        return null;
    }
    return data;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const result = validateSelfServeCode({ ownerEmail: body?.email });
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const { code: mintedCode, ownerEmail } = result.value;
        const origin = new URL(request.url).origin;
        const supabase = getSupabaseAdmin();

        // 1. Already an advocate? Hand back the link they already have. A buyer
        //    who later uses the tool, or anyone submitting twice, lands here.
        let code = (await findExistingCode(supabase, ownerEmail))?.code ?? null;
        let existing = code !== null;

        // 2. Otherwise mint one.
        //    `code_type: 'affiliate'` because the check constraint permits only
        //    'customer' | 'affiliate' and these owners have not bought anything,
        //    so 'customer' would be untrue. They carry no reward override, so
        //    they pay exactly the plan tier like every other code.
        //    `owner_name` is left NULL — the modal collects an email only, and a
        //    name derived from the local-part would be a fabrication that then
        //    shows up in the admin table and in email greetings.
        if (!code) {
            const { data, error } = await supabase
                .from('referral_codes')
                .insert({
                    code: mintedCode,
                    owner_email: ownerEmail,
                    code_type: 'affiliate',
                    active: true,
                    invited_at: new Date().toISOString(),
                })
                .select(CODE_COLUMNS)
                .single();

            if (error) {
                // 23505 = unique violation. Either two submissions raced for the
                // same owner_email, or the random code collided. Re-read: if the
                // owner now has a code, that is the answer, not an error.
                if (error.code === '23505') {
                    const raced = await findExistingCode(supabase, ownerEmail);
                    if (!raced) {
                        console.error('[referral-link] code collision, no owner row', {
                            ownerEmail,
                            mintedCode,
                        });
                        return NextResponse.json(
                            { error: 'Could not create your link. Please try again.' },
                            { status: 500 },
                        );
                    }
                    code = raced.code;
                    existing = true;
                } else {
                    console.error('[referral-link] insert failed', { ownerEmail, error });
                    return NextResponse.json(
                        { error: 'Could not create your link. Please try again.' },
                        { status: 500 },
                    );
                }
            } else {
                code = data.code;
            }
        }

        // 3. Email them the link. Reuses the advocate email the Stripe webhook
        //    sends — same link, same two-sided framing — and never throws.
        const link = referralUrl(origin, code);
        const email = await sendReferralEmail({
            toEmail: ownerEmail,
            referralUrl: link,
            rewardAmount: REWARD_BY_PLAN.complete,
            refereeDiscount: REFEREE_REWARD_BY_PLAN.complete,
        });

        await addToMarketingList(ownerEmail);

        console.log('[referral-link] issued', {
            email: ownerEmail,
            code,
            existing,
            emailSent: email.sent,
        });

        const payload: LinkResponse = {
            referralUrl: link,
            // Falls back to /share/CODE when REFERRAL_SHARE_SECRET is unset, which
            // still renders the share page minus the private stats panel.
            shareUrl: shareUrlFor(origin, code),
            existing,
            emailSent: email.sent,
        };
        return NextResponse.json(payload);
    } catch (error) {
        console.error('[referral-link] unhandled', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
