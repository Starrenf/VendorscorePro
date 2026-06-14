-- v0.9.67 - AI-register en subverwerkers scheiden
-- Doel:
-- - AI-governance hoort uitsluitend in public.ai_register.
-- - public.subprocessors blijft bedoeld voor subverwerkerinformatie en een indicatie of AI wordt gebruikt.
-- - Oude AI-analyseblokken in subprocessors.notes worden opgeschoond, zodat ze niet meer als AI-registerdata aanvoelen.

-- 1) Preview: bekijk eerst welke legacy AI-notities worden geraakt.
-- select id, supplier_id, name, service, uses_ai, risk_level, left(notes, 180) as notes_preview
-- from public.subprocessors
-- where notes ilike '%AI-toepassingen%'
--    or notes ilike '%AI-governance%'
--    or notes ilike '%AI-risicoanalyse%';

-- 2) Schoon oude AI-analyses op uit het vrije notitieveld.
update public.subprocessors
set notes = null
where notes ilike '%AI-toepassingen%'
   or notes ilike '%AI-governance%'
   or notes ilike '%AI-risicoanalyse%';

-- 3) Maak oude AI-detailvelden leeg als deze kolommen bestaan.
-- uses_ai blijft bewust staan als eenvoudige indicatie dat een subverwerker AI gebruikt.
do $$
declare
  col text;
  cols text[] := array[
    'ai_risk_classification',
    'ai_category',
    'ai_provider',
    'ai_model',
    'ai_use_case',
    'ai_decision_impact',
    'ai_human_in_loop',
    'ai_trains_on_customer_data',
    'ai_processes_personal_data',
    'ai_automated_decision_making',
    'ai_data_location',
    'ai_governance_notes'
  ];
begin
  foreach col in array cols loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subprocessors'
        and column_name = col
    ) then
      execute format('update public.subprocessors set %I = null where uses_ai = true', col);
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subprocessors'
      and column_name = 'ai_type'
  ) then
    update public.subprocessors
    set ai_type = 'AI-component aanwezig'
    where uses_ai = true;
  end if;
end $$;

-- 4) Borging AI-register: RLS en duplicaatpreventie blijven leidend.
alter table public.ai_register enable row level security;

drop policy if exists "ai_register_select_own_org" on public.ai_register;
drop policy if exists "ai_register_insert_own_org" on public.ai_register;
drop policy if exists "ai_register_update_own_org" on public.ai_register;
drop policy if exists "ai_register_delete_own_org" on public.ai_register;

create policy "ai_register_select_own_org"
on public.ai_register
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "ai_register_insert_own_org"
on public.ai_register
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and (created_by is null or created_by = auth.uid())
);

create policy "ai_register_update_own_org"
on public.ai_register
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

create policy "ai_register_delete_own_org"
on public.ai_register
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

grant select, insert, update, delete on public.ai_register to authenticated;

-- Unieke index alleen aanmaken als er geen duplicaten bestaan.
do $$
begin
  if not exists (
    select 1
    from (
      select organization_id, supplier_id, application_id, lower(trim(name)) as normalized_name, count(*)
      from public.ai_register
      group by organization_id, supplier_id, application_id, lower(trim(name))
      having count(*) > 1
    ) d
  ) then
    create unique index if not exists ai_register_unique_entry
    on public.ai_register (
      organization_id,
      coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(application_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(trim(name))
    );
  else
    raise notice 'ai_register_unique_entry niet aangemaakt: ruim dubbele AI-registeritems eerst op.';
  end if;
end $$;

notify pgrst, 'reload schema';
