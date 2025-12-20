'use client';

import { useCallback, useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toastApiError, toastSuccess } from '@/lib/toast';
import { useOwnerAuth } from '@/lib/useOwnerAuth';
import type { OwnerTable, OwnerVenue, StaffUser } from '@qr/types';
import { useTranslations } from 'next-intl';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

export default function OwnerVenuesPage() {
  const { token } = useOwnerAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const tr = useTranslations();
  const [venues, setVenues] = useState<OwnerVenue[]>([]);
  const [tables, setTables] = useState<Array<OwnerTable & { venue?: { id: string; name: string; slug: string } }>>([]);
  const [users, setUsers] = useState<Array<StaffUser & { venue?: { id: string; name: string; slug: string } }>>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', currency: 'KGS', timezone: 'Asia/Bishkek' });
  const [search, setSearch] = useState(searchParams?.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') ?? 'all');
  const [venueFilter, setVenueFilter] = useState(searchParams?.get('venueId') ?? 'all');
  const [roleFilter, setRoleFilter] = useState(searchParams?.get('role') ?? 'all');

  const safeUpdateQuery = (next: { search?: string; status?: string; venueId?: string; role?: string }) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next.search !== undefined) {
      if (next.search) params.set('search', next.search);
      else params.delete('search');
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== 'all') params.set('status', next.status);
      else params.delete('status');
    }
    if (next.venueId !== undefined) {
      if (next.venueId && next.venueId !== 'all') params.set('venueId', next.venueId);
      else params.delete('venueId');
    }
    if (next.role !== undefined) {
      if (next.role && next.role !== 'all') params.set('role', next.role);
      else params.delete('role');
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?');
  };

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const venuesRes = await fetch(`${API_HTTP}/owner/venues`, { headers: { Authorization: `Bearer ${token}` } });
        const venuesData = await venuesRes.json();
        setVenues(venuesData.venues ?? []);
      } catch (err) {
        toastApiError(err, t('owner.errors.loadVenues'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, t]);

  useEffect(() => {
    if (!token) return;
    const loadTables = async () => {
      setTablesLoading(true);
      setTablesError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (venueFilter !== 'all') params.set('venueId', venueFilter);
        params.set('pageSize', '50');
        const res = await fetch(`${API_HTTP}/owner/tables?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(t('owner.errors.loadTables'));
        const data = await res.json();
        setTables(data.tables ?? data.items ?? []);
      } catch (err) {
        setTablesError('owner.errors.loadTables');
        toastApiError(err, t('owner.errors.loadTables'));
      } finally {
        setTablesLoading(false);
      }
    };
    loadTables();
  }, [token, search, statusFilter, venueFilter, t]);

  useEffect(() => {
    if (!token) return;
    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (venueFilter !== 'all') params.set('venueId', venueFilter);
        if (roleFilter !== 'all') params.set('role', roleFilter);
        params.set('pageSize', '50');
        const res = await fetch(`${API_HTTP}/owner/users/all?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(t('owner.errors.loadUsers'));
        const data = await res.json();
        setUsers(data.users ?? data.items ?? []);
      } catch (err) {
        setUsersError('owner.errors.loadUsers');
        toastApiError(err, t('owner.errors.loadUsers'));
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, [token, search, statusFilter, venueFilter, roleFilter, t]);

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('common.filters.allStatuses') },
      { value: 'active', label: t('status.active') },
      { value: 'inactive', label: t('status.inactive') },
    ],
    [t]
  );

  const roleOptions = useMemo(
    () => [
      { value: 'all', label: t('common.filters.allRoles') },
      { value: 'ADMIN', label: t('common.roles.ADMIN') },
      { value: 'KITCHEN', label: t('common.roles.KITCHEN') },
      { value: 'WAITER', label: t('common.roles.WAITER') },
    ],
    [t]
  );

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_HTTP}/owner/venues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const v = await res.json();
      setVenues((prev) => [v, ...prev]);
      toastSuccess(t('owner.toasts.venueCreated'));
      setForm({ ...form, name: '', slug: '' });
    } catch (err) {
      toastApiError(err, t('owner.errors.createVenue'));
    } finally {
      setCreating(false);
    }
  };

  const scrollToCreate = useCallback(() => {
    if (typeof window === 'undefined') return;
    const target = document.getElementById('owner-create-venue');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-semibold">{t('owner.venues.title')}</div>
        <div className="text-sm text-muted-foreground">{t('owner.venues.subtitle')}</div>
      </div>
      <Card className="p-4 md:p-6">
        <div className="text-sm font-semibold">{t('common.labels.filters')}</div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Input
            placeholder={t('owner.venues.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              safeUpdateQuery({ search: e.target.value });
            }}
          />
          <Select
            value={venueFilter}
            onValueChange={(val) => {
              setVenueFilter(val);
              safeUpdateQuery({ venueId: val });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.labels.venue')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('owner.venues.filters.allVenues')}</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              safeUpdateQuery({ status: val });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.labels.status')} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              safeUpdateQuery({ role: val });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.labels.role')} />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>
      <Card id="owner-create-venue" className="p-4">
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder={t('forms.placeholders.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            placeholder={t('forms.placeholders.slug')}
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            required
          />
          <Input
            placeholder={t('forms.placeholders.currency')}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
          <Input
            placeholder={t('forms.placeholders.timezone')}
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
          <Button type="submit" className="md:col-span-4" disabled={creating}>
            {creating ? t('owner.venues.actions.creating') : t('owner.venues.actions.create')}
          </Button>
        </form>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {loading
          ? Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="p-4 space-y-2 animate-pulse">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted" />
              </Card>
            ))
          : venues.map((v) => (
              <Card key={v.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-lg font-semibold">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.slug}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.currency} · {v.timezone}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={v.isActive ? 'default' : 'outline'}>
                    {v.isActive ? t('status.active') : t('status.inactive')}
                  </Badge>
                  <Link href={`/owner/venues/${v.id}`}>
                    <Button variant="outline" size="sm">
                      {t('common.actions.open')}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          {!loading && venues.length === 0 && (
            <Card className="space-y-2 border-dashed p-4 text-sm text-muted-foreground">
              <div>{t('owner.venues.empty')}</div>
              <Button size="sm" variant="outline" onClick={scrollToCreate}>
                {t('owner.venues.actions.create')}
              </Button>
            </Card>
          )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{t('owner.tables.title')}</div>
            <div className="text-sm text-muted-foreground">{t('owner.tables.subtitle')}</div>
          </div>
          <Link href={venues[0] ? `/owner/venues/${venues[0].id}` : '#'}>
            <Button variant="outline" size="sm" disabled={!venues[0]}>
              {t('owner.tables.actions.goToVenue')}
            </Button>
          </Link>
        </div>
        {tablesError && (
          <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {t(tablesError as never)}
          </Card>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {tablesLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="p-4 space-y-2 animate-pulse">
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-1/4 rounded bg-muted" />
                </Card>
              ))
            : tables.map((t) => (
                <Link key={`${t.venueId}-${t.code}`} href={`/owner/venues/${t.venueId ?? t.venue?.id}`} className="block">
                  <Card className="flex items-center justify-between p-4 hover:border-primary/50 transition">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tr('common.labels.code')}: {t.code}
                      </div>
                      {t.venue && (
                        <div className="text-xs text-muted-foreground">
                          {tr('common.labels.venue')}: {t.venue.name}
                        </div>
                      )}
                    </div>
                    <Badge variant={t.isActive ? 'default' : 'outline'}>
                      {t.isActive ? tr('status.active') : tr('status.inactive')}
                    </Badge>
                  </Card>
                </Link>
              ))}
          {!tablesLoading && tables.length === 0 && (
            <Card className="space-y-2 border-dashed p-4 text-sm text-muted-foreground">
              <div>{t('owner.tables.empty')}</div>
              {venues[0] ? (
                <Link href={`/owner/venues/${venues[0].id}`}>
                  <Button size="sm" variant="outline">
                    {t('owner.tables.actions.goToVenue')}
                  </Button>
                </Link>
              ) : (
                <Button size="sm" variant="outline" onClick={scrollToCreate}>
                  {t('owner.venues.actions.create')}
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{t('owner.users.title')}</div>
            <div className="text-sm text-muted-foreground">{t('owner.users.subtitle')}</div>
          </div>
        </div>
        {usersError && (
          <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {t(usersError as never)}
          </Card>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {usersLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="p-4 space-y-2 animate-pulse">
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-1/4 rounded bg-muted" />
                </Card>
              ))
            : users.map((u) => {
                const venueId = (u as { venueId?: string }).venueId || u.venue?.id;
                const venueName = u.venue?.name;
                return (
                  <Link key={u.id} href={venueId ? `/owner/venues/${venueId}` : '#'} className="block">
                  <Card className="flex items-center justify-between p-4 hover:border-primary/50 transition">
                    <div>
                      <div className="font-semibold">{u.name || u.email || u.phone || t('common.labels.user')}</div>
                      <div className="text-xs text-muted-foreground">{u.email || u.phone}</div>
                      {venueName && (
                        <div className="text-xs text-muted-foreground">
                          {t('common.labels.venue')}: {venueName}
                        </div>
                      )}
                    </div>
                    <Badge variant={u.isActive ? 'default' : 'outline'}>
                      {t(`common.roles.${u.role}` as never)}
                    </Badge>
                  </Card>
                  </Link>
                );
              })}
          {!usersLoading && users.length === 0 && (
            <Card className="space-y-2 border-dashed p-4 text-sm text-muted-foreground">
              <div>{t('owner.users.empty')}</div>
              {venues[0] ? (
                <Link href={`/owner/venues/${venues[0].id}`}>
                  <Button size="sm" variant="outline">
                    {t('owner.users.actions.invite')}
                  </Button>
                </Link>
              ) : (
                <Button size="sm" variant="outline" onClick={scrollToCreate}>
                  {t('owner.venues.actions.create')}
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
