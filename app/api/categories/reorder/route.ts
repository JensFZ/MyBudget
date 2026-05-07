import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

interface ReorderItem {
  id: number;
  sort_order: number;
  group_id: number;
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { items } = await req.json() as { items: ReorderItem[] };
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ ok: true });

  const ids = items.map(i => i.id);
  const owned = db.prepare(`
    SELECT c.id FROM categories c
    JOIN category_groups cg ON c.group_id = cg.id
    WHERE c.id IN (${ids.map(() => '?').join(',')}) AND cg.vault_id = ?
  `).all(...ids, ctx.vaultId) as { id: number }[];

  if (owned.length !== ids.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const update = db.prepare('UPDATE categories SET sort_order = ?, group_id = ? WHERE id = ?');
  db.transaction(() => {
    for (const item of items) update.run(item.sort_order, item.group_id, item.id);
  })();

  return NextResponse.json({ ok: true });
}
