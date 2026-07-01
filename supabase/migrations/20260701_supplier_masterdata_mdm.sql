-- Governix Supplier Masterdata / MDM foundation
-- Doel:
-- 1. Een leverancier blijft uniek als masterdata-object.
-- 2. De getoonde naam, juridische naam en aliassen worden apart beheerd.
-- 3. Samengevoegde leveranciers blijven auditbaar maar verdwijnen uit actieve overzichten.
-- 4. De frontend kan via public.active_suppliers_view en public.supplier_overview_view naar één waarheid kijken.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

create or replace function public.normalize_supplier_name(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(
      unaccent(
        regexp_replace(
          coalesce(input, ''),
          '\m(b\.?v\.?|bv|n\.?v\.?|nv)\M',
          '',
          'gi'
        )
      )
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

alter table public.suppliers
  add column if not exists legal_name text,
  add column if not exists display_name text,
  add column if not exists normalized_name text,
  add column if not exists is_active boolean default true,
  add column if not exists is_merged boolean default false,
  add column if not exists merged_into_supplier_id uuid references public.suppliers(id),
  add column if not exists merged_at timestamptz,
  add column if not exists merge_note text;

update public.suppliers
set
  legal_name = coalesce(legal_name, name),
  display_name = coalesce(display_name, name),
  normalized_name = public.normalize_supplier_name(coalesce(display_name, name)),
  is_active = coalesce(is_active, true),
  is_merged = coalesce(is_merged, false);

create table if not exists public.supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (public.normalize_supplier_name(alias)) stored,
  created_at timestamptz not null default now(),
  unique (organization_id, normalized_alias)
);

create index if not exists supplier_aliases_supplier_id_idx
  on public.supplier_aliases (supplier_id);

insert into public.supplier_aliases (organization_id, supplier_id, alias)
select s.organization_id, s.id, s.name
from public.suppliers s
where s.name is not null
on conflict (organization_id, normalized_alias) do nothing;

create table if not exists public.supplier_merge_map (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  duplicate_supplier_id uuid not null references public.suppliers(id),
  master_supplier_id uuid not null references public.suppliers(id),
  reason text,
  approved boolean default false,
  created_at timestamptz default now(),
  unique (duplicate_supplier_id),
  check (duplicate_supplier_id <> master_supplier_id)
);

create or replace function public.set_supplier_masterdata_defaults()
returns trigger
language plpgsql
as $$
begin
  new.display_name := coalesce(nullif(new.display_name, ''), new.name);
  new.legal_name := nullif(new.legal_name, '');
  new.normalized_name := public.normalize_supplier_name(coalesce(new.display_name, new.name));
  new.is_active := coalesce(new.is_active, true);
  new.is_merged := coalesce(new.is_merged, false);
  return new;
end;
$$;

drop trigger if exists trg_set_supplier_masterdata_defaults on public.suppliers;
create trigger trg_set_supplier_masterdata_defaults
before insert or update of name, display_name, legal_name, is_active, is_merged
on public.suppliers
for each row
execute function public.set_supplier_masterdata_defaults();

create unique index if not exists suppliers_unique_active_normalized_name
  on public.suppliers (organization_id, normalized_name)
  where coalesce(is_active, true) = true
    and coalesce(is_merged, false) = false;

create or replace view public.active_suppliers_view as
select
  s.*,
  coalesce(nullif(s.display_name, ''), s.name) as visible_name
from public.suppliers s
where coalesce(s.is_active, true) = true
  and coalesce(s.is_merged, false) = false
  and coalesce(s.status, 'active'::text) <> all (array['archived'::text, 'deleted'::text]);

create or replace view public.supplier_overview_view as
select
  s.id,
  s.organization_id,
  s.name,
  coalesce(nullif(s.display_name, ''), s.name) as display_name,
  s.legal_name,
  coalesce(nullif(s.display_name, ''), s.name) as visible_name,
  s.status,
  s.category,
  s.classification,
  coalesce(nullif(s.domain, ''::text), 'Generiek'::text) as domain,
  coalesce(s.supplier_type, 'leverancier'::text) as supplier_type,
  s.is_active,
  s.is_merged,
  s.created_at,
  s.updated_at,
  coalesce(g.total_items, 0::bigint) as governance_total_items,
  coalesce(g.checked_items, 0::bigint) as governance_checked_items,
  coalesce(g.total_items, 0::bigint) as total_items,
  coalesce(g.checked_items, 0::bigint) as checked_items,
  coalesce(g.score_percent, 0) as governance_score_percent,
  coalesce(g.score_percent, 0) as governance_score,
  coalesce(g.status_label, 'Niet gestart'::text) as governance_status_label,
  coalesce(g.status_color, 'gray'::text) as governance_status,
  coalesce(g.status_color, 'gray'::text) as governance_status_color,
  0 as notes_count,
  0 as open_actions_count,
  0 as documents_count,
  0 as applications_count,
  0 as ai_subprocessors_count
from public.suppliers s
left join public.supplier_governance_summary g
  on g.supplier_id = s.id
 and g.organization_id = s.organization_id
where coalesce(s.is_active, true) = true
  and coalesce(s.is_merged, false) = false
  and coalesce(s.status, 'active'::text) <> all (array['archived'::text, 'deleted'::text]);

create or replace function public.merge_suppliers(
  p_organization_id uuid,
  p_duplicate_supplier_id uuid,
  p_master_supplier_id uuid,
  p_reason text default 'Samengevoegd via leveranciers masterdata beheer'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_duplicate public.suppliers%rowtype;
  v_master public.suppliers%rowtype;
  v_table record;
  v_has_org boolean;
  v_count integer;
  v_total integer := 0;
begin
  if p_duplicate_supplier_id = p_master_supplier_id then
    raise exception 'Duplicate supplier en master supplier mogen niet gelijk zijn.';
  end if;

  select * into v_duplicate
  from public.suppliers
  where id = p_duplicate_supplier_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Duplicate supplier niet gevonden binnen organisatie.';
  end if;

  select * into v_master
  from public.suppliers
  where id = p_master_supplier_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Master supplier niet gevonden binnen organisatie.';
  end if;

  insert into public.supplier_aliases (organization_id, supplier_id, alias)
  values
    (p_organization_id, p_master_supplier_id, v_duplicate.name),
    (p_organization_id, p_master_supplier_id, coalesce(v_duplicate.display_name, v_duplicate.name)),
    (p_organization_id, p_master_supplier_id, coalesce(v_duplicate.legal_name, v_duplicate.name))
  on conflict (organization_id, normalized_alias) do nothing;

  insert into public.supplier_aliases (organization_id, supplier_id, alias)
  select p_organization_id, p_master_supplier_id, sa.alias
  from public.supplier_aliases sa
  where sa.supplier_id = p_duplicate_supplier_id
  on conflict (organization_id, normalized_alias) do nothing;

  for v_table in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'supplier_id'
      and table_name not in ('suppliers', 'supplier_aliases')
  loop
    select exists (
      select 1
      from information_schema.columns c
      where c.table_schema = v_table.table_schema
        and c.table_name = v_table.table_name
        and c.column_name = 'organization_id'
    ) into v_has_org;

    if v_has_org then
      execute format(
        'update %I.%I set supplier_id = $1 where supplier_id = $2 and organization_id = $3',
        v_table.table_schema,
        v_table.table_name
      ) using p_master_supplier_id, p_duplicate_supplier_id, p_organization_id;
    else
      execute format(
        'update %I.%I set supplier_id = $1 where supplier_id = $2',
        v_table.table_schema,
        v_table.table_name
      ) using p_master_supplier_id, p_duplicate_supplier_id;
    end if;

    get diagnostics v_count = row_count;
    v_total := v_total + coalesce(v_count, 0);
  end loop;

  insert into public.supplier_merge_map (
    organization_id,
    duplicate_supplier_id,
    master_supplier_id,
    reason,
    approved
  )
  values (
    p_organization_id,
    p_duplicate_supplier_id,
    p_master_supplier_id,
    p_reason,
    true
  )
  on conflict (duplicate_supplier_id) do update
  set
    master_supplier_id = excluded.master_supplier_id,
    reason = excluded.reason,
    approved = true;

  update public.suppliers
  set
    is_active = false,
    is_merged = true,
    merged_into_supplier_id = p_master_supplier_id,
    merged_at = now(),
    merge_note = p_reason
  where id = p_duplicate_supplier_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'duplicate_supplier_id', p_duplicate_supplier_id,
    'master_supplier_id', p_master_supplier_id,
    'updated_references', v_total,
    'status', 'merged'
  );
end;
$$;

-- Controlequeries na uitvoeren migratie:
-- select normalized_name, count(*), array_agg(name order by name)
-- from public.suppliers
-- where coalesce(is_active, true) = true and coalesce(is_merged, false) = false
-- group by normalized_name
-- having count(*) > 1;
--
-- select count(*) from public.active_suppliers_view;
