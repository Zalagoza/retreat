import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'crypto';
import { COOKIE, verifySession } from './session';

function h(v: string) {
  return createHash('sha256').update(v).digest();
}

export function checkCredentials(user: string, pass: string): boolean {
  const u = timingSafeEqual(h(user), h(process.env.ADMIN_USERNAME || ''));
  const p = timingSafeEqual(h(pass), h(process.env.ADMIN_PASSWORD || ''));
  return u && p && !!process.env.ADMIN_PASSWORD;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}
