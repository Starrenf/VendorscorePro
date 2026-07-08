-- Governix v4.1.0 Modular RBAC Foundation
-- Doel:
-- - Rollen, modules en moduletoegang centraal beheren.
-- - Zijmenu en workflows niet langer hardcoded laten bepalen wat een gebruiker ziet.
-- - Basis leggen voor rolgedreven workflowrouting naar Inkoop, Privacy, Security, Architectuur, AI, etc.
--
-- Veiligheid:
-- - Idempotent: kan meerdere keren worden uitgevoerd.
-- - Geen zware scans.
-- - Geen destructive changes.
-- - Bestaande user_roles blijven behouden.

create extension if not exists pgcrypto;

create table if not exists public.roles (
  name text primary key,
  description text,
  risk text default 'laag',
  badge text,
  is_system_role boolean default true,
  sort_order integer default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roles
  add column if not exists risk text default 'laag',
  add column if not exists badge text,
  add column if not exists is_system_role boolean default true,
  add column if not exists sort_order integer default 999,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.governix_modules (
  module_key text primary key,
  name text not null,
  description text,
  category text,
  route text,
  icon text,
  is_active boolean not null default true,
  sort_order integer default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_module_permissions (
  role_name text not null references public.roles(name) on delete cascade,
  module_key text not null references public.governix_modules(module_key) on delete cascade,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_name, module_key)
);

create table if not exists public.role_templates (
  template_key text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer default 999,
  created_at timestamptz not null default now()
);

create table if not exists public.role_template_roles (
  template_key text not null references public.role_templates(template_key) on delete cascade,
  role_name text not null references public.roles(name) on delete cascade,
  primary key (template_key, role_name)
);

create table if not exists public.module_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid,
  role_name text,
  module_key text,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description, risk, badge, sort_order) values
  ('Super Admin', 'Volledig beheer van Governix, inclusief instellingen, rollen en gevoelige configuratie.', 'hoog', 'Volledig beheer', 10),
  ('Organisatiebeheerder', 'Beheert gebruikers, organisatie-instellingen, waardelijsten en kroonjuwelen binnen de eigen organisatie.', 'hoog', 'Beheer', 20),
  ('Inkoper', 'Beheert inkoopintake, integrale toetsing, aanbestedingsvoorbereiding en inkooprapportages.', 'middel', 'Inkoop', 30),
  ('Contractmanager', 'Beheert leveranciers, contracten, governance, risico''s en leveranciersbeoordelingen.', 'middel', 'Contract & leveranciers', 40),
  ('Contractmanager Lijn', 'Beperkte rol voor contractverantwoordelijken in de lijn. Kan eigen contracten registreren, documenten koppelen en jaarlijkse reviews afronden.', 'laag', 'Lijncontracten', 50),
  ('Functioneel Beheerder', 'Beheert applicatie-informatie, vult governance aan en kan leveranciers beoordelen vanuit gebruikersperspectief.', 'middel', 'Applicaties & FB', 60),
  ('AI Manager', 'Beheert AI-register, AI-risico''s, DPIA-status, AI-governance en bijbehorende beheersmaatregelen.', 'middel', 'AI-governance', 70),
  ('Security Officer', 'Beoordeelt informatiebeveiliging, continuïteit, risico''s en security-documentatie.', 'middel', 'Security', 80),
  ('Privacy Officer', 'Beoordeelt AVG, DPIA, verwerkersovereenkomsten, subverwerkers en privacyrisico''s.', 'middel', 'Privacy', 90),
  ('Architect', 'Beoordeelt architectuur, koppelingen, SSO, lifecycle en aansluiting op het applicatielandschap.', 'middel', 'Architectuur', 100),
  ('MVO Reviewer', 'Beoordeelt duurzaamheid, SROI, regionale impact en maatschappelijke criteria.', 'laag', 'MVO', 110),
  ('Subsidie Reviewer', 'Beoordeelt subsidievoorwaarden, projectverplichtingen en administratieve borging.', 'middel', 'Subsidies', 120),
  ('Viewer', 'Alleen-lezen toegang tot dashboards, leveranciers, applicaties, governance en rapportages.', 'laag', 'Alleen lezen', 900)
