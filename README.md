# LOOKit

LOOKit is a campus wayfinding web app for Rizal Technological University, Pasig Campus. It combines an interactive campus map, indoor floor plans with step-by-step directions, a staff directory, and an admin dashboard.

Built with React, Vite, Tailwind CSS, Mapbox GL and Supabase.

## Features

- **Map:** campus overview with building filters (All, M.A.E, CED, CAS, Javier, Canteen) and a 2D/3D toggle.
- **Directions:** search for a room or building and get a route across floors (1F to 6F) with step-by-step guidance.
- **Staff directory:** searchable list of staff and offices, with a map card and "Show path" for each person. Requires login.
- **About:** information about the app.
- **Admin dashboard:** visible only to users whose role is `admin` (see below).

## Admin dashboard

Admins see an **Admin** button in the navigation. The dashboard has five tabs:

| Tab | What it does |
| --- | --- |
<<<<<<< HEAD
| **Map** | Type an office or room in **From** to see it highlighted and pinned on its floor plan. Enter a new name in **To** and press **Apply change** to rename the location. |
| **Directory** | Choose **Update staff**, **Add staff** or **Delete staff**. A live preview of the staff directory sits next to the form, and clicking a card selects that person. |
| **Overview** | Placeholder. |
| **Users** | Placeholder. |
| **Audit Log** | Placeholder. |

Changes are saved to Supabase (`staff_members` and `location`). The public Staff page reads from the same `staff_members` table and falls back to the built-in list in `src/features/staff/data/staffData.js` if the table is empty or fails to load.
=======
| **Overview** | Read-only summary with three panels: a compact campus map, the first staff entries and the list of users. Each panel has a **View** link that opens its full tab. |
| **Map** | Type an office or room in **From** to see it highlighted and pinned on its floor plan. Enter a new name in **To** and press **Apply change** to rename the location. |
| **Directory** | Choose **Update staff**, **Add staff** or **Delete staff**. A live preview of the staff directory sits next to the form, and clicking a card selects that person. |
| **Users** | Choose **Update user**, **Add user** or **Delete user**. The list next to the form is searchable and clicking a card selects that user. **Delete user** deactivates the account (it shows as Inactive and can be reactivated); use **Show inactive** to list inactive users. The backend refuses to deactivate yourself or the last admin and the message is shown in the form. |
| **Audit Log** | Read-only list of recorded actions, newest first, with date and time, who, action, what changed (before → after for updates) and Success/Failed status. Search, filter by action, entity, status and date range, and use **Load more** for older entries. |

Map and Directory changes are saved to Supabase (`staff_members` and `location`). Users and the Audit Log use the FastAPI endpoints `/api/users` and `/api/audit`; the app also reports logins, failed logins and logouts to `/api/audit/*`, and signs out accounts the backend reports as deactivated. The public Staff page reads from the same `staff_members` table and falls back to the built-in list in `src/features/staff/data/staffData.js` if the table is empty or fails to load.
>>>>>>> d6a3a47 (updated user, overview, audit logs)

## Getting started

### Requirements

- Node.js 20 or newer
- A Supabase project
- A Mapbox access token

### Install and run

```bash
npm install
npm run dev
```

Never put a Supabase service-role key in the frontend.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |
| `npm run check:routes` | Validate routing data |

## Supabase setup

### Tables used

- `staff_members`: `employee_number`, `department_id`, `office_location_id`, `first_name`, `last_name`, `role`, `email`
- `departments`: `departmentid`, `name`
- `location`: `locationid`, `floorid`, `name`, `type`, `x_coordinate`, `y_coordinate`, `code`, `label`, `building_code`
- `users`: `id`, `full_name`, `email`, `created_at`, `role` (linked to `auth.users`; `role = 'admin'` grants admin access)

### Row-level security

The admin tabs write directly from the browser, so Supabase must only allow admins to write. `supabase/admin_policies.sql` creates:

- an `is_admin()` helper that checks `public.users.role`
- read access to `staff_members`, `departments` and `location` for signed-in users
- write access to `staff_members`, and update access to `location`, for admins only

Run it once in the Supabase SQL editor, then check **Authentication → Policies**. If an older "allow all" policy exists on any of these tables, drop it, because Supabase allows an action if any policy allows it.

To make someone an admin, set `role = 'admin'` on their row in `public.users`.

## Project structure

```
src/
  features/
    about/        About page
    account/      Account info and logout
    admin/        Admin dashboard (tabs, forms, floor-plan map)
    dashboard/    Home map, top navigation, building filters
    directions/   Route map, floor tabs, step-by-step panel
    login/        Login, registration, auth context
    navigation/   Routing graph, location search, step builder
    search/       Directions search screens
    staff/        Staff directory, Supabase service and hook
  services/       Supabase and API clients
public/data/      Campus, floor and path GeoJSON
supabase/         SQL for row-level security policies
```

## Known limitations

- Room names on the map and in Directions come from the static files in `public/data/`. Renaming a location in the admin dashboard updates the database, but the map shows the new name only after that data is loaded from Supabase.
- The admin Map tab highlights and pins a location only if it can be matched to the campus data by `code` or name.
<<<<<<< HEAD
- Overview, Users and Audit Log are not built yet.
=======
- Login, failed-login and logout reports are sent without waiting for the answer, so a backend outage never blocks signing in or out, but those events are then missing from the Audit Log.
>>>>>>> d6a3a47 (updated user, overview, audit logs)
