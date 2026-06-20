-- =====================================================
-- VendorScorePro v0.9.18
-- Bewaartermijnen + AI-governance registratie + contractsamenvatting zoekfix
-- =====================================================

-- Extra AI-governancevelden bij subverwerkers.
alter table public.subprocessors
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

create index if not exists idx_subprocessors_ai_category
  on public.subprocessors(organization_id, supplier_id, ai_category)
  where uses_ai = true;

-- Optionele referentietabel voor bewaartermijnen.
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
on public.retention_reference_items
for select
to authenticated
using (
  organization_id is null
  or organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "retention_reference_manage_org" on public.retention_reference_items;
create policy "retention_reference_manage_org"
on public.retention_reference_items
for all
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid() and role in ('admin','owner')
  )
)
with check (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid() and role in ('admin','owner')
  )
);

insert into public.retention_reference_items (domain, record_type, retention_period, legal_basis, recommendation, is_default)
select * from (
  values
  ('Fiscale administratie','Basisgegevens administratie','7 jaar','Fiscale bewaarplicht / Belastingdienst','Gebruik als minimale termijn voor contract- en facturatiedossiers met fiscale relevantie.', true),
  ('Fiscale administratie','Gegevens over onroerende zaken','10 jaar','Fiscale bewaarplicht / Belastingdienst','Alleen relevant bij vastgoed of onroerende zaken.', true),
  ('AVG / persoonsgegevens','Persoonsgegevens algemeen','Niet langer dan noodzakelijk','AVG opslagbeperking','Leg doel, grondslag, bewaartermijn en verwijdermoment per verwerking vast.', true),
  ('Personeel / identificatie','Kopie identiteitsbewijs werknemer','Minimaal 5 jaar na einde kalenderjaar uitdiensttreding','Identificatieplicht werkgever','Alleen relevant als leverancier HR-/personeelsgegevens verwerkt.', true),
  ('Contractmanagement','Contract, SLA, DPA, offertes, addenda, gespreksverslagen','Beleidsmatig: advies looptijd + 7 jaar','Bewijspositie, accountant/audit en fiscale bewaarplicht','Gebruik als Gilde-werkafspraak voor leveranciersdossiers.', true)
) as v(domain, record_type, retention_period, legal_basis, recommendation, is_default)
where not exists (
  select 1 from public.retention_reference_items r
  where r.organization_id is null
    and r.domain = v.domain
    and r.record_type = v.record_type
);

notify pgrst, 'reload schema';
