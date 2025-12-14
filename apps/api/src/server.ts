import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { Server as IOServer } from 'socket.io';
import crypto from 'node:crypto';
import * as QRCode from 'qrcode';
import {
  FRONTEND_BASE_URL,
  SESSION_INACTIVITY_MS,
  CLOSED_SESSION_TTL_MS,
  SERVED_ORDER_TTL_MS,
  DEMO_STAFF_PASSWORD,
  refreshCookieName,
  refreshCookieSecure,
} from './config/env';
import { parseBearerToken, verifyStaffJwt, issueAccessToken } from './lib/authTokens';
import type { StaffTokenPayload } from './lib/authTokens';
import { generateTempPassword, hashPassword, verifyPassword } from './lib/crypto';
import { createStaffService, mapStaffUser } from './lib/staffService';

// Defer Prisma import until after env is loaded to ensure it picks up the correct DATABASE_URL.
const prismaModulePromise = import('@qr/db');
type PrismaModule = Awaited<typeof prismaModulePromise>;
let prisma: PrismaModule['prisma'];
let Prisma: PrismaModule['Prisma'];
let staffService: ReturnType<typeof createStaffService>;
import {
  AdminMenuItemCreateDto,
  AdminMenuItemUpdateDto,
  AdminTableCreateDto,
  AdminTableUpdateDto,
  AssistanceRequestDto,
  AuthLoginDto,
  AuthLoginResponseDto,
  AuthRefreshResponseDto,
  CartAddItemDto,
  CartRemoveItemDto,
  CartUpdateItemQtyDto,
  CartUpdatedEventDto,
  ErrorEventDto,
  GuestPingDto,
  JoinSessionDto,
  JoinSessionResponseDto,
  JoinSessionSocketDto,
  MenuUpdatedEventDto,
  OrderEventDto,
  OrderMarkServedDto,
  OrderStatusEnum,
  OrderSubmitDto,
  PaymentCreateDto,
  PaymentCreateResponseDto,
  PaymentIntent,
  PaymentStatusEnum,
  PaymentUpdatedEventDto,
  PublicMenuResponseDto,
  SessionLeaveDto,
  SessionStateDto,
  SessionStateEventDto,
  StaffCreateDto,
  StaffOrderStatusPatchDto,
  StaffOrdersQueryDto,
  StaffOrdersResponseDto,
  StaffUpdateDto,
  StaffUserDto,
  TableSessionStatusEnum,
  UserRoleEnum,
  WaiterSubscribeDto,
  isOrderTransitionAllowed,
  type CartItem,
  type Order,
  type TableSession,
} from '@qr/types';

const demoVenue = {
  id: 'venue-demo',
  name: 'Demo Venue',
  slug: 'demo',
  currency: 'KGS',
  timezone: 'Asia/Bishkek',
};

