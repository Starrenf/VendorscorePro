import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";

export default function SupplierApplicationsTab({ supplier }) {
  const { organization } = useApp();
  const client = supabase();

  const [apps, setApps] = useState([]);
  const [newApp, setNewApp] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await client
      .from("applications")
      .select("*")
      .eq("supplier_id", supplier.id);

    setApps(data || []);
  }

  async function add() {
    if (!newApp) return;

    await client.from("applications").insert({
      name: newApp,
      supplier_id: supplier.id,
      organization_id: organization.id,
    });

    setNewApp("");
    load();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Applicaties</h2>

      <div className="mt-3 flex gap-2">
        <input
          className="input"
          value={newApp}
          onChange={(e) => setNewApp(e.target.value)}
          placeholder="Nieuwe applicatie"
        />
        <button className="btn btn-primary" onClick={add}>
          Toevoegen
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {apps.map((a) => (
          <div key={a.id} className="card p-3">
            {a.name}
          </div>
        ))}
      </div>
    </div>
  );
}
