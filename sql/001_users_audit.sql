-- =====================================================================
-- LOOKit migration 001: Users management + Audit log
-- Run ONCE in the Supabase SQL Editor, BEFORE deploying the new backend
-- code (the backend now selects is_active / must_change_password).
-- Safe to re-run: everything is idempotent.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. public.users: soft-delete + forced password change columns
-- ---------------------------------------------------------------------
alter table public.users
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid,
  add column if not exists must_change_password boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. public.audit_log
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  actor_id      uuid,
  actor_email   text,
  action        text not null
                check (action in ('LOGIN','LOGIN_FAILED','LOGOUT','CREATE','UPDATE','DEACTIVATE','REACTIVATE','DELETE')),
  entity_type   text not null
                check (entity_type in ('auth','user','staff','location')),
  entity_id     text,
  entity_label  text,
  changes       jsonb,
  status        text not null default 'success'
                check (status in ('success','failed')),
  error_message text,
  ip_address    text
);

create index if not exists audit_log_created_at_idx  on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx      on public.audit_log (action);
create index if not exists audit_log_entity_type_idx on public.audit_log (entity_type);
create index if not exists audit_log_status_idx      on public.audit_log (status);

-- ---------------------------------------------------------------------
-- 3. Lock the table down: RLS on, NO policies. Only the service-role
--    backend (which bypasses RLS) can read or write it.
-- ---------------------------------------------------------------------
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Append-only: block UPDATE / DELETE / TRUNCATE for everyone,
--    including the service role.
--    (To purge old rows later, drop the two triggers, delete, re-create.)
-- ---------------------------------------------------------------------
create or replace function public.audit_log_block_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists audit_log_no_update_delete on public.audit_log;
create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_block_mutation();

drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_block_mutation();

commit;

-- ---------------------------------------------------------------------
-- Optional checks (run separately)
-- ---------------------------------------------------------------------
-- Is there already a trigger creating public.users rows on sign-up?
--   select tgname from pg_trigger
--   where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- Append-only test (should fail with "audit_log is append-only"):
--   insert into public.audit_log (action, entity_type) values ('LOGIN','auth');
--   update public.audit_log set status = 'failed' where id = (select max(id) from public.audit_log);
