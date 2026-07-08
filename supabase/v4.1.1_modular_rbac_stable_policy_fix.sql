-- Governix v4.1.1 Modular RBAC Stable Policy Fix
-- Deze migratie hoort bij de nieuwe solide basis na v4.1.0.
-- Doel:
-- - role_module_permissions via de frontend kunnen beheren.
-- - Alleen Super Admin, Organisatiebeheerder of legacy admin mag modulekoppelingen wijzigen.
-- - Idempotent en veilig opnieuw uitvoerbaar.

alter table public.role_module_permissions enable row level security;

-- Leesrechten: ingelogde gebruikers mogen modulepermissies lezen zodat het menu opgebouwd kan worden.
drop policy if exists role_module_permissions_authenticated_read
on public.role_module_permissions;

create policy role_module_permissions_authenticated_read
on public.role_module_permissions
for select
to authenticated
using (true);

-- Beheerrechten: alleen beheerders mogen rollen aan modules koppelen of ontkoppelen.
drop policy if exists role_module_permissions_admin_all
on public.role_module_permissions;

create policy role_module_permissions_admin_all
on public.role_module_permissions
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role_name in ('Super Admin', 'Organisatiebeheerder')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role_name in ('Super Admin', 'Organisatiebeheerder')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Optioneel maar wenselijk: RLS op rollen en modules met leesrechten voor authenticated gebruikers.
alter table public.roles enable row level security;
alter table public.governix_modules enable row level security;

drop policy if exists roles_authenticated_read
on public.roles;

create policy roles_authenticated_read
on public.roles
for select
to authenticated
using (true);

drop policy if exists governix_modules_authenticated_read
on public.governix_modules;

create policy governix_modules_authenticated_read
on public.governix_modules
for select
to authenticated
using (true);

-- Beheer op rollen en modules alleen voor beheerders.
drop policy if exists roles_admin_all
on public.roles;

create policy roles_admin_all
on public.roles
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role_name in ('Super Admin', 'Organisatiebeheerder')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role_name in ('Super Admin', 'Organisatiebeheerder')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists governix_modules_admin_all
on public.governix_modules;

create policy governix_modules_admin_all
on public.governix_modules
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role_name in ('Super Admin', 'Organisatiebeheerder')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role_name in ('Super Admin', 'Organisatiebeheerder')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Controle na uitvoeren:
-- 1. Rollenbeheer openen.
-- 2. Rol kiezen, bijvoorbeeld Contractmanager Lijn.
-- 3. Module aanvinken/uitvinken.
-- 4. Geen 403 meer in de console.
