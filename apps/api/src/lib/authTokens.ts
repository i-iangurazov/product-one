import { UserRoleEnum } from '@qr/types';
import { staffTokenTtlSeconds } from '../config/env';
import { base64UrlEncode, signSegment } from './crypto';

export type StaffTokenPayload = {
  sub: string;
  role: (typeof UserRoleEnum)['enum'][keyof typeof UserRoleEnum['enum']];
  venueId: string;
  exp: number;
};

export const signStaffJwt = (payload: Omit<StaffTokenPayload, 'exp'> & { exp?: number }) => {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode({ ...payload, exp: payload.exp ?? Math.floor(Date.now() / 1000) + staffTokenTtlSeconds });
  const signature = signSegment(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
};

export const verifyStaffJwt = (token?: string): StaffTokenPayload | null => {
  if (!token) return null;
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) return null;
  const expected = signSegment(`${header}.${body}`);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!Buffer.from(signature).equals(Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StaffTokenPayload;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
};

export const issueAccessToken = (staff: { id: string; role: StaffTokenPayload['role']; venueId: string }) => {
  return signStaffJwt({ sub: staff.id, role: staff.role, venueId: staff.venueId, exp: Math.floor(Date.now() / 1000) + staffTokenTtlSeconds });
};

export const parseBearerToken = (header: string | undefined) => {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;
  return token;
};
