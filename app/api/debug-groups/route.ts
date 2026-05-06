import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allGroupsInVault = db.prepare(
    'SELECT id, name, vault_id, is_hidden, sort_order FROM category_groups WHERE vault_id = ? ORDER BY sort_order'
  ).all(ctx.vaultId);

  const allCategoriesInVault = db.prepare(`
    SELECT c.id, c.name, c.group_id, c.is_hidden, c.sort_order, cg.name as group_name, cg.vault_id as group_vault_id
    FROM categories c
    LEFT JOIN category_groups cg ON c.group_id = cg.id
    WHERE cg.vault_id = ?
    ORDER BY cg.sort_order, c.sort_order
  `).all(ctx.vaultId);

  // Find categories whose group belongs to a DIFFERENT vault
  const orphanedCategories = db.prepare(`
    SELECT c.id, c.name, c.group_id, c.is_hidden,
           cg.name as group_name, cg.vault_id as group_vault_id
    FROM categories c
    LEFT JOIN category_groups cg ON c.group_id = cg.id
    WHERE cg.vault_id != ? OR cg.vault_id IS NULL
  `).all(ctx.vaultId);

  return NextResponse.json({
    vaultId: ctx.vaultId,
    groups: allGroupsInVault,
    categories: allCategoriesInVault,
    orphanedCategories,
  });
}