on conflict (name) do update
set description = excluded.description,
    risk = excluded.risk,
    badge = excluded.badge,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.governix_modules (module_key, name, description, category, route, icon, sort_order) values
  ('home', 'Home', 'Startpagina van Governix.', 'Start', '/', 'Home', 10),
  ('dashboard', 'Dashboard', 'Algemeen dashboard en stuurinformatie.', 'Start', '/dashboard', 'LayoutDashboard', 20),
  ('about', 'Over Governix', 'Introductie en platforminformatie.', 'Start', '/over', 'HelpCircle', 30),
  ('suppliers', 'Leveranciers', 'Leveranciersoverzicht, leveranciersdossiers en masterdata.', 'Werkgebieden', '/suppliers', 'Users', 100),
  ('contracts_workspace', 'Contract Workspace', 'Werkruimte voor contractregistratie, contractreviews en contractopvolging.', 'Werkgebieden', '/contracts/workspace', 'FileText', 110),
  ('contracts_new', 'Nieuw contract', 'Wizard voor contractregistratie door contractverantwoordelijken.', 'Werkgebieden', '/contracts/new', 'FileText', 120),
  ('procurement_intake', 'Inkoop Intake', 'Inkoopintake en integrale toetsing met specialist-routing.', 'Werkgebieden', '/procurement/intake', 'ClipboardList', 130),
  ('applications', 'Applicaties', 'Applicatielandschap en functioneel beheer.', 'Werkgebieden', '/landschap', 'Layers3', 140),
  ('assets', 'Gebouwen & Assets', 'Gebouwen, assets, installaties en asset governance.', 'Werkgebieden', '/assets', 'Building', 150),
  ('facility_workspace', 'Facility Workspace', 'Facility governance, onderhoud, garanties en claims.', 'Werkgebieden', '/facility', 'Building2', 160),
  ('warranties', 'Garanties', 'Garantieonderdelen en claimprocessen.', 'Werkgebieden', '/warranties', 'Wrench', 170),
  ('governance', 'Governance', 'Governance checklist, methodiek en compliance.', 'Werkgebieden', '/methodiek', 'ShieldCheck', 180),
  ('ai_governance', 'AI Governance', 'AI-register, AI-assessments en AI-compliance.', 'Werkgebieden', '/ai-register', 'Brain', 190),
  ('status', 'Statuspagina', 'Statusoverzicht, risico en opvolging.', 'Risico & inzicht', '/status', 'ClipboardList', 300),
  ('architecture', 'Architectuur', 'Architectuurcockpit, MORA en koppelingen.', 'Risico & inzicht', '/architecture', 'BarChart3', 310),
  ('kroonjuwelen', 'Kroonjuwelen', 'Kritieke applicaties en kroonjuwelen.', 'Risico & inzicht', '/kroonjuwelen', 'ShieldCheck', 320),
  ('wiki', 'Wiki', 'Kennisbank en gebruikersdocumentatie.', 'Risico & inzicht', '/wiki', 'BookOpen', 330),
  ('handleiding', 'Handleiding', 'Gebruikershandleiding.', 'Risico & inzicht', '/handleiding', 'FileQuestion', 340),
  ('communications', 'Communicatie', 'Systeemmeldingen en communicatiebeheer.', 'Beheer', '/settings/communications', 'Megaphone', 500),
  ('settings_roles', 'Rollenbeheer', 'Rollen, gebruikers en moduletoegang beheren.', 'Beheer', '/settings/roles', 'UserCog', 510),
  ('settings', 'Waardelijsten', 'Instellingen en waardelijsten.', 'Beheer', '/settings', 'SlidersHorizontal', 520),
  ('admin_orgs', 'Organisaties', 'Organisatiebeheer.', 'Beheer', '/admin/orgs', 'Settings', 530),
  ('wiki_admin', 'Wiki beheer', 'Wiki-beheer en kennisstructuur.', 'Beheer', '/wiki/admin', 'BookOpen', 540),
  ('onboarding', 'Onboarding', 'Organisatie-onboarding.', 'Beheer', '/onboarding', 'Building2', 550)
on conflict (module_key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    route = excluded.route,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

-- Basisrechten per rol
-- Super Admin / Organisatiebeheerder: alles
insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin)
select 'Super Admin', module_key, true, true, true, true, true, true from public.governix_modules
on conflict (role_name, module_key) do update
set can_view = true, can_create = true, can_edit = true, can_delete = true, can_approve = true, can_admin = true, updated_at = now();

insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin)
select 'Organisatiebeheerder', module_key, true, true, true, false, true, module_key in ('settings_roles','settings','communications','wiki_admin') from public.governix_modules
on conflict (role_name, module_key) do update
set can_view = true, can_create = true, can_edit = true, can_approve = true, can_admin = excluded.can_admin, updated_at = now();

