alter table public.applications
add column if not exists functional_owner text;

alter table public.applications
add column if not exists is_critical boolean default false;

alter table public.applications
add column if not exists updated_at timestamptz default now();

alter table public.applications
add column if not exists created_at timestamptz default now();
