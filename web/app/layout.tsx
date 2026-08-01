import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { Nav } from '@/components/nav'
import { Baloo_2, Nunito, Silkscreen } from 'next/font/google'

const fontBody = Nunito({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' })
const fontDisplay = Baloo_2({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' })
const fontPixel = Silkscreen({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-pixel' })

export const metadata: Metadata = {
  title: 'Ledgii',
  description: 'Personal finance dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontBody.variable} ${fontDisplay.variable} ${fontPixel.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
