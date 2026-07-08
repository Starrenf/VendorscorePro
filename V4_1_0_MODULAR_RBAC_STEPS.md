# Governix v4.1.0 — Modular RBAC Foundation

## Doel

Deze release maakt Governix modulair op basis van rollen en modules:

```text
Gebruiker → rollen → moduletoegang → menu/routes/acties
```

Hiermee verdwijnen hardcoded menu's en hardcoded rolkeuzes stap voor stap uit de frontend.

## Bestanden

Aangepast:

- `src/state/AppState.jsx`
- `src/components/Layout.jsx`
- `src/pages/RoleManagement.jsx`

Nieuw:

- `supabase/v4.1.0_modular_rbac_foundation.sql`

## SQL uitvoeren

Draai in Supabase SQL Editor:

```sql
-- volledige inhoud van:
-- supabase/v4.1.0_modular_rbac_foundation.sql
```

Deze migratie is idempotent en maakt/seedt:

- `roles`
- `governix_modules`
- `role_module_permissions`
- `role_templates`
- `role_template_roles`
- `module_access_audit`
- view `v_user_module_permissions`
- functie `has_module_access(...)`

## Controle na SQL

```sql
select name, risk, sort_order
from public.roles
order by sort_order;
```

```sql
select role_name, module_key, can_view, can_create, can_edit, can_approve
from public.role_module_permissions
where role_name in ('Inkoper', 'Contractmanager Lijn')
order by role_name, module_key;
```

```sql
select *
from public.v_user_module_permissions
where profile_id = '749f16bc-ee27-4792-917e-88e693f82e26'::uuid
order by module_key;
```

## Lokaal bouwen

```bash
npm install
npm run build
```

## Functionele test

1. Log in als Super Admin.
2. Ga naar `Rollenbeheer`.
3. Controleer of rollen zichtbaar zijn:
   - Inkoper
   - Contractmanager Lijn
   - Privacy Officer
   - Security Officer
   - Architect
4. Selecteer rol `Contractmanager Lijn` links in de rollenbibliotheek.
5. Controleer dat modules gekoppeld zijn:
   - Home
   - Dashboard
   - Contract Workspace
   - Nieuw contract
   - Leveranciers
   - Statuspagina
   - Wiki
   - Handleiding
6. Log uit/in als testaccount met `Contractmanager Lijn`.
7. Controleer dat het menu beperkt is.
8. Selecteer rol `Inkoper` en controleer moduletoegang voor inkoopmodules.

## Belangrijke ontwerpkeuze

De frontend gebruikt nu `v_user_module_permissions` als bron voor menu-filtering. Als deze view nog niet bestaat, gebruikt Governix tijdelijk een fallback op basis van bekende rollen. Daardoor blijft de applicatie bruikbaar terwijl SQL gefaseerd wordt uitgerold.

## Volgende stap

De volgende release moet dezelfde modulepermissies ook gebruiken voor:

- knoppen en acties (`can_create`, `can_edit`, `can_approve`);
- workflowrouting naar specialisten;
- RLS-policies in Supabase.
