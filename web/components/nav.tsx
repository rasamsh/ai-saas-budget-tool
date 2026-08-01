'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ThemeToggle } from './theme-toggle'
import { createClient } from '@/lib/supabase/client'
import { Mascot } from '@/components/ui/mascot'

export function Nav() {
  const currentYear = new Date().getFullYear()
  const router = useRouter()
  const pathname = usePathname()

  // The login screen is a standalone full-bleed surface with no app chrome.
  if (pathname === '/login') return null

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href={`/${currentYear}`}
            className="flex items-center gap-2"
          >
            <Mascot size={24} />
            <span className="font-pixel text-sm tracking-wide text-[color:var(--accent)]">
              LEDGII
            </span>
          </Link>
          <Link
            href={`/${currentYear}`}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150"
          >
            {currentYear}
          </Link>
          <Link
            href="/settings/imports"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150"
          >
            Import
          </Link>
          <Link
            href="/settings"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150"
          >
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={signOut}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
