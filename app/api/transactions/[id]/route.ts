import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tx = db.prepare(`
    SELECT t.*, a.name as account_name FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ? AND a.vault_id = ?
  `).get(Number(id), ctx.vaultId) as {
    id: number; account_id: number; amount: number; date: string; cleared: number;
    transfer_account_id: number | null; account_name: string;
  } | undefined;
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const newAmount = body.amount !== undefined ? body.amount : tx.amount;
  const transferInBody = 'transfer_account_id' in body;
  const newTransferAccountId = transferInBody ? body.transfer_account_id : tx.transfer_account_id;
  const transferChanged = transferInBody && body.transfer_account_id !== tx.transfer_account_id;
  const amountChanged = body.amount !== undefined && body.amount !== tx.amount;

  // Find existing paired transaction
  const oldPaired = tx.transfer_account_id
    ? db.prepare(`
        SELECT * FROM transactions
        WHERE account_id = ? AND transfer_account_id = ? AND date = ? AND ABS(amount) = ABS(?) AND id != ?
      `).get(tx.transfer_account_id, tx.account_id, tx.date, tx.amount, tx.id) as
        { id: number; account_id: number; amount: number } | undefined
    : undefined;

  if (transferChanged) {
    // Remove old paired transaction
    if (oldPaired) {
      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(oldPaired.amount, oldPaired.account_id);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(oldPaired.id);
    }

    // Create new paired transaction
    if (body.transfer_account_id) {
      const destAccount = db.prepare('SELECT id, name FROM accounts WHERE id = ? AND vault_id = ?')
        .get(body.transfer_account_id, ctx.vaultId) as { id: number; name: string } | undefined;
      if (destAccount) {
        const pairedAmount = -newAmount;
        db.prepare(`
          INSERT INTO transactions (account_id, category_id, transfer_account_id, date, amount, payee, memo, cleared, flag)
          VALUES (?, null, ?, ?, ?, ?, ?, ?, null)
        `).run(
          body.transfer_account_id, tx.account_id,
          body.date ?? tx.date, pairedAmount,
          `Transfer from: ${tx.account_name}`,
          body.memo ?? null, body.cleared ?? tx.cleared ?? 0
        );
        db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(pairedAmount, body.transfer_account_id);
      }
    }
  } else if (amountChanged && oldPaired) {
    // Amount changed on existing transfer — update paired
    const pairedNewAmount = -newAmount;
    const pairedDelta = pairedNewAmount - oldPaired.amount;
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(pairedDelta, oldPaired.account_id);
    db.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(pairedNewAmount, oldPaired.id);
  }

  // Update source account balance if amount changed
  if (amountChanged) {
    const delta = newAmount - tx.amount;
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(delta, tx.account_id);
  }

  // Build update fields for current transaction
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.cleared !== undefined) { fields.push('cleared = ?'); values.push(body.cleared); }
  if (body.amount !== undefined) { fields.push('amount = ?'); values.push(body.amount); }
  if (body.payee !== undefined) { fields.push('payee = ?'); values.push(body.payee); }
  if (body.memo !== undefined) { fields.push('memo = ?'); values.push(body.memo); }
  if (body.flag !== undefined) { fields.push('flag = ?'); values.push(body.flag); }

  if (transferInBody) {
    fields.push('transfer_account_id = ?');
    values.push(newTransferAccountId);
    // Becoming a transfer → clear category; leaving transfer → use provided category_id
    fields.push('category_id = ?');
    values.push(newTransferAccountId !== null ? null : (body.category_id ?? null));
  } else if (body.category_id !== undefined) {
    fields.push('category_id = ?');
    values.push(body.category_id);
  }

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
