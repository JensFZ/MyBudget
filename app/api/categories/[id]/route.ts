import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify category belongs to this vault
  const cat = db.prepare(`
    SELECT c.id FROM categories c
    JOIN category_groups cg ON c.group_id = cg.id
    WHERE c.id = ? AND cg.vault_id = ?
  `).get(Number(id), ctx.vaultId);
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('color' in body)       { fields.push('color = ?');       values.push(body.color ?? null); }
  if ('name' in body)        { fields.push('name = ?');        values.push(String(body.name).trim()); }
  if ('goal_amount' in body) { fields.push('goal_amount = ?'); values.push(body.goal_amount == null ? null : Number(body.goal_amount)); }
  if ('goal_type' in body)   { fields.push('goal_type = ?');   values.push(body.goal_type ?? null); }
  if ('goal_date' in body)   { fields.push('goal_date = ?');   values.push(body.goal_date ?? null); }

  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  values.push(Number(id));
  const result = db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ? RETURNING *`).get(...values);

  return NextResponse.json(result);
}
