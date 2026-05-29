-- VendorScorePro v0.9.12
-- Fix: supplier_meetings opslaan/laden/verwijderen met RLS op basis van profiles.organization_id
-- Uitvoeren in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.supplier_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  meeting_date date,
  title text not null,
  participants text,
  summary text,
  notes text,
  follow_up text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_meetings
  add column if not exists organization_id uuid;
alter table public.supplier_meetings
  add column if not exists supplier_id uuid;
alter table public.supplier_meetings
  add column if not exists meeting_date date;
alter table public.supplier_meetings
  add column if not exists title text;
alter table public.supplier_meetings
  add column if not exists participants text;
alter table public.supplier_meetings
  add column if not exists summary text;
alter table public.supplier_meetings
  add column if not exists notes text;
alter table public.supplier_meetings
  add column if not exists follow_up text;
alter table public.supplier_meetings
  add column if not exists created_at timestamptz default now();
alter table public.supplier_meetings
  add column if not exists updated_at timestamptz default now();

create index if not exists supplier_meetings_org_supplier_idx
on public.supplier_meetings (organization_id, supplier_id);

create index if not exists supplier_meetings_date_idx
on public.supplier_meetings (meeting_date desc);

alter table public.supplier_meetings enable row level security;

drop policy if exists "meetings select" on public.supplier_meetings;
drop policy if exists "meetings insert" on public.supplier_meetings;
drop policy if exists "meetings update" on public.supplier_meetings;
drop policy if exists "meetings delete" on public.supplier_meetings;

create policy "meetings select"
on public.supplier_meetings
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "meetings insert"
on public.supplier_meetings
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "meetings update"
on public.supplier_meetings
for update
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "meetings delete"
on public.supplier_meetings
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

notify pgrst, 'reload schema';

-- Controle na uitvoeren:
-- select * from public.supplier_meetings limit 10;
