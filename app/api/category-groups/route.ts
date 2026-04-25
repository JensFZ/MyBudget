import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as m FROM category_groups WHERE vault_id = ?'
  ).get(ctx.vaultId) as { m: number | null }).m ?? 0;

  const result = db.prepare(`
    INSERT INTO category_groups (name, sort_order, vault_id)
    VALUES (?, ?, ?) RETURNING *
  `).get(name.trim(), maxOrder + 1, ctx.vaultId);

  return NextResponse.json(result, { status: 201 });
}
