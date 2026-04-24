# AVM Backend (Express + MongoDB + Nodemailer)

A standalone Node.js backend for the APPLICATION Validity Manager frontend.

## What's inside

- **Express** REST API
- **MongoDB / Mongoose** for users, OTPs, and applications
- **JWT** auth (Bearer tokens)
- **Nodemailer + Gmail** for sending OTP emails and contact-form messages
- **Zod** for input validation

## Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Required:
   - `MONGODB_URI` — your MongoDB connection string
   - `GMAIL_USER` — the Gmail address that will send mail
   - `GMAIL_APP_PASSWORD` — a Gmail App Password (16 chars, dashes optional)
   - `JWT_SECRET` — any long random string

3. Run in dev mode:
   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:4000`.

## Wire the frontend to this backend

In the **frontend** project root, create a `.env` file with:

```
VITE_API_URL=http://localhost:4000
```

Then restart the frontend dev server.

## Endpoints

### Auth
- `POST /api/auth/register/start` — `{ name, email, password }` → emails OTP
- `POST /api/auth/register/verify` — `{ email, code }` → `{ token, user }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `POST /api/auth/forgot/start` — `{ email }` → emails OTP
- `POST /api/auth/forgot/verify` — `{ email, code, password }` → `{ ok: true }`

### Profile (requires `Authorization: Bearer <token>`)
- `GET  /api/profile/me`
- `POST /api/profile/email/start` — `{ newEmail }` → emails OTP
- `POST /api/profile/email/verify` — `{ newEmail, code }`
- `POST /api/profile/password` — `{ current, next }`

### Applications (requires Bearer token unless noted)
- `GET    /api/applications`
- `POST   /api/applications` — `{ name, description, expiryDate }`
- `PATCH  /api/applications/:id` — partial update
- `DELETE /api/applications/:id`

### Public
- `GET  /api/public/applications/:id` — public read-only endpoint used by the
  validity badge on `/api/bot/:id` in the frontend
- `POST /api/contact` — `{ name, email, message }` → emails the contact form
