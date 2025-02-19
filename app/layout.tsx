import './globals.css'
import { Inter } from 'next/font/google'
import Image from 'next/image'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen">
          <nav className="backdrop-blur-lg bg-black/20 border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center h-full py-2">
                  <Image 
                    src="/fourteenfishermann.png"
                    alt="Fourteen Fisherman Logo"
                    width={60}
                    height={48}
                    priority
                    className="h-full w-auto"
                  />
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}