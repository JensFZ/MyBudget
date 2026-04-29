import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = db.prepare('SELECT id FROM bank_connections WHERE id = ? AND vault_id = ?').get(Number(id), ctx.vaultId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare('DELETE FROM bank_connections WHERE id = ?').run(Number(id));
  return NextResponse.json({ deleted: true });
}
