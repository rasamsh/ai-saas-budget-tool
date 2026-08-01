'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setAnnualIncome(year: number, annualIncome: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await supabase
    .from('user_income')
    .upsert({ user_id: user.id, year, annual_income: annualIncome, updated_at: new Date().toISOString() })

  // Revalidate the year page and all month pages under it
  revalidatePath(`/${year}`)
  for (let m = 1; m <= 12; m++) {
    revalidatePath(`/${year}/${m.toString().padStart(2, '0')}`)
  }
}
