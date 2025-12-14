'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StaffUser } from '@qr/types';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

type LoginPayload = { email?: string; phone?: string; password: string };

export function useStaffAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async ({ email, phone, password }: LoginPayload) => {
    setLoading(true);
    setError(null);
    const res = await fetch(`${API_HTTP}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, phone, password }),
    });
    if (!res.ok) {
      setLoading(false);
      setError('Invalid credentials');
      throw new Error('Invalid credentials');
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_HTTP}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        setAccessToken(null);
        setUser(null);
        return null;
      }
      const data = await res.json();
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.accessToken as string;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_HTTP}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const attempt = async (token: string | null) =>
        fetch(input, {
          ...init,
          headers: {
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        });

      let res = await attempt(accessToken);
      if (res.status === 401) {
        const newToken = await refresh();
        if (!newToken) return res;
        res = await attempt(newToken);
      }
      return res;
    },
    [accessToken, refresh]
  );

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { accessToken, user, loading, error, login, logout, refresh, authorizedFetch };
}
