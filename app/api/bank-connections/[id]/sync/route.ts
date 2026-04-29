import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';
import { decrypt } from '@/lib/bank-crypto';
import { fetchBalance, fetchTransactions } from '@/lib/fints-client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conn = db.prepare(`
    SELECT bc.*, a.balance as current_balance
    FROM bank_connections bc
    JOIN accounts a ON bc.account_id = a.id
    WHERE bc.id = ? AND bc.vault_id = ?
  `).get(Number(id), ctx.vaultId) as {
    id: number; account_id: number; bank_url: string; blz: string;
    username_enc: string; pin_enc: string; bank_account_iban: string;
    last_synced_at: string | null; current_balance: number;
  } | undefined;

  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const username = decrypt(conn.username_enc);
  const pin = decrypt(conn.pin_enc);
  const config = { url: conn.bank_url, blz: conn.blz, username, pin };

  try {
    // Fetch transactions from last sync or 90 days back
    const fromDate = conn.last_synced_at
      ? new Date(conn.last_synced_at)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [transactions, newBalance] = await Promise.all([
      fetchTransactions(config, conn.bank_account_iban, fromDate),
      fetchBalance(config, conn.bank_account_iban),
    ]);

    // Import new transactions (deduplicate via import_hash)
    let imported = 0;
    let duplicates = 0;

    const checkDup = db.prepare('SELECT id FROM transactions WHERE import_hash = ?');
    const insertTx = db.prepare(`
      INSERT INTO transactions (account_id, date, payee, memo, amount, cleared, import_hash)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);

    const doImport = db.transaction(() => {
      for (const tx of transactions) {
        if (checkDup.get(tx.import_hash)) { duplicates++; continue; }
        insertTx.run(conn.account_id, tx.date, tx.payee, tx.memo, tx.amount, tx.import_hash);
        imported++;
      }
      // Sync account balance to bank balance
      db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, conn.account_id);
      // Update sync metadata
      db.prepare(
        'UPDATE bank_connections SET last_synced_at = ?, last_sync_error = NULL WHERE id = ?'
      ).run(new Date().toISOString(), conn.id);
    });

    doImport();

    // Notify sidebar about balance change
    return NextResponse.json({ imported, duplicates, balance: newBalance });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE bank_connections SET last_sync_error = ? WHERE id = ?').run(message, conn.id);
    return NextResponse.json({ error: 'sync_failed', message }, { status: 502 });
  }
}
