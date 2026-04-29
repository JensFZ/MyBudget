import { NextRequest, NextResponse } from 'next/server';
import { resolveVault } from '@/lib/vault';
import { fetchAccounts } from '@/lib/fints-client';
import { lookupFintsUrl } from '@/lib/blz-lookup';

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blz, url, username, pin } = await req.json();
  if (!blz || !username || !pin) {
    return NextResponse.json({ error: 'blz, username and pin are required' }, { status: 400 });
  }

  const fintsUrl = url || lookupFintsUrl(blz);
  if (!fintsUrl) {
    return NextResponse.json({ error: 'no_url', message: 'Keine FinTS-URL für diese BLZ bekannt. Bitte manuell eingeben.' }, { status: 422 });
  }

  try {
    const accounts = await fetchAccounts({ url: fintsUrl, blz, username, pin });
    return NextResponse.json({ url: fintsUrl, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/pin|password|passwort|kennwort|credential|auth/i.test(msg)) {
      return NextResponse.json({ error: 'wrong_credentials' }, { status: 401 });
    }
    if (/tan/i.test(msg)) {
      return NextResponse.json({ error: 'tan_required' }, { status: 422 });
    }
    return NextResponse.json({ error: 'connection_failed', message: msg }, { status: 502 });
  }
}
