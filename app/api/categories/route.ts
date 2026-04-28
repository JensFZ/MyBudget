import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const groups = db.prepare(
    'SELECT * FROM category_groups WHERE vault_id = ? ORDER BY sort_order'
  ).all(ctx.vaultId) as { id: number; name: string; sort_order: number; is_hidden: number }[];
  const groupIds = groups.map(g => g.id);
  const categories = groupIds.length > 0
    ? db.prepare(
        `SELECT * FROM categories WHERE group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY sort_order`
      ).all(...groupIds)
    : [];
  return NextResponse.json({ groups, categories });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { group_id, name, is_goal, goal_amount, goal_type } = await req.json();

  // Verify group belongs to this vault
  const group = db.prepare('SELECT id FROM category_groups WHERE id = ? AND vault_id = ?').get(group_id, ctx.vaultId);
  if (!group) return NextResponse.json({ error: 'Invalid group' }, { status: 400 });

  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM categories WHERE group_id = ?').get(group_id) as { m: number | null }).m ?? 0;
  const result = db.prepare(`
    INSERT INTO categories (group_id, name, sort_order, is_goal, goal_amount, goal_type)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING *
  `).get(group_id, name, maxOrder + 1, is_goal ?? 0, goal_amount ?? null, goal_type ?? null);

  return NextResponse.json(result, { status: 201 });
}
