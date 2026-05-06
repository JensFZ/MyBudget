import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    "SELECT balance FROM accounts WHERE vault_id = ? AND type != 'closed' AND COALESCE(subtype,'') NOT IN ('loan_received','loan_granted')"
  ).all(ctx.vaultId) as { balance: number }[];
  const assets = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const debts = accounts.filter(a => a.balance < 0).reduce((s, a) => s + a.balance, 0);

  const loanAccounts = db.prepare(
    "SELECT name, balance, subtype FROM accounts WHERE vault_id = ? AND COALESCE(subtype,'') IN ('loan_received','loan_granted') AND type != 'closed'"
  ).all(ctx.vaultId) as { name: string; balance: number; subtype: string }[];
  const loansReceived = loanAccounts.filter(a => a.subtype === 'loan_received').reduce((s, a) => s + a.balance, 0);
  const loansGranted  = loanAccounts.filter(a => a.subtype === 'loan_granted').reduce((s, a) => s + a.balance, 0);

  const allTxns = db.prepare(`
    SELECT t.date, t.amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.vault_id = ?
      AND a.on_budget = 1
      AND t.transfer_account_id IS NULL
      AND COALESCE(a.subtype,'') NOT IN ('loan_received','loan_granted')
    ORDER BY t.date ASC, t.id ASC
  `).all(ctx.vaultId) as { date: string; amount: number }[];

  const wallet: { date: string; remaining: number }[] = [];
  const spendingAges: number[] = [];

  for (const tx of allTxns) {
    if (tx.amount > 0) {
      wallet.push({ date: tx.date, remaining: tx.amount });
    } else {
      let toSpend = Math.abs(tx.amount);
      let weightedDays = 0, weightedAmt = 0;
      while (toSpend > 0.001 && wallet.length > 0) {
        const oldest = wallet[0];
        const used = Math.min(oldest.remaining, toSpend);
        const days = (new Date(tx.date).getTime() - new Date(oldest.date).getTime()) / 86400000;
        weightedDays += days * used;
        weightedAmt  += used;
        toSpend          -= used;
        oldest.remaining -= used;
        if (oldest.remaining < 0.001) wallet.shift();
      }
      if (weightedAmt > 0) spendingAges.push(weightedDays / weightedAmt);
    }
  }

  const last10 = spendingAges.slice(-10);
  const ageOfMoney: number | null = last10.length > 0
    ? Math.round(last10.reduce((a, b) => a + b, 0) / last10.length)
    : null;

  return NextResponse.json({ monthly, netWorth: assets + debts, assets, debts, loansReceived, loansGranted, ageOfMoney });
}
