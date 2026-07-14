'use client';

import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Faq, GuaranteeCard, NhsBanner } from '@/components/landing/v5';
import PricingTable from '@/components/landing/v5/PricingTable';

export default function PricingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans">
      <LandingNavbar user={null} />
      <main className="flex flex-col gap-14 pb-20 pt-32 sm:gap-20 sm:pt-40">
        <header className="px-5 text-center sm:px-8">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-xs">
            The Complete SCA Course
          </p>
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-heading sm:text-5xl">
            AI Practice + On-demand Lectures + Small-Group Coaching.
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
