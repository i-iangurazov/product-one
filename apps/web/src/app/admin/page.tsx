'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table as TableIcon, Users, QrCode, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { Order, OrderStatusEnum, UserRoleEnum, type StaffUser } from '@qr/types';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

type TableRow = { id: string; name: string; code: string; isActive: boolean };

function orderTotal(order: Order) {
  return order.items.reduce((sum, i) => {
    const mod = i.modifiers.reduce((s, m) => s + m.priceDelta, 0);
    return sum + (i.unitPrice + mod) * i.qty;
  }, 0);
}

export default function AdminPage() {
  const { accessToken, user, login, logout, authorizedFetch, loading: authLoading, error: authError } = useStaffAuth();
  const [loginEmail, setLoginEmail] = useState('admin@example.com');
  const [loginPassword, setLoginPassword] = useState('changeme');

  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableForm, setTableForm] = useState({ name: '', code: '', isActive: true });
  const [qrDialog, setQrDialog] = useState<{ link: string; qr: string } | null>(null);

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: UserRoleEnum.enum.WAITER,
    password: '',
    isActive: true,
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === UserRoleEnum.enum.ADMIN;

  const fetchTables = async () => {
    const res = await authorizedFetch(`${API_HTTP}/admin/tables`);
    if (!res.ok) throw new Error('Failed to load tables');
    const data = await res.json();
    setTables(data.tables ?? []);
  };

  const fetchStaff = async () => {
    const res = await authorizedFetch(`${API_HTTP}/admin/staff`);
    if (!res.ok) throw new Error('Failed to load staff');
    const data = await res.json();
    setStaff(data.users ?? []);
  };

  const fetchOrders = async () => {
    const res = await authorizedFetch(`${API_HTTP}/staff/orders`);
    if (!res.ok) throw new Error('Failed to load orders');
    const data = await res.json();
    setOrders(data.orders ?? []);
  };

  useEffect(() => {
    if (!accessToken || !isAdmin) return;
    setLoading(true);
    Promise.all([fetchTables(), fetchStaff(), fetchOrders()])
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, [accessToken, isAdmin]);

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
      toast.success('Table created');
    } catch {
      toast.error('Failed to create table');
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
    } catch {
      toast.error('Failed to update table');
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/tables/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error('Failed to delete table');
    }
  };

  const handleShowQr = async (id: string) => {
    try {
      const res = await authorizedFetch(`${API_HTTP}/admin/tables/${id}/qr`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQrDialog({ link: data.link, qr: data.qr });
    } catch {
      toast.error('Failed to load QR');
    }
  };

  const handleCreateStaff = async () => {
    try {
      const payload = { ...staffForm, venueId: user?.venueId };
      if (!payload.password) delete (payload as any).password;
      const res = await authorizedFetch(`${API_HTTP}/admin/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setStaffForm({ name: '', email: '', phone: '', role: UserRoleEnum.enum.WAITER, password: '', isActive: true });
      fetchStaff();
      toast.success('User created');
    } catch {
      toast.error('Failed to create user');
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
    } catch {
      toast.error('Failed to update user');
    }
  };

  const statusAnalytics = useMemo(
    () =>
      Object.values(OrderStatusEnum.enum).map((status) => ({
        status,
        count: orders.filter((o) => o.status === status).length,
      })),
    [orders]
  );

  const revenue = useMemo(() => orders.reduce((sum, o) => sum + orderTotal(o), 0), [orders]);

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="p-6 space-y-4 w-full max-w-md">
          <div className="text-lg font-semibold">Admin sign in</div>
          <Input placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <Button
            disabled={authLoading}
            onClick={async () => {
              try {
                await login({ email: loginEmail, password: loginPassword });
              } catch {
                toast.error(authError ?? 'Invalid credentials');
              }
            }}
          >
            {authLoading ? '…' : 'Sign in'}
          </Button>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 space-y-3">
          <div className="text-lg font-semibold">Unauthorized</div>
          <div className="text-sm text-muted-foreground">Admin role required.</div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Signed in as</div>
          <div className="font-semibold">{user?.name}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Revenue: {(revenue / 100).toFixed(2)}</Badge>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              <div className="font-semibold">Tables</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input placeholder="Name" value={tableForm.name} onChange={(e) => setTableForm((v) => ({ ...v, name: e.target.value }))} />
              <Input placeholder="Code" value={tableForm.code} onChange={(e) => setTableForm((v) => ({ ...v, code: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tableForm.isActive} onChange={(e) => setTableForm((v) => ({ ...v, isActive: e.target.checked }))} />
                Active
              </label>
              <Button onClick={handleCreateTable}>Add table</Button>
            </div>
            <div className="space-y-2">
              {tables.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {t.name} <Badge variant="outline">{t.code}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{t.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={t.isActive} onChange={(e) => handleToggleTable(t.id, e.target.checked)} />
                      Active
                    </label>
                    <Button size="sm" variant="outline" onClick={() => handleShowQr(t.id)} className="gap-1">
                      <QrCode className="h-4 w-4" /> QR
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTable(t.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {tables.length === 0 && <div className="text-sm text-muted-foreground">No tables yet</div>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <div className="font-semibold">Staff</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="Name" value={staffForm.name} onChange={(e) => setStaffForm((v) => ({ ...v, name: e.target.value }))} />
              <Input placeholder="Email" value={staffForm.email} onChange={(e) => setStaffForm((v) => ({ ...v, email: e.target.value }))} />
              <Input placeholder="Phone" value={staffForm.phone} onChange={(e) => setStaffForm((v) => ({ ...v, phone: e.target.value }))} />
              <Select value={staffForm.role} onValueChange={(val) => setStaffForm((v) => ({ ...v, role: val as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRoleEnum.enum.ADMIN}>Admin</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.WAITER}>Waiter</SelectItem>
                  <SelectItem value={UserRoleEnum.enum.KITCHEN}>Kitchen</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={staffForm.isActive} onChange={(e) => setStaffForm((v) => ({ ...v, isActive: e.target.checked }))} />
                Active
              </label>
              <Input
                placeholder="Password (optional)"
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm((v) => ({ ...v, password: e.target.value }))}
              />
              <div className="sm:col-span-3">
                <Button onClick={handleCreateStaff}>Add user</Button>
              </div>
            </div>

            <div className="space-y-2">
              {staff.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {u.name} <Badge variant="outline">{u.role}</Badge>
                      {!u.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email || u.phone}</div>
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={u.isActive} onChange={(e) => handleUpdateStaffActive(u.id, e.target.checked)} />
                    Active
                  </label>
                </div>
              ))}
              {staff.length === 0 && <div className="text-sm text-muted-foreground">No staff yet</div>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="font-semibold">Orders</div>
            {orders.map((order) => {
              const total = orderTotal(order);
              return (
                <div key={order.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">#{order.number}</div>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">Table {order.tableId}</div>
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
                  <div className="text-sm font-semibold">Total: {(total / 100).toFixed(2)}</div>
                </div>
              );
            })}
            {orders.length === 0 && <div className="text-sm text-muted-foreground">No orders yet</div>}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="p-4 space-y-2">
            <div className="font-semibold">Orders by status</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="status" />
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
            <DialogTitle>Table QR</DialogTitle>
            <DialogDescription>{qrDialog?.link}</DialogDescription>
          </DialogHeader>
          {qrDialog?.qr ? <img src={qrDialog.qr} alt="QR code" className="mx-auto h-52 w-52" /> : <Loader2 className="h-6 w-6 animate-spin" />}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => qrDialog?.link && navigator.clipboard.writeText(qrDialog.link)}>
              Copy link
            </Button>
            {qrDialog?.qr && (
              <Button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = qrDialog.qr;
                  a.download = 'table-qr.png';
                  a.click();
                }}
              >
                Download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-2 shadow">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      )}
    </div>
  );
}
