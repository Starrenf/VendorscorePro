-- =====================================================
-- VendorScorePro v0.9.14
-- Applicatie contractsamenvattingen + RLS + full-text search
-- =====================================================

create table if not exists public.application_contract_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  summary_text text not null default '',
  version text not null default '1.0',
  source_file text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(summary_text, '') || ' ' || coalesce(source_file, '') || ' ' || coalesce(version, ''))
  ) stored
);

create unique index if not exists application_contract_summaries_app_unique
  on public.application_contract_summaries (organization_id, supplier_id, application_id);

create index if not exists idx_application_contract_summaries_org
  on public.application_contract_summaries (organization_id);

create index if not exists idx_application_contract_summaries_supplier
  on public.application_contract_summaries (supplier_id);

create index if not exists idx_application_contract_summaries_application
  on public.application_contract_summaries (application_id);

create index if not exists idx_application_contract_summaries_search
  on public.application_contract_summaries using gin (search_vector);

alter table public.application_contract_summaries enable row level security;

drop policy if exists "application_contract_summaries_select_own_org" on public.application_contract_summaries;
create policy "application_contract_summaries_select_own_org"
on public.application_contract_summaries
for select
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "application_contract_summaries_insert_own_org" on public.application_contract_summaries;
create policy "application_contract_summaries_insert_own_org"
on public.application_contract_summaries
for insert
to authenticated
with check (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "application_contract_summaries_update_own_org" on public.application_contract_summaries;
create policy "application_contract_summaries_update_own_org"
on public.application_contract_summaries
for update
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
)
with check (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "application_contract_summaries_delete_own_org" on public.application_contract_summaries;
create policy "application_contract_summaries_delete_own_org"
on public.application_contract_summaries
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

drop trigger if exists trg_application_contract_summaries_updated_at on public.application_contract_summaries;
create trigger trg_application_contract_summaries_updated_at
before update on public.application_contract_summaries
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
