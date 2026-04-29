import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';
import { encrypt } from '@/lib/bank-crypto';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const account_id = searchParams.get('account_id');

  let rows;
  if (account_id) {
    rows = db.prepare(
      'SELECT id, account_id, blz, bank_url, bank_account_iban, last_synced_at, last_sync_error FROM bank_connections WHERE account_id = ? AND vault_id = ?'
    ).all(Number(account_id), ctx.vaultId);
  } else {
    rows = db.prepare(
      'SELECT id, account_id, blz, bank_url, bank_account_iban, last_synced_at, last_sync_error FROM bank_connections WHERE vault_id = ?'
    ).all(ctx.vaultId);
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { account_id, blz, bank_url, username, pin, iban } = await req.json();

  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND vault_id = ?').get(account_id, ctx.vaultId);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  // Replace existing connection for this account
  db.prepare('DELETE FROM bank_connections WHERE account_id = ? AND vault_id = ?').run(account_id, ctx.vaultId);

  const username_enc = encrypt(username);
  const pin_enc = encrypt(pin);

  const row = db.prepare(`
    INSERT INTO bank_connections (account_id, vault_id, bank_url, blz, username_enc, pin_enc, bank_account_iban)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id, account_id, blz, bank_url, bank_account_iban, last_synced_at, last_sync_error
  `).get(account_id, ctx.vaultId, bank_url, blz, username_enc, pin_enc, iban ?? null);

  return NextResponse.json(row, { status: 201 });
}
