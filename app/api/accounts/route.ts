import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIfNeeded } from '@/lib/seed';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  seedIfNeeded(ctx.vaultId);
  const accounts = db.prepare(
    'SELECT * FROM accounts WHERE vault_id = ? ORDER BY on_budget DESC, type, name'
  ).all(ctx.vaultId);
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, type, balance, on_budget } = await req.json();
  const result = db.prepare(
    'INSERT INTO accounts (name, type, balance, on_budget, vault_id) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).get(name, type, balance ?? 0, on_budget ?? 1, ctx.vaultId);
  return NextResponse.json(result, { status: 201 });
}
