import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const TABLE = "labdm_state";
const STATE_KEY = "main";

export default async () => {
  const url = Netlify.env.get("SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!url || !key) {
    return Response.json({ ok: false, error: "Missing Supabase environment variables" }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, data, updated_at")
    .eq("id", STATE_KEY)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ ok: true, exists: false });
  }

  const snapshot = data.data as {
    equipment?: unknown[];
    users?: unknown[];
    events?: unknown[];
    locations?: unknown[];
    categories?: unknown[];
  };

  return Response.json({
    ok: true,
    exists: true,
    updated_at: data.updated_at,
    counts: {
      equipment: snapshot.equipment?.length || 0,
      users: snapshot.users?.length || 0,
      events: snapshot.events?.length || 0,
      locations: snapshot.locations?.length || 0,
      categories: snapshot.categories?.length || 0
    }
  });
};

export const config: Config = {
  schedule: "0 3 */5 * *"
};
