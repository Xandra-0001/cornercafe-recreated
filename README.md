# The Corner Cafe

Reservation website and serverless backend deployed on Vercel.

## Production

- Website: `https://corner-cafe-booking-redesign.vercel.app`
- Staff sign-in: `/admin/login`
- API status: `/api/health`

## Backend

The Vercel Node.js API is in `api/[...route].js`. Private Vercel Blob storage holds the shared reservation, table, admin, and session state. Passwords use salted scrypt hashes; staff sessions use random, hashed tokens in `HttpOnly` cookies. Requests are checked server-side for party size, table capacity, menu items, dates, and overlapping reservations. Conditional Blob writes prevent two requests from claiming the same table at once.

Guests can check availability, submit a pending request, and look up a request reference. Staff can sign in with individual accounts, review or confirm/cancel requests, and view the seating map. The owner can create and deactivate staff accounts. The staff dashboard refreshes automatically every 30 seconds.

## Create the first owner

There is no public sign-up or owner setup page. The cafe owner signs in with the owner credentials and creates individual staff logins from **Team access** in the dashboard. Only the owner can create or deactivate staff accounts; new accounts receive staff access.

## Local development

`npm run dev` starts the Vite frontend only. To run Vercel API functions and the private Blob integration locally, use the Vercel CLI with the project linked and the development environment pulled:

```sh
npm install
vercel link
vercel env pull .env.local
vercel dev
```

Keep `.env.local` private and never commit it.

## Storage note

This version uses one private JSON document in Blob storage with conditional writes, sized for a small cafe's booking volume. Vercel Blob is usage-based. A relational database is a better fit if the cafe needs higher concurrency, reporting, backups, retention policies, or a large booking history.
