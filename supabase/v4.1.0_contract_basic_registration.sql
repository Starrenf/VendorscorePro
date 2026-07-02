-- Governix v4.1.0 - Contract Basisregistratie MVP
-- Doel: laagdrempelige contractregistratie voor Contractmanager Lijn.
-- Geen documentupload, geen zware workflow. Alleen basisvelden, reviewdatum en besluitmoment.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists is_contract_manager boolean default false,
  add column if not exists contract_workspace_enabled boolean default false;

create table if not exists public.contract_basic_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  contract_title text not null,
  service_name text,
  contract_manager_profile_id uuid references public.profiles(id),
  contract_owner_profile_id uuid references public.profiles(id),
  organizational_unit text,
  start_date date,
  end_date date,
  notice_period_months integer default 3,
  auto_renewal boolean default false,
  renewal_period_months integer,
  annual_amount numeric default 0,
  total_contract_value numeric default 0,
  cost_center text,
  indexation boolean default false,
  review_date date,
  decision_due_date date,
  status text default 'concept',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_basic_registrations_org_idx
  on public.contract_basic_registrations (organization_id);

create index if not exists contract_basic_registrations_manager_idx
  on public.contract_basic_registrations (contract_manager_profile_id);

create index if not exists contract_basic_registrations_review_idx
  on public.contract_basic_registrations (organization_id, review_date);

create or replace function public.set_contract_basic_registration_dates()
returns trigger
language plpgsql
as $$
begin
  if new.review_date is null and new.end_date is not null then
    new.review_date := (new.end_date - interval '12 months')::date;
  end if;

  if new.decision_due_date is null and new.end_date is not null then
    new.decision_due_date := (new.end_date - interval '6 months')::date;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_contract_basic_registration_dates
on public.contract_basic_registrations;

create trigger trg_set_contract_basic_registration_dates
before insert or update
on public.contract_basic_registrations
for each row
execute function public.set_contract_basic_registration_dates();

create or replace view public.v_contractmanager_contracts as
select
  c.*,
  coalesce(s.display_name, s.name) as supplier_name,
  cm.display_name as contract_manager_name,
  co.display_name as contract_owner_name,
  case
    when c.review_date is not null and c.review_date <= current_date then 'review_overdue'
    when c.decision_due_date is not null and c.decision_due_date <= current_date + interval '30 days' then 'decision_due'
    when c.end_date is not null and c.end_date <= current_date + interval '180 days' then 'ending_soon'
    when c.review_date is not null and c.review_date <= current_date + interval '30 days' then 'review_soon'
    else 'ok'
  end as attention_status
from public.contract_basic_registrations c
left join public.suppliers s on s.id = c.supplier_id
left join public.profiles cm on cm.id = c.contract_manager_profile_id
left join public.profiles co on co.id = c.contract_owner_profile_id;

notify pgrst, 'reload schema';
