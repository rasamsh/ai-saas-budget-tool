'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/eyebrow'
import { Pill } from '@/components/ui/pill'
import { Mascot } from '@/components/ui/mascot'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(`/${new Date().getFullYear()}`)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-[var(--background)] px-4 py-8 font-sans text-[color:var(--foreground)]">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <Mascot size={60} className="mb-3" />
          <Eyebrow>Personal finance</Eyebrow>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">Ledgii</h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted-foreground)]">Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 flex justify-center">
          <Pill variant="outline">Made for humans</Pill>
        </div>
      </Card>
    </div>
  )
}
