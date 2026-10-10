# CourierPro — Server

REST API for the CourierPro logistics platform. Built with Express 5, Prisma 7, PostgreSQL, Redis, and TypeScript.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Language | TypeScript 7 (strict) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL |
| Cache / OTP | Redis 6 |
| Auth | JWT (access + refresh tokens), bcryptjs |
| Email | Nodemailer + EJS templates |
| Payment | bKash payment gateway |
| Validation | Zod 4 |
| Build | tsup |
| Dev server | tsx watch |
| Deploy | Vercel (serverless) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Redis instance
- npm or pnpm

### Install

```bash
npm install
```

### Environment

Create a `.env` file in the project root. All variables are required unless marked optional:

```env
# Server
NODE_ENV=development
PORT=5000

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_USER=default
REDIS_PASSWORD=your_redis_password
REDIS_HOST=your_redis_host
REDIS_PORT=6379

# Email (SMTP)
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
EMAIL_SENDER="CourierPro <noreply@courierpro.com>"

# bKash Payment Gateway
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta
BKASH_USERNAME=your_bkash_username
BKASH_PASSWORD=your_bkash_password
BKASH_APP_KEY=your_bkash_app_key
BKASH_APP_SECRET=your_bkash_app_secret
BKASH_CALLBACK_URL=http://localhost:5000/api/v1/payments/callback

# CORS
FRONTEND_URL=http://localhost:3000
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npx prisma migrate dev
```

### Run

```bash
npm run dev      # development (tsx watch)
npm run build    # compile to dist/
npm run start    # serve compiled build
```

---

## Project Structure

```
src/
├── app.ts                    # Express app setup — parsers, CORS, routes
├── server.ts                 # Entry point — DB + Redis + SMTP connect, listen
└── app/
    ├── config/
    │   └── index.ts          # Environment config
    ├── errors/
    │   └── AppError.ts       # Custom error class
    ├── libs/
    │   ├── prisma.ts         # Prisma client singleton
    │   ├── redis.ts          # Redis client singleton
    │   └── nodemailer.ts     # SMTP transporter
    ├── middlewares/
    │   ├── auth.ts           # JWT auth + role guard middleware
    │   ├── validateRequest.ts # Zod request validation
    │   ├── globalErrorHandler.ts
    │   └── notFoundHandler.ts
    ├── utils/
    │   ├── asyncHandler.ts   # catchAsync wrapper
    │   ├── sendResponse.ts   # Standardised response helper
    │   └── jwtUtils.ts       # createToken / verifyToken
    └── v1/
        ├── routes/
        │   └── index.ts      # Mounts all module routers under /api/v1
        └── modules/
            ├── auth/         # Login, refresh token, logout
            ├── user/         # Register, verify email, profile, password
            ├── hub/          # Hub CRUD, assign manager
            ├── areas/        # Coverage area management
            ├── shipment/     # Shipment lifecycle
            ├── hub-transfer/ # Inter-hub transfer flow
            ├── vehicle/      # Fleet management
            ├── payment/      # bKash payment integration
            └── templates/    # EJS email templates
```

Each module follows a strict layered pattern:

```
module/
├── module.route.ts       # Express router + role guards
├── module.controller.ts  # Request/response handling
├── module.service.ts     # Business logic + DB queries
├── module.validation.ts  # Zod schemas
└── module.interface.ts   # TypeScript types
```

---

## API Reference

Base URL: `http://localhost:5000/api/v1`

All protected routes accept the token via:
- Cookie: `accessToken` (set by server on login/verify)
- Header: `Authorization: Bearer <token>`

### Auth — `/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Login with email + password. Sets `accessToken` + `refreshToken` cookies |
| POST | `/auth/refresh-token` | Cookie | Issue new access token from refresh token |
| POST | `/auth/logout` | Cookie | Clear tokens and invalidate session |

### User — `/user`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/user/register` | — | Register (SENDER or RIDER). Sends OTP to email via Redis |
| POST | `/user/verify-email` | — | Submit OTP to verify email and create account |
| POST | `/user/google` | — | OAuth login / register via Google |
| POST | `/user/forgot-password` | — | Send password reset OTP to email |
| POST | `/user/reset-password` | — | Verify OTP and set new password |
| GET | `/user/me` | ✅ Any | Get own profile with nested `profile` object |
| PATCH | `/user/me` | ✅ Any | Update name, gender, bio, phone, NID, passport |
| POST | `/user/change-password` | ✅ Any | Change password (requires current password) |

### Hubs — `/hubs`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/hubs` | ADMIN, SUPER_ADMIN | Create a new hub |
| GET | `/hubs` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | List hubs (search, pagination) |
| GET | `/hubs/:id` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Get hub by ID with areas and manager |
| PATCH | `/hubs/:id` | ADMIN, SUPER_ADMIN | Update hub name or address |
| PATCH | `/hubs/:id/assign-manager` | ADMIN, SUPER_ADMIN | Assign a HUB_MANAGER user to the hub |
| DELETE | `/hubs/:id` | ADMIN, SUPER_ADMIN | Delete hub (blocked if active shipments exist) |

