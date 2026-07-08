# Governix Stable Baseline v4.1.1

## Status

Deze build is de nieuwe solide basis voor verdere ontwikkeling van Governix.

## Kernbesluit

Governix is vanaf deze baseline modulair opgebouwd:

```text
Gebruiker → rollen → modules → rechten → menu/routes/acties
```

Rollen en modules worden niet meer primair hardcoded beheerd, maar via database-tabellen.

## Onderdeel van deze baseline

### Frontend

- `src/state/AppState.jsx`
  - laadt `user_roles`;
  - laadt modulepermissies via `v_user_module_permissions`;
  - biedt helperfuncties zoals `canAccessModule`, `hasRole` en `getModulePermission`.

- `src/components/Layout.jsx`
  - bouwt het menu op basis van moduletoegang;
  - toont alleen modules die de gebruiker mag zien;
  - gebruikt de primaire rol in de gebruikersweergave.

- `src/pages/RoleManagement.jsx`
  - toont rollenbibliotheek;
  - maakt rollen toekenbaar;
  - maakt modules per rol koppelbaar;
  - ondersteunt rollen zoals `Inkoper` en `Contractmanager Lijn`.

### Database

- `supabase/v4.1.0_modular_rbac_foundation.sql`
  - maakt/seedt rollen, modules, rol-modulepermissies, roltemplates en view `v_user_module_permissions`.

- `supabase/v4.1.1_modular_rbac_stable_policy_fix.sql`
  - voegt de noodzakelijke RLS-policies toe zodat modulekoppeling vanuit Rollenbeheer werkt zonder 403 Forbidden.

## Belangrijke rollen

- Super Admin
- Organisatiebeheerder
- Inkoper
- Contractmanager
- Contractmanager Lijn
- Functioneel Beheerder
- AI Manager
- Security Officer
- Privacy Officer
- Architect
- MVO Reviewer
- Subsidie Reviewer
- Viewer

## Belangrijke modules

- Home
- Dashboard
- Leveranciers
- Contract Workspace
- Nieuw contract
- Inkoop Intake
- Applicaties
- Gebouwen & Assets
- Facility Workspace
- Garanties
- Governance
- AI Governance
- Statuspagina
- Architectuur
- Wiki
- Rollenbeheer
- Waardelijsten

## Geteste werking

- Rollen zijn zichtbaar.
- `Contractmanager Lijn` is aanwezig.
- Modules kunnen per rol worden gekoppeld.
- De eerdere 403 op `role_module_permissions` is opgelost via RLS-policy.
- Menu-filtering werkt op basis van moduletoegang.

## Nieuwe ontwikkelregel

Vanaf deze baseline geldt:

1. Nieuwe functionaliteit wordt als module toegevoegd aan `governix_modules`.
2. Toegang wordt geregeld via `role_module_permissions`.
3. Rollen worden beheerd via `roles` en `user_roles`.
4. Geen nieuwe hardcoded rolmenu's meer zonder databasekoppeling.
5. Workflowrouting naar specialisten gebruikt rollen/modules, niet persoonsnamen.

## Volgende ontwikkelstap

De volgende logische stap is:

- actierechten per module afdwingen (`can_create`, `can_edit`, `can_approve`, `can_delete`);
- Inkoop Intake Wizard koppelen aan specialistrollen;
- taken/notificaties genereren voor geraakte disciplines;
- RLS verder hardenen per module en recordtype.
