import { createClient } from "@supabase/supabase-js";

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
const GILDE_ORG_ID = process.env.GILDE_ORG_ID || "7ec54263-6b9b-4cb2-9b97-526d8909550d";

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error("Missing env vars. Required: OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const OLD = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } });
const NEW = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

async function fetchAll(client, table, queryBuilder) {
  const { data, error } = await queryBuilder;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function loadNewSupplierMap() {
  const suppliers = await fetchAll(
    NEW,
    "suppliers",
    NEW.from("suppliers").select("id,name,organization_id").eq("organization_id", GILDE_ORG_ID)
  );
  return new Map(suppliers.map((s) => [String(s.name || "").toLowerCase(), s.id]));
}

async function migrateSuppliers() {
  const oldSuppliers = await fetchAll(
    OLD,
    "suppliers",
    OLD.from("suppliers").select("*").eq("organization_id", GILDE_ORG_ID)
  );

  const existingByName = await loadNewSupplierMap();
  let inserted = 0;
  let skipped = 0;

  for (const s of oldSuppliers) {
    const key = String(s.name || "").toLowerCase();
    if (!s.name || existingByName.has(key)) {
      skipped += 1;
      continue;
    }

    const payload = {
      organization_id: GILDE_ORG_ID,
      name: s.name,
      classification: s.classification || null,
      kvk_number: s.kvk_number || null,
      creditor_number: s.creditor_number || null,
      category: s.category || "generiek",
      notes: s.notes || null,
      is_active: typeof s.is_active === "boolean" ? s.is_active : true,
      status: s.status || "active",
      created_at: s.created_at || undefined,
      updated_at: s.updated_at || undefined,
    };

    const { error } = await NEW.from("suppliers").insert(payload);
    if (error) {
      console.error(`suppliers insert failed for ${s.name}:`, error.message);
      continue;
    }
    inserted += 1;
  }

  console.log(`Suppliers migrated. inserted=${inserted}, skipped=${skipped}`);
}

async function migrateSupplierContacts() {
  const supplierMap = await loadNewSupplierMap();
  const oldSuppliers = await fetchAll(
    OLD,
    "suppliers",
    OLD.from("suppliers").select("id,name").eq("organization_id", GILDE_ORG_ID)
  );
  const oldSupplierById = new Map(oldSuppliers.map((s) => [s.id, s.name]));

  const oldContacts = await fetchAll(
    OLD,
    "supplier_contacts",
    OLD.from("supplier_contacts").select("*").eq("organization_id", GILDE_ORG_ID)
  );

  let inserted = 0;
  let skipped = 0;
  for (const c of oldContacts) {
    const supplierName = oldSupplierById.get(c.supplier_id);
    const newSupplierId = supplierMap.get(String(supplierName || "").toLowerCase());
    if (!newSupplierId) {
      skipped += 1;
      continue;
    }

    const payload = {
      organization_id: GILDE_ORG_ID,
      supplier_id: newSupplierId,
      full_name: c.full_name || null,
      role_title: c.role_title || null,
      email: c.email || null,
      phone: c.phone || null,
      is_primary: !!c.is_primary,
      created_at: c.created_at || undefined,
    };

    const { error } = await NEW.from("supplier_contacts").insert(payload);
    if (error) {
      console.error(`supplier_contacts insert failed for ${payload.full_name || "contact"}:`, error.message);
      continue;
    }
    inserted += 1;
  }

  console.log(`Supplier contacts migrated. inserted=${inserted}, skipped=${skipped}`);
}

async function migrateSupplierProgress() {
  const supplierMap = await loadNewSupplierMap();
  const oldSuppliers = await fetchAll(
    OLD,
    "suppliers",
    OLD.from("suppliers").select("id,name").eq("organization_id", GILDE_ORG_ID)
  );
  const oldSupplierById = new Map(oldSuppliers.map((s) => [s.id, s.name]));

  const oldProgress = await fetchAll(
    OLD,
    "supplier_progress",
    OLD.from("supplier_progress").select("*").eq("organization_id", GILDE_ORG_ID)
  );

  let inserted = 0;
  let skipped = 0;
  for (const p of oldProgress) {
    const supplierName = oldSupplierById.get(p.supplier_id);
    const newSupplierId = supplierMap.get(String(supplierName || "").toLowerCase());
    if (!newSupplierId) {
      skipped += 1;
      continue;
    }

    const payload = {
      organization_id: GILDE_ORG_ID,
      supplier_id: newSupplierId,
      inventory_complete: !!p.inventory_complete,
      contract_received: !!p.contract_received,
      last_meeting_at: p.last_meeting_at || null,
      notes: p.notes || null,
    };

    const { error } = await NEW.from("supplier_progress").upsert(payload, { onConflict: "organization_id,supplier_id" });
    if (error) {
      console.error(`supplier_progress upsert failed for ${supplierName || p.supplier_id}:`, error.message);
      continue;
    }
    inserted += 1;
  }

  console.log(`Supplier progress migrated. upserted=${inserted}, skipped=${skipped}`);
}

async function main() {
  console.log("Starting Gilde migration to VendorScore Pro…");
  await migrateSuppliers();
  await migrateSupplierContacts();
  await migrateSupplierProgress();
  console.log("Migration completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
