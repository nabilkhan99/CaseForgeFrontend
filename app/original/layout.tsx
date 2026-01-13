import Image from 'next/image'

export default function OriginalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 to-slate-800">
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
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-neutral-50">
        {children}
      </main>
    </div>
  )
}