const menuVersions = new Map<string, string>([[demoVenue.slug, 'v1']]);
const menusByVenue = new Map<string, any>([
  [
    demoVenue.slug,
    PublicMenuResponseDto.parse({
      venue: demoVenue,
      categories: [
        {
          id: 'cat-mains',
          name: 'Основное',
          sortOrder: 0,
          items: [
            {
              id: 'item-plov',
              name: 'Плов',
              description: 'Рис, морковь, баранина',
              price: 35000,
              isActive: true,
              isInStock: true,
              sortOrder: 0,
              modifiers: [
                {
                  id: 'mod-sauce',
                  name: 'Соус',
                  isRequired: false,
                  minSelect: 0,
                  maxSelect: 2,
                  sortOrder: 0,
                  options: [
                    { id: 'opt-spicy', name: 'Острый', priceDelta: 0, isActive: true, sortOrder: 0 },
                    { id: 'opt-garlic', name: 'Чесночный', priceDelta: 0, isActive: true, sortOrder: 1 },
                  ],
                },
              ],
            },
            {
              id: 'item-lagman',
              name: 'Лагман',
              description: 'Говядина, лапша, овощи, острый соус',
              price: 42000,
              isActive: true,
              isInStock: true,
              sortOrder: 1,
              modifiers: [
                {
                  id: 'mod-spice',
                  name: 'Острота',
                  isRequired: false,
                  minSelect: 0,
                  maxSelect: 1,
                  sortOrder: 0,
                  options: [
                    { id: 'opt-spice-low', name: 'Мягкий', priceDelta: 0, isActive: true, sortOrder: 0 },
                    { id: 'opt-spice-med', name: 'Средний', priceDelta: 0, isActive: true, sortOrder: 1 },
                    { id: 'opt-spice-hot', name: 'Острый', priceDelta: 0, isActive: true, sortOrder: 2 },
                  ],
                },
              ],
            },
            {
              id: 'item-besh',
              name: 'Бешбармак',
              description: 'Домашняя лапша, отварное мясо, лук',
              price: 50000,
              isActive: true,
              isInStock: true,
              sortOrder: 2,
              modifiers: [],
            },
            {
              id: 'item-manty',
              name: 'Манты',
              description: 'Баранина, лук, 5 шт',
              price: 38000,
              isActive: true,
              isInStock: true,
              sortOrder: 3,
              modifiers: [
                {
                  id: 'mod-sourcream',
                  name: 'Сметана',
                  isRequired: false,
                  minSelect: 0,
                  maxSelect: 1,
                  sortOrder: 0,
                  options: [{ id: 'opt-sourcream', name: 'Добавить сметану', priceDelta: 5000, isActive: true, sortOrder: 0 }],
                },
              ],
            },
            {
              id: 'item-samsa',
              name: 'Самса',
              description: 'Печеная, с говядиной, 1 шт',
              price: 12000,
              isActive: true,
              isInStock: true,
              sortOrder: 4,
              modifiers: [],
            },
          ],
        },
        {
          id: 'cat-drinks',
          name: 'Напитки',
          sortOrder: 1,
          items: [
            {
              id: 'item-tea',
              name: 'Чай',
              description: 'Черный, 500 мл',
              price: 12000,
              isActive: true,
              isInStock: true,
              sortOrder: 0,
              modifiers: [],
            },
            {
              id: 'item-coffee',
              name: 'Кофе американо',
              description: '250 мл',
              price: 15000,
              isActive: true,
              isInStock: true,
              sortOrder: 1,
              modifiers: [],
            },
            {
              id: 'item-latte',
              name: 'Латте',
              description: 'Молочный кофе, 300 мл',
              price: 18000,
              isActive: true,
              isInStock: true,
              sortOrder: 2,
              modifiers: [],
            },
            {
              id: 'item-lemonade',
              name: 'Лимонад',
              description: 'Домашний, 500 мл',
              price: 16000,
              isActive: true,
              isInStock: true,
              sortOrder: 3,
              modifiers: [],
            },
          ],
        },
        {
          id: 'cat-salads',
          name: 'Салаты',
          sortOrder: 2,
          items: [
            {
              id: 'item-greek',
              name: 'Греческий',
              description: 'Огурцы, помидоры, фета, маслины',
              price: 24000,
              isActive: true,
              isInStock: true,
              sortOrder: 0,
              modifiers: [],
            },
            {
              id: 'item-caesar',
              name: 'Цезарь с курицей',
              description: 'Курица, айсберг, соус цезарь, гренки',
              price: 28000,
              isActive: true,
              isInStock: true,
              sortOrder: 1,
              modifiers: [],
            },
            {
              id: 'item-vin',
              name: 'Винегрет',
              description: 'Свекла, картофель, морковь, горошек',
              price: 19000,
              isActive: true,
              isInStock: true,
              sortOrder: 2,
              modifiers: [],
            },
          ],
        },
        {
          id: 'cat-desserts',
          name: 'Десерты',
          sortOrder: 3,
          items: [
            {
              id: 'item-cheesecake',
              name: 'Чизкейк',
              description: 'Сливочный, клубничный соус',
              price: 27000,
              isActive: true,
              isInStock: true,
              sortOrder: 0,
              modifiers: [],
            },
            {
              id: 'item-tiramisu',
              name: 'Тирамису',
              description: 'Кофейный крем, савоярди',
              price: 30000,
              isActive: true,
              isInStock: true,
              sortOrder: 1,
              modifiers: [],
            },
            {
              id: 'item-icecream',
              name: 'Мороженое',
              description: 'Шарики на выбор',
              price: 15000,
              isActive: true,
              isInStock: true,
              sortOrder: 2,
              modifiers: [
                {
                  id: 'mod-icecream',
                  name: 'Вкус',
                  isRequired: false,
                  minSelect: 0,
                  maxSelect: 2,
                  sortOrder: 0,
                  options: [
                    { id: 'opt-ice-vanilla', name: 'Ваниль', priceDelta: 0, isActive: true, sortOrder: 0 },
                    { id: 'opt-ice-choco', name: 'Шоколад', priceDelta: 0, isActive: true, sortOrder: 1 },
                    { id: 'opt-ice-berry', name: 'Ягоды', priceDelta: 0, isActive: true, sortOrder: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  ],
]);
const adminMenuItems = new Map<string, any>();

const sessionTokens = new Map<string, Set<string>>();

const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const buildKitchenRoom = (venueId: string) => `venue:${venueId}:kitchen`;
const buildWaitersRoom = (venueId: string) => `venue:${venueId}:waiters`;
const buildSessionRoom = (sessionId: string) => `tableSession:${sessionId}`;

const issueSessionToken = (sessionId: string) => {
  const token = crypto.randomBytes(32).toString('hex');
  const list = sessionTokens.get(sessionId) ?? new Set<string>();
  list.add(token);
  sessionTokens.set(sessionId, list);
  return token;
};

const isSessionTokenValid = (sessionId: string, token?: string | null) => {
  if (!token) return false;
  return sessionTokens.get(sessionId)?.has(token) ?? false;
};

const revokeSessionTokens = (sessionId: string) => {
  sessionTokens.delete(sessionId);
};

const requireStaffAuth = (
  req: { headers: Record<string, any> },
  reply: { status: (code: number) => { send: (body: any) => void } },
  roles?: StaffTokenPayload['role'][]
) => {
  const staff = verifyStaffJwt(parseBearerToken(req.headers.authorization as string | undefined));
  if (!staff) {
    reply.status(401).send({ message: 'Unauthorized' });
    return null;
  }
  if (roles && !roles.includes(staff.role)) {
    reply.status(403).send({ message: 'Forbidden' });
    return null;
  }
  return staff;
};

const findMenuItem = (venueSlug: string, itemId: string) => {
  const menu = menusByVenue.get(venueSlug);
  if (!menu) return undefined;
  for (const category of menu.categories) {
    const item = category.items.find((i: any) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
};

const bumpMenuVersion = (venueSlug: string) => {
  const next = `v${Date.now()}`;
  menuVersions.set(venueSlug, next);
  return next;
};

const emitMenuUpdated = async (io: IOServer | null, venueSlug: string) => {
  if (!io) return;
  const version = menuVersions.get(venueSlug) ?? 'v1';
  const payload = MenuUpdatedEventDto.parse({ version });
  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  const venueId = venue?.id ?? venueSlug;
  io.to(buildKitchenRoom(venueId)).emit('menu.updated', payload);
  io.to(buildWaitersRoom(venueId)).emit('menu.updated', payload);
  const sessions = await prisma.tableSession.findMany({
    where: { venueId, status: TableSessionStatusEnum.enum.OPEN },
    select: { id: true },
  });
  sessions.forEach((s) => io!.to(buildSessionRoom(s.id)).emit('menu.updated', payload));
};

const ensureDemoVenue = async () => {
  let venue = await prisma.venue.findUnique({ where: { slug: demoVenue.slug } });
  if (!venue) {
    venue = await prisma.venue.create({ data: demoVenue });
  }
  return venue;
};

const ensureDemoMenuData = async (venueId: string) => {
  const menu = menusByVenue.get(demoVenue.slug);
  if (!menu) return;

  for (const category of menu.categories) {
    await prisma.menuCategory.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        sortOrder: category.sortOrder ?? 0,
        isActive: (category as any).isActive ?? true,
        venueId,
      },
      create: {
        id: category.id,
        venueId,
        name: category.name,
        sortOrder: category.sortOrder ?? 0,
        isActive: (category as any).isActive ?? true,
      },
    });

    for (const item of category.items) {
      await prisma.menuItem.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description ?? null,
          imageUrl: item.imageUrl ?? null,
          price: item.price,
          isActive: item.isActive ?? true,
          isInStock: item.isInStock ?? true,
          sortOrder: item.sortOrder ?? 0,
          categoryId: category.id,
          venueId,
        },
        create: {
          id: item.id,
          venueId,
          categoryId: category.id,
          name: item.name,
          description: item.description ?? null,
          imageUrl: item.imageUrl ?? null,
          price: item.price,
          isActive: item.isActive ?? true,
          isInStock: item.isInStock ?? true,
          sortOrder: item.sortOrder ?? 0,
        },
      });

      for (const group of item.modifiers ?? []) {
        await prisma.menuModifierGroup.upsert({
          where: { id: group.id },
          update: {
            name: group.name,
            isRequired: group.isRequired ?? false,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder: group.sortOrder ?? 0,
            itemId: item.id,
          },
          create: {
            id: group.id,
            itemId: item.id,
            name: group.name,
            isRequired: group.isRequired ?? false,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder: group.sortOrder ?? 0,
          },
        });

        for (const option of group.options ?? []) {
          await prisma.menuModifierOption.upsert({
            where: { id: option.id },
            update: {
              name: option.name,
              priceDelta: option.priceDelta ?? 0,
              isActive: option.isActive ?? true,
              sortOrder: option.sortOrder ?? 0,
              groupId: group.id,
            },
            create: {
              id: option.id,
              groupId: group.id,
              name: option.name,
              priceDelta: option.priceDelta ?? 0,
              isActive: option.isActive ?? true,
              sortOrder: option.sortOrder ?? 0,
            },
          });
        }
      }
    }
  }
};

const ensureDemoStaffUsers = async (venueId: string) => {
  const roles: StaffTokenPayload['role'][] = [
    UserRoleEnum.enum.ADMIN,
    UserRoleEnum.enum.WAITER,
    UserRoleEnum.enum.KITCHEN,
  ];
  const passwordHash = await hashPassword(DEMO_STAFF_PASSWORD);
  await Promise.all(
    roles.map((role) =>
      prisma.staffUser.upsert({
        where: { email: `${role.toLowerCase()}@example.com` },
        update: { venueId, role, name: `${role.toLowerCase()} demo`, passwordHash, isActive: true },
        create: {
          id: `staff-${role.toLowerCase()}`,
          venueId,
          role,
          name: `${role.toLowerCase()} demo`,
          email: `${role.toLowerCase()}@example.com`,
          passwordHash,
          isActive: true,
        },
      })
    )
  );
};

const ensureTable = async (venueId: string, tableCode: string) => {
  let table = await prisma.table.findFirst({ where: { venueId, code: tableCode } });
  if (!table) {
    table = await prisma.table.create({
      data: { id: tableCode, venueId, code: tableCode, name: `Table ${tableCode}`, isActive: true },
    });
  }
  return table;
};

const ensureSession = async (payload: { venueSlug: string; tableCode: string; peopleCount?: number }) => {
  const venue = await ensureDemoVenue();
  await ensureDemoStaffUsers(venue.id);
  await ensureDemoMenuData(venue.id);
  const table = await ensureTable(venue.id, payload.tableCode);

  const existing = await prisma.tableSession.findFirst({
    where: { venueId: venue.id, tableId: table.id, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
  if (existing) {
    return { session: existing, table, venue };
  }

  const session = await prisma.tableSession.create({
    data: {
      venueId: venue.id,
      tableId: table.id,
      status: 'OPEN',
      peopleCount: payload.peopleCount,
      openedAt: nowIso(),
      lastActiveAt: nowIso(),
    },
  });
  return { session, table, venue };
};

const mapCartItem = (item: any, modifiers: any[]): CartItem => ({
  id: item.id,
  sessionId: item.sessionId,
  menuItemId: item.menuItemId,
  qty: item.qty,
  note: item.note ?? undefined,
  unitPrice: item.unitPrice,
  itemName: item.itemName,
  addedByDeviceHash: item.addedByDeviceHash ?? undefined,
  modifiers: modifiers.map((m) => ({ optionId: m.optionId, optionName: m.optionName, priceDelta: m.priceDelta })),
});

const mapOrder = (order: any, items: any[]): Order => ({
  id: order.id,
  venueId: order.venueId,
  sessionId: order.sessionId,
  tableId: order.tableId,
  status: order.status as Order['status'],
  number: order.number,
  comment: order.comment ?? undefined,
  acceptedAt: order.acceptedAt?.toISOString(),
  readyAt: order.readyAt?.toISOString(),
  servedAt: order.servedAt?.toISOString(),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  items: items.map((i) => ({
    id: i.id,
    orderId: i.orderId,
    menuItemId: i.menuItemId,
    qty: i.qty,
    note: i.note ?? undefined,
    unitPrice: i.unitPrice,
    itemName: i.itemName,
    modifiers: i.modifiers.map((m: any) => ({
      id: m.id,
      orderItemId: m.orderItemId,
      optionId: m.optionId,
      optionName: m.optionName,
      priceDelta: m.priceDelta,
    })),
  })),
});

const mapPayment = (payment: any): PaymentIntent => ({
  id: payment.id,
  venueId: payment.venueId,
  sessionId: payment.sessionId,
  orderId: payment.orderId ?? undefined,
  amount: payment.amount,
  status: payment.status,
  provider: payment.provider,
  payload: payment.payload as any,
  createdAt: payment.createdAt.toISOString(),
  updatedAt: payment.updatedAt.toISOString(),
});

const mapSessionDto = (session: any, table: any): TableSession => ({
  id: session.id,
  venueId: session.venueId,
  tableId: table?.code ?? session.tableId,
  status: session.status,
  peopleCount: session.peopleCount ?? undefined,
  openedAt: session.openedAt.toISOString ? session.openedAt.toISOString() : session.openedAt,
  closedAt: session.closedAt ? (session.closedAt.toISOString ? session.closedAt.toISOString() : session.closedAt) : undefined,
  lastActiveAt: session.lastActiveAt.toISOString ? session.lastActiveAt.toISOString() : session.lastActiveAt,
});

const calcCartTotals = (cart: CartItem[]) => {
  const subtotal = cart.reduce((sum, item) => {
    const modifiersTotal = item.modifiers.reduce((modSum, mod) => modSum + mod.priceDelta, 0);
    return sum + (item.unitPrice + modifiersTotal) * item.qty;
  }, 0);
  return { subtotal, total: subtotal, itemCount: cart.reduce((sum, item) => sum + item.qty, 0) };
};

const calcOrderTotal = (order: Order) =>
  order.items.reduce((sum, item) => {
    const modifiersTotal = item.modifiers.reduce((modSum, mod) => modSum + mod.priceDelta, 0);
    return sum + (item.unitPrice + modifiersTotal) * item.qty;
  }, 0);

const calcOrdersTotal = (orders: Order[]) => orders.reduce((sum, order) => sum + calcOrderTotal(order), 0);

const calcCartItemsTotal = (cart: CartItem[]) =>
  cart.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
    return sum + (item.unitPrice + modSum) * item.qty;
  }, 0);

const buildTableLink = (venueSlug: string, tableCode: string) => `${FRONTEND_BASE_URL}/v/${venueSlug}/t/${tableCode}`;

const validateModifiers = (
  venueSlug: string,
  menuItemId: string,
  selections: Array<{ optionId: string; optionName?: string; priceDelta: number }>
) => {
  const menuItem = findMenuItem(venueSlug, menuItemId);
  if (!menuItem || !menuItem.isInStock) return { error: 'OUT_OF_STOCK' as const };
  const byGroup = new Map<string, string[]>();
  selections.forEach((sel) => {
    const group = menuItem.modifiers.find((g: any) => g.options.some((o: any) => o.id === sel.optionId));
    if (!group) return;
    const list = byGroup.get(group.id) ?? [];
    list.push(sel.optionId);
    byGroup.set(group.id, list);
  });

  const sanitized: CartItem['modifiers'] = [];
  for (const group of menuItem.modifiers) {
    const selected = byGroup.get(group.id) ?? [];
    if (group.isRequired && selected.length === 0) return { error: 'MODIFIER_REQUIRED' as const };
    if (selected.length < group.minSelect) return { error: 'MODIFIER_MIN' as const };
    if (selected.length > group.maxSelect) return { error: 'MODIFIER_MAX' as const };

    selected.slice(0, group.maxSelect).forEach((id) => {
      const opt = group.options.find((o: any) => o.id === id);
      if (!opt || !opt.isActive || opt.priceDelta < 0) return;
      sanitized.push({ optionId: opt.id, optionName: opt.name, priceDelta: opt.priceDelta });
    });
  }
  return { modifiers: sanitized };
};

const getSessionState = async (sessionId: string) => {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      cartItems: { include: { modifiers: true }, orderBy: { createdAt: 'asc' } },
      orders: {
        where: { status: { notIn: ['SERVED', 'CANCELLED'] } },
        include: { items: { include: { modifiers: true } } },
        orderBy: { createdAt: 'asc' },
      },
      payments: true,
    },
  });
  if (!session) return null;
  const cart = session.cartItems.map((c) => mapCartItem(c, c.modifiers));
  const orders = session.orders.map((o) => mapOrder(o, o.items));
  const payments = session.payments.map((p) => mapPayment(p));
  const version = menuVersions.get(demoVenue.slug) ?? 'v1';
  return SessionStateDto.parse({
    session: mapSessionDto(session, (session as any).table),
    cart,
    ordersActive: orders,
    payments,
    menuVersion: version,
  });
};

const sumPaid = async (sessionId: string, orderId?: string) => {
  const payments = await prisma.paymentIntent.findMany({
    where: {
      sessionId,
      status: PaymentStatusEnum.enum.PAID,
      ...(orderId ? { orderId } : {}),
    },
  });
  return payments.reduce((sum, p) => sum + p.amount, 0);
};

const computeOutstanding = async (
  sessionId: string,
  mode: string,
  opts: { order?: Order; cart?: CartItem[]; items?: string[]; orders?: Order[] }
) => {
  const base = opts.order
    ? calcOrderTotal(opts.order)
    : opts.orders?.length
      ? calcOrdersTotal(opts.orders)
      : calcCartTotals(opts.cart ?? []).total;
  const paid = await sumPaid(sessionId, opts.order?.id);
  const remaining = Math.max(base - paid, 0);
  if (mode === 'ITEMS' && opts.items?.length && !opts.order) {
    const selected = (opts.cart ?? []).filter((c) => opts.items?.includes(c.id));
    const selectedTotal = calcCartItemsTotal(selected);
    return Math.min(selectedTotal, remaining);
  }
  return remaining;
};

const emitOrderUpdated = (io: IOServer, order: Order) => {
  const payload = OrderEventDto.parse({ order });
  io.to(buildSessionRoom(order.sessionId)).emit('order.updated', payload);
  io.to(buildKitchenRoom(order.venueId)).emit('order.updated', payload);
  if (order.status === OrderStatusEnum.enum.READY || order.status === OrderStatusEnum.enum.SERVED) {
    io.to(buildWaitersRoom(order.venueId)).emit('order.updated', payload);
  }
};

const emitPaymentUpdated = (io: IOServer, payment: PaymentIntent) => {
  const payload = PaymentUpdatedEventDto.parse({ payment });
  io.to(buildSessionRoom(payment.sessionId)).emit('payment.updated', payload);
};

const closeSession = async (sessionId: string, reason: string, io: IOServer | null) => {
  const session = await prisma.tableSession.findUnique({ where: { id: sessionId }, include: { table: true } });
  if (!session) return;
  await prisma.tableSession.update({ where: { id: sessionId }, data: { status: TableSessionStatusEnum.enum.CLOSED, closedAt: nowIso() } });
  revokeSessionTokens(sessionId);
  if (io) {
    io.to(buildSessionRoom(sessionId)).emit('session.closed', { sessionId, reason, closedAt: nowIso() });
  }
};

async function main() {
  ({ prisma, Prisma } = await prismaModulePromise);
  staffService = createStaffService(prisma);
  const app = Fastify({ logger: true });
  let io: IOServer | null = null;
  let prismaErrorSilencedUntil = 0;

  app.log.info({ node: process.version, databaseUrl: process.env.DATABASE_URL }, 'runtime env');

  const handlePrismaError = (err: unknown, context: string) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P5010') {
      const now = Date.now();
      if (now > prismaErrorSilencedUntil) {
        app.log.error({ err }, context);
        prismaErrorSilencedUntil = now + 60_000;
      }
      return;
    }
    app.log.error({ err }, context);
  };

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user-role', 'authorization'],
  });
  await app.register(fastifyCookie);

  app.get('/health', async () => ({ ok: true }));

  // Public
  app.get('/public/venues/:venueSlug/menu', async (req, reply) => {
    const { venueSlug } = req.params as { venueSlug: string };
    const menu = menusByVenue.get(venueSlug);
    if (!menu) return reply.status(404).send({ message: 'Menu not found' });
    return reply.send(menu);
  });

  app.post('/public/sessions/join', async (req, reply) => {
    const parsed = JoinSessionDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    try {
      const ensured = await ensureSession(parsed.data);
      const session = ensured.session;
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { lastActiveAt: nowIso(), peopleCount: parsed.data.peopleCount ?? session.peopleCount },
      });
      const token = issueSessionToken(session.id);
      const state = await getSessionState(session.id);
      if (!state) return reply.status(404).send({ message: 'Session not found' });

      return JoinSessionResponseDto.parse({
        sessionId: session.id,
        token,
        ...state,
      });
    } catch (err) {
      handlePrismaError(err, 'join session failed');
      return reply.status(503).send({ message: 'Unable to join session. Is the database running?' });
    }
  });

  app.get('/public/sessions/:sessionId/state', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const token = parseBearerToken(req.headers.authorization as string | undefined);
    if (!isSessionTokenValid(sessionId, token)) {
      return reply.status(401).send({ message: 'Invalid or missing session token' });
    }
    const sessionState = await getSessionState(sessionId);
    if (!sessionState) return reply.status(404).send({ message: 'Session not found' });
    return sessionState;
  });

  app.post('/public/sessions/:sessionId/payments', async (req, reply) => {
    const parsed = PaymentCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());

    const { sessionId } = req.params as { sessionId: string };
    if (parsed.data.sessionId !== sessionId) {
      return reply.status(400).send({ message: 'SessionId mismatch' });
    }
    const bearer = parseBearerToken(req.headers.authorization as string | undefined);
    const token = bearer ?? parsed.data.token;
    if (!token || !isSessionTokenValid(sessionId, token) || token !== parsed.data.token) {
      return reply.status(401).send({ message: 'Invalid session token' });
    }
    const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });

    const cartRows = await prisma.cartItem.findMany({ where: { sessionId }, include: { modifiers: true } });
    const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
    const ordersActiveRows = await prisma.order.findMany({
      where: { sessionId, status: { notIn: ['SERVED', 'CANCELLED'] } },
      include: { items: { include: { modifiers: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ordersActive = ordersActiveRows.map((o) => mapOrder(o, o.items));
    const orderRow = parsed.data.orderId
      ? await prisma.order.findUnique({ where: { id: parsed.data.orderId }, include: { items: { include: { modifiers: true } } } })
      : undefined;
    const order = orderRow ? mapOrder(orderRow, orderRow.items) : undefined;
    if (parsed.data.orderId && !order) return reply.status(404).send({ message: 'Order not found' });

    const mode = parsed.data.mode ?? 'FULL';
    const outstanding = await computeOutstanding(sessionId, mode, { order, cart, items: parsed.data.items, orders: ordersActive });
    if (outstanding <= 0) return reply.status(400).send({ message: 'Nothing to pay' });

    let amount = parsed.data.amount ?? 0;
    if (mode === 'ITEMS' && parsed.data.items?.length) {
      const selected = cart.filter((c) => parsed.data.items?.includes(c.id));
      if (!selected.length) return reply.status(400).send({ message: 'No matching items selected' });
      const selectedTotal = calcCartItemsTotal(selected);
      amount = amount || selectedTotal;
      if (amount > selectedTotal) return reply.status(400).send({ message: 'Amount exceeds selected items total' });
    } else if (mode === 'EVEN') {
      const splitCount = parsed.data.splitCount ?? session.peopleCount ?? 1;
      const share = Math.ceil(outstanding / Math.max(splitCount, 1));
      amount = amount || share;
    } else {
      amount = amount || outstanding;
    }

    if (!amount || amount <= 0) return reply.status(400).send({ message: 'Nothing to pay' });
    if (amount > outstanding) return reply.status(400).send({ message: 'Amount exceeds outstanding' });

    const now = nowIso();
    const payment = await prisma.paymentIntent.create({
      data: {
        id: uid(),
        venueId: session.venueId,
        sessionId,
        orderId: parsed.data.orderId,
        amount,
        status: PaymentStatusEnum.enum.CREATED,
        provider: 'mock',
        payload: {
          mode,
          items: parsed.data.items,
          splitCount: parsed.data.splitCount,
          paidByDeviceHash: parsed.data.paidByDeviceHash,
        },
        createdAt: now,
        updatedAt: now,
      },
    });

    // mock settle
    const settled = await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: { status: PaymentStatusEnum.enum.PAID, updatedAt: nowIso() },
    });
    if (io) emitPaymentUpdated(io, mapPayment(settled));

    return PaymentCreateResponseDto.parse({ payment: mapPayment(settled) });
  });

  app.get('/public/payments/:paymentId', async (req, reply) => {
    const { paymentId } = req.params as { paymentId: string };
    const payment = await prisma.paymentIntent.findUnique({ where: { id: paymentId } });
    if (!payment) return reply.status(404).send({ message: 'Payment not found' });
    const bearer = parseBearerToken(req.headers.authorization as string | undefined);
    if (!isSessionTokenValid(payment.sessionId, bearer)) {
      return reply.status(401).send({ message: 'Invalid session token' });
    }
    return mapPayment(payment);
  });

  // Auth / staff
  app.post('/auth/login', async (req, reply) => {
    const parsed = AuthLoginDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const user = await prisma.staffUser.findFirst({
      where: {
        OR: [
          parsed.data.email ? { email: parsed.data.email } : undefined,
          parsed.data.phone ? { phone: parsed.data.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });
    if (!user || !user.isActive) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    const { refreshToken, expiresAt } = await staffService.createRefreshSession(user.id);
    reply.setCookie(refreshCookieName, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: refreshCookieSecure,
      path: '/auth',
      expires: expiresAt,
    });

    const accessToken = issueAccessToken(user);
    return AuthLoginResponseDto.parse({
      accessToken,
      user: mapStaffUser(user),
    });
  });

  app.post('/auth/refresh', async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[refreshCookieName];
    const session = await staffService.findRefreshSession(token);
    if (!session) {
      reply.clearCookie(refreshCookieName, { path: '/auth' });
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }
    const user = await prisma.staffUser.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) {
      await staffService.revokeRefreshSession(token);
      reply.clearCookie(refreshCookieName, { path: '/auth' });
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }

    await prisma.staffSession.update({ where: { id: session.id }, data: { revokedAt: nowIso() } });
    const { refreshToken, expiresAt } = await staffService.createRefreshSession(user.id);
    reply.setCookie(refreshCookieName, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: refreshCookieSecure,
      path: '/auth',
      expires: expiresAt,
    });

    const accessToken = issueAccessToken(user);
    return AuthRefreshResponseDto.parse({ accessToken, user: mapStaffUser(user) });
  });

  app.post('/auth/logout', async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[refreshCookieName];
    await staffService.revokeRefreshSession(token);
    reply.clearCookie(refreshCookieName, { path: '/auth' });
    return { ok: true };
  });

  app.get('/staff/orders', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN, UserRoleEnum.enum.KITCHEN, UserRoleEnum.enum.WAITER]);
    if (!staff) return;
    const parsed = StaffOrdersQueryDto.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const statusesFilter = parsed.data.status
      ? parsed.data.status.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const orders = await prisma.order.findMany({
      where: {
        venueId: staff.venueId,
        ...(statusesFilter.length ? { status: { in: statusesFilter as any } } : {}),
      },
      include: { items: { include: { modifiers: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const mapped = orders.map((o) => mapOrder(o, o.items));
    return StaffOrdersResponseDto.parse({ orders: mapped });
  });

  app.patch('/staff/orders/:orderId/status', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN, UserRoleEnum.enum.KITCHEN, UserRoleEnum.enum.WAITER]);
    if (!staff) return;
    const { orderId } = req.params as { orderId: string };
    const parsed = StaffOrderStatusPatchDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { modifiers: true } } } });
    if (!order) return reply.status(404).send({ message: 'Order not found' });
    if (order.venueId !== staff.venueId) return reply.status(403).send({ message: 'Forbidden' });

    if (!isOrderTransitionAllowed(staff.role, order.status as any, parsed.data.status)) {
      return reply.status(403).send({ message: 'Transition not allowed for role' });
    }

    const now = nowIso();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: parsed.data.status,
        acceptedAt: parsed.data.status === OrderStatusEnum.enum.ACCEPTED ? now : order.acceptedAt,
        readyAt: parsed.data.status === OrderStatusEnum.enum.READY ? now : order.readyAt,
        servedAt: parsed.data.status === OrderStatusEnum.enum.SERVED ? now : order.servedAt,
        updatedAt: now,
      },
      include: { items: { include: { modifiers: true } } },
    });

    if (io) emitOrderUpdated(io, mapOrder(updated, updated.items));

    return OrderEventDto.parse({ order: mapOrder(updated, updated.items) });
  });

  // Admin: minimal placeholders (menus remain in-memory demo)
  app.get('/admin/menu', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    return menusByVenue.get(demoVenue.slug) ?? menusByVenue.values().next().value;
  });

  app.post('/admin/menu', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const parsed = AdminMenuItemCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const id = uid();
    const item = { id, ...parsed.data };
    adminMenuItems.set(id, item);
    const menu = menusByVenue.get(demoVenue.slug);
    if (!menu) return reply.status(404).send({ message: 'Menu not found' });
    const category = menu.categories.find((c: any) => c.id === parsed.data.categoryId);
    if (!category) return reply.status(400).send({ message: 'Category not found' });
    category.items.push({
      id,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      imageUrl: parsed.data.imageUrl,
      isActive: true,
      isInStock: true,
      sortOrder: category.items.length,
      modifiers: parsed.data.modifiers ?? [],
    });
    menusByVenue.set(menu.venue.slug, menu);
    bumpMenuVersion(menu.venue.slug);
    await emitMenuUpdated(io, menu.venue.slug);
    return { ok: true, item };
  });

  app.patch('/admin/menu/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const parsed = AdminMenuItemUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const existing = adminMenuItems.get(id);
    if (!existing) return reply.status(404).send({ message: 'Menu item not found' });
    const updated = { ...existing, ...parsed.data };
    adminMenuItems.set(id, updated);
    const menu = menusByVenue.get(demoVenue.slug);
    if (!menu) return reply.status(404).send({ message: 'Menu not found' });
    menu.categories.forEach((cat: any) => {
      const idx = cat.items.findIndex((i: any) => i.id === id);
      if (idx >= 0) {
        cat.items[idx] = { ...cat.items[idx], ...parsed.data };
      }
    });
    menusByVenue.set(menu.venue.slug, menu);
    bumpMenuVersion(menu.venue.slug);
    await emitMenuUpdated(io, menu.venue.slug);
    return { ok: true, item: updated };
  });

  app.delete('/admin/menu/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const existing = adminMenuItems.get(id);
    if (!existing) return reply.status(404).send({ message: 'Menu item not found' });
    adminMenuItems.delete(id);
    const menu = menusByVenue.get(demoVenue.slug);
    if (!menu) return reply.status(404).send({ message: 'Menu not found' });
    menu.categories.forEach((cat: any) => {
      cat.items = cat.items.filter((i: any) => i.id !== id);
    });
    menusByVenue.set(menu.venue.slug, menu);
    bumpMenuVersion(menu.venue.slug);
    await emitMenuUpdated(io, menu.venue.slug);
    return { ok: true };
  });

  app.get('/admin/tables', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const tables = await prisma.table.findMany({ where: { venueId: staff.venueId } });
    return { tables };
  });

  app.post('/admin/tables', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const parsed = AdminTableCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const table = await prisma.table.create({
      data: {
        id: parsed.data.code,
        venueId: staff.venueId,
        name: parsed.data.name,
        code: parsed.data.code,
        isActive: parsed.data.isActive,
      },
    });
    return { ok: true, table };
  });

  app.patch('/admin/tables/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const parsed = AdminTableUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const table = await prisma.table.update({ where: { id }, data: parsed.data });
    return { ok: true, table };
  });

  app.delete('/admin/tables/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    await prisma.table.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/admin/staff', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const users = await prisma.staffUser.findMany({ where: { venueId: staff.venueId } });
    return { users: users.map(mapStaffUser) };
  });

  app.post('/admin/staff', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const parsed = StaffCreateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    if (parsed.data.venueId !== staff.venueId) return reply.status(403).send({ message: 'Forbidden' });
    const tempPassword = parsed.data.password ?? generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.staffUser.create({
      data: {
        venueId: staff.venueId,
        role: parsed.data.role,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        passwordHash,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return { user: mapStaffUser(user), tempPassword: parsed.data.password ? undefined : tempPassword };
  });

  app.patch('/admin/staff/:id', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const parsed = StaffUpdateDto.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const existing = await prisma.staffUser.findUnique({ where: { id } });
    if (!existing || existing.venueId !== staff.venueId) return reply.status(404).send({ message: 'Staff not found' });
    const data: any = { ...parsed.data };
    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
    }
    delete data.password;
    if (data.venueId && data.venueId !== staff.venueId) return reply.status(403).send({ message: 'Forbidden' });
    const user = await prisma.staffUser.update({ where: { id }, data });
    return { user: mapStaffUser(user) };
  });

  app.get('/admin/tables/:id/qr', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { id } = req.params as { id: string };
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) return reply.status(404).send({ message: 'Table not found' });
    const venue = await prisma.venue.findUnique({ where: { id: table.venueId } });
    const venueSlug = venue?.slug ?? demoVenue.slug;
    const link = buildTableLink(venueSlug, table.code);
    const qr = await QRCode.toDataURL(link, { margin: 1, scale: 6, errorCorrectionLevel: 'M' });
    return { link, qr };
  });

  app.post('/admin/sessions/:sessionId/close', async (req, reply) => {
    const staff = requireStaffAuth(req, reply, [UserRoleEnum.enum.ADMIN]);
    if (!staff) return;
    const { sessionId } = req.params as { sessionId: string };
    const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    await closeSession(sessionId, 'manual', io);
    return { ok: true, sessionId };
  });

  const server = app.server;
  io = new IOServer(server, { cors: { origin: true } });

  // background inactivity closer & TTL cleanup
  setInterval(async () => {
    try {
      const nowMs = Date.now();
      const inactiveCutoff = new Date(nowMs - SESSION_INACTIVITY_MS);
      const sessions = await prisma.tableSession.findMany({
        where: { status: TableSessionStatusEnum.enum.OPEN, lastActiveAt: { lte: inactiveCutoff } },
        select: { id: true },
      });
      for (const s of sessions) {
        await closeSession(s.id, 'inactive', io);
      }
    } catch (err) {
      handlePrismaError(err, 'inactivity cleanup failed');
    }
  }, 60_000);

  setInterval(async () => {
    try {
      const sessionCutoff = new Date(Date.now() - CLOSED_SESSION_TTL_MS);
      const servedCutoff = new Date(Date.now() - SERVED_ORDER_TTL_MS);

      const closedSessions = await prisma.tableSession.findMany({
        where: { status: TableSessionStatusEnum.enum.CLOSED, closedAt: { lte: sessionCutoff } },
        select: { id: true },
      });
      if (closedSessions.length) {
        const ids = closedSessions.map((s) => s.id);
        await prisma.$transaction([
          prisma.orderItemModifier.deleteMany({ where: { orderItem: { order: { sessionId: { in: ids } } } } }),
          prisma.orderItem.deleteMany({ where: { order: { sessionId: { in: ids } } } }),
          prisma.order.deleteMany({ where: { sessionId: { in: ids } } }),
          prisma.cartItemModifier.deleteMany({ where: { cartItem: { sessionId: { in: ids } } } }),
          prisma.cartItem.deleteMany({ where: { sessionId: { in: ids } } }),
          prisma.paymentIntent.deleteMany({ where: { sessionId: { in: ids } } }),
          prisma.tableSession.deleteMany({ where: { id: { in: ids } } }),
        ]);
        ids.forEach((id) => revokeSessionTokens(id));
      }

      const servedOrders = await prisma.order.findMany({
        where: { status: OrderStatusEnum.enum.SERVED, servedAt: { lte: servedCutoff } },
        select: { id: true },
      });
      if (servedOrders.length) {
        const ids = servedOrders.map((o) => o.id);
        await prisma.$transaction([
          prisma.orderItemModifier.deleteMany({ where: { orderItem: { orderId: { in: ids } } } }),
          prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
          prisma.paymentIntent.deleteMany({ where: { orderId: { in: ids } } }),
          prisma.order.deleteMany({ where: { id: { in: ids } } }),
        ]);
      }
    } catch (err) {
      handlePrismaError(err, 'ttl cleanup failed');
    }
  }, 5 * 60_000);

  io.on('connection', (socket) => {
    socket.on('kitchen.subscribe', (payload) => {
      const parsed = WaiterSubscribeDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const staff = verifyStaffJwt(parsed.data.token);
      if (!staff || staff.venueId !== parsed.data.venueId || ![UserRoleEnum.enum.KITCHEN, UserRoleEnum.enum.ADMIN].includes(staff.role as any)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Forbidden' }));
        return;
      }
      socket.join(buildKitchenRoom(parsed.data.venueId));
    });

    socket.on('waiter.subscribe', (payload) => {
      const parsed = WaiterSubscribeDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const staff = verifyStaffJwt(parsed.data.token);
      if (!staff || staff.venueId !== parsed.data.venueId || ![UserRoleEnum.enum.WAITER, UserRoleEnum.enum.ADMIN].includes(staff.role as any)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Forbidden' }));
        return;
      }
      socket.join(buildWaitersRoom(parsed.data.venueId));
    });

    socket.on('session.join', async (payload) => {
      const parsed = JoinSessionSocketDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId }, include: { table: true } });
      if (!session) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found' }));
        return;
      }
      if (!isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }
      await prisma.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso(), peopleCount: parsed.data.peopleCount ?? undefined } });
      socket.join(buildSessionRoom(session.id));
      const state = await getSessionState(session.id);
      if (state) socket.emit('session.state', SessionStateEventDto.parse(state));
    });

    socket.on('cart.addItem', async (payload) => {
      const parsed = CartAddItemDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId }, include: { table: true } });
      if (!session) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found' }));
        return;
      }
      if (!isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }

      const modsResult = validateModifiers(demoVenue.slug, parsed.data.menuItemId, parsed.data.modifiers ?? []);
      if ('error' in modsResult) {
        socket.emit('error', ErrorEventDto.parse({ code: modsResult.error, message: 'Invalid modifiers' }));
        return;
      }
      const menuItem = findMenuItem(demoVenue.slug, parsed.data.menuItemId);
      if (!menuItem) {
        socket.emit('error', ErrorEventDto.parse({ code: 'OUT_OF_STOCK', message: 'Товар недоступен' }));
        return;
      }

      await prisma.$transaction(async (tx) => {
        const cartItem = await tx.cartItem.create({
          data: {
            id: uid(),
            sessionId: session.id,
            menuItemId: parsed.data.menuItemId,
            qty: parsed.data.qty,
            note: parsed.data.note,
            unitPrice: menuItem.price,
            itemName: menuItem.name,
            addedByDeviceHash: undefined,
          },
        });
        if (modsResult.modifiers.length) {
          await tx.cartItemModifier.createMany({
            data: modsResult.modifiers.map((m) => ({ cartItemId: cartItem.id, optionId: m.optionId, optionName: m.optionName, priceDelta: m.priceDelta })),
          });
        }
        await tx.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso() } });
      });

      const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
      const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
      const totals = calcCartTotals(cart);
      io?.to(buildSessionRoom(session.id)).emit('cart.updated', CartUpdatedEventDto.parse({ cart, totals }));
    });

    socket.on('session.leave', async (payload) => {
      const parsed = SessionLeaveDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session) return;
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
      }
      socket.leave(buildSessionRoom(parsed.data.sessionId));
    });

    socket.on('table.assistanceRequested', async (payload) => {
      const parsed = AssistanceRequestDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId }, include: { table: true } });
      if (!session) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found' }));
        return;
      }
      if (!isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }
      await prisma.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso() } });
      io?.to(buildWaitersRoom(session.venueId)).emit('table.assistanceRequested', {
        sessionId: session.id,
        tableId: session.tableId,
        venueId: session.venueId,
        message: parsed.data.message,
        deviceHash: parsed.data.deviceHash,
      });
    });

    socket.on('cart.updateItemQty', async (payload) => {
      const parsed = CartUpdateItemQtyDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session || !isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: parsed.data.sessionId, reason: 'closed' });
        return;
      }
      const item = await prisma.cartItem.findUnique({ where: { id: parsed.data.cartItemId } });
      if (!item) return;
      if (parsed.data.qty <= 0) {
        await prisma.cartItemModifier.deleteMany({ where: { cartItemId: item.id } });
        await prisma.cartItem.delete({ where: { id: item.id } });
      } else {
        await prisma.cartItem.update({ where: { id: item.id }, data: { qty: parsed.data.qty } });
      }
      await prisma.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso() } });
      const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
      const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
      const totals = calcCartTotals(cart);
      io?.to(buildSessionRoom(parsed.data.sessionId)).emit('cart.updated', CartUpdatedEventDto.parse({ cart, totals }));
    });

    socket.on('cart.removeItem', async (payload) => {
      const parsed = CartRemoveItemDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session || !isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Invalid session token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: parsed.data.sessionId, reason: 'closed' });
        return;
      }
      await prisma.cartItemModifier.deleteMany({ where: { cartItemId: parsed.data.cartItemId } });
      await prisma.cartItem.deleteMany({ where: { id: parsed.data.cartItemId, sessionId: parsed.data.sessionId } });
      await prisma.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso() } });
      const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
      const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
      const totals = calcCartTotals(cart);
      io?.to(buildSessionRoom(parsed.data.sessionId)).emit('cart.updated', CartUpdatedEventDto.parse({ cart, totals }));
    });

    socket.on('order.submit', async (payload) => {
      const parsed = OrderSubmitDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }

      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId }, include: { table: true } });
      if (!session || !isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'UNAUTHORIZED', message: 'Session not found or invalid token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }
      const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
      if (!cartRows.length) {
        socket.emit('error', ErrorEventDto.parse({ code: 'CART_EMPTY', message: 'Cart is empty' }));
        return;
      }
      const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));

      const now = nowIso();
      const numberAgg = await prisma.order.aggregate({
        where: { venueId: session.venueId },
        _max: { number: true },
      });
      const nextNumber = (numberAgg._max.number ?? 0) + 1;

      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: uid(),
            venueId: session.venueId,
            sessionId: session.id,
            tableId: session.tableId,
            status: OrderStatusEnum.enum.NEW,
            number: nextNumber,
            comment: parsed.data.comment,
            createdAt: now,
            updatedAt: now,
          },
        });

        for (const item of cart) {
          const orderItem = await tx.orderItem.create({
            data: {
              id: uid(),
              orderId: created.id,
              menuItemId: item.menuItemId,
              qty: item.qty,
              note: item.note,
              unitPrice: item.unitPrice,
              itemName: item.itemName,
            },
          });
          if (item.modifiers.length) {
            await tx.orderItemModifier.createMany({
              data: item.modifiers.map((m) => ({
                id: uid(),
                orderItemId: orderItem.id,
                optionId: m.optionId,
                optionName: m.optionName,
                priceDelta: m.priceDelta,
              })),
            });
          }
        }

        await tx.cartItemModifier.deleteMany({ where: { cartItem: { sessionId: session.id } } });
        await tx.cartItem.deleteMany({ where: { sessionId: session.id } });
        await tx.tableSession.update({ where: { id: session.id }, data: { lastActiveAt: nowIso() } });

        const fullOrder = await tx.order.findUnique({
          where: { id: created.id },
          include: { items: { include: { modifiers: true } } },
        });
        return fullOrder!;
      });

      const mappedOrder = mapOrder(order, order.items);
      io?.to(buildSessionRoom(session.id)).emit('cart.updated', CartUpdatedEventDto.parse({ cart: [], totals: calcCartTotals([]) }));
      io?.to(buildSessionRoom(session.id)).emit('order.created', OrderEventDto.parse({ order: mappedOrder }));
      io?.to(buildKitchenRoom(session.venueId)).emit('order.created', OrderEventDto.parse({ order: mappedOrder }));
    });

    socket.on('order.markServed', async (payload) => {
      const parsed = OrderMarkServedDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }
      const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId }, include: { items: { include: { modifiers: true } } } });
      if (!order) {
        socket.emit('error', ErrorEventDto.parse({ code: 'ORDER_NOT_FOUND', message: 'Order not found' }));
        return;
      }
      if (order.status !== OrderStatusEnum.enum.READY) {
        socket.emit('error', ErrorEventDto.parse({ code: 'INVALID_STATE', message: 'Order not ready' }));
        return;
      }
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatusEnum.enum.SERVED, servedAt: nowIso(), updatedAt: nowIso() },
        include: { items: { include: { modifiers: true } } },
      });
      emitOrderUpdated(io!, mapOrder(updated, updated.items));
    });

    socket.on('guest.ping', async (payload) => {
      const parsed = GuestPingDto.safeParse(payload);
      if (!parsed.success) return;
      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session || !isSessionTokenValid(session.id, parsed.data.token)) return;
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { lastActiveAt: nowIso() },
      });
    });

    socket.on('payment.create', async (payload) => {
      const parsed = PaymentCreateDto.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', ErrorEventDto.parse({ code: 'VALIDATION', message: 'Invalid payload' }));
        return;
      }

      const session = await prisma.tableSession.findUnique({ where: { id: parsed.data.sessionId } });
      if (!session || !isSessionTokenValid(session.id, parsed.data.token)) {
        socket.emit('error', ErrorEventDto.parse({ code: 'SESSION_NOT_FOUND', message: 'Session not found or invalid token' }));
        return;
      }
      if (session.status === TableSessionStatusEnum.enum.CLOSED) {
        socket.emit('session.closed', { sessionId: session.id, reason: 'closed' });
        return;
      }

      const cartRows = await prisma.cartItem.findMany({ where: { sessionId: session.id }, include: { modifiers: true } });
      const cart = cartRows.map((c) => mapCartItem(c, c.modifiers));
      const orderRow = parsed.data.orderId
        ? await prisma.order.findUnique({ where: { id: parsed.data.orderId }, include: { items: { include: { modifiers: true } } } })
        : undefined;
      const order = orderRow ? mapOrder(orderRow, orderRow.items) : undefined;
      if (parsed.data.orderId && !order) {
        socket.emit('error', ErrorEventDto.parse({ code: 'ORDER_NOT_FOUND', message: 'Order not found' }));
        return;
      }

      const mode = parsed.data.mode ?? 'FULL';
      const outstanding = await computeOutstanding(session.id, mode, { order, cart, items: parsed.data.items });
      if (outstanding <= 0) {
        socket.emit('error', ErrorEventDto.parse({ code: 'NOTHING_TO_PAY', message: 'Nothing to pay' }));
        return;
      }

      let amount = parsed.data.amount ?? 0;
      if (mode === 'ITEMS' && parsed.data.items?.length) {
        const selected = cart.filter((c) => parsed.data.items?.includes(c.id));
        if (!selected.length) {
          socket.emit('error', ErrorEventDto.parse({ code: 'INVALID_ITEMS', message: 'No matching items selected' }));
          return;
        }
        const selectedTotal = calcCartItemsTotal(selected);
        amount = amount || selectedTotal;
        if (amount > selectedTotal) {
          socket.emit('error', ErrorEventDto.parse({ code: 'AMOUNT_EXCEEDS', message: 'Amount exceeds selected total' }));
          return;
        }
      } else if (mode === 'EVEN') {
        const splitCount = parsed.data.splitCount ?? session.peopleCount ?? 1;
        const share = Math.ceil(outstanding / Math.max(splitCount, 1));
        amount = amount || share;
      } else {
        amount = amount || outstanding;
      }

      if (!amount || amount <= 0 || amount > outstanding) {
        socket.emit('error', ErrorEventDto.parse({ code: 'AMOUNT_EXCEEDS', message: 'Invalid amount' }));
        return;
      }

      const now = nowIso();
      const payment = await prisma.paymentIntent.create({
        data: {
          id: uid(),
          venueId: session.venueId,
          sessionId: session.id,
          orderId: parsed.data.orderId,
          amount,
          status: PaymentStatusEnum.enum.CREATED,
          provider: 'mock',
          payload: {
            mode,
            items: parsed.data.items,
            splitCount: parsed.data.splitCount,
            paidByDeviceHash: parsed.data.paidByDeviceHash,
          },
          createdAt: now,
          updatedAt: now,
        },
      });

      const settled = await prisma.paymentIntent.update({
        where: { id: payment.id },
        data: { status: PaymentStatusEnum.enum.PAID, updatedAt: nowIso() },
      });
      emitPaymentUpdated(io!, mapPayment(settled));
    });
  });

  const port = Number(process.env.API_PORT || 4000);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`API listening on http://localhost:${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
