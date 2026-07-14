'use client';

import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Faq, GuaranteeCard, NhsBanner } from '@/components/landing/v5';
import PricingTable from '@/components/landing/v5/PricingTable';

function PricingContent() {
  const searchParams = useSearchParams();
  const showUpgradeBanner = searchParams.get('upgrade') === 'true';

  const [user, setUser] = useState<User | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      if (user) {
        fetch('/api/subscription')
          .then((r) => r.json())
          .then((data) => {
            if (data.subscription) {
              setCurrentPlan(data.subscription.plan);
            }
          });
      }
    });
  }, []);

  const handleCheckout = async (plan: string) => {
    if (!user) {
      window.location.href = `/auth/sign-up?redirect=/pricing`;
      return;
    }

    setCheckoutLoading(plan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.redirect) {
        window.location.href = data.redirect;
      }
    } catch {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans">
      <LandingNavbar user={null} />
      <main className="flex flex-col gap-14 pb-20 pt-32 sm:gap-20 sm:pt-40">
        <header className="px-5 text-center sm:px-8">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-xs">
            The complete SCA programme
          </p>
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-heading sm:text-5xl">
            AI practice + expert teaching + small-group coaching.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-body sm:text-base">
            Pass all 200 mock AI SCA stations. Still fail your SCA? We pay you £500.
          </p>
        </header>
        <NhsBanner />
        <PricingTable />
        <GuaranteeCard />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
