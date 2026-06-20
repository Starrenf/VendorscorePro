-- VendorScorePro v0.9.72 - RBAC org_memberships frontend fix notes
-- Geen verplichte databasewijziging voor de frontendfix.
-- Optioneel: verwijder orphan membership/profile zonder auth.users-koppeling nadat je dit gecontroleerd hebt.

-- Controle orphan profielen/gebruiker-koppelingen:
select
  u.email,
  p.id,
  p.full_name,
  p.role,
  om.role as membership_role
from public.profiles p
left join auth.users u on u.id = p.id
left join public.org_memberships om on om.user_id = p.id
where u.id is null;

-- Optionele opschoning van het eerder gevonden lege admin-profiel:
-- delete from public.user_roles where profile_id = 'c62954ca-8188-41d3-be9e-d63e7231600b';
-- delete from public.org_memberships where user_id = 'c62954ca-8188-41d3-be9e-d63e7231600b';
-- delete from public.profiles where id = 'c62954ca-8188-41d3-be9e-d63e7231600b';
