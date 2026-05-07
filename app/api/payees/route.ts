import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = db.prepare(`
    SELECT DISTINCT t.payee,
      (SELECT t2.category_id
       FROM transactions t2
       JOIN accounts a2 ON t2.account_id = a2.id
       WHERE t2.payee = t.payee AND a2.vault_id = ? AND t2.category_id IS NOT NULL
       ORDER BY t2.date DESC, t2.created_at DESC LIMIT 1) as last_category_id,
      (SELECT c.name
       FROM transactions t2
       JOIN accounts a2 ON t2.account_id = a2.id
       JOIN categories c ON t2.category_id = c.id
       WHERE t2.payee = t.payee AND a2.vault_id = ? AND t2.category_id IS NOT NULL
       ORDER BY t2.date DESC, t2.created_at DESC LIMIT 1) as last_category_name
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.vault_id = ? AND t.payee IS NOT NULL AND t.payee != ''
      AND t.transfer_account_id IS NULL
    ORDER BY t.payee COLLATE NOCASE
  `).all(ctx.vaultId, ctx.vaultId, ctx.vaultId);

  return NextResponse.json(rows);
}
