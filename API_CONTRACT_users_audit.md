# LOOKit API contract: Users + Audit Log

All endpoints below need `Authorization: Bearer <supabase access token>` unless marked **public**.
Errors always use FastAPI's shape: `{"detail": "message"}` (422 validation errors return `detail` as a list).

Common status codes: 401 invalid/expired token, 403 not admin / deactivated / must change password, 404 not found, 409 duplicate email, 429 rate limited.

Special 403 `detail` strings the frontend should handle:
- `"This account has been deactivated."` -> sign the user out, show a "deactivated" message.
- `"You must change your temporary password before using admin features."` -> show the change-password screen.

---

## Changes to existing responses (additive only)

`GET /api/auth/me` and `GET /api/auth/admin-check`: the `user` object gains two fields.

```json
{ "user": { "id": "uuid", "full_name": "...", "email": "...", "created_at": "...", "role": "admin",
            "is_active": true, "must_change_password": false } }
```

Staff and location endpoints keep their exact request/response shapes.

---

## Users (admin only)

User object (`UserOut`):

```json
{ "id": "uuid", "full_name": "Juan Dela Cruz", "email": "juan@rtu.edu.ph", "role": "user",
  "is_active": true, "created_at": "2026-11-07T01:00:00+00:00",
  "deactivated_at": null, "must_change_password": false }
```

### `GET /api/users?include_inactive=false&q=`
- `include_inactive` default `false`. `q` = case-insensitive substring of name or email.
- Sorted by `full_name` (case-insensitive).
- 200 -> `{ "users": [UserOut, ...] }`

### `POST /api/users`
Body: `{ "full_name": "string (1-200)", "email": "string", "role": "user" | "admin", "password": "string (8-72 chars)" }` (`role` defaults to `"user"`)
- Creates a confirmed Auth user, upserts `public.users`, sets `must_change_password = true`.
- 200 -> `{ "status": "created", "user": UserOut }`
- 409 duplicate email, 400 Auth rejected the account (e.g. weak password), 422 invalid body.

### `PUT /api/users/{id}`
Body (all optional, at least one required): `{ "full_name"?: string, "email"?: string, "role"?: "user" | "admin" }`
- Email and name are kept in sync with Supabase Auth.
- 200 -> `{ "status": "updated", "user": UserOut }` (no-op updates return 200 and are not logged)
- 400 `"You cannot demote your own account."` / `"Cannot demote the last active admin."` / `"No fields provided to update."`
- 404 unknown id, 409 duplicate email.

### `DELETE /api/users/{id}` (soft delete)
- Sets `is_active=false`, records `deactivated_at` / `deactivated_by`, bans the Auth account. Row is never deleted.
- 200 -> `{ "status": "deactivated", "user": UserOut }`
- 400 `"You cannot deactivate your own account."` / `"Cannot deactivate the last active admin."` / `"This user is already deactivated."`
- 404 unknown id.

### `POST /api/users/{id}/reactivate`
- 200 -> `{ "status": "reactivated", "user": UserOut }`
- 400 `"This user is already active."`, 404 unknown id.

---

## Change password (any signed-in user)

### `POST /api/auth/change-password`
Body: `{ "new_password": "string (8-72 chars)" }`
- The backend sets the password and clears `must_change_password`. **The frontend must call this instead of `supabase.auth.updateUser`** so the forced-change flag cannot be skipped.
- 200 -> `{ "status": "password_changed" }`. The current session stays valid.
- 400 Auth rejected the password (`detail` has the reason), 422 length rules.

Frontend flow: after sign-in, call `GET /api/auth/me`; if `user.must_change_password` is true, show a change-password screen and block the rest of the app until `POST /api/auth/change-password` succeeds, then re-fetch `/me`.

---

## Audit log

### `GET /api/audit` (admin only)
Query params (all optional):

| param | notes |
|---|---|
| `q` | substring match on actor email, entity label or entity id |
| `action` | `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `CREATE`, `UPDATE`, `DEACTIVATE`, `REACTIVATE`, `DELETE` |
| `entity_type` | `auth`, `user`, `staff`, `location` |
| `status` | `success` or `failed` |
| `date_from` | ISO date or datetime, inclusive |
| `date_to` | ISO date (covers the whole day) or datetime (inclusive) |
| `limit` | default 50, max 200 |
| `offset` | default 0 |

Dates without a timezone are treated as **UTC**. For "today in Manila" send full datetimes with the offset, e.g. `date_from=2026-11-07T00:00:00+08:00`.
Invalid `action` / `entity_type` / `status` / dates return 400.

200 ->
```json
{ "total": 123,
  "entries": [ {
    "id": 456, "created_at": "2026-11-07T01:23:45.678+00:00",
    "actor_email": "admin@rtu.edu.ph",
    "action": "UPDATE", "entity_type": "staff",
    "entity_id": "1042", "entity_label": "Maria Santos",
    "changes": { "role": { "from": "Instructor", "to": "Professor" } },
    "status": "success", "error_message": null, "ip_address": "203.0.113.5"
  } ] }
```
Newest first. `entity_id` and `ip_address` are extras beyond the minimum list. `changes` is `null` for events without field changes (login, deactivate/reactivate use `{"is_active": {...}}`). Password values are never stored (`"***"` placeholders only).

### `POST /api/audit/login` (any valid token)
Body: none. Call right after a successful Supabase sign-in. 200 -> `{ "status": "logged" }`
(A deactivated user gets the 403 above.)

### `POST /api/audit/logout` (any valid token)
Body: none. Call **before** `supabase.auth.signOut()`. 200 -> `{ "status": "logged" }`

### `POST /api/audit/login-failed` (public)
Body: `{ "email": "string" }`. Call when sign-in fails.
- 200 -> `{ "status": "logged" }` always, whether or not the email has an account.
- 422 invalid email format, 429 more than 10 requests/minute from one IP (also a global cap). Ignore failures from this call in the UI.

---

## What the audit log records (server-side, reliable)

| Endpoint | action / entity_type |
|---|---|
| `POST /api/staff` | CREATE / staff |
| `PUT /api/staff/{n}` | UPDATE / staff (before -> after) |
| `DELETE /api/staff/{n}` | DELETE / staff (snapshot of removed fields) |
| `PUT /api/navigation/locations/{id}` | UPDATE / location (name before -> after) |
| `POST /api/users` | CREATE / user |
| `PUT /api/users/{id}` | UPDATE / user |
| `DELETE /api/users/{id}` | DEACTIVATE / user |
| `POST /api/users/{id}/reactivate` | REACTIVATE / user |
| `POST /api/auth/change-password` | UPDATE / user |

LOGIN / LOGOUT / LOGIN_FAILED are **reported by the frontend**, so they can be skipped or forged by a modified client. Requests rejected by the auth guard itself (401/403 before the endpoint runs) are not logged.
