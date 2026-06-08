# Wallet Backend Service

NestJS REST API for customer wallets — PostgreSQL, TypeORM, JWT auth, pessimistic row locking on balance updates.

## Setup

**Prerequisites:** Node.js 20+, PostgreSQL 14+, Yarn 1.22+

```bash
cp .env.example .env                          # configure DB_* and JWT_SECRET
psql -U postgres -d postgres -f scripts/setup-db.sql
yarn install
yarn migration:run
yarn build
yarn start:prod
```

Or run `./scripts/setup.sh` then `yarn start:prod` (script does env, DB bootstrap, install, migrate, build).

- API: http://localhost:3000  
- Swagger: http://localhost:3000/swagger  
- Tests: `yarn test` (stop the server first; needs PostgreSQL from `.env`)

## API examples

No Postman collection — use Swagger UI or the curls below.

```bash
# Register & login
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"SecurePass123!","name":"Alice"}'

curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"SecurePass123!"}'
# → set ACCESS_TOKEN from response

export ACCESS_TOKEN="<accessToken>"

# Wallet & token
curl -s -X POST http://localhost:3000/wallets -H "Authorization: Bearer $ACCESS_TOKEN"
curl -s -X POST http://localhost:3000/wallets/tokens -H "Authorization: Bearer $ACCESS_TOKEN"
# → set WALLET_TOKEN from response

export WALLET_TOKEN="<token>"

# Deposit, withdraw, history
curl -s -X POST http://localhost:3000/wallets/deposit \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"walletToken\":\"$WALLET_TOKEN\",\"amount\":100.50}"

curl -s -X POST http://localhost:3000/wallets/withdraw \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"walletToken\":\"$WALLET_TOKEN\",\"amount\":25.00}"

curl -s "http://localhost:3000/wallets/transactions?walletToken=$WALLET_TOKEN&page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Responses: success `{ "success": true, "data": {} }` · error `{ "success": false, "message": "...", "errorCode": "..." }`

## Implementation notes

- **Layers:** `Controller → Service → Repository`. Business rules and transactions in services; TypeORM queries only in repositories.
- **PostgreSQL:** Chosen for ACID transactions, `SELECT FOR UPDATE`, triggers, and `decimal` columns — fits the ~1M wallet scale on a single instance.
- **Schema:** `customers` → `wallets` (one per customer, balance `0.00` at creation) → `wallet_tokens` (max 3 active) → `transactions` ledger. Migrations in `src/database/migrations/`.
- **Auth:** JWT identifies the customer; deposit/withdraw/history also require a `walletToken` so operations are tied to a specific credential.
- **Balance safety:** Deposits and withdrawals run in a DB transaction with pessimistic row lock on the wallet. Amounts use `decimal.js` / `decimal(18,2)` to avoid float errors.
- **Token limit:** Enforced in the service and by a PostgreSQL trigger on `wallet_tokens`.
- **Failed withdrawals:** Recorded in the ledger with `FAILED` status; balance unchanged.
- **Assumptions:** Single currency, single region, no idempotency keys, rate limiting in-memory (disabled when `NODE_ENV=test`).

## Tooling

| Tool | Why | Experience |
|------|-----|------------|
| **NestJS** | Structure, DI, guards, validation, less boilerplate | Comfortable — used in backend projects |
| **TypeScript** | Type safety for money and API contracts | Strong |
| **PostgreSQL** | ACID, row locking, triggers | Comfortable — primary SQL DB |
| **TypeORM** | Entities, migrations, transaction API | Familiar — used with NestJS |
| **Passport JWT** | Standard bearer-token auth | Familiar |
| **class-validator** | Request DTO validation | Comfortable |
| **decimal.js** | Exact decimal arithmetic for money | Used as needed |
| **Swagger** | Interactive API docs instead of Postman | Familiar |
| **Jest + Supertest** | Unit and e2e tests | Comfortable |

Package manager: Yarn Classic (`yarn.lock` included).

## Limitations & future work

**Current limitations**

- In-memory rate limiting — not suitable for multiple instances
- No idempotency keys on deposit/withdraw
- Domain events emitted but no listeners yet
- No token revoke/rotate endpoints
- JWT in header only; no admin API

**With more time**

- Idempotency keys for deposit/withdraw
- Token revoke/rotate
- Event outbox or audit listener (e.g. RabbitMQ)
- Health endpoints (`/health`, `/health/ready`)
- Redis-backed rate limiting
- OpenTelemetry tracing
