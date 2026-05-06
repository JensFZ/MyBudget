export const fmt = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

/** Format a number for amount inputs: absolute value, 2 decimal places, comma separator */
export function fmt2(n: number): string {
  return Math.abs(n).toFixed(2).replaceAll('.', ',');
}

/** Evaluate chained expressions like "1,50+8+8", "100-5,20+3", "10*1,19", "100/4" */
export function evalAmount(expr: string): number {
  const s = expr.trim().replaceAll(',', '.');
  const raw = s.match(/[+\-*/]|[0-9]+(?:\.[0-9]+)?/g);
  if (!raw) return 0;

  let i = 0;
  const nums: number[] = [];
  const ops: string[] = [];

  let sign = 1;
  if (raw[i] === '-') { sign = -1; i++; }
  else if (raw[i] === '+') { i++; }
  if (i >= raw.length) return 0;
  nums.push(sign * parseFloat(raw[i++]));

  while (i < raw.length - 1) {
    const op = raw[i++];
    nums.push(parseFloat(raw[i++]));
    ops.push(op);
  }

  // First pass: * and /
  let j = 0;
  while (j < ops.length) {
    if (ops[j] === '*' || ops[j] === '/') {
      const val = ops[j] === '*' ? nums[j] * nums[j + 1] : nums[j] / nums[j + 1];
      nums.splice(j, 2, val);
      ops.splice(j, 1);
    } else { j++; }
  }

  // Second pass: + and -
  let total = nums[0];
  for (let k = 0; k < ops.length; k++) {
    total = ops[k] === '-' ? total - nums[k + 1] : total + nums[k + 1];
  }
  return total;
}
