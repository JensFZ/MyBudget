import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { verifySession } from '@/lib/auth';

export interface VaultMemberRow {
  vault_id: number;
  role: 'owner' | 'member';
}

/** Read vault_id from cookie, return null if missing or not a valid number. */
export function getActiveVaultId(req: NextRequest): number | null {
  const raw = req.cookies.get('vault_id')?.value;
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

/** Check that userId is a member of vaultId. */
export function hasVaultAccess(userId: number, vaultId: number): boolean {
  const row = db
    .prepare('SELECT 1 FROM vault_members WHERE vault_id = ? AND user_id = ?')
    .get(vaultId, userId);
  return !!row;
}

/** Check that userId is the owner of vaultId. */
export function isVaultOwner(userId: number, vaultId: number): boolean {
  const row = db
    .prepare("SELECT 1 FROM vault_members WHERE vault_id = ? AND user_id = ? AND role = 'owner'")
    .get(vaultId, userId);
  return !!row;
}

/**
 * Resolve the active vault for the current request.
 * Returns { userId, vaultId } or null if not authenticated / no access.
 */
export async function resolveVault(
  req: NextRequest
): Promise<{ userId: number; vaultId: number } | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { userId } = await verifySession(token);
    const vaultId = getActiveVaultId(req);
    if (!vaultId) {
      // Fall back to the user's first vault
      const row = db
        .prepare('SELECT vault_id FROM vault_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1')
        .get(userId) as { vault_id: number } | undefined;
      if (!row) return null;
      return { userId, vaultId: row.vault_id };
    }
    if (!hasVaultAccess(userId, vaultId)) return null;
    return { userId, vaultId };
  } catch {
    return null;
  }
}
