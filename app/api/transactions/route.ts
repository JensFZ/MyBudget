import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const account_id = searchParams.get('account_id');
  const search = searchParams.get('search');

  let query = `
    SELECT t.*, a.name as account_name, c.name as category_name
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE a.vault_id = ?
  `;
  const params: (string | number)[] = [ctx.vaultId];

  if (month) { query += ` AND t.date LIKE ?`; params.push(`${month}%`); }
  if (account_id) { query += ` AND t.account_id = ?`; params.push(Number(account_id)); }
  if (search) { query += ` AND (t.payee LIKE ? OR t.memo LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (searchParams.get('needs_category') === '1') {
    query += ` AND (t.category_id IS NULL AND t.amount < 0)`;
  }
  query += ' ORDER BY t.date DESC, t.created_at DESC';

  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { account_id, category_id, date, amount, memo, payee, cleared, flag, transfer_account_id } = body;

  // Verify account belongs to vault
  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND vault_id = ?').get(account_id, ctx.vaultId);
  if (!account) return NextResponse.json({ error: 'Invalid account' }, { status: 400 });

  const result = db.prepare(`
    INSERT INTO transactions (account_id, category_id, date, amount, memo, payee, cleared, flag, transfer_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `).get(
    account_id,
    transfer_account_id ? null : (category_id ?? null),
    date, amount, memo ?? null, payee ?? null, cleared ?? 0, flag ?? null, transfer_account_id ?? null
  ) as { id: number };

  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, account_id);

  if (transfer_account_id) {
    const srcName = (db.prepare('SELECT name FROM accounts WHERE id = ?').get(account_id) as { name: string }).name;
    const destName = (db.prepare('SELECT name FROM accounts WHERE id = ?').get(transfer_account_id) as { name: string }).name;
    db.prepare('UPDATE transactions SET payee = ? WHERE id = ?').run(`Transfer to: ${destName}`, result.id);
    const destAmount = -amount;
    db.prepare(`
      INSERT INTO transactions (account_id, category_id, date, amount, memo, payee, cleared, flag, transfer_account_id)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `).run(transfer_account_id, date, destAmount, memo ?? null, `Transfer from: ${srcName}`, cleared ?? 0, flag ?? null, account_id);
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(destAmount, transfer_account_id);
  }

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ids } = await req.json() as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const deleteTx = db.transaction((txIds: number[]) => {
    for (const id of txIds) {
      const tx = db.prepare(`
        SELECT t.* FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.id = ? AND a.vault_id = ?
      `).get(id, ctx.vaultId) as { id: number; account_id: number; amount: number; date: string; transfer_account_id: number | null } | undefined;
      if (!tx) continue;

      if (tx.transfer_account_id) {
        const paired = db.prepare(`
          SELECT * FROM transactions
          WHERE account_id = ? AND transfer_account_id = ? AND date = ? AND ABS(amount) = ABS(?) AND id != ?
        `).get(tx.transfer_account_id, tx.account_id, tx.date, tx.amount, tx.id) as
          { id: number; account_id: number; amount: number } | undefined;
        if (paired && !txIds.includes(paired.id)) {
          db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(paired.amount, paired.account_id);
          db.prepare('DELETE FROM transactions WHERE id = ?').run(paired.id);
        }
      }

      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
    }
  });

  deleteTx(ids);
  return NextResponse.json({ deleted: ids.length });
}