### Areas — `/areas`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/areas` | ADMIN, SUPER_ADMIN | Create coverage area linked to a hub |
| GET | `/areas` | Public | List areas (search, pagination) |

### Shipments — `/shipments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/shipments` | SENDER, OPS_MANAGER, ADMIN, SUPER_ADMIN | Create a shipment |
| GET | `/shipments/my` | SENDER, OPS_MANAGER, ADMIN, SUPER_ADMIN | Get sender's own shipments |
| GET | `/shipments` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER, RIDER | List all shipments |
| GET | `/shipments/:id` | SENDER, RIDER, HUB_MANAGER, OPS_MANAGER, ADMIN, SUPER_ADMIN | Get shipment by ID |
| PATCH | `/shipments/:id` | SENDER | Edit shipment details (before pickup) |
| PATCH | `/shipments/:id/status` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER, RIDER | Update shipment status |
| PATCH | `/shipments/:id/assign-rider` | ADMIN, SUPER_ADMIN, OPS_MANAGER | Assign a rider to shipment |
| DELETE | `/shipments/:id` | SENDER | Cancel a shipment |

### Hub Transfers — `/hub-transfers`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/hub-transfers` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Initiate transfer between hubs |
| GET | `/hub-transfers` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | List all transfers |
| GET | `/hub-transfers/:id` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Get transfer by ID |
| PATCH | `/hub-transfers/:id/receive` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Confirm receipt at destination hub |

### Vehicles — `/vehicles`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/vehicles` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Add vehicle to fleet |
| GET | `/vehicles` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | List vehicles |
| GET | `/vehicles/:id` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Get vehicle by ID |
| PATCH | `/vehicles/:id` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Update vehicle details or status |
| DELETE | `/vehicles/:id` | ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER | Remove vehicle |

### Payments — `/payments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/payments/bkash/initiate` | SENDER | Initiate bKash payment for a shipment |
| GET | `/payments/callback` | — | bKash redirect callback (no auth) |
| GET | `/payments/bkash/callback` | — | bKash redirect callback (alias) |
| GET | `/payments/:id` | SENDER, HUB_MANAGER, OPS_MANAGER, ADMIN, SUPER_ADMIN | Get payment status |

---

## Standard Response Shape

All endpoints return a consistent envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful.",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

`meta` is only present on paginated list endpoints.

Error responses follow the same shape with `success: false` and relevant `statusCode`.

---

## Authentication Details

**Token flow:**
1. Login / verify email → server sets `accessToken` (1 day) and `refreshToken` (7 days) as httpOnly cookies and also returns them in the response body
2. Subsequent requests send the cookie automatically (or `Authorization: Bearer` header)
3. When the access token expires, call `POST /auth/refresh-token` to get a new one
4. `POST /auth/logout` clears both cookies

**JWT payload:**
```ts
{
  userId: string
  name: string
  email: string
  role: string
  iat: number
  exp: number
}
```

**OTP flow (registration and password reset):**
- OTP is a 6-digit code stored in Redis with a 5-minute TTL
- Registration data is also temporarily stored in Redis until email is verified
- Both keys are deleted from Redis after successful verification

---

## Roles

| Role | Self-register | Description |
|---|---|---|
| `SENDER` | ✅ | Creates and tracks shipments, initiates payments |
| `RIDER` | ✅ | Picks up and delivers shipments |
| `HUB_MANAGER` | ❌ admin only | Manages a single hub, transfers, vehicles |
| `OPS_MANAGER` | ❌ admin only | Platform-wide operations visibility |
| `SUPPORT_AGENT` | ❌ admin only | Customer support tickets |
| `ADMIN` | ❌ admin only | Full platform management |
| `SUPER_ADMIN` | ❌ admin only | All ADMIN permissions + role/permission management |

---

## Data Models

Core Prisma models (split schema files under `prisma/schema/`):

| Model | Description |
|---|---|
| `User` | All platform users with role, status, auth provider |
| `Profile` | Extended user info — bio, phone, NID, passport |
| `Sender` | Sender-specific data linked to User |
| `Rider` | Rider-specific data, earnings, vehicle assignment |
| `Hub` | Distribution hub with manager and coverage areas |
| `Area` | Geographic coverage zone with postal code, linked to Hub |
| `Shipment` | Full shipment lifecycle with status log |
| `HubTransfer` | Tracks shipment movements between hubs |
| `Vehicle` | Fleet vehicles with type and status |
| `Payment` | bKash payment records per shipment |
| `CourierEarning` | Rider earnings per delivered shipment |
| `DeliveryFee` | Fee configuration by delivery type and area |
| `SupportTicket` | Customer support tickets |
| `Notification` | In-app notifications |

Key enums: `Role`, `UserStatus`, `ShipmentStatus`, `PaymentStatus`, `VehicleStatus`, `TransferStatus`, `DeliveryType`, `ShipmentCategory`

---

## Deployment

The project includes a `vercel.json` for Vercel serverless deployment:

```bash
npm run build   # outputs to dist/
```

Then deploy with the Vercel CLI or connect the GitHub repository in the Vercel dashboard. Ensure all environment variables are set in the Vercel project settings.
