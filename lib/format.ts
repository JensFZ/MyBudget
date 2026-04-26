export const fmt = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

/** Format a number for amount inputs: absolute value, 2 decimal places, comma separator */
export function fmt2(n: number): string {
  return Math.abs(n).toFixed(2).replaceAll('.', ',');
}

/** Evaluate chained expressions like "1,50+8+8" or "100-5,20+3" */
export function evalAmount(expr: string): number {
  const s = expr.trim().replaceAll(',', '.');
  const tokens = s.split(/(?=[+-])/);
  let result = 0;
  for (const token of tokens) {
    const num = Number.parseFloat(token);
    if (!Number.isNaN(num)) result += num;
  }
  return result;
}
