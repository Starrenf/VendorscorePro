-- VendorScorePro v0.9.73 - Portal & Communications Center
-- Doel: beheerbare Home-banners voor storingen, onderhoud, informatie en opgeloste meldingen.

create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text,
  announcement_type text,
  active boolean default true,
  start_date timestamptz default now(),
  end_date timestamptz,
  created_by uuid,
  created_at timestamptz default now()
);

alter table public.system_announcements
add column if not exists organization_id uuid,
add column if not exists title text,
add column if not exists message text,
add column if not exists announcement_type text default 'info',
add column if not exists active boolean default true,
add column if not exists start_date timestamptz default now(),
add column if not exists end_date timestamptz,
add column if not exists visible_for_role text,
add column if not exists target_module text default 'home',
add column if not exists priority integer default 1,
add column if not exists created_by uuid,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

-- Koppel bestaande meldingen aan Gilde indien ze nog geen organisatie hebben.
update public.system_announcements
set organization_id = '7ec54263-6b9b-4cb2-9b97-526d8909550d'
where organization_id is null;

-- Normaliseer lege waarden.
update public.system_announcements
set
  announcement_type = coalesce(nullif(announcement_type, ''), 'info'),
  target_module = coalesce(nullif(target_module, ''), 'home'),
  priority = coalesce(priority, 1),
  active = coalesce(active, true),
  start_date = coalesce(start_date, now()),
  updated_at = coalesce(updated_at, now());

-- Laat organization_id voorlopig verplicht zijn nadat bestaande records zijn hersteld.
alter table public.system_announcements
alter column organization_id set not null;

-- Type check veilig opnieuw zetten.
alter table public.system_announcements
  drop constraint if exists system_announcements_type_check;

alter table public.system_announcements
  add constraint system_announcements_type_check
  check (announcement_type in ('critical','maintenance','info','resolved'));

create index if not exists idx_system_announcements_org
on public.system_announcements(organization_id);

create index if not exists idx_system_announcements_active_window
on public.system_announcements(organization_id, active, start_date, end_date);

alter table public.system_announcements enable row level security;

drop policy if exists "system_announcements_select_own_org" on public.system_announcements;
drop policy if exists "system_announcements_manage_admin" on public.system_announcements;
drop policy if exists "org members can read announcements" on public.system_announcements;
drop policy if exists "admins manage announcements" on public.system_announcements;

create policy "system_announcements_select_own_org"
on public.system_announcements
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from public.org_memberships
    where user_id = auth.uid()
  )
);

create policy "system_announcements_manage_admin"
on public.system_announcements
for all
to authenticated
using (
  exists (
    select 1
    from public.org_memberships om
    where om.organization_id = system_announcements.organization_id
      and om.user_id = auth.uid()
      and lower(om.role) in ('admin', 'super admin', 'organisatiebeheerder')
  )
)
with check (
  exists (
    select 1
    from public.org_memberships om
    where om.organization_id = system_announcements.organization_id
      and om.user_id = auth.uid()
      and lower(om.role) in ('admin', 'super admin', 'organisatiebeheerder')
  )
);

grant select, insert, update, delete on public.system_announcements to authenticated;
revoke all on public.system_announcements from anon;

-- Voorbeeldmelding. Laat staan of verwijder na test.
insert into public.system_announcements (
  organization_id,
  title,
  message,
  announcement_type,
  active,
  target_module,
  priority,
  start_date
)
select
  '7ec54263-6b9b-4cb2-9b97-526d8909550d',
  'Welkom bij VendorScorePro',
  'Het Communicatiecentrum is beschikbaar. Beheerders kunnen vanaf nu meldingen, storingen en onderhoudsbanners publiceren op de Homepagina.',
  'info',
  true,
  'home',
  1,
  now()
where not exists (
  select 1
  from public.system_announcements
  where organization_id = '7ec54263-6b9b-4cb2-9b97-526d8909550d'
    and title = 'Welkom bij VendorScorePro'
);

notify pgrst, 'reload schema';