-- Inkoper
insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin) values
  ('Inkoper', 'home', true, false, false, false, false, false),
  ('Inkoper', 'dashboard', true, false, false, false, false, false),
  ('Inkoper', 'procurement_intake', true, true, true, false, true, false),
  ('Inkoper', 'suppliers', true, true, true, false, false, false),
  ('Inkoper', 'contracts_workspace', true, true, true, false, true, false),
  ('Inkoper', 'contracts_new', true, true, true, false, false, false),
  ('Inkoper', 'governance', true, true, true, false, true, false),
  ('Inkoper', 'status', true, false, false, false, false, false),
  ('Inkoper', 'wiki', true, false, false, false, false, false),
  ('Inkoper', 'handleiding', true, false, false, false, false, false)
on conflict (role_name, module_key) do update
set can_view = excluded.can_view, can_create = excluded.can_create, can_edit = excluded.can_edit, can_delete = excluded.can_delete, can_approve = excluded.can_approve, can_admin = excluded.can_admin, updated_at = now();

-- Contractmanager Lijn
insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin) values
  ('Contractmanager Lijn', 'home', true, false, false, false, false, false),
  ('Contractmanager Lijn', 'dashboard', true, false, false, false, false, false),
  ('Contractmanager Lijn', 'contracts_workspace', true, true, true, false, false, false),
  ('Contractmanager Lijn', 'contracts_new', true, true, true, false, false, false),
  ('Contractmanager Lijn', 'suppliers', true, false, false, false, false, false),
  ('Contractmanager Lijn', 'status', true, false, false, false, false, false),
  ('Contractmanager Lijn', 'wiki', true, false, false, false, false, false),
  ('Contractmanager Lijn', 'handleiding', true, false, false, false, false, false)
on conflict (role_name, module_key) do update
set can_view = excluded.can_view, can_create = excluded.can_create, can_edit = excluded.can_edit, can_delete = excluded.can_delete, can_approve = excluded.can_approve, can_admin = excluded.can_admin, updated_at = now();

-- Contractmanager professioneel
insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin) values
  ('Contractmanager', 'home', true, false, false, false, false, false),
  ('Contractmanager', 'dashboard', true, false, false, false, false, false),
  ('Contractmanager', 'suppliers', true, true, true, false, false, false),
  ('Contractmanager', 'contracts_workspace', true, true, true, false, true, false),
  ('Contractmanager', 'contracts_new', true, true, true, false, false, false),
  ('Contractmanager', 'governance', true, true, true, false, true, false),
  ('Contractmanager', 'status', true, false, false, false, false, false),
  ('Contractmanager', 'wiki', true, false, false, false, false, false),
  ('Contractmanager', 'handleiding', true, false, false, false, false, false)
on conflict (role_name, module_key) do update
set can_view = excluded.can_view, can_create = excluded.can_create, can_edit = excluded.can_edit, can_delete = excluded.can_delete, can_approve = excluded.can_approve, can_admin = excluded.can_admin, updated_at = now();

-- Specialistrollen
insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin) values
  ('Functioneel Beheerder', 'home', true, false, false, false, false, false),
  ('Functioneel Beheerder', 'dashboard', true, false, false, false, false, false),
  ('Functioneel Beheerder', 'applications', true, true, true, false, false, false),
  ('Functioneel Beheerder', 'suppliers', true, false, false, false, false, false),
  ('Functioneel Beheerder', 'governance', true, true, true, false, false, false),
  ('AI Manager', 'home', true, false, false, false, false, false),
  ('AI Manager', 'dashboard', true, false, false, false, false, false),
  ('AI Manager', 'ai_governance', true, true, true, false, true, false),
  ('AI Manager', 'governance', true, false, true, false, true, false),
  ('AI Manager', 'suppliers', true, false, false, false, false, false),
  ('Security Officer', 'home', true, false, false, false, false, false),
  ('Security Officer', 'dashboard', true, false, false, false, false, false),
  ('Security Officer', 'governance', true, false, true, false, true, false),
  ('Security Officer', 'ai_governance', true, false, true, false, true, false),
  ('Privacy Officer', 'home', true, false, false, false, false, false),
  ('Privacy Officer', 'dashboard', true, false, false, false, false, false),
  ('Privacy Officer', 'governance', true, false, true, false, true, false),
  ('Architect', 'home', true, false, false, false, false, false),
  ('Architect', 'dashboard', true, false, false, false, false, false),
  ('Architect', 'architecture', true, true, true, false, true, false),
  ('Architect', 'applications', true, false, true, false, false, false)
