// Explicit date parsing to an ISO YYYY-MM-DD string. The Python pipeline uses
// dateutil; bank CSV exports only ever use MM/DD/YYYY (occasionally 2-digit
// year) or ISO, so we parse those forms directly and avoid `new Date(string)`
// timezone ambiguity. Returns null for unparseable input (row is skipped).

export function parseDateISO(value: string | undefined): string | null {
  const str = (value ?? '').trim()
  if (!str) return null

  // ISO: YYYY-MM-DD (optionally followed by time)
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const mo = Number(m[2])
    const d = Number(m[3])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    return `${m[1]}-${m[2]}-${m[3]}`
  }

  // US: M/D/YYYY, MM/DD/YYYY, or MM/DD/YY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (m) {
    const mo = Number(m[1])
    const d = Number(m[2])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const mm = String(mo).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  return null
}
