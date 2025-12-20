"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { useOwnerAuth } from "@/lib/useOwnerAuth";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip, BarChart, Bar, Legend } from "recharts";
import type {
  OwnerStats,
  OwnerTable,
  OwnerVenue,
  PublicMenuResponse,
  StaffUser,
  MenuModifierGroup,
  MenuModifierOption,
  MenuItem,
  UserRole,
} from "@qr/types";
import { UserRoleEnum } from "@qr/types";
import { useTranslations } from "next-intl";

type ModifierOptionForm = MenuModifierOption;
type ModifierGroupForm = MenuModifierGroup & { options: ModifierOptionForm[] };
type MenuForm = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  isInStock: boolean;
  modifiers: ModifierGroupForm[];
};

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

export default function OwnerVenueDetailPage() {
  const params = useParams<{ venueId: string }>();
  const venueId = params?.venueId;
  const { token } = useOwnerAuth();
  const t = useTranslations();
  const [venue, setVenue] = useState<OwnerVenue | null>(null);
  const [tables, setTables] = useState<OwnerTable[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const defaultMenuForm = useMemo<MenuForm>(
    () => ({
      id: undefined,
      categoryId: '',
      name: '',
      description: '',
      price: '',
      imageUrl: '',
      sortOrder: 0,
      isActive: true,
      isInStock: true,
      modifiers: [],
    }),
    []
  );
  const [menuForm, setMenuForm] = useState<MenuForm>(defaultMenuForm);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ name: '', code: '', capacity: '' });
  const [userForm, setUserForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }>({
    name: '',
    email: '',
    password: '',
    role: UserRoleEnum.enum.VENUE_ADMIN,
  });
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | 'all'>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (!token || !venueId) return;
    const load = async () => {
      try {
        const [v, t, u, s] = await Promise.all([
          fetch(`${API_HTTP}/owner/venues/${venueId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${API_HTTP}/owner/venues/${venueId}/tables`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${API_HTTP}/owner/venues/${venueId}/users`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${API_HTTP}/owner/venues/${venueId}/stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        ]);
        setVenue(v);
        setTables(t.tables ?? []);
        setUsers(u.users ?? []);
        setStats(s);
        setMenu(null);
      } catch (err) {
        toastApiError(err, t('owner.errors.loadVenue'));
      }
    };
    load();
  }, [token, venueId, t]);

  useEffect(() => {
    const loadMenu = async () => {
      if (!token || !venueId) return;
      setMenuLoading(true);
      try {
        const res = await fetch(`${API_HTTP}/owner/venues/${venueId}/menu`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as PublicMenuResponse;
        setMenu(data);
        if (!menuForm.categoryId && data.categories?.[0]) {
          setMenuForm((prev) => ({ ...prev, categoryId: data.categories[0].id }));
        }
      } catch (err) {
        toastApiError(err, t('owner.errors.loadMenu'));
      } finally {
        setMenuLoading(false);
      }
    };
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, venueId, t]);

  const categoryOptions = useMemo(() => menu?.categories?.map((c) => ({ id: c.id, name: c.name })) ?? [], [menu?.categories]);

  const filteredTables = useMemo(() => {
    const term = tableSearch.toLowerCase().trim();
    return tables.filter((table) => {
      const matchesTerm = term ? `${table.name} ${table.code}`.toLowerCase().includes(term) : true;
      const matchesStatus =
        tableStatusFilter === 'all' ? true : tableStatusFilter === 'active' ? table.isActive : !table.isActive;
      return matchesTerm && matchesStatus;
    });
  }, [tables, tableSearch, tableStatusFilter]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.toLowerCase().trim();
    return users.filter((member) => {
      const matchesTerm = term
        ? `${member.name ?? ''} ${member.email ?? ''}`.toLowerCase().includes(term)
        : true;
      const matchesRole = userRoleFilter === 'all' ? true : member.role === userRoleFilter;
      const matchesStatus =
        userStatusFilter === 'all' ? true : userStatusFilter === 'active' ? member.isActive : !member.isActive;
      return matchesTerm && matchesRole && matchesStatus;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter]);

  const resetTableFilters = () => {
    setTableSearch('');
    setTableStatusFilter('all');
  };

  const resetUserFilters = () => {
    setUserSearch('');
    setUserRoleFilter('all');
    setUserStatusFilter('all');
  };

  const resetMenuForm = (overrides?: Partial<MenuForm>) => {
    setMenuForm({
      ...defaultMenuForm,
      categoryId: overrides?.categoryId ?? categoryOptions[0]?.id ?? '',
      ...overrides,
    });
  };

  const buildMenuFormFromItem = (item: MenuItem, categoryId: string): MenuForm => ({
    id: item.id,
    categoryId: categoryId || categoryOptions[0]?.id || '',
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    imageUrl: item.imageUrl ?? '',
    sortOrder: item.sortOrder ?? 0,
    isActive: item.isActive ?? true,
    isInStock: item.isInStock ?? true,
    modifiers:
      item.modifiers?.map((g) => ({
        id: g.id,
        name: g.name,
        isRequired: g.isRequired ?? false,
        minSelect: g.minSelect ?? 0,
        maxSelect: g.maxSelect ?? 1,
        sortOrder: g.sortOrder ?? 0,
        options:
          g.options?.map((opt) => ({
            id: opt.id,
            name: opt.name,
            priceDelta: opt.priceDelta,
            isActive: opt.isActive ?? true,
            sortOrder: opt.sortOrder ?? 0,
          })) ?? [],
      })) ?? [],
  });

  const upsertMenuItem = (item: MenuItem, categoryId: string) => {
    setMenu((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => {
        if (cat.id !== categoryId) return { ...cat, items: [...cat.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) };
        const without = cat.items.filter((i) => i.id !== item.id);
        const nextItems = [...without, item].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return { ...cat, items: nextItems };
      });
      const exists = categories.find((c) => c.id === categoryId);
      if (!exists) {
        categories.push({
          id: categoryId,
          name: categoryId,
          color: '#ffffff',
          sortOrder: categories.length,
          items: [item],
        });
      }
      return { ...prev, categories };
    });
  };

  const removeMenuItem = (itemId: string) => {
    setMenu((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => ({ ...cat, items: cat.items.filter((i) => i.id !== itemId) }));
      return { ...prev, categories };
    });
  };

  const validateImageUrl = (url: string) => !url || /^https?:\/\//i.test(url);

  const openNewMenuDialog = () => {
    resetMenuForm();
    setMenuDialogOpen(true);
  };

  const openEditMenuDialog = (item: MenuItem, categoryId: string) => {
    setMenuForm(buildMenuFormFromItem(item, categoryId));
    setMenuDialogOpen(true);
  };

  const updateItem = async (itemId: string, payload: Record<string, unknown>) => {
    if (!token || !venueId) return;
    const res = await fetch(`${API_HTTP}/owner/venues/${venueId}/menu/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? t('owner.errors.updateMenuItem'));
    }
    const data = await res.json();
    return data.item as MenuItem;
  };

  const persistSortOrder = async (categoryId: string, items: MenuItem[]) => {
    for (const [index, item] of items.entries()) {
      try {
        await updateItem(item.id, { sortOrder: index });
      } catch (err) {
        toastApiError(err, t('owner.errors.updateSortOrder'));
        break;
      }
    }
  };

  const moveItem = async (categoryId: string, itemId: string, direction: 'up' | 'down') => {
    const category = menu?.categories.find((c) => c.id === categoryId);
    if (!category) return;
    const sorted = [...category.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const index = sorted.findIndex((i) => i.id === itemId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
    const newOrder = [...sorted];
    const [removed] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, removed);
    await persistSortOrder(categoryId, newOrder);
    setMenu((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) =>
        cat.id === categoryId ? { ...cat, items: newOrder.map((it, idx) => ({ ...it, sortOrder: idx })) } : cat
      );
      return { ...prev, categories };
    });
  };

  const saveMenuItem = async () => {
    if (!token || !venueId) return;
    if (!menuForm.name || !menuForm.categoryId || !menuForm.price) {
      toastApiError(t('owner.venue.menu.validation.required'), t('owner.venue.menu.validation.required'));
      return;
    }
    if (!validateImageUrl(menuForm.imageUrl)) {
      toastApiError(t('owner.venue.menu.validation.imageUrl'), t('owner.venue.menu.validation.imageUrl'));
      return;
    }
    const priceInt = Number(menuForm.price);
    if (Number.isNaN(priceInt) || priceInt < 0) {
      toastApiError(t('owner.venue.menu.validation.price'), t('owner.venue.menu.validation.price'));
      return;
    }
    const payload = {
      categoryId: menuForm.categoryId,
      name: menuForm.name,
      description: menuForm.description || undefined,
      price: priceInt,
      imageUrl: menuForm.imageUrl || undefined,
      sortOrder: menuForm.sortOrder ?? 0,
      isActive: menuForm.isActive,
      isInStock: menuForm.isInStock,
      modifiers: menuForm.modifiers.map((group, idx) => ({
        ...group,
        sortOrder: group.sortOrder ?? idx,
        options: group.options.map((opt, optIdx) => ({
          ...opt,
          sortOrder: opt.sortOrder ?? optIdx,
        })),
      })),
    };
    try {
      const res = await fetch(
        menuForm.id ? `${API_HTTP}/owner/venues/${venueId}/menu/${menuForm.id}` : `${API_HTTP}/owner/venues/${venueId}/menu`,
        {
          method: menuForm.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.item) {
        throw new Error(data?.message ?? t('owner.errors.saveMenuItem'));
      }
      upsertMenuItem(data.item as MenuItem, payload.categoryId);
      toastSuccess(menuForm.id ? t('owner.toasts.menuItemUpdated') : t('owner.toasts.menuItemCreated'));
      setMenuDialogOpen(false);
      resetMenuForm({ categoryId: payload.categoryId });
    } catch (err) {
      toastApiError(err, t('owner.errors.saveMenuItem'));
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    if (!token || !venueId) return;
    const confirmed = typeof window !== 'undefined' ? window.confirm(t('owner.venue.menu.confirmDelete')) : false;
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_HTTP}/owner/venues/${venueId}/menu/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? t('owner.errors.deleteMenuItem'));
      }
      removeMenuItem(itemId);
      toastSuccess(t('owner.toasts.menuItemDeleted'));
    } catch (err) {
      toastApiError(err, t('owner.errors.deleteMenuItem'));
    }
  };

  const addModifierGroup = () => {
    setMenuForm((prev) => ({
      ...prev,
      modifiers: [
        ...prev.modifiers,
        {
          id: crypto.randomUUID(),
          name: '',
          isRequired: false,
          minSelect: 0,
          maxSelect: 1,
          sortOrder: prev.modifiers.length,
          options: [],
        },
      ],
    }));
  };

  const updateGroup = (groupId: string, patch: Partial<ModifierGroupForm>) => {
    setMenuForm((prev) => ({
      ...prev,
      modifiers: prev.modifiers.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
    }));
  };

  const removeGroup = (groupId: string) => {
    setMenuForm((prev) => ({
      ...prev,
      modifiers: prev.modifiers.filter((g) => g.id !== groupId),
    }));
  };

  const addOption = (groupId: string) => {
    setMenuForm((prev) => ({
      ...prev,
      modifiers: prev.modifiers.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                { id: crypto.randomUUID(), name: '', priceDelta: 0, isActive: true, sortOrder: g.options.length },
              ],
            }
          : g
      ),
    }));
  };

  const updateOption = (groupId: string, optionId: string, patch: Partial<ModifierOptionForm>) => {
    setMenuForm((prev) => ({
      ...prev,
      modifiers: prev.modifiers.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.map((opt) => (opt.id === optionId ? { ...opt, ...patch } : opt)) }
          : g
      ),
    }));
  };

  const removeOption = (groupId: string, optionId: string) => {
    setMenuForm((prev) => ({
      ...prev,
      modifiers: prev.modifiers.map((g) =>
        g.id === groupId ? { ...g, options: g.options.filter((opt) => opt.id !== optionId) } : g
      ),
    }));
  };

  const createTable = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !venueId) return;
    try {
      const payload = {
        name: tableForm.name,
        code: tableForm.code,
        capacity: tableForm.capacity ? Number(tableForm.capacity) : undefined,
      };
      const res = await fetch(`${API_HTTP}/owner/venues/${venueId}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const tbl = await res.json();
      setTables((prev) => [tbl, ...prev]);
      setTableForm({ name: '', code: '', capacity: '' });
      toastSuccess(t('owner.toasts.tableCreated'));
    } catch (err) {
      toastApiError(err, t('owner.errors.createTable'));
    }
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !venueId) return;
    try {
      const res = await fetch(`${API_HTTP}/owner/venues/${venueId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...userForm, password: userForm.password || 'ChangeMe123!' }),
      });
      if (!res.ok) throw new Error();
      const usr = await res.json();
      setUsers((prev) => [usr, ...prev]);
      toastSuccess(t('owner.toasts.userCreated'));
    } catch (err) {
      toastApiError(err, t('owner.errors.createUser'));
    }
  };

  const seedMenu = async () => {
    if (!token || !venueId) return;
    setMenuLoading(true);
    try {
      const res = await fetch(`${API_HTTP}/owner/venues/${venueId}/menu/seed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMenu(data.menu);
      if (data.menu?.categories?.[0]) {
        setMenuForm((prev) => ({ ...prev, categoryId: data.menu.categories[0].id }));
      }
      toastSuccess(t('owner.toasts.sampleMenuAdded'));
    } catch (err) {
      toastApiError(err, t('owner.errors.seedMenu'));
    } finally {
      setMenuLoading(false);
    }
  };

  if (!venue) return <div className="text-muted-foreground">{t('common.states.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">{venue.name}</div>
          <div className="text-sm text-muted-foreground">{venue.slug}</div>
        </div>
        <Badge variant={venue.isActive ? 'default' : 'outline'}>
          {venue.isActive ? t('status.active') : t('status.inactive')}
        </Badge>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('owner.venue.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="menu">{t('owner.venue.tabs.menu')}</TabsTrigger>
          <TabsTrigger value="tables">{t('owner.venue.tabs.tables')}</TabsTrigger>
          <TabsTrigger value="users">{t('owner.venue.tabs.users')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('owner.venue.tabs.analytics')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-3 md:grid-cols-2">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">{t('common.labels.slug')}</div>
            <div className="text-lg font-semibold">{venue.slug}</div>
            <div className="text-sm text-muted-foreground">
              {t('common.labels.timezone')}: {venue.timezone}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">{t('common.labels.currency')}</div>
            <div className="text-lg font-semibold">{venue.currency}</div>
          </Card>
        </TabsContent>
        <TabsContent value="menu" className="space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{t('common.labels.menu')}</div>
                <div className="text-lg font-semibold">{t('owner.venue.menu.subtitle')}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={seedMenu} disabled={menuLoading}>
                  {menuLoading ? t('owner.venue.menu.seeding') : t('owner.venue.menu.addSample')}
                </Button>
                <Button onClick={openNewMenuDialog}>{t('owner.venue.menu.addItem')}</Button>
              </div>
            </div>
            {menuLoading && (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Card key={idx} className="p-4 space-y-2 animate-pulse">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="h-3 w-1/4 rounded bg-muted" />
                  </Card>
                ))}
              </div>
            )}
            {!menuLoading && (
              <div className="grid gap-3 md:grid-cols-2">
                {menu?.categories?.length ? (
                  menu.categories.map((cat) => (
                    <Card key={cat.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{cat.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t('owner.venue.menu.itemsCount', { count: cat.items.length })}
                          </div>
                        </div>
                        <Badge variant="outline">#{cat.sortOrder ?? 0}</Badge>
                      </div>
                      <div className="space-y-2">
                        {cat.items
                          .slice()
                          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                          .map((i, idx) => (
                            <Card key={i.id} className="p-4 space-y-2 border border-dashed">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold">{i.name}</div>
                                  {i.description && <div className="text-xs text-muted-foreground">{i.description}</div>}
                                  <div className="text-xs text-muted-foreground">
                                    {t('owner.venue.menu.priceWithSort', {
                                      price: (i.price / 100).toFixed(2),
                                      order: i.sortOrder ?? idx,
                                    })}
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    <Badge variant={i.isActive ? 'default' : 'outline'}>
                                      {i.isActive ? t('status.active') : t('status.inactive')}
                                    </Badge>
                                    <Badge variant={i.isInStock ? 'outline' : 'destructive'}>
                                      {i.isInStock ? t('common.states.inStock') : t('common.states.outOfStock')}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => moveItem(cat.id, i.id, 'up')} disabled={idx === 0}>
                                    ↑
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => moveItem(cat.id, i.id, 'down')} disabled={idx === cat.items.length - 1}>
                                    ↓
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => openEditMenuDialog(i as MenuItem, cat.id)}>
                                  {t('common.actions.edit')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    const next = !i.isActive;
                                    try {
                                      const updated = await updateItem(i.id, { isActive: next });
                                      upsertMenuItem(updated as MenuItem, cat.id);
                                      toastSuccess(next ? t('owner.toasts.menuItemActivated') : t('owner.toasts.menuItemDeactivated'));
                                    } catch (err) {
                                      toastApiError(err, t('owner.errors.updateMenuItem'));
                                    }
                                  }}
                                >
                                  {i.isActive ? t('common.actions.deactivate') : t('common.actions.activate')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteMenuItem(i.id)}
                                >
                                  {t('common.actions.delete')}
                                </Button>
                              </div>
                            </Card>
                          ))}
                        {cat.items.length === 0 && (
                          <Card className="p-4 text-sm text-muted-foreground border-dashed">
                            {t('owner.venue.menu.emptyCategory')}
                          </Card>
                        )}
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-4 text-sm text-muted-foreground border-dashed">
                    {t('owner.venue.menu.emptyMenu')}
                  </Card>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="tables" className="space-y-3">
          <Card className="p-4">
            <form onSubmit={createTable} className="grid gap-2 md:grid-cols-4">
              <Input
                placeholder={t('forms.placeholders.name')}
                value={tableForm.name}
                onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                required
              />
              <Input
                placeholder={t('forms.placeholders.code')}
                value={tableForm.code}
                onChange={(e) => setTableForm({ ...tableForm, code: e.target.value })}
                required
              />
              <Input
                type="number"
                placeholder={t('forms.placeholders.capacity')}
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
              />
              <Button type="submit">{t('owner.venue.tables.actions.add')}</Button>
            </form>
          </Card>
          <Card className="p-4">
            <div className="grid gap-2 md:grid-cols-2">
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
          </Card>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredTables.map((t) => (
              <Card key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('common.labels.code')}: {t.code}
                  </div>
                </div>
                <Badge variant={t.isActive ? 'default' : 'outline'}>
                  {t.isActive ? t('status.active') : t('status.inactive')}
                </Badge>
              </Card>
            ))}
            {filteredTables.length === 0 && (
              <Card className="space-y-2 border-dashed p-4 text-sm text-muted-foreground">
                <div>
                  {tables.length === 0 ? t('owner.venue.tables.emptyAll') : t('owner.venue.tables.emptyFiltered')}
                </div>
                {tables.length > 0 && (
                  <Button size="sm" variant="outline" onClick={resetTableFilters}>
                    {t('common.actions.clearFilters')}
                  </Button>
                )}
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="users" className="space-y-3">
          <Card className="p-4">
            <form onSubmit={createUser} className="grid gap-2 md:grid-cols-5">
              <Input
                placeholder={t('forms.placeholders.name')}
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                required
              />
              <Input
                placeholder={t('forms.placeholders.email')}
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
              />
              <Input
                placeholder={t('forms.placeholders.passwordOptional')}
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
              <Input
                placeholder={t('owner.venue.users.placeholders.role')}
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
              />
              <Button type="submit">{t('owner.venue.users.actions.add')}</Button>
            </form>
          </Card>
          <Card className="p-4">
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder={t('forms.placeholders.searchUsers')}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <Select value={userRoleFilter} onValueChange={(val) => setUserRoleFilter(val as UserRole | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.labels.role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filters.allRoles')}</SelectItem>
                  {Object.values(UserRoleEnum.enum).map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`common.roles.${role}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={userStatusFilter} onValueChange={(val) => setUserStatusFilter(val as typeof userStatusFilter)}>
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
          </Card>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredUsers.map((u) => (
              <Card key={u.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant="outline">{t(`common.roles.${u.role}` as never)}</Badge>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <Card className="space-y-2 border-dashed p-4 text-sm text-muted-foreground">
                <div>
                  {users.length === 0 ? t('owner.venue.users.emptyAll') : t('owner.venue.users.emptyFiltered')}
                </div>
                {users.length > 0 && (
                  <Button size="sm" variant="outline" onClick={resetUserFilters}>
                    {t('common.actions.clearFilters')}
                  </Button>
                )}
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <div className="text-sm font-semibold">{t('owner.venue.analytics.orders7d')}</div>
            <div className="h-48">
              <ResponsiveContainer>
                <AreaChart data={stats?.ordersLast7d ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" hide />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#14b8a6" fill="#14b8a6" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold">{t('owner.venue.analytics.topItems')}</div>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={stats?.topItems ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemName" hide />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qty" fill="#0f172a" />
                  <Bar dataKey="revenue" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {menuForm.id ? t('owner.venue.menu.dialog.editTitle') : t('owner.venue.menu.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('owner.venue.menu.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <label className="space-y-1 text-sm">
                <div>{t('common.labels.category')}</div>
                <Select
                  value={menuForm.categoryId}
                  onValueChange={(val) => setMenuForm((prev) => ({ ...prev, categoryId: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('forms.placeholders.category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <div>{t('common.labels.name')}</div>
                <Input value={menuForm.name} onChange={(e) => setMenuForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <div>{t('common.labels.description')}</div>
                <Input
                  value={menuForm.description}
                  onChange={(e) => setMenuForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t('forms.placeholders.optional')}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm">
                  <div>{t('owner.venue.menu.fields.priceCents')}</div>
                  <Input
                    type="number"
                    min={0}
                    value={menuForm.price}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, price: e.target.value }))}
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <div>{t('owner.venue.menu.fields.sortOrder')}</div>
                  <Input
                    type="number"
                    value={menuForm.sortOrder}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))}
                  />
                </label>
              </div>
              <label className="space-y-1 text-sm">
                <div>{t('owner.venue.menu.fields.imageUrl')}</div>
                <Input
                  value={menuForm.imageUrl}
                  onChange={(e) => setMenuForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder={t('forms.placeholders.imageUrl')}
                />
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={menuForm.isActive}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  {t('status.active')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={menuForm.isInStock}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, isInStock: e.target.checked }))}
                  />
                  {t('common.states.inStock')}
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{t('owner.venue.menu.modifiers.title')}</div>
                <Button size="sm" variant="outline" type="button" onClick={addModifierGroup}>
                  {t('owner.venue.menu.modifiers.addGroup')}
                </Button>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {menuForm.modifiers.map((group) => (
                  <Card key={group.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={group.name}
                        onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                        placeholder={t('owner.venue.menu.modifiers.groupName')}
                      />
                      <Button size="icon" variant="destructive" onClick={() => removeGroup(group.id)} type="button">
                        ×
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={group.isRequired}
                          onChange={(e) => updateGroup(group.id, { isRequired: e.target.checked })}
                        />
                        {t('owner.venue.menu.modifiers.required')}
                      </label>
                      <label className="flex items-center gap-1">
                        {t('common.labels.min')}
                        <Input
                          type="number"
                          className="h-8 w-16"
                          value={group.minSelect}
                          onChange={(e) => updateGroup(group.id, { minSelect: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        {t('common.labels.max')}
                        <Input
                          type="number"
                          className="h-8 w-16"
                          value={group.maxSelect}
                          onChange={(e) => updateGroup(group.id, { maxSelect: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        {t('owner.venue.menu.fields.sortOrder')}
                        <Input
                          type="number"
                          className="h-8 w-16"
                          value={group.sortOrder}
                          onChange={(e) => updateGroup(group.id, { sortOrder: Number(e.target.value) || 0 })}
                        />
                      </label>
                    </div>
                    <div className="space-y-1">
                      {group.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2 text-sm">
                          <Input
                            value={opt.name}
                            onChange={(e) => updateOption(group.id, opt.id, { name: e.target.value })}
                            placeholder={t('owner.venue.menu.modifiers.optionName')}
                          />
                          <Input
                            type="number"
                            className="w-24"
                            value={opt.priceDelta}
                            onChange={(e) => updateOption(group.id, opt.id, { priceDelta: Number(e.target.value) || 0 })}
                          />
                          <Input
                            type="number"
                            className="w-20"
                            value={opt.sortOrder}
                            onChange={(e) => updateOption(group.id, opt.id, { sortOrder: Number(e.target.value) || 0 })}
                          />
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={opt.isActive}
                              onChange={(e) => updateOption(group.id, opt.id, { isActive: e.target.checked })}
                            />
                            {t('status.active')}
                          </label>
                          <Button size="icon" variant="destructive" type="button" onClick={() => removeOption(group.id, opt.id)}>
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" type="button" onClick={() => addOption(group.id)}>
                        {t('owner.venue.menu.modifiers.addOption')}
                      </Button>
                    </div>
                  </Card>
                ))}
                {menuForm.modifiers.length === 0 && (
                  <Card className="p-4 text-sm text-muted-foreground border-dashed">
                    {t('owner.venue.menu.modifiers.empty')}
                  </Card>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMenuDialogOpen(false)} type="button">
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={saveMenuItem} type="button">
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
