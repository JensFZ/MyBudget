import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIfNeeded } from '@/lib/seed';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  seedIfNeeded(ctx.vaultId);

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
