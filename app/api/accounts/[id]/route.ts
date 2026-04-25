import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND vault_id = ?').get(Number(id), ctx.vaultId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const clearedBalance = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND cleared = 1'
  ).get(Number(id)) as { total: number }).total;

  const unclearedBalance = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND cleared = 0'
  ).get(Number(id)) as { total: number }).total;

  return NextResponse.json({ ...account as object, clearedBalance, unclearedBalance });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND vault_id = ?').get(Number(id), ctx.vaultId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, type, on_budget, starred } = body;

  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (type !== undefined) { fields.push('type = ?'); values.push(type); }
  if (on_budget !== undefined) { fields.push('on_budget = ?'); values.push(on_budget); }
  if (starred !== undefined) { fields.push('starred = ?'); values.push(starred); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });

  values.push(Number(id));
  const result = db.prepare(
    `UPDATE accounts SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).get(...values);

  return NextResponse.json(result);
}
