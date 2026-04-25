import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signSession } from '@/lib/auth';

interface InviteRow {
  id: number;
  vault_id: number;
  vault_name: string;
  expires_at: string;
  used_at: string | null;
}

function getInvite(token: string): InviteRow | null {
  return db.prepare(`
    SELECT vi.id, vi.vault_id, v.name AS vault_name, vi.expires_at, vi.used_at
    FROM vault_invites vi
    JOIN vaults v ON v.id = vi.vault_id
    WHERE vi.token = ?
  `).get(token) as InviteRow | null;
}

function isValid(invite: InviteRow): boolean {
  if (invite.used_at) return false;
  return new Date(invite.expires_at) > new Date();
}

// GET /api/vaults/invite/[token] — validate token, return vault info
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = getInvite(token);
  if (!invite || !isValid(invite)) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }
  return NextResponse.json({ vaultId: invite.vault_id, vaultName: invite.vault_name });
}

// POST /api/vaults/invite/[token]
// Body with `name` = register new user; body without `name` = log in existing user
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = getInvite(token);
  if (!invite || !isValid(invite)) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  const body = await req.json();
  const { email, password, name } = body as { email: string; password: string; name?: string };

  if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  let user: { id: number; name: string; email: string };

  if (name) {
    // Register new user
    if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return NextResponse.json({ error: 'E-Mail bereits vergeben' }, { status: 409 });

    const hash = await bcrypt.hash(password, 12);
    user = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email'
    ).get(name.trim(), email.trim().toLowerCase(), hash) as typeof user;

    // Create personal vault for the new user
    const personalVaultName = `${user.name}s Budget`;
    const personalVaultId = db.prepare('INSERT INTO vaults (name) VALUES (?)').run(personalVaultName).lastInsertRowid;
    db.prepare('INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)').run(personalVaultId, user.id, 'owner');
  } else {
    // Log in existing user
    const existing = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?')
      .get(email.trim().toLowerCase()) as { id: number; name: string; email: string; password_hash: string } | undefined;
    if (!existing) return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
    const valid = await bcrypt.compare(password, existing.password_hash);
    if (!valid) return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
    user = existing;
  }

  // Add user to invited vault (ignore if already member)
  db.prepare('INSERT OR IGNORE INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)').run(invite.vault_id, user.id, 'member');

  // Mark invite as used
  db.prepare("UPDATE vault_invites SET used_at = datetime('now') WHERE id = ?").run(invite.id);

  const sessionToken = await signSession({ userId: user.id, name: user.name, email: user.email });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', sessionToken, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  res.cookies.set('vault_id', String(invite.vault_id), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
