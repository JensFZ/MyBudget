import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const group = db.prepare('SELECT id FROM category_groups WHERE id = ? AND vault_id = ?')
    .get(Number(id), ctx.vaultId);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('name' in body)      { fields.push('name = ?');      values.push(String(body.name).trim()); }
  if ('is_hidden' in body) { fields.push('is_hidden = ?'); values.push(body.is_hidden ? 1 : 0); }

  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  values.push(Number(id));
  const result = db.prepare(`UPDATE category_groups SET ${fields.join(', ')} WHERE id = ? RETURNING *`).get(...values);

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const group = db.prepare('SELECT id FROM category_groups WHERE id = ? AND vault_id = ?')
    .get(Number(id), ctx.vaultId);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const catCount = (db.prepare(
    'SELECT COUNT(*) as c FROM categories WHERE group_id = ?'
  ).get(Number(id)) as { c: number }).c;
  if (catCount > 0) return NextResponse.json({ error: 'has_categories' }, { status: 409 });

  db.prepare('DELETE FROM category_groups WHERE id = ?').run(Number(id));

  return new NextResponse(null, { status: 204 });
}
