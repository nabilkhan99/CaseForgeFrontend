'use client';

import { Inter } from 'next/font/google';
import Head from 'next/head';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function ClinicalMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-[#070A13] text-white`}>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <style jsx global>{`
        body {
          background: #070A13;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #101922;
        }
        ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }

        /* Glass card effect */
        .glass-card {
          background: rgba(21, 26, 46, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
      {children}
    </div>
  );
}
