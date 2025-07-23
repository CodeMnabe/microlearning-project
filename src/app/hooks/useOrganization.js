"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function useOrganization(user) {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(Boolean(user)); // load only if we have a user
  const supabase = createClient();

  useEffect(() => {
    if (!user) return; // not logged-in → skip

    async function fetchOrg() {
      const { data, error } = await supabase
        .from("organization")
        .select("id, name")
        .eq("owner_user_id", user.id)
        .single();

      if (error) console.error("[useOrganization] ", error.message);
      setOrg(data); // may be null if row doesn’t exist
      setLoading(false);
    }

    fetchOrg();
  }, [user, supabase]);

  return { org, loading };
}
