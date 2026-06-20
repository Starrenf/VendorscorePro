-- VendorScorePro v0.9.75 - Supplier, Contract & Asset Foundation UI
-- Doel: frontendvelden ondersteunen voor multi-discipline contracten, leverancierverrijking en assetfundament.

-- 1. Leveranciersverrijking / bedrijfsgegevens
alter table public.suppliers
add column if not exists legal_name text,
add column if not exists website text,
add column if not exists visiting_address text,
add column if not exists postal_code text,
add column if not exists city text,
add column if not exists country text default 'Nederland',
add column if not exists vat_number text,
add column if not exists iban text,
add column if not exists invoice_address text,
add column if not exists billing_email text,
add column if not exists finance_email text,
add column if not exists enrichment_status text,
add column if not exists enrichment_notes text,
add column if not exists enrichment_updated_at timestamptz;

-- 2. Contracten per discipline
alter table public.supplier_contracts
add column if not exists discipline text,
add column if not exists subdiscipline text,
add column if not exists building_id uuid references public.buildings(id) on delete set null,
add column if not exists asset_id uuid references public.assets(id) on delete set null;

create index if not exists idx_supplier_contracts_discipline
on public.supplier_contracts(organization_id, discipline);

-- 3. Asset/hoofdaannemer work packages - veilig aanmaken indien nog niet aanwezig
create table if not exists public.supplier_work_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  main_supplier_id uuid references public.suppliers(id) on delete set null,
  subcontractor_supplier_id uuid references public.suppliers(id) on delete set null,
  source_code text,
  source_description text,
  work_package_name text,
  contract_wish text,
  domain text default 'Vastgoed & Gebouwen',
  category text,
  amount_excl_vat numeric,
  split_candidate boolean default true,
  status text default 'Te beoordelen',
  source_file text,
  source_sheet text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_supplier_work_packages_main_supplier
on public.supplier_work_packages(organization_id, main_supplier_id);

create index if not exists idx_supplier_work_packages_subcontractor
on public.supplier_work_packages(organization_id, subcontractor_supplier_id);

-- 4. RLS basis: organisatieleden mogen lezen; admins mogen beheren.
alter table public.supplier_work_packages enable row level security;

drop policy if exists "supplier_work_packages_select_own_org" on public.supplier_work_packages;
drop policy if exists "supplier_work_packages_manage_admin" on public.supplier_work_packages;

create policy "supplier_work_packages_select_own_org"
on public.supplier_work_packages
for select
to authenticated
using (
  organization_id in (
    select organization_id from public.org_memberships where user_id = auth.uid()
  )
);

create policy "supplier_work_packages_manage_admin"
on public.supplier_work_packages
for all
to authenticated
using (
  exists (
    select 1 from public.org_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = supplier_work_packages.organization_id
      and lower(om.role) in ('admin', 'super admin', 'organisatiebeheerder')
  )
)
with check (
  exists (
    select 1 from public.org_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = supplier_work_packages.organization_id
      and lower(om.role) in ('admin', 'super admin', 'organisatiebeheerder')
  )
);

grant select, insert, update, delete on public.supplier_work_packages to authenticated;

notify pgrst, 'reload schema';
