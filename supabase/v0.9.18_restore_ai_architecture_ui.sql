-- VendorScorePro v0.9.18 restore AI + Architecture UI support
-- Veilig uit te voeren; gebruikt IF NOT EXISTS waar mogelijk.

-- AI-register centraal
create table if not exists public.ai_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  application_id uuid,
  subprocessor_id uuid,
  name text not null,
  description text,
  ai_use_case text,
  ai_purpose text,
  ai_risk_classification text default 'unknown',
  eu_ai_act_category text,
  risk_reason text,
  ai_model_vendor text,
  ai_model_name text,
  ai_model_version text,
  processes_personal_data boolean default false,
  processes_special_category_data boolean default false,
  automated_decision_making boolean default false,
  human_oversight boolean default true,
  trains_on_customer_data boolean default false,
  transparency_measures text,
  data_location text,
  eu_data_storage boolean,
  retention_period text,
  dpia_required boolean default false,
  dpia_completed boolean default false,
  dpia_notes text,
  dpa_present boolean default false,
  subprocessor_known boolean default false,
  security_documentation_present boolean default false,
  status text default 'concept',
  owner_name text,
  owner_department text,
  review_frequency text default 'jaarlijks',
  last_review_date date,
  next_review_date date,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_register enable row level security;

drop policy if exists "ai_register_select_own_org" on public.ai_register;
create policy "ai_register_select_own_org"
on public.ai_register for select to authenticated
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "ai_register_insert_own_org" on public.ai_register;
create policy "ai_register_insert_own_org"
on public.ai_register for insert to authenticated
with check (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "ai_register_update_own_org" on public.ai_register;
create policy "ai_register_update_own_org"
on public.ai_register for update to authenticated
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
)
with check (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "ai_register_delete_own_org" on public.ai_register;
create policy "ai_register_delete_own_org"
on public.ai_register for delete to authenticated
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

create index if not exists idx_ai_register_org on public.ai_register(organization_id);
create index if not exists idx_ai_register_supplier on public.ai_register(supplier_id);
create index if not exists idx_ai_register_risk on public.ai_register(ai_risk_classification);

-- AI-register mitigerende maatregelen
create table if not exists public.ai_register_mitigations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_register_id uuid references public.ai_register(id) on delete cascade,
  title text not null,
  description text,
  mitigation_type text default 'governance',
  priority text default 'medium',
  status text default 'open',
  due_date date,
  owner_name text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_register_mitigations enable row level security;

drop policy if exists "ai_register_mitigations_select_own_org" on public.ai_register_mitigations;
create policy "ai_register_mitigations_select_own_org"
on public.ai_register_mitigations for select to authenticated
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "ai_register_mitigations_insert_own_org" on public.ai_register_mitigations;
create policy "ai_register_mitigations_insert_own_org"
on public.ai_register_mitigations for insert to authenticated
with check (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "ai_register_mitigations_update_own_org" on public.ai_register_mitigations;
create policy "ai_register_mitigations_update_own_org"
on public.ai_register_mitigations for update to authenticated
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
)
with check (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- AI-velden op subprocessors
alter table public.subprocessors
  add column if not exists ai_risk_classification text,
  add column if not exists ai_category text,
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists ai_use_case text,
  add column if not exists ai_decision_impact text,
  add column if not exists ai_human_in_loop boolean,
  add column if not exists ai_trains_on_customer_data boolean default false,
  add column if not exists ai_processes_personal_data boolean default false,
  add column if not exists ai_automated_decision_making boolean default false,
  add column if not exists ai_data_location text,
  add column if not exists ai_governance_notes text;

create index if not exists idx_subprocessors_ai_risk_classification on public.subprocessors(ai_risk_classification);
create index if not exists idx_subprocessors_uses_ai on public.subprocessors(uses_ai);

-- Documenten blijven linkregistratie; geen opslag van Gilde-documenten in Supabase Storage.
alter table public.supplier_documents
  add column if not exists external_url text,
  add column if not exists storage_mode text default 'link',
  add column if not exists source_system text default 'Teams/SharePoint',
  add column if not exists folder_url text,
  add column if not exists owner_name text,
  add column if not exists sensitivity text;

-- Softwarelandschap verrijking; corrigeert niet de data, maar zorgt dat de frontendvelden bestaan.
alter table public.software_landscape_items
  add column if not exists supplier_id uuid,
  add column if not exists supplier_name text,
  add column if not exists domain text,
  add column if not exists functional_owner text,
  add column if not exists is_crown_jewel boolean default false,
  add column if not exists is_overhead boolean default false,
  add column if not exists overhead_reason text,
  add column if not exists enrichment_status text default 'new';

-- Bewaartermijnen referentie
create table if not exists public.retention_reference_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  domain text not null,
  record_type text not null,
  retention_period text not null,
  legal_basis text,
  recommendation text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.retention_reference_items enable row level security;

drop policy if exists "retention_reference_select" on public.retention_reference_items;
create policy "retention_reference_select"
on public.retention_reference_items for select to authenticated
using (
  organization_id is null
  or organization_id in (select organization_id from public.profiles where id = auth.uid())
);

insert into public.retention_reference_items (domain, record_type, retention_period, legal_basis, recommendation, is_default)
select * from (
  values
  ('Fiscale administratie','Basisgegevens administratie','7 jaar','Fiscale bewaarplicht / Belastingdienst','Gebruik als minimale termijn voor contract- en facturatiedossiers met fiscale relevantie.', true),
  ('AVG / persoonsgegevens','Persoonsgegevens algemeen','Niet langer dan noodzakelijk','AVG opslagbeperking','Leg doel, grondslag, bewaartermijn en verwijdermoment per verwerking vast.', true),
  ('Contractmanagement','Contract, SLA, DPA, offertes, addenda, gespreksverslagen','Beleidsmatig: advies looptijd + 7 jaar','Bewijspositie, accountant/audit en fiscale bewaarplicht','Gebruik als Gilde-werkafspraak voor leveranciersdossiers.', true)
) as v(domain, record_type, retention_period, legal_basis, recommendation, is_default)
where not exists (
  select 1 from public.retention_reference_items r
  where r.organization_id is null and r.domain = v.domain and r.record_type = v.record_type
);

notify pgrst, 'reload schema';
