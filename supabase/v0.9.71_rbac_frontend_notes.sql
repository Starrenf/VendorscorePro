-- VendorScorePro v0.9.71 - RBAC Foundation Frontend Notes
-- Deze build verwacht dat de RBAC-tabellen al bestaan.
-- Minimale tabellen:
--   public.roles(name text, description text)
--   public.user_roles(id uuid, profile_id uuid, role_name text, created_at timestamptz)
--
-- Aanbevolen unieke index:
create unique index if not exists user_roles_unique_profile_role
on public.user_roles(profile_id, role_name);

-- Aanbevolen rechten voor ingelogde gebruikers. Verdere RLS-hardening volgt in v0.9.72+.
grant select on public.roles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;

notify pgrst, 'reload schema';
