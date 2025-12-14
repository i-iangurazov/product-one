import { z } from 'zod';

export const JoinSessionDto = z.object({
  venueSlug: z.string().min(1),
  tableCode: z.string().min(1),
  deviceHash: z.string().min(6),
  peopleCount: z.number().int().positive().optional(),
});

export type JoinSessionDtoType = z.infer<typeof JoinSessionDto>;

export const JoinSessionSocketDto = JoinSessionDto.extend({
  sessionId: z.string(),
  token: z.string(),
});
export type JoinSessionSocket = z.infer<typeof JoinSessionSocketDto>;

export const UserRoleEnum = z.enum(['ADMIN', 'KITCHEN', 'WAITER']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const TableSessionStatusEnum = z.enum(['OPEN', 'CHECKOUT', 'CLOSED']);
export type TableSessionStatus = z.infer<typeof TableSessionStatusEnum>;

export const OrderStatusEnum = z.enum(['NEW', 'ACCEPTED', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const ORDER_TRANSITIONS: Record<UserRole, Array<{ from: OrderStatus; to: OrderStatus }>> = {
  ADMIN: [
    // full control, mirrors kitchen + waiter plus ability to cancel
    { from: 'NEW', to: 'ACCEPTED' },
    { from: 'ACCEPTED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'READY' },
    { from: 'READY', to: 'SERVED' },
    { from: 'NEW', to: 'CANCELLED' },
    { from: 'ACCEPTED', to: 'CANCELLED' },
    { from: 'IN_PROGRESS', to: 'CANCELLED' },
    { from: 'READY', to: 'CANCELLED' },
  ],
  KITCHEN: [
    { from: 'NEW', to: 'ACCEPTED' },
    { from: 'ACCEPTED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'READY' },
    { from: 'READY', to: 'CANCELLED' },
  ],
  WAITER: [{ from: 'READY', to: 'SERVED' }],
};

export const isOrderTransitionAllowed = (role: UserRole, from: OrderStatus, to: OrderStatus) => {
  if (from === to) return true;
  return ORDER_TRANSITIONS[role]?.some((rule) => rule.from === from && rule.to === to) ?? false;
};

export const PaymentStatusEnum = z.enum(['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const PaymentIntentDto = z.object({
  id: z.string(),
  venueId: z.string(),
  sessionId: z.string(),
  orderId: z.string().optional(),
  amount: z.number().int().nonnegative(),
  status: PaymentStatusEnum,
  provider: z.string(),
  payload: z
    .object({
      mode: z.enum(['FULL', 'EVEN', 'ITEMS']).optional(),
      items: z.array(z.string()).optional(),
      splitCount: z.number().int().positive().optional(),
      paidByDeviceHash: z.string().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentIntent = z.infer<typeof PaymentIntentDto>;

export const PaymentCreateDto = z.object({
  sessionId: z.string(),
  amount: z.number().int().positive().optional(),
  orderId: z.string().optional(),
  mode: z.enum(['FULL', 'EVEN', 'ITEMS']).default('FULL'),
  items: z.array(z.string()).optional(), // for ITEMS mode: cart item IDs
  splitCount: z.number().int().positive().optional(), // for EVEN mode
  paidByDeviceHash: z.string().optional(),
  token: z.string(),
});
export type PaymentCreate = z.infer<typeof PaymentCreateDto>;

export const PaymentCreateResponseDto = z.object({
  payment: PaymentIntentDto,
});
export type PaymentCreateResponse = z.infer<typeof PaymentCreateResponseDto>;

export const PaymentUpdatedEventDto = z.object({
  payment: PaymentIntentDto,
});
export type PaymentUpdatedEvent = z.infer<typeof PaymentUpdatedEventDto>;

export const ModifierSelectionDto = z.object({
  optionId: z.string().min(1),
  optionName: z.string().min(1),
  priceDelta: z.number().int(),
});
export type ModifierSelection = z.infer<typeof ModifierSelectionDto>;

export const CartItemDto = z.object({
  id: z.string(),
  sessionId: z.string(),
  menuItemId: z.string(),
  qty: z.number().int().positive(),
  note: z.string().optional(),
  addedByDeviceHash: z.string().optional(),
  unitPrice: z.number().int(),
  itemName: z.string(),
  modifiers: z.array(ModifierSelectionDto),
});
export type CartItem = z.infer<typeof CartItemDto>;

export const OrderItemModifierDto = ModifierSelectionDto.extend({
  orderItemId: z.string().optional(),
});
export type OrderItemModifier = z.infer<typeof OrderItemModifierDto>;

export const OrderItemDto = z.object({
  id: z.string(),
  orderId: z.string(),
  menuItemId: z.string(),
  qty: z.number().int().positive(),
  note: z.string().optional(),
  unitPrice: z.number().int(),
  itemName: z.string(),
  modifiers: z.array(OrderItemModifierDto),
});
export type OrderItem = z.infer<typeof OrderItemDto>;

export const OrderDto = z.object({
  id: z.string(),
  venueId: z.string(),
  sessionId: z.string(),
  tableId: z.string(),
  status: OrderStatusEnum,
  number: z.number().int().positive(),
  comment: z.string().optional(),
  acceptedAt: z.string().datetime().optional(),
  readyAt: z.string().datetime().optional(),
  servedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(OrderItemDto),
});
export type Order = z.infer<typeof OrderDto>;

export const TableSessionDto = z.object({
  id: z.string(),
  venueId: z.string(),
  tableId: z.string(),
  status: TableSessionStatusEnum,
  peopleCount: z.number().int().positive().optional(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  lastActiveAt: z.string().datetime(),
});
export type TableSession = z.infer<typeof TableSessionDto>;

export const SessionStateDto = z.object({
  session: TableSessionDto,
  cart: z.array(CartItemDto),
  ordersActive: z.array(OrderDto),
  payments: z.array(PaymentIntentDto).default([]),
  menuVersion: z.string().optional(),
});
export type SessionState = z.infer<typeof SessionStateDto>;

export const SessionStateWithTokenDto = SessionStateDto.extend({
  sessionId: z.string(),
  token: z.string(),
});
export type SessionStateWithToken = z.infer<typeof SessionStateWithTokenDto>;

export const CartTotalsDto = z.object({
  subtotal: z.number().int(),
  total: z.number().int(),
  itemCount: z.number().int(),
});
export type CartTotals = z.infer<typeof CartTotalsDto>;

// Socket: client -> server
export const CartAddItemDto = z.object({
  sessionId: z.string(),
  menuItemId: z.string(),
  qty: z.number().int().positive(),
  modifiers: z.array(ModifierSelectionDto).default([]),
  note: z.string().optional(),
  token: z.string(),
});
export type CartAddItem = z.infer<typeof CartAddItemDto>;

export const CartUpdateItemQtyDto = z.object({
  sessionId: z.string(),
  cartItemId: z.string(),
  qty: z.number().int().nonnegative(),
  token: z.string(),
});
export type CartUpdateItemQty = z.infer<typeof CartUpdateItemQtyDto>;

export const CartRemoveItemDto = z.object({
  sessionId: z.string(),
  cartItemId: z.string(),
  token: z.string(),
});
export type CartRemoveItem = z.infer<typeof CartRemoveItemDto>;

export const OrderSubmitDto = z.object({
  sessionId: z.string(),
  clientOrderKey: z.string().uuid(),
  comment: z.string().optional(),
  token: z.string(),
});
export type OrderSubmit = z.infer<typeof OrderSubmitDto>;

export const OrderMarkServedDto = z.object({
  orderId: z.string(),
});
export type OrderMarkServed = z.infer<typeof OrderMarkServedDto>;

export const GuestPingDto = z.object({
  sessionId: z.string(),
  deviceHash: z.string(),
  token: z.string(),
});
export type GuestPing = z.infer<typeof GuestPingDto>;

export const SessionLeaveDto = z.object({
  sessionId: z.string(),
  deviceHash: z.string().optional(),
  reason: z.string().optional(),
  token: z.string(),
});
export type SessionLeave = z.infer<typeof SessionLeaveDto>;

export const AssistanceRequestDto = z.object({
  sessionId: z.string(),
  deviceHash: z.string().optional(),
  message: z.string().optional(),
  token: z.string(),
});
export type AssistanceRequest = z.infer<typeof AssistanceRequestDto>;

export const WaiterSubscribeDto = z.object({
  venueId: z.string(),
  token: z.string(),
});
export type WaiterSubscribe = z.infer<typeof WaiterSubscribeDto>;

// Socket: server -> client
export const CartUpdatedEventDto = z.object({
  cart: z.array(CartItemDto),
  totals: CartTotalsDto,
});
export type CartUpdatedEvent = z.infer<typeof CartUpdatedEventDto>;

export const SessionStateEventDto = SessionStateDto;
export type SessionStateEvent = z.infer<typeof SessionStateEventDto>;

export const OrderEventDto = z.object({
  order: OrderDto,
});
export type OrderEvent = z.infer<typeof OrderEventDto>;

export const MenuUpdatedEventDto = z.object({
  version: z.string(),
});
export type MenuUpdatedEvent = z.infer<typeof MenuUpdatedEventDto>;

export const ErrorEventDto = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorEvent = z.infer<typeof ErrorEventDto>;

// REST: public
export const MenuModifierOptionDto = z.object({
  id: z.string(),
  name: z.string(),
  priceDelta: z.number().int(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type MenuModifierOption = z.infer<typeof MenuModifierOptionDto>;

export const MenuModifierGroupDto = z.object({
  id: z.string(),
  name: z.string(),
  isRequired: z.boolean().default(false),
  minSelect: z.number().int().default(0),
  maxSelect: z.number().int().default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(MenuModifierOptionDto),
});
export type MenuModifierGroup = z.infer<typeof MenuModifierGroupDto>;

export const MenuItemDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  price: z.number().int(),
  isActive: z.boolean().default(true),
  isInStock: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  modifiers: z.array(MenuModifierGroupDto),
});
export type MenuItem = z.infer<typeof MenuItemDto>;

export const MenuCategoryDto = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int().default(0),
  items: z.array(MenuItemDto),
});
export type MenuCategory = z.infer<typeof MenuCategoryDto>;

export const PublicMenuResponseDto = z.object({
  venue: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    currency: z.string(),
    timezone: z.string(),
  }),
  categories: z.array(MenuCategoryDto),
});
export type PublicMenuResponse = z.infer<typeof PublicMenuResponseDto>;

export const PublicSessionStateResponseDto = SessionStateDto;
export type PublicSessionStateResponse = z.infer<typeof PublicSessionStateResponseDto>;

export const JoinSessionResponseDto = SessionStateWithTokenDto;
export type JoinSessionResponse = z.infer<typeof JoinSessionResponseDto>;

// REST: staff
export const AuthLoginDto = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    password: z.string().min(6),
    role: UserRoleEnum.optional(),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone required' });
export type AuthLogin = z.infer<typeof AuthLoginDto>;

export const StaffUserDto = z.object({
  id: z.string(),
  venueId: z.string(),
  role: UserRoleEnum,
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});
export type StaffUser = z.infer<typeof StaffUserDto>;

export const AuthLoginResponseDto = z.object({
  accessToken: z.string(),
  user: StaffUserDto,
});
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseDto>;

export const AuthRefreshResponseDto = z.object({
  accessToken: z.string(),
  user: StaffUserDto,
});
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseDto>;

export const StaffOrdersQueryDto = z.object({
  status: z.string().optional(),
});
export type StaffOrdersQuery = z.infer<typeof StaffOrdersQueryDto>;

export const StaffOrdersResponseDto = z.object({
  orders: z.array(OrderDto),
});
export type StaffOrdersResponse = z.infer<typeof StaffOrdersResponseDto>;

export const StaffOrderStatusPatchDto = z.object({
  status: OrderStatusEnum,
});
export type StaffOrderStatusPatch = z.infer<typeof StaffOrderStatusPatchDto>;

// REST: admin
export const StaffCreateDto = z
  .object({
    venueId: z.string(),
    role: UserRoleEnum,
    name: z.string(),
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone required' });
export type StaffCreate = z.infer<typeof StaffCreateDto>;

export const StaffUpdateDto = StaffCreateDto.partial();
export type StaffUpdate = z.infer<typeof StaffUpdateDto>;

export const AdminTableDto = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  isActive: z.boolean().default(true),
});
export type AdminTable = z.infer<typeof AdminTableDto>;

export const AdminTableCreateDto = z.object({
  name: z.string(),
  code: z.string(),
  isActive: z.boolean().default(true),
});
export type AdminTableCreate = z.infer<typeof AdminTableCreateDto>;

export const AdminMenuItemCreateDto = z.object({
  categoryId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().int(),
  imageUrl: z.string().url().optional(),
  modifiers: z.array(MenuModifierGroupDto).default([]),
});
export type AdminMenuItemCreate = z.infer<typeof AdminMenuItemCreateDto>;

export const AdminMenuItemUpdateDto = AdminMenuItemCreateDto.partial();
export type AdminMenuItemUpdate = z.infer<typeof AdminMenuItemUpdateDto>;

export const AdminTableUpdateDto = AdminTableCreateDto.partial();
export type AdminTableUpdate = z.infer<typeof AdminTableUpdateDto>;
