-- VendorScorePro v0.9.24 - Wiki activeren + schema compatibiliteit
-- Uitvoeren in Supabase SQL Editor.
-- Doel: bestaande wiki-tabellen geschikt maken voor de Wiki-frontend in v0.9.23/v0.9.24.

-- 1. Vereiste kolommen voor de huidige Wiki-frontend
alter table public.wiki_categories
  add column if not exists color text default 'blue',
  add column if not exists updated_at timestamptz default now();

alter table public.wiki_articles
  add column if not exists category text,
  add column if not exists summary text,
  add column if not exists content text,
  add column if not exists tags text[] default '{}',
  add column if not exists status text default 'draft',
  add column if not exists is_published boolean default false,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

-- 2. Indexen per organisatie
create unique index if not exists wiki_articles_org_slug_unique
  on public.wiki_articles (organization_id, slug);

create unique index if not exists wiki_categories_org_slug_unique
  on public.wiki_categories (organization_id, slug);

-- 3. RLS aanzetten
alter table public.wiki_categories enable row level security;
alter table public.wiki_articles enable row level security;
alter table public.wiki_article_versions enable row level security;
alter table public.wiki_favorites enable row level security;

-- 4. Categorie policies
drop policy if exists wiki_categories_select_org on public.wiki_categories;
create policy wiki_categories_select_org
on public.wiki_categories
for select
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists wiki_categories_insert_allowed_roles on public.wiki_categories;
create policy wiki_categories_insert_allowed_roles
on public.wiki_categories
for insert
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.wiki_role, p.role, 'viewer') in (
      'admin',
      'contractmanager',
      'functional_manager',
      'privacy_security'
    )
  )
);

drop policy if exists wiki_categories_update_allowed_roles on public.wiki_categories;
create policy wiki_categories_update_allowed_roles
on public.wiki_categories
for update
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.wiki_role, p.role, 'viewer') in (
      'admin',
      'contractmanager',
      'functional_manager',
      'privacy_security'
    )
  )
)
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists wiki_categories_delete_admin_only on public.wiki_categories;
create policy wiki_categories_delete_admin_only
on public.wiki_categories
for delete
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.wiki_role, p.role, 'viewer') = 'admin'
  )
);

-- 5. Artikelen policies opnieuw veilig zetten.
drop policy if exists wiki_articles_select_org on public.wiki_articles;
create policy wiki_articles_select_org
on public.wiki_articles
for select
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists wiki_articles_insert_allowed_roles on public.wiki_articles;
create policy wiki_articles_insert_allowed_roles
on public.wiki_articles
for insert
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.wiki_role, p.role, 'viewer') in (
      'admin',
      'contractmanager',
      'functional_manager',
      'privacy_security'
    )
  )
);

drop policy if exists wiki_articles_update_allowed_roles on public.wiki_articles;
create policy wiki_articles_update_allowed_roles
on public.wiki_articles
for update
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.wiki_role, p.role, 'viewer') in (
      'admin',
      'contractmanager',
      'functional_manager',
      'privacy_security'
    )
  )
)
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists wiki_articles_delete_admin_only on public.wiki_articles;
create policy wiki_articles_delete_admin_only
on public.wiki_articles
for delete
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.wiki_role, p.role, 'viewer') = 'admin'
  )
);

-- 6. Grants
grant select, insert, update, delete on public.wiki_articles to authenticated;
grant select, insert, update, delete on public.wiki_categories to authenticated;
grant select, insert, update, delete on public.wiki_article_versions to authenticated;
grant select, insert, update, delete on public.wiki_favorites to authenticated;

-- 7. Seed categorieën voor jouw huidige organisatie.
insert into public.wiki_categories (organization_id, name, slug, color, icon, sort_order)
select p.organization_id, v.name, v.slug, v.color, v.icon, v.sort_order
from public.profiles p
cross join (
  values
    ('Contractmanagement', 'contractmanagement', 'blue', 'FileText', 1),
    ('Privacy & Security', 'privacy-security', 'green', 'Shield', 2),
    ('Functioneel beheer', 'functioneel-beheer', 'purple', 'Settings', 3),
    ('Wetgeving', 'wetgeving', 'orange', 'Scale', 4),
    ('Templates', 'templates', 'cyan', 'LayoutTemplate', 5),
    ('Onderwijs', 'onderwijs', 'indigo', 'GraduationCap', 6)
) as v(name, slug, color, icon, sort_order)
where p.id = auth.uid()
  and p.organization_id is not null
on conflict (organization_id, slug) do update
set name = excluded.name,
    color = excluded.color,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    updated_at = now();

-- 8. Eerste artikel: Wettelijke bewaartermijnen.
insert into public.wiki_articles (
  organization_id,
  title,
  slug,
  category,
  summary,
  content,
  tags,
  status,
  is_published,
  created_by,
  updated_by,
  updated_at
)
select
  p.organization_id,
  'Wettelijke bewaartermijnen',
  'wettelijke-bewaartermijnen',
  'Privacy & Security',
  'Overzicht van veelgebruikte wettelijke bewaartermijnen en aandachtspunten voor contractmanagement.',
  '# Wettelijke bewaartermijnen

## Financiële administratie
De fiscale bewaarplicht is in de praktijk meestal 7 jaar.

## Contracten
Praktijkadvies: bewaar contracten en relevante correspondentie minimaal 7 jaar na einde contract, tenzij organisatiebeleid of juridische context anders bepaalt.

## Sollicitatiegegevens
Gebruikelijk: 4 weken na afronding procedure, of langer met toestemming van betrokkene.

## Camerabeelden
Gebruikelijk maximaal 4 weken, tenzij er sprake is van een incident.

## Logging en security logs
Leg dit vast in organisatiebeleid. Stem af met CISO/FG, BIO/NEN en leveranciersafspraken.

## Let op
Bewaartermijnen kunnen verschillen per proces, wettelijke grondslag en type gegevens. Leg altijd bron, eigenaar en verwijderproces vast.',
  array['AVG','bewaartermijnen','contractmanagement','privacy'],
  'published',
  true,
  auth.uid(),
  auth.uid(),
  now()
from public.profiles p
where p.id = auth.uid()
  and p.organization_id is not null
on conflict (organization_id, slug) do update
set category = excluded.category,
    summary = excluded.summary,
    content = excluded.content,
    tags = excluded.tags,
    status = excluded.status,
    is_published = excluded.is_published,
    updated_by = auth.uid(),
    updated_at = now();

notify pgrst, 'reload schema';
