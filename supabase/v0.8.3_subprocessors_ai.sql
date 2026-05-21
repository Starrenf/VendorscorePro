-- v0.8.3 subprocessors + AI governance
create table if not exists public.subprocessors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  supplier_id uuid not null,
  name text not null,
  service text,
  country text,
  processes_personal_data boolean default true,
  uses_ai boolean default false,
  ai_type text,
  risk_level text default 'medium',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subprocessors
  drop constraint if exists subprocessors_org_fk,
  add constraint subprocessors_org_fk
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.subprocessors
  drop constraint if exists subprocessors_supplier_fk,
  add constraint subprocessors_supplier_fk
  foreign key (supplier_id) references public.suppliers(id) on delete cascade;

create index if not exists idx_subprocessors_org
  on public.subprocessors (organization_id);

create index if not exists idx_subprocessors_supplier
  on public.subprocessors (supplier_id);

create index if not exists idx_subprocessors_ai
  on public.subprocessors (uses_ai);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subprocessors_updated_at on public.subprocessors;
create trigger trg_subprocessors_updated_at
before update on public.subprocessors
for each row
execute function public.set_updated_at();

alter table public.subprocessors enable row level security;

drop policy if exists "subprocessors_select_own_org" on public.subprocessors;
create policy "subprocessors_select_own_org"
on public.subprocessors
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "subprocessors_insert_own_org" on public.subprocessors;
create policy "subprocessors_insert_own_org"
on public.subprocessors
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "subprocessors_update_own_org" on public.subprocessors;
create policy "subprocessors_update_own_org"
on public.subprocessors
for update
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "subprocessors_delete_own_org" on public.subprocessors;
create policy "subprocessors_delete_own_org"
on public.subprocessors
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);
