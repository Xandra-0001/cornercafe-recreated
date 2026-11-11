# The Corner Cafe backend

## Deployed implementation

- **Runtime:** Vercel Node.js serverless function at `api/[...route].js`.
- **Storage:** private Vercel Blob store `corner-cafe-private-data`, using one JSON state document. Reads bypass CDN caching. Writes use ETag compare-and-swap retries, so concurrent reservation creation and status updates cannot silently overwrite each other.
- **Authentication:** individual owner/staff accounts, salted scrypt password hashes, random session tokens stored as hashes, 12-hour `HttpOnly; SameSite=Lax` cookies, login attempt limiting, and owner-only team administration.
- **Account creation:** There is no public registration or owner-bootstrap endpoint. The existing owner is the only account that can create staff logins, through the authenticated Team access panel. The API always creates new accounts with the `staff` role.

## Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | API and storage readiness |
| `GET` | `/api/availability?date=&partySize=` | Public | Tables available for a date and group size |
| `GET` | `/api/availability?date=&partySize=&tableId=` | Public | Available times for a selected table |
| `POST` | `/api/reservations` | Public | Create a pending reservation |
| `GET` | `/api/reservation-status?reference=` | Public | Return limited request status details |
| `POST` | `/api/admin/auth?action=login` | Public, rate limited | Authenticate and set the session cookie |
| `GET` | `/api/admin/auth?action=session` | Staff | Restore the current staff identity |
| `POST` | `/api/admin/auth?action=logout` | Staff | Revoke session and clear cookie |
| `GET` | `/api/admin/reservations` | Staff | Read shared reservation requests |
| `PATCH` | `/api/admin/reservation?id=` | Staff | Confirm or cancel a request |
| `GET` | `/api/admin/tables` | Staff | Read the seating layout and availability |
| `GET`, `POST` | `/api/admin/users` | Owner | List or create individual staff accounts |
| `PATCH` | `/api/admin/user?id=` | Owner | Deactivate or reactivate an account |

## Operational limits

The current store is a single private JSON document, intended for low-volume cafe use. Conditional updates protect booking conflicts but all writes contend on one document, and the Blob store is not a relational database. Move to Postgres with transactional constraints before relying on the system for high traffic, extensive reporting, formal backup/retention requirements, or multi-location inventory. Vercel Blob usage is billed according to the account's current plan and usage.

The project currently does not send email/SMS confirmations, provide password reset, keep a separate audit log, or automate backups. Reservation requests appear in the staff dashboard, which refreshes every 30 seconds; staff can also refresh manually.
