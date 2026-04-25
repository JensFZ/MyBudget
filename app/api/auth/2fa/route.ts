import { NextRequest, NextResponse } from 'next/server';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import db from '@/lib/db';
import { verifySession } from '@/lib/auth';

interface UserRow {
  id: number;
  name: string;
  email: string;
  totp_secret: string | null;
  totp_enabled: number;
}

async function getUser(req: NextRequest): Promise<UserRow | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { userId } = await verifySession(token);
    return db.prepare('SELECT id, name, email, totp_secret, totp_enabled FROM users WHERE id = ?').get(userId) as UserRow | null;
  } catch {
    return null;
  }
}

// GET — generate a new TOTP secret + QR code for setup
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = generateSecret();
  const otpauth = generateURI({ label: user.email, issuer: 'MyBudget', secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  // Store secret temporarily (not yet enabled)
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);

  return NextResponse.json({ secret, qrDataUrl });
}

// POST — verify code and enable 2FA
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await req.json();
  if (!user.totp_secret) return NextResponse.json({ error: 'No secret generated' }, { status: 400 });

  const result = verifySync({ token: code, secret: user.totp_secret });
  if (!result?.valid) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  return NextResponse.json({ ok: true });
}

// DELETE — disable 2FA (requires current TOTP code to confirm)
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await req.json();
  if (user.totp_enabled && user.totp_secret) {
    const result = verifySync({ token: code, secret: user.totp_secret });
    if (!result?.valid) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id);
  return NextResponse.json({ ok: true });
}

// PATCH — get current 2FA status
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ enabled: user.totp_enabled === 1 });
}
