import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export type Frequency =
  | 'daily' | 'weekly' | 'every_other_week' | 'twice_a_month'
  | 'every_4_weeks' | 'monthly' | 'every_other_month' | 'every_3_months'
  | 'every_4_months' | 'twice_a_year' | 'yearly' | 'every_other_year';

export function nextDate(from: string, frequency: Frequency): string {
  const d = new Date(from);
  switch (frequency) {
    case 'daily':             d.setDate(d.getDate() + 1); break;
    case 'weekly':            d.setDate(d.getDate() + 7); break;
    case 'every_other_week':  d.setDate(d.getDate() + 14); break;
    case 'twice_a_month':     d.setDate(d.getDate() + 15); break;
    case 'every_4_weeks':     d.setDate(d.getDate() + 28); break;
    case 'monthly':           d.setMonth(d.getMonth() + 1); break;
    case 'every_other_month': d.setMonth(d.getMonth() + 2); break;
    case 'every_3_months':    d.setMonth(d.getMonth() + 3); break;
    case 'every_4_months':    d.setMonth(d.getMonth() + 4); break;
    case 'twice_a_year':      d.setMonth(d.getMonth() + 6); break;
    case 'yearly':            d.setFullYear(d.getFullYear() + 1); break;
    case 'every_other_year':  d.setFullYear(d.getFullYear() + 2); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = db.prepare(`
    SELECT st.*, a.name as account_name, c.name as category_name
    FROM scheduled_transactions st
    JOIN accounts a ON st.account_id = a.id
    LEFT JOIN categories c ON st.category_id = c.id
    WHERE st.vault_id = ?
    ORDER BY st.next_date ASC
  `).all(ctx.vaultId);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { account_id, category_id, payee, memo, amount, frequency, date, cleared, flag } = body;

  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND vault_id = ?').get(account_id, ctx.vaultId);
  if (!account) return NextResponse.json({ error: 'Invalid account' }, { status: 400 });

  const next = nextDate(date, frequency as Frequency);

  const result = db.prepare(`
    INSERT INTO scheduled_transactions
      (account_id, category_id, payee, memo, amount, frequency, next_date, cleared, flag, vault_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    account_id, category_id ?? null, payee ?? null, memo ?? null,
    amount, frequency, next, cleared ?? 0, flag ?? null, ctx.vaultId
  );

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  const existing = db.prepare('SELECT id FROM scheduled_transactions WHERE id = ? AND vault_id = ?').get(id, ctx.vaultId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare('DELETE FROM scheduled_transactions WHERE id = ?').run(id);
  return NextResponse.json({ deleted: true });
}
