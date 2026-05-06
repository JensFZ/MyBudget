import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';
import { nextDate, Frequency } from '../route';

interface ScheduledRow {
  id: number;
  account_id: number;
  category_id: number | null;
  payee: string | null;
  memo: string | null;
  amount: number;
  frequency: string;
  next_date: string;
  cleared: number;
  flag: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = db.prepare('SELECT * FROM scheduled_transactions WHERE id = ? AND vault_id = ?')
    .get(Number(id), ctx.vaultId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const allowed = ['account_id', 'category_id', 'payee', 'memo', 'amount', 'frequency', 'next_date'] as const;
  const fields = allowed.filter(f => f in body);
  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });

  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f] ?? null);

  const result = db.prepare(
    `UPDATE scheduled_transactions SET ${setClauses} WHERE id = ? AND vault_id = ? RETURNING *`
  ).get(...[...values, Number(id), ctx.vaultId]);

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Book: create real transaction from template and advance next_date
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const st = db.prepare('SELECT * FROM scheduled_transactions WHERE id = ? AND vault_id = ?')
    .get(Number(id), ctx.vaultId) as ScheduledRow | undefined;
  if (!st) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const date = body.date ?? st.next_date;

  const tx = db.prepare(`
    INSERT INTO transactions (account_id, category_id, date, amount, memo, payee, cleared, flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `).get(st.account_id, st.category_id, date, st.amount, st.memo, st.payee, st.cleared ?? 0, st.flag);

  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(st.amount, st.account_id);

  const newNextDate = nextDate(date, st.frequency as Frequency);
  db.prepare('UPDATE scheduled_transactions SET next_date = ? WHERE id = ?').run(newNextDate, st.id);

  return NextResponse.json({ transaction: tx, next_date: newNextDate }, { status: 201 });
}
