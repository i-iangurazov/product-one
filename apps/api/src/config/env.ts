import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root env for API and Prisma. From apps/api/src/config -> ../../../.. to repo root.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), override: true });

export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
export const SESSION_INACTIVITY_MS = Number(process.env.SESSION_INACTIVITY_MS ?? 90 * 60 * 1000);
export const CLOSED_SESSION_TTL_MS = Number(process.env.CLOSED_SESSION_TTL_MS ?? 24 * 60 * 60 * 1000);
export const SERVED_ORDER_TTL_MS = Number(process.env.SERVED_ORDER_TTL_MS ?? 24 * 60 * 60 * 1000);
export const JWT_SECRET = process.env.API_JWT_SECRET || 'dev-secret';
export const DEMO_STAFF_PASSWORD = process.env.STAFF_DEMO_PASSWORD || 'changeme';
export const staffTokenTtlSeconds = Number(process.env.STAFF_TOKEN_TTL_SECONDS ?? 15 * 60);
export const refreshTokenTtlDays = Number(process.env.STAFF_REFRESH_TOKEN_TTL_DAYS ?? 14);
export const refreshCookieName = process.env.STAFF_REFRESH_COOKIE_NAME || 'qr_staff_r';
export const refreshCookieSecure = process.env.NODE_ENV === 'production';
