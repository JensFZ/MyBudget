import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import db from '@/lib/db';
import { signSession } from '@/lib/auth';

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled: number;
}

export async function POST(req: NextRequest) {
  const { email, password, totpCode } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | undefined;
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // 2FA check
  if (user.totp_enabled && user.totp_secret) {
    if (!totpCode) {
      // Signal to client that 2FA is required
      return NextResponse.json({ requires2fa: true }, { status: 200 });
    }
    const result = verifySync({ token: totpCode, secret: user.totp_secret });
    if (!result?.valid) {
      return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 401 });
    }
  }

  const token = await signSession({ userId: user.id, name: user.name, email: user.email });
  const firstVault = db.prepare(
    'SELECT vault_id FROM vault_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1'
  ).get(user.id) as { vault_id: number } | undefined;

  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  if (firstVault) {
    res.cookies.set('vault_id', String(firstVault.vault_id), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return res;
}
