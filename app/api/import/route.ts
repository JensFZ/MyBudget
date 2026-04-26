import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

interface ImportRow {
  date: string;        // YYYY-MM-DD
  payee: string | null;
  memo: string | null;
  amount: number;      // positive = inflow, negative = outflow
  cleared: number;     // 0 or 1
  import_hash: string;
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { account_id: number; rows: ImportRow[] };
  const { account_id, rows } = body;

  if (!account_id || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify account belongs to this vault
  const account = db.prepare(
    'SELECT id, balance FROM accounts WHERE id = ? AND vault_id = ?'
  ).get(account_id, ctx.vaultId) as { id: number; balance: number } | undefined;
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  let imported = 0;
  let duplicates = 0;

  const insertTx = db.prepare(`
    INSERT INTO transactions (account_id, date, payee, memo, amount, cleared, import_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateBalance = db.prepare(
    'UPDATE accounts SET balance = balance + ? WHERE id = ?'
  );
  const checkDup = db.prepare(
    'SELECT id FROM transactions WHERE import_hash = ?'
  );

  const doImport = db.transaction(() => {
    for (const row of rows) {
      const existing = checkDup.get(row.import_hash);
      if (existing) {
        duplicates++;
        continue;
      }
      insertTx.run(account_id, row.date, row.payee, row.memo, row.amount, row.cleared, row.import_hash);
      updateBalance.run(row.amount, account_id);
      imported++;
    }
  });

  doImport();

  return NextResponse.json({ imported, duplicates, total: rows.length });
}
