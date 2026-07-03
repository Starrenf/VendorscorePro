-- Governix v4.1.1 - AI Register: samengestelde vragen opsplitsen
-- Doel: bestaande AI-registervelden expliciet borgen voor losse beantwoording.
-- Deze migratie is licht en idempotent. Er worden geen zware updates uitgevoerd.

alter table public.ai_register
  add column if not exists ai_purpose text,
  add column if not exists ai_model_version text,
  add column if not exists notes text;

comment on column public.ai_register.ai_use_case is
  'Use case: in welk proces wordt AI gebruikt en door welke gebruikersgroep.';

comment on column public.ai_register.ai_purpose is
  'Doel van de AI-inzet: welk doel moet de AI-toepassing bereiken.';

comment on column public.ai_register.ai_model_name is
  'Naam van het gebruikte model of de AI-dienst.';

comment on column public.ai_register.ai_model_version is
  'Versie of releasedatum van het gebruikte model of de AI-dienst.';

comment on column public.ai_register.transparency_measures is
  'Transparantiemaatregelen richting gebruikers, betrokkenen of beheerders.';

comment on column public.ai_register.notes is
  'Interne notities, aandachtspunten en vervolgacties.';

notify pgrst, 'reload schema';
