-- VendorScorePro v0.9.16 - Wiki CMS support
-- Alleen nodig wanneer wiki_categories of kolommen nog ontbreken.

create table if not exists public.wiki_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  slug text,
  color text default 'blue',
  icon text,
  sort_order integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

alter table public.wiki_articles
  alter column slug set not null;

create unique index if not exists wiki_articles_org_slug_unique
  on public.wiki_articles (organization_id, slug);

create unique index if not exists wiki_categories_org_slug_unique
  on public.wiki_categories (organization_id, slug);

alter table public.wiki_categories enable row level security;
alter table public.wiki_articles enable row level security;

drop policy if exists wiki_categories_select on public.wiki_categories;
create policy wiki_categories_select
on public.wiki_categories
for select
using (auth.uid() is not null);

drop policy if exists wiki_categories_insert on public.wiki_categories;
create policy wiki_categories_insert
on public.wiki_categories
for insert
with check (auth.uid() is not null);

drop policy if exists wiki_categories_update on public.wiki_categories;
create policy wiki_categories_update
on public.wiki_categories
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists wiki_categories_delete on public.wiki_categories;
create policy wiki_categories_delete
on public.wiki_categories
for delete
using (auth.uid() is not null);

drop policy if exists wiki_articles_select on public.wiki_articles;
create policy wiki_articles_select
on public.wiki_articles
for select
using (auth.uid() is not null);

drop policy if exists wiki_articles_insert on public.wiki_articles;
create policy wiki_articles_insert
on public.wiki_articles
for insert
with check (auth.uid() is not null);

drop policy if exists wiki_articles_update on public.wiki_articles;
create policy wiki_articles_update
on public.wiki_articles
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists wiki_articles_delete on public.wiki_articles;
create policy wiki_articles_delete
on public.wiki_articles
for delete
using (auth.uid() is not null);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.wiki_articles to authenticated;
grant select, insert, update, delete on public.wiki_categories to authenticated;

notify pgrst, 'reload schema';
