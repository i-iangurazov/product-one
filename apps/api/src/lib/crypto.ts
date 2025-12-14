import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { JWT_SECRET } from '../config/env';

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const generateTempPassword = () => crypto.randomBytes(9).toString('base64url');
export const hashPassword = async (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = async (password: string, hash?: string | null) => {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
};

export const base64UrlEncode = (input: object | string) =>
  Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64url');
export const signSegment = (data: string) => crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