on conflict (role_name, module_key) do update
set can_view = excluded.can_view, can_create = excluded.can_create, can_edit = excluded.can_edit, can_delete = excluded.can_delete, can_approve = excluded.can_approve, can_admin = excluded.can_admin, updated_at = now();

-- Viewer
insert into public.role_module_permissions (role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin) values
  ('Viewer', 'home', true, false, false, false, false, false),
  ('Viewer', 'dashboard', true, false, false, false, false, false),
  ('Viewer', 'suppliers', true, false, false, false, false, false),
  ('Viewer', 'applications', true, false, false, false, false, false),
  ('Viewer', 'status', true, false, false, false, false, false),
  ('Viewer', 'wiki', true, false, false, false, false, false),
  ('Viewer', 'handleiding', true, false, false, false, false, false)
on conflict (role_name, module_key) do update
set can_view = excluded.can_view, can_create = false, can_edit = false, can_delete = false, can_approve = false, can_admin = false, updated_at = now();

insert into public.role_templates (template_key, name, description, sort_order) values
  ('viewer', 'Viewer', 'Alleen lezen.', 10),
  ('contractmanager_lijn', 'Contractmanager Lijn', 'Beperkte rol voor contractverantwoordelijken in de lijn.', 20),
  ('inkoper', 'Inkoper', 'Rol voor Team Inkoop.', 30),
  ('contractmanager', 'Contractmanager', 'Professionele contractmanager.', 40),
  ('ai_manager', 'AI Manager', 'AI Governance specialist.', 50),
  ('security_officer', 'Security Officer', 'Security specialist.', 60),
  ('privacy_officer', 'Privacy Officer', 'Privacy specialist.', 70),
  ('architect', 'Architect', 'Architectuur specialist.', 80),
  ('super_admin', 'Super Admin', 'Volledig beheer.', 900)
on conflict (template_key) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.role_template_roles (template_key, role_name) values
  ('viewer', 'Viewer'),
  ('contractmanager_lijn', 'Contractmanager Lijn'),
  ('inkoper', 'Inkoper'),
  ('contractmanager', 'Contractmanager'),
  ('ai_manager', 'AI Manager'),
  ('security_officer', 'Security Officer'),
  ('privacy_officer', 'Privacy Officer'),
  ('architect', 'Architect'),
  ('super_admin', 'Super Admin'),
  ('super_admin', 'Contractmanager')
on conflict (template_key, role_name) do nothing;

create or replace view public.v_user_module_permissions as
select
  ur.profile_id,
  ur.role_name,
  r.description as role_description,
  m.module_key,
  m.name as module_name,
  m.description as module_description,
  m.category as module_category,
  m.route,
  bool_or(rmp.can_view) as can_view,
  bool_or(rmp.can_create) as can_create,
  bool_or(rmp.can_edit) as can_edit,
  bool_or(rmp.can_delete) as can_delete,
  bool_or(rmp.can_approve) as can_approve,
  bool_or(rmp.can_admin) as can_admin
from public.user_roles ur
join public.roles r
  on r.name = ur.role_name
join public.role_module_permissions rmp
  on rmp.role_name = ur.role_name
join public.governix_modules m
  on m.module_key = rmp.module_key
where m.is_active = true
  and rmp.can_view = true
group by
  ur.profile_id,
  ur.role_name,
  r.description,
  m.module_key,
  m.name,
  m.description,
  m.category,
  m.route;

create or replace function public.has_module_access(
  p_profile_id uuid,
  p_module_key text,
  p_action text default 'view'
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.v_user_module_permissions p
    where p.profile_id = p_profile_id
      and p.module_key = p_module_key
      and case lower(coalesce(p_action, 'view'))
        when 'view' then p.can_view
        when 'create' then p.can_create
        when 'edit' then p.can_edit
        when 'delete' then p.can_delete
        when 'approve' then p.can_approve
        when 'admin' then p.can_admin
        else p.can_view
      end
  );
$$;

-- Controlequeries:
-- select * from public.roles order by sort_order;
-- select role_name, module_key, can_view from public.role_module_permissions order by role_name, module_key;
-- select * from public.v_user_module_permissions where profile_id = '<PROFILE_ID>';
