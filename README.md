# Identity Reconciliation Service

A backend service for Identity Reconciliation task. It links customer contacts across multiple purchases by matching email addresses and phone numbers.

### **BACKEND IS LIVE:** [CLICK HERE](https://identity-reconciliation-production-c447.up.railway.app)

## Tech Stack

- **Node.js** + **Express** — HTTP server
- **TypeScript** — Type safety
- **PostgreSQL** — Database
- **Prisma** — ORM

## Project Structure

```
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── index.ts             # Express server entry point
│   ├── prisma.ts            # Prisma client singleton
│   ├── routes.ts            # API route definitions
│   └── service.ts           # Core identity reconciliation logic
├── .env.example             # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### Prerequisites

- Node.js (v18+)
- PostgreSQL running locally or remotely

### 1. Clone and install dependencies

```bash
git clone https://github.com/anuragparashar26/identity-reconciliation.git
cd identity-reconciliation
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/identity_reconciliation?schema=public"
PORT=3000
```

### 3. Create the database

```bash
createdb identity_reconciliation
```

### 4. Run Prisma migrations

```bash
npx prisma migrate dev --name init
```

This will create the `Contact` table and generate the Prisma client.

### 5. Start the server

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

## API

### `POST /identify`

Links contacts based on email and/or phone number.

**Request Body:**

```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

At least one of `email` or `phoneNumber` must be provided.

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456", "789012"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Example Requests

### Example 1: New contact creation

**Local:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "anurag@example.com", "phoneNumber": "123456"}'
```

**Production:**
```bash
curl -X POST https://identity-reconciliation-production-c447.up.railway.app/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "anurag@example.com", "phoneNumber": "123456"}'
```

Response (first-time contact):

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["anurag@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

### Example 2: Linking with new information

After the contact above exists, a request with the same phone but a new email:

**Local:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "parashar@example.com", "phoneNumber": "123456"}'
```

**Production:**
```bash
curl -X POST https://identity-reconciliation-production-c447.up.railway.app/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "parashar@example.com", "phoneNumber": "123456"}'
```

Response:

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["anurag@example.com", "parashar@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

### Example 3: Primary merge case

Suppose two separate primary contacts exist:

- **id 11** — email: `hello@example.com`, phone: `919191`
- **id 27** — email: `world@example.com`, phone: `717171`

A request linking them:

**Local:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "hello@example.com", "phoneNumber": "717171"}'
```

**Production:**
```bash
curl -X POST https://identity-reconciliation-production-c447.up.railway.app/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "hello@example.com", "phoneNumber": "717171"}'
```

Response:

```json
{
  "contact": {
    "primaryContactId": 11,
    "emails": ["hello@example.com", "world@example.com"],
    "phoneNumbers": ["919191", "717171"],
    "secondaryContactIds": [27]
  }
}
```

Contact 11 remains primary (oldest). Contact 27 becomes secondary with `linkedId: 11`.

## Health Check

**Local:**
```bash
curl http://localhost:3000/
```

**Production:**
```bash
curl https://identity-reconciliation-production-c447.up.railway.app/
```

```json
{ "status": "ok", "message": "Identity Reconciliation Service" }
```
