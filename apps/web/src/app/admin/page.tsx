'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Image from 'next/image';
import { Table as TableIcon, Users, QrCode, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toastApiError, toastSuccess } from '@/lib/toast';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { Order, OrderStatusEnum, UserRoleEnum, type MenuCategory, type StaffUser } from '@qr/types';
import { useTranslations } from 'next-intl';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

type TableRow = { id: string; name: string; code: string; isActive: boolean };
type UserRole = (typeof UserRoleEnum.enum)[keyof typeof UserRoleEnum.enum];
type OrderStatus = (typeof OrderStatusEnum.enum)[keyof typeof OrderStatusEnum.enum];

const safeNext = (candidate?: string | null, fallback = '/admin') =>
  candidate && candidate.startsWith('/') ? candidate : fallback;

function orderTotal(order: Order) {
  return order.items.reduce((sum, i) => {
    const mod = i.modifiers.reduce((s, m) => s + m.priceDelta, 0);
    return sum + (i.unitPrice + mod) * i.qty;
  }, 0);
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { accessToken, user, login, logout, authorizedFetch, loading: authLoading, error: authError } = useStaffAuth();
  const [loginEmail, setLoginEmail] = useState(() => t('admin.login.demoEmail'));
  const [loginPassword, setLoginPassword] = useState(() => t('admin.login.demoPassword'));
  const [loginPending, setLoginPending] = useState(false);

  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableForm, setTableForm] = useState({ name: '', code: '', isActive: true });
  const [qrDialog, setQrDialog] = useState<{ link: string; qr: string } | null>(null);

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: UserRoleEnum.enum.WAITER as UserRole,
    password: '',
    isActive: true,
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<{ categories: MenuCategory[] } | null>(null);
  const [menuForm, setMenuForm] = useState({ categoryId: '', name: '', price: '' });
  const [menuLoading, setMenuLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<UserRole | 'all'>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'all'>('all');

  const isAdmin = user?.role === UserRoleEnum.enum.ADMIN;

  const fetchTables = useCallback(async () => {
    const res = await authorizedFetch(`${API_HTTP}/admin/tables`);
    if (!res.ok) throw new Error(t('admin.errors.loadTables'));
    const data = await res.json();
    setTables(data.tables ?? []);
  }, [authorizedFetch, t]);

  const fetchStaff = useCallback(async () => {
    const res = await authorizedFetch(`${API_HTTP}/admin/staff`);
    if (!res.ok) throw new Error(t('admin.errors.loadStaff'));
    const data = await res.json();
    setStaff(data.users ?? []);
  }, [authorizedFetch, t]);

  const fetchMenu = useCallback(async () => {
    const res = await authorizedFetch(`${API_HTTP}/admin/menu`);
    if (!res.ok) throw new Error(t('admin.errors.loadMenu'));
    const data = (await res.json()) as { categories: MenuCategory[] };
    setMenu(data ?? { categories: [] });
    if (!menuForm.categoryId && data?.categories?.[0]) {
      setMenuForm((prev) => ({ ...prev, categoryId: data.categories[0].id }));
    }
  }, [authorizedFetch, menuForm.categoryId, t]);

  const fetchOrders = useCallback(async () => {
    const res = await authorizedFetch(`${API_HTTP}/staff/orders`);
    if (!res.ok) throw new Error(t('admin.errors.loadOrders'));
    const data = await res.json();
    setOrders(data.orders ?? []);
  }, [authorizedFetch, t]);

  useEffect(() => {
    if (!accessToken || !isAdmin) return;
    setLoading(true);
    Promise.all([fetchTables(), fetchStaff(), fetchOrders(), fetchMenu()])
      .catch((err) => toastApiError(err, t('admin.errors.loadAdminData')))
      .finally(() => setLoading(false));
  }, [accessToken, isAdmin, fetchTables, fetchStaff, fetchOrders, fetchMenu, t]);

  const handleCreateTable = async () => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tableForm),
      });
      if (!res.ok) throw new Error();
      setTableForm({ name: '', code: '', isActive: true });
      fetchTables();
      toastSuccess(t('admin.toasts.tableCreated'));
    } catch (err) {
      toastApiError(err, t('admin.errors.createTable'));
    }
  };

  const handleToggleTable = async (id: string, isActive: boolean) => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, isActive } : t)));
    } catch (err) {
      toastApiError(err, t('admin.errors.updateTable'));
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/tables/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toastApiError(err, t('admin.errors.deleteTable'));
    }
  };

  const handleShowQr = async (id: string) => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/tables/${id}/qr`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQrDialog({ link: data.link, qr: data.qr });
    } catch (err) {
      toastApiError(err, t('admin.errors.loadQr'));
    }
  };

  const handleCreateStaff = async () => {
    try {
      const payload = { ...staffForm, venueId: user?.venueId };
      const body = payload.password ? payload : { ...payload, password: undefined };
      const res = await authorizedFetch(`${API_HTTP}/admin/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setStaffForm({ name: '', email: '', phone: '', role: UserRoleEnum.enum.WAITER, password: '', isActive: true });
      fetchStaff();
      toastSuccess(t('admin.toasts.userCreated'));
    } catch (err) {
      toastApiError(err, t('admin.errors.createUser'));
    }
  };

  const handleAddMenuItem = async () => {
    try {
      setMenuLoading(true);
      const res = await authorizedFetch(`${API_HTTP}/admin/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: menuForm.categoryId || (menu?.categories?.[0]?.id ?? 'default'),
          name: menuForm.name,
          price: Number(menuForm.price || 0),
        }),
      });
      if (!res.ok) throw new Error();
      await fetchMenu();
      setMenuForm((prev) => ({ ...prev, name: '', price: '' }));
      toastSuccess(t('admin.toasts.menuItemAdded'));
    } catch (err) {
      toastApiError(err, t('admin.errors.addMenuItem'));
    } finally {
      setMenuLoading(false);
    }
  };

  const handleSeedMenu = async () => {
    try {
      setMenuLoading(true);
      const res = await authorizedFetch(`${API_HTTP}/admin/menu/seed`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMenu(data.menu ?? data);
      if (data.menu?.categories?.[0]) {
        setMenuForm((prev) => ({ ...prev, categoryId: data.menu.categories[0].id }));
      }
      toastSuccess(t('admin.toasts.sampleMenuAdded'));
    } catch (err) {
      toastApiError(err, t('admin.errors.seedMenu'));
    } finally {
      setMenuLoading(false);
    }
  };

  const handleUpdateStaffActive = async (id: string, isActive: boolean) => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      setStaff((prev) => prev.map((u) => (u.id === id ? { ...u, isActive } : u)));
    } catch (err) {
      toastApiError(err, t('admin.errors.updateUser'));
    }
  };

  const statusAnalytics = useMemo(
    () =>
      Object.values(OrderStatusEnum.enum).map((status) => ({
        status,
        label: t(`status.order.${status}` as never),
        count: orders.filter((o) => o.status === status).length,
      })),
    [orders, t]
  );

  const revenue = useMemo(() => orders.reduce((sum, o) => sum + orderTotal(o), 0), [orders]);

  const filteredTables = useMemo(() => {
    const term = tableSearch.toLowerCase().trim();
    return tables.filter((table) => {
      const matchesTerm = term ? `${table.name} ${table.code}`.toLowerCase().includes(term) : true;
      const matchesStatus =
        tableStatusFilter === 'all' ? true : tableStatusFilter === 'active' ? table.isActive : !table.isActive;
      return matchesTerm && matchesStatus;
    });
  }, [tables, tableSearch, tableStatusFilter]);

  const filteredStaff = useMemo(() => {
    const term = staffSearch.toLowerCase().trim();
    return staff.filter((member) => {
      const matchesTerm = term
        ? `${member.name ?? ''} ${member.email ?? ''} ${member.phone ?? ''}`.toLowerCase().includes(term)
        : true;
      const matchesRole = staffRoleFilter === 'all' ? true : member.role === staffRoleFilter;
      const matchesStatus =
        staffStatusFilter === 'all' ? true : staffStatusFilter === 'active' ? member.isActive : !member.isActive;
      return matchesTerm && matchesRole && matchesStatus;
    });
  }, [staff, staffSearch, staffRoleFilter, staffStatusFilter]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.toLowerCase().trim();
    return orders.filter((order) => {
      const matchesTerm = term
        ? `${order.number} ${order.tableId} ${order.items.map((i) => i.itemName).join(' ')}`.toLowerCase().includes(term)
        : true;
      const matchesStatus = orderStatusFilter === 'all' ? true : order.status === orderStatusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const resetTableFilters = () => {
    setTableSearch('');
    setTableStatusFilter('all');
  };

  const resetStaffFilters = () => {
    setStaffSearch('');
    setStaffRoleFilter('all');
    setStaffStatusFilter('all');
  };

  const resetOrderFilters = () => {
    setOrderSearch('');
    setOrderStatusFilter('all');
  };

  if (!accessToken) {
    const authErrorMessage = authError ? t(authError as never) : t('errors.invalidCredentials');
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="p-6 space-y-4 w-full max-w-md">
          <div className="text-lg font-semibold">{t('admin.login.title')}</div>
          <Input
            placeholder={t('forms.placeholders.email')}
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <Input
            placeholder={t('forms.placeholders.password')}
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />
          <Button
            disabled={authLoading || loginPending}
            onClick={async () => {
              try {
                setLoginPending(true);
                await login({ email: loginEmail, password: loginPassword });
                const next = searchParams?.get('next');
                if (next) {
                  router.replace(safeNext(next, '/admin'));
                }
              } catch {
                toastApiError(authErrorMessage, authErrorMessage);
              } finally {
                setLoginPending(false);
              }
            }}
          >
            {authLoading || loginPending ? t('common.states.loading') : t('common.actions.signIn')}
          </Button>
          {authError && <div className="text-sm text-destructive">{authErrorMessage}</div>}
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 space-y-3">
          <div className="text-lg font-semibold">{t('errors.unauthorized')}</div>
          <div className="text-sm text-muted-foreground">{t('errors.unauthorizedHint')}</div>
          <Button variant="outline" onClick={logout}>
            {t('common.actions.logout')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{t('admin.header.signedInAs')}</div>
          <div className="font-semibold">{user?.name}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t('admin.header.revenue', { amount: (revenue / 100).toFixed(2) })}</Badge>
          <Button variant="outline" onClick={logout}>
            {t('common.actions.logout')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tables">{t('admin.tabs.tables')}</TabsTrigger>
          <TabsTrigger value="menu">{t('admin.tabs.menu')}</TabsTrigger>
          <TabsTrigger value="users">{t('admin.tabs.users')}</TabsTrigger>
          <TabsTrigger value="orders">{t('admin.tabs.orders')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('admin.tabs.analytics')}</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">{t('common.labels.menu')}</div>
                <div className="text-lg font-semibold">{t('admin.menu.subtitle')}</div>
              </div>
              <Button variant="outline" onClick={handleSeedMenu} disabled={menuLoading}>
                {menuLoading ? t('admin.menu.seeding') : t('admin.menu.addSample')}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                placeholder={t('forms.placeholders.categoryId')}
                value={menuForm.categoryId}
                onChange={(e) => setMenuForm((v) => ({ ...v, categoryId: e.target.value }))}
                required
              />
              <Input
                placeholder={t('forms.placeholders.name')}
                value={menuForm.name}
                onChange={(e) => setMenuForm((v) => ({ ...v, name: e.target.value }))}
                required
              />
              <Input
                type="number"
                placeholder={t('forms.placeholders.priceCents')}
                value={menuForm.price}
                onChange={(e) => setMenuForm((v) => ({ ...v, price: e.target.value }))}
                required
              />
              <Button onClick={handleAddMenuItem} disabled={menuLoading}>
                {t('admin.menu.addItem')}
              </Button>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {menu?.categories?.length ? (
              menu.categories.map((cat) => (
                <Card key={cat.id} className="p-4 space-y-2">
                  <div className="font-semibold">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('admin.menu.itemsCount', { count: cat.items.length })}
                  </div>
                  <div className="space-y-1">
                    {cat.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">{(item.price / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-4 text-sm text-muted-foreground border-dashed">{t('admin.menu.empty')}</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              <div className="font-semibold">{t('admin.tables.title')}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                placeholder={t('forms.placeholders.name')}
                value={tableForm.name}
                onChange={(e) => setTableForm((v) => ({ ...v, name: e.target.value }))}
              />
              <Input
                placeholder={t('forms.placeholders.code')}
                value={tableForm.code}
                onChange={(e) => setTableForm((v) => ({ ...v, code: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tableForm.isActive} onChange={(e) => setTableForm((v) => ({ ...v, isActive: e.target.checked }))} />
                {t('status.active')}
              </label>
              <Button onClick={handleCreateTable}>{t('admin.tables.addButton')}</Button>
            </div>
          </Card>
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4" />
                <div className="font-semibold">{t('admin.tables.listTitle')}</div>
              </div>
              <Badge variant="outline">{filteredTables.length}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder={t('forms.placeholders.searchTables')}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
              <Select value={tableStatusFilter} onValueChange={(val) => setTableStatusFilter(val as typeof tableStatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.labels.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filters.allStatuses')}</SelectItem>
                  <SelectItem value="active">{t('status.active')}</SelectItem>
                  <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredTables.map((table) => (
                <div key={table.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {table.name} <Badge variant="outline">{table.code}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{table.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={table.isActive}
                        onChange={(e) => handleToggleTable(table.id, e.target.checked)}
                      />
                      {t('status.active')}
                    </label>
                    <Button size="sm" variant="outline" onClick={() => handleShowQr(table.id)} className="gap-1">
                      <QrCode className="h-4 w-4" /> {t('common.labels.qr')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTable(table.id)}>
                      {t('common.actions.delete')}
                    </Button>
                  </div>
                </div>
              ))}
              {filteredTables.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                  <div>
                    {tables.length === 0 ? t('admin.tables.emptyAll') : t('admin.tables.emptyFiltered')}
                  </div>
                  {tables.length > 0 && (
                    <Button size="sm" variant="outline" onClick={resetTableFilters}>
                      {t('common.actions.clearFilters')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <div className="font-semibold">{t('admin.users.title')}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder={t('forms.placeholders.name')}
                value={staffForm.name}
                onChange={(e) => setStaffForm((v) => ({ ...v, name: e.target.value }))}
              />
              <Input
                placeholder={t('forms.placeholders.email')}
                value={staffForm.email}
                onChange={(e) => setStaffForm((v) => ({ ...v, email: e.target.value }))}
              />
              <Input
                placeholder={t('forms.placeholders.phone')}
                value={staffForm.phone}
                onChange={(e) => setStaffForm((v) => ({ ...v, phone: e.target.value }))}
              />
              <Select value={staffForm.role} onValueChange={(val) => setStaffForm((v) => ({ ...v, role: val as UserRole }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.labels.role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRoleEnum.enum.ADMIN}>{t('common.roles.ADMIN')}</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.WAITER}>{t('common.roles.WAITER')}</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.KITCHEN}>{t('common.roles.KITCHEN')}</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={staffForm.isActive} onChange={(e) => setStaffForm((v) => ({ ...v, isActive: e.target.checked }))} />
                {t('status.active')}
              </label>
              <Input
                placeholder={t('forms.placeholders.passwordOptional')}
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm((v) => ({ ...v, password: e.target.value }))}
              />
              <div className="sm:col-span-3">
                <Button onClick={handleCreateStaff}>{t('admin.users.addButton')}</Button>
              </div>
            </div>
          </Card>
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <div className="font-semibold">{t('admin.users.listTitle')}</div>
              </div>
              <Badge variant="outline">{filteredStaff.length}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder={t('forms.placeholders.searchStaff')}
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
              <Select value={staffRoleFilter} onValueChange={(val) => setStaffRoleFilter(val as UserRole | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.labels.role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filters.allRoles')}</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.ADMIN}>{t('common.roles.ADMIN')}</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.WAITER}>{t('common.roles.WAITER')}</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.KITCHEN}>{t('common.roles.KITCHEN')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={staffStatusFilter} onValueChange={(val) => setStaffStatusFilter(val as typeof staffStatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.labels.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filters.allStatuses')}</SelectItem>
                  <SelectItem value="active">{t('status.active')}</SelectItem>
                  <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredStaff.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {u.name} <Badge variant="outline">{t(`common.roles.${u.role}` as never)}</Badge>
                      {!u.isActive && <Badge variant="destructive">{t('status.inactive')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email || u.phone}</div>
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={u.isActive} onChange={(e) => handleUpdateStaffActive(u.id, e.target.checked)} />
                    {t('status.active')}
                  </label>
                </div>
              ))}
              {filteredStaff.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                  <div>
                    {staff.length === 0 ? t('admin.users.emptyAll') : t('admin.users.emptyFiltered')}
                  </div>
                  {staff.length > 0 && (
                    <Button size="sm" variant="outline" onClick={resetStaffFilters}>
                      {t('common.actions.clearFilters')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t('admin.orders.title')}</div>
              <Badge variant="outline">{filteredOrders.length}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder={t('forms.placeholders.searchOrders')}
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <Select value={orderStatusFilter} onValueChange={(val) => setOrderStatusFilter(val as OrderStatus | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.labels.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filters.allStatuses')}</SelectItem>
                  {Object.values(OrderStatusEnum.enum).map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status.order.${status}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredOrders.map((order) => {
              const total = orderTotal(order);
              return (
                <div key={order.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">#{order.number}</div>
                    <Badge variant="outline">{t(`status.order.${order.status}` as never)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('common.labels.table')} {order.tableId}
                  </div>
                  <div className="text-sm space-y-1">
                    {order.items.map((i) => (
                      <div key={i.id} className="flex justify-between">
                        <span>
                          {i.qty} × {i.itemName}
                        </span>
                        <span className="text-muted-foreground">
                          {((i.unitPrice + i.modifiers.reduce((s, m) => s + m.priceDelta, 0)) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-semibold">
                    {t('admin.orders.total', { amount: (total / 100).toFixed(2) })}
                  </div>
                </div>
              );
            })}
            {filteredOrders.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                <div>{orders.length === 0 ? t('admin.orders.emptyAll') : t('admin.orders.emptyFiltered')}</div>
                {orders.length > 0 && (
                  <Button size="sm" variant="outline" onClick={resetOrderFilters}>
                    {t('common.actions.clearFilters')}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="p-4 space-y-2">
            <div className="font-semibold">{t('admin.analytics.ordersByStatus')}</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!qrDialog} onOpenChange={(open) => setQrDialog(open ? qrDialog : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.dialogs.tableQrTitle')}</DialogTitle>
            <DialogDescription>{qrDialog?.link}</DialogDescription>
          </DialogHeader>
          {qrDialog?.qr ? (
            <Image
              src={qrDialog.qr}
              alt={t('admin.dialogs.qrAlt')}
              width={208}
              height={208}
              className="mx-auto h-52 w-52"
              unoptimized
            />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin" />
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => qrDialog?.link && navigator.clipboard.writeText(qrDialog.link)}>
              {t('common.actions.copyLink')}
            </Button>
            {qrDialog?.qr && (
              <Button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = qrDialog.qr;
                  a.download = t('admin.dialogs.qrFilename');
                  a.click();
                }}
              >
                {t('common.actions.download')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('common.states.loading')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const t = useTranslations();
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center p-6">{t('common.states.loading')}</div>}
    >
      <AdminPageContent />
    </Suspense>
  );
}
