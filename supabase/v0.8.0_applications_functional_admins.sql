create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  supplier_id uuid not null,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applications_org on public.applications (organization_id);
create index if not exists idx_applications_supplier on public.applications (supplier_id);
create index if not exists idx_applications_name on public.applications (name);

alter table public.applications enable row level security;

alter table public.applications
  drop constraint if exists applications_org_fk,
  add constraint applications_org_fk
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.applications
  drop constraint if exists applications_supplier_fk,
  add constraint applications_supplier_fk
  foreign key (supplier_id) references public.suppliers(id) on delete cascade;

alter table public.functional_admin_assignments
  add column if not exists application_id uuid;

alter table public.functional_admin_assignments
  drop constraint if exists fa_assignments_application_fk,
  add constraint fa_assignments_application_fk
  foreign key (application_id) references public.applications(id) on delete set null;

drop policy if exists "applications_select_own_org" on public.applications;
create policy "applications_select_own_org"
on public.applications
for select
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "applications_insert_own_org" on public.applications;
create policy "applications_insert_own_org"
on public.applications
for insert
to authenticated
with check (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "applications_update_own_org" on public.applications;
create policy "applications_update_own_org"
on public.applications
for update
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "applications_delete_own_org" on public.applications;
create policy "applications_delete_own_org"
on public.applications
for delete
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();
