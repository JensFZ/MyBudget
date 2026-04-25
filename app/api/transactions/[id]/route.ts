import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  // Verify transaction belongs to this vault
  const tx = db.prepare(`
    SELECT t.id FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ? AND a.vault_id = ?
  `).get(Number(id), ctx.vaultId);
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { cleared, category_id, payee, memo, flag } = await req.json();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (cleared !== undefined) { fields.push('cleared = ?'); values.push(cleared); }
  if (category_id !== undefined) { fields.push('category_id = ?'); values.push(category_id); }
  if (payee !== undefined) { fields.push('payee = ?'); values.push(payee); }
  if (memo !== undefined) { fields.push('memo = ?'); values.push(memo); }
  if (flag !== undefined) { fields.push('flag = ?'); values.push(flag); }
  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });

  values.push(Number(id));
  const result = db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ? RETURNING *`).get(...values);
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tx = db.prepare(`
    SELECT t.* FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ? AND a.vault_id = ?
  `).get(Number(id), ctx.vaultId) as {
    id: number; account_id: number; amount: number; date: string; transfer_account_id: number | null;
  } | undefined;
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (tx.transfer_account_id) {
    const paired = db.prepare(`
      SELECT * FROM transactions
      WHERE account_id = ? AND transfer_account_id = ? AND date = ? AND ABS(amount) = ABS(?) AND id != ?
    `).get(tx.transfer_account_id, tx.account_id, tx.date, tx.amount, tx.id) as
      { id: number; account_id: number; amount: number } | undefined;
    if (paired) {
      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(paired.amount, paired.account_id);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(paired.id);
    }
  }

  db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id);
  db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(id));
  return NextResponse.json({ success: true });
}
