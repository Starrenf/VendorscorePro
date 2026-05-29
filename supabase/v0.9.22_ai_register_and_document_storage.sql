-- VendorScorePro v0.9.22
-- AI-register frontend support + documentupload voorbereiding.
-- Let op: ai_register en ai_register_mitigations moeten al bestaan.

-- 1. Storage bucket voor leverancierdocumenten.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-documents',
  'supplier-documents',
  true,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- 2. Policies voor uploaden/lezen via pad organization_id/supplier_id/bestand.
-- Voor nu public bucket zodat testgebruik direct werkt. In een volgende security-hardening stap kan dit naar private + signed URLs.

drop policy if exists "supplier_documents_storage_select_org_members" on storage.objects;
drop policy if exists "supplier_documents_storage_insert_org_members" on storage.objects;
drop policy if exists "supplier_documents_storage_update_org_members" on storage.objects;
drop policy if exists "supplier_documents_storage_delete_org_members" on storage.objects;

create policy "supplier_documents_storage_select_org_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'supplier-documents'
  and exists (
    select 1
    from public.org_memberships m
    where m.organization_id::text = split_part(storage.objects.name, '/', 1)
      and m.user_id = auth.uid()
  )
);

create policy "supplier_documents_storage_insert_org_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'supplier-documents'
  and exists (
    select 1
    from public.org_memberships m
    where m.organization_id::text = split_part(storage.objects.name, '/', 1)
      and m.user_id = auth.uid()
  )
);

create policy "supplier_documents_storage_update_org_members"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'supplier-documents'
  and exists (
    select 1
    from public.org_memberships m
    where m.organization_id::text = split_part(storage.objects.name, '/', 1)
      and m.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'supplier-documents'
  and exists (
    select 1
    from public.org_memberships m
    where m.organization_id::text = split_part(storage.objects.name, '/', 1)
      and m.user_id = auth.uid()
  )
);

create policy "supplier_documents_storage_delete_org_members"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'supplier-documents'
  and exists (
    select 1
    from public.org_memberships m
    where m.organization_id::text = split_part(storage.objects.name, '/', 1)
      and m.user_id = auth.uid()
  )
);
