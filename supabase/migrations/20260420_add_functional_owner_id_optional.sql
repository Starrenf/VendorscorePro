alter table public.applications
add column if not exists functional_owner_id uuid;
