/**
 * Округление денежных значений.
 * - При n < 1e13: точное округление до 2 знаков (Math.round(n * 100) / 100)
 * - При n >= 1e13: Math.round(n) — дробные копейки несущественны при триллионах,
 *   а n * 100 при n ≈ 1e15 превысило бы Number.MAX_SAFE_INTEGER
 */
export const roundCurrency = (n: number): number => {
  if (n >= 1e13 || n <= -1e13) return Math.round(n)
  return Math.round(n * 100) / 100
}
