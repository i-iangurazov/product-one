# QR Ordering API Overview

## Base URLs
- HTTP: `http://localhost:4000`
- WS: `http://localhost:4000`

## Auth Models
- **Guest session token**: hex token issued by `/public/sessions/join`; send as `Authorization: Bearer <token>` for session REST; include in socket payloads.
- **Staff access JWT**: short‑lived token from `/auth/login` (or `/auth/refresh`); send as `Authorization: Bearer <token>` for staff/admin REST and in waiter/kitchen socket subscribe payloads.
- **Staff refresh token**: httpOnly cookie `qr_staff_r`; used only by `/auth/refresh` and `/auth/logout`.

## Public (no auth)
- `GET /public/venues/:venueSlug/menu` → `PublicMenuResponse`.
- `POST /public/sessions/join` → body `{ venueSlug, tableCode, deviceHash, peopleCount? }` → `JoinSessionResponse` (includes `token`).

## Public (session token required)
- `GET /public/sessions/:sessionId/state` → `SessionState`.
- `POST /public/sessions/:sessionId/payments` → `PaymentCreateResponse` (mock settles to PAID).
- `GET /public/payments/:paymentId` → `PaymentIntent` (valid session token required).

## Staff Auth
- `POST /auth/login` `{ email?, phone?, password }` → `{ accessToken, user }` + refresh cookie.
- `POST /auth/refresh` (cookie) → `{ accessToken, user }` + rotated refresh cookie.
- `POST /auth/logout` (cookie) → `{ ok: true }` and revokes refresh.

## Staff (Bearer access token)
- `GET /staff/orders?status=READY|...` → `{ orders }` (venue‑scoped).
- `PATCH /staff/orders/:orderId/status` `{ status }` → `OrderEventDto`.

## Admin (Bearer access token, ADMIN role)
- `GET /admin/staff` → `{ users }`.
- `POST /admin/staff` → body `StaffCreateDto` → `{ user, tempPassword? }`.
- `PATCH /admin/staff/:id` → body `StaffUpdateDto` → `{ user }`.
- `GET /admin/tables` → `{ tables }`.
- `POST /admin/tables` → `AdminTableCreateDto` → `{ ok, table }`.
- `PATCH /admin/tables/:id` → partial table → `{ ok, table }`.
- `DELETE /admin/tables/:id` → `{ ok }`.
- `GET /admin/tables/:id/qr` → `{ link, qr }` (qr is data URL).
- Menu admin (demo/in‑memory): `GET/POST/PATCH/DELETE /admin/menu`.
- `POST /admin/sessions/:sessionId/close` → `{ ok, sessionId }`.

## WebSocket Events
- Namespace: root (`io(API_WS)`).
- **Session (guest)**
  - Emit `session.join` `{ sessionId, venueSlug, tableCode, deviceHash, peopleCount?, token }`
  - Emit `cart.addItem|updateItemQty|removeItem`, `order.submit`, `payment.create` (see DTOs).
  - Emit `guest.ping` heartbeat `{ sessionId, deviceHash, token }`
  - Listens: `session.state`, `cart.updated`, `order.created/updated`, `payment.updated`, `session.closed`, `menu.updated`, `error`.
- **Waiter/Kitchen**
  - Emit `waiter.subscribe` or `kitchen.subscribe` `{ venueId, token }` (staff JWT).
  - Receive `order.updated` and `table.assistanceRequested` (waiter).
- **Guest assistance**
  - Guest emits `table.assistanceRequested` `{ sessionId, deviceHash, message?, token }`
  - Server broadcasts to waiters room `table.assistanceRequested`.

## Demo Data
- Demo venue `slug: demo`, seeded menu, tables, and staff users:
  - Emails: `admin@example.com`, `waiter@example.com`, `kitchen@example.com`
  - Password: `changeme`
