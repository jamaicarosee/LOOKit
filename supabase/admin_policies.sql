-- OPTIONAL. Review before running in the Supabase SQL editor.
-- The admin tabs write to staff_members and location straight from the browser,
-- so Supabase has to allow it for admins (public.users.role = 'admin') and nobody else.
-- If you already have policies on these tables, adjust instead of duplicating.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

alter table public.staff_members enable row level security;
alter table public.departments   enable row level security;
alter table public.location      enable row level security;

-- Anyone signed in can read (the Staff page needs this)
create policy "staff readable"       on public.staff_members for select to authenticated using (true);
create policy "departments readable" on public.departments   for select to authenticated using (true);
create policy "location readable"    on public.location      for select to authenticated using (true);

-- Only admins can change
create policy "admins manage staff"  on public.staff_members for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins rename places" on public.location      for update to authenticated using (public.is_admin()) with check (public.is_admin());
