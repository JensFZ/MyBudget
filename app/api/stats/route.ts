import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIfNeeded } from '@/lib/seed';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  seedIfNeeded(ctx.vaultId);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? '2025-12';
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 7);

  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [toY, toM] = to.split('-').map(Number);
  while (y < toY || (y === toY && m <= toM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }

  const monthly = months.map(month => {
    const income = (db.prepare(`
      SELECT COALESCE(SUM(t.amount), 0) as total
      FROM transactions t JOIN accounts a ON t.account_id = a.id
      WHERE t.date LIKE ? AND t.amount > 0 AND a.vault_id = ?
    `).get(`${month}%`, ctx.vaultId) as { total: number }).total;

    const spending = Math.abs((db.prepare(`
      SELECT COALESCE(SUM(t.amount), 0) as total
      FROM transactions t JOIN accounts a ON t.account_id = a.id
      WHERE t.date LIKE ? AND t.amount < 0 AND a.vault_id = ?
    `).get(`${month}%`, ctx.vaultId) as { total: number }).total);

    return { month, income, spending };
  });

  const accounts = db.prepare(
    "SELECT balance FROM accounts WHERE vault_id = ? AND type != 'closed'"
  ).all(ctx.vaultId) as { balance: number }[];
  const assets = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const debts = accounts.filter(a => a.balance < 0).reduce((s, a) => s + a.balance, 0);

  return NextResponse.json({ monthly, netWorth: assets + debts, assets, debts, ageOfMoney: 125 });
}
