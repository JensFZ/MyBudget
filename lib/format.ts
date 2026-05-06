export const fmt = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

/** Format a number for amount inputs: absolute value, 2 decimal places, comma separator */
export function fmt2(n: number): string {
  return Math.abs(n).toFixed(2).replaceAll('.', ',');
}

/** Evaluate chained expressions like "1,50+8+8", "100÷4×3", "12,5*2-1" */
export function evalAmount(expr: string): number {
  const s = expr.trim()
    .replaceAll(',', '.')
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-');

  if (!s) return 0;

  let pos = 0;

  function parseFactor(): number {
    let sign = 1;
    if (pos < s.length && s[pos] === '-') { sign = -1; pos++; }
    else if (pos < s.length && s[pos] === '+') { pos++; }
    const start = pos;
    while (pos < s.length && (s[pos] >= '0' && s[pos] <= '9' || s[pos] === '.')) pos++;
    const n = parseFloat(s.slice(start, pos));
    return sign * (isNaN(n) ? 0 : n);
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseFactor();
      result = op === '*' ? result * right : right !== 0 ? result / right : 0;
    }
    return result;
  }

  function parseExpr(): number {
    let result = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      result = op === '+' ? result + parseTerm() : result - parseTerm();
    }
    return result;
  }

  try {
    const result = parseExpr();
    return isNaN(result) ? 0 : result;
  } catch {
    return 0;
  }
}
