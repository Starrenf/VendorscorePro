-- v0.9.23 - Extra AI-registervelden op subprocessors
-- Doel: AI-data bij subverwerkers betrouwbaar opslaan en aansluiten op EU AI Act-risicoklassen.

alter table public.subprocessors
  add column if not exists ai_risk_classification text,
  add column if not exists ai_category text,
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists ai_use_case text,
  add column if not exists ai_decision_impact text,
  add column if not exists ai_human_in_loop boolean,
  add column if not exists ai_trains_on_customer_data boolean,
  add column if not exists ai_processes_personal_data boolean,
  add column if not exists ai_automated_decision_making boolean,
  add column if not exists ai_data_location text,
  add column if not exists ai_governance_notes text;

-- Veilige constraints: eerst oude versies verwijderen, daarna actueel toevoegen.
alter table public.subprocessors
  drop constraint if exists subprocessors_ai_risk_classification_check;

alter table public.subprocessors
  add constraint subprocessors_ai_risk_classification_check
  check (
    ai_risk_classification is null
    or ai_risk_classification in ('unacceptable', 'high', 'limited', 'minimal', 'unknown')
  );

alter table public.subprocessors
  drop constraint if exists subprocessors_ai_decision_impact_check;

alter table public.subprocessors
  add constraint subprocessors_ai_decision_impact_check
  check (
    ai_decision_impact is null
    or ai_decision_impact in ('ondersteunend', 'semi_automatisch', 'automatisch', 'onbekend')
  );

create index if not exists idx_subprocessors_ai_risk_classification
  on public.subprocessors(ai_risk_classification);

create index if not exists idx_subprocessors_uses_ai
  on public.subprocessors(uses_ai);

comment on column public.subprocessors.ai_risk_classification is
'EU AI Act risicoklasse: unacceptable, high, limited, minimal of unknown.';
comment on column public.subprocessors.ai_category is
'Functionele AI-categorie, zoals generatief, chatbot, OCR, onderwijsbeoordeling, HR/recruitment, biometrie of security.';
comment on column public.subprocessors.ai_governance_notes is
'Governance-aantekeningen voor AI-gebruik door deze subverwerker, inclusief DPIA, transparantie, modelinformatie en mitigaties.';
