-- =====================================================================
-- LOOKit migration 002: split staff names into Status / First / M.I. / Last
-- Run ONCE in the Supabase SQL Editor, BEFORE deploying the new backend
-- and admin code. Safe to re-run (only touches rows where title and
-- middle_initial are both still empty).
--
-- Existing data stores everything in first_name, e.g.
--   first_name = 'Instr. Maria Helen R.'   last_name = 'Gunda'
-- This turns it into
--   title = 'Instr.'  first_name = 'Maria Helen'  middle_initial = 'R.'  last_name = 'Gunda'
-- Suffixes such as ', CPA' or 'Jr.' stay inside last_name (unchanged).
-- =====================================================================

begin;

alter table public.staff_members
  add column if not exists title text,
  add column if not exists middle_initial text;

-- STEP A (optional): preview what will change, BEFORE running step B.
-- select employee_number, first_name, last_name,
--        (regexp_match(btrim(first_name), '^(Asst\. Prof\.|Assoc\. Prof\.|Prof\.|Instr\.|Dr\.|Atty\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+', 'i'))[1] as title,
--        (regexp_match(regexp_replace(btrim(first_name), '^(Asst\. Prof\.|Assoc\. Prof\.|Prof\.|Instr\.|Dr\.|Atty\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+', '', 'i'), '^(.+?)\s+([A-Za-z]\.?)$'))[2] as middle_initial
-- from public.staff_members order by employee_number;

-- STEP B: backfill
with step1 as (
  select
    employee_number,
    (regexp_match(btrim(first_name),
      '^(Asst\. Prof\.|Assoc\. Prof\.|Prof\.|Instr\.|Dr\.|Atty\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+', 'i'))[1] as t,
    regexp_replace(btrim(first_name),
      '^(Asst\. Prof\.|Assoc\. Prof\.|Prof\.|Instr\.|Dr\.|Atty\.|Engr\.|Mr\.|Ms\.|Mrs\.)\s+', '', 'i') as rest
  from public.staff_members
  where title is null and middle_initial is null
),
step2 as (
  select
    employee_number,
    t,
    coalesce((regexp_match(rest, '^(.+?)\s+([A-Za-z]\.?)$'))[1], rest) as fn,
    (regexp_match(rest, '^(.+?)\s+([A-Za-z]\.?)$'))[2] as mi
  from step1
)
update public.staff_members s
set title          = step2.t,
    first_name     = step2.fn,
    middle_initial = case when step2.mi is null then null
                          when length(step2.mi) = 1 then upper(step2.mi) || '.'
                          else upper(left(step2.mi, 1)) || '.' end
from step2
where s.employee_number = step2.employee_number;

commit;

-- After running, review in the admin Directory: anything with an unusual
-- name (two initials, nicknames, suffix in the first name) can be fixed there.
