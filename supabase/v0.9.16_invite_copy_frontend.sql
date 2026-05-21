-- VendorScorePro v0.9.16 - Invite copy UX + invite RLS hardening
-- Run this in Supabase SQL Editor if invites are created but not visible in Admin > Organisaties.

begin;

-- Compatibiliteit voor verschillende invite-schema's.
alter table if exists public.org_invites
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table if exists public.org_invites
  add column if not exists revoked boolean not null default false;

alter table if exists public.org_invites
  add column if not exists uses integer not null default 0;

alter table if exists public.org_invites
  add column if not exists max_uses integer not null default 1;

alter table if exists public.org_invites
  add column if not exists expires_at timestamptz;

create unique index if not exists org_invites_code_unique
on public.org_invites (code);

create index if not exists org_invites_org_id_idx
on public.org_invites (organization_id);

alter table public.org_invites enable row level security;

-- Beheerbeleid voor admins/owners binnen dezelfde organisatie.
drop policy if exists "Admins can read org invites" on public.org_invites;
drop policy if exists "Admins can create org invites" on public.org_invites;
drop policy if exists "Admins can update org invites" on public.org_invites;
drop policy if exists "Admins can delete org invites" on public.org_invites;

drop policy if exists org_invites_select on public.org_invites;
drop policy if exists org_invites_insert on public.org_invites;
drop policy if exists org_invites_update on public.org_invites;
drop policy if exists org_invites_delete on public.org_invites;

create policy "Admins can read org invites"
on public.org_invites
for select
to authenticated
using (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'owner')
  )
);

create policy "Admins can create org invites"
on public.org_invites
for insert
to authenticated
with check (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'owner')
  )
);

create policy "Admins can update org invites"
on public.org_invites
for update
to authenticated
using (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'owner')
  )
)
with check (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'owner')
  )
);

create policy "Admins can delete org invites"
on public.org_invites
for delete
to authenticated
using (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'owner')
  )
);

commit;

notify pgrst, 'reload schema';
