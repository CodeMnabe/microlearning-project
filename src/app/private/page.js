// app/private/page.js
"use client"; // ← this file is a client component

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client"; // your browser helper

export default function PrivatePage() {
  const supabase = createClient(); // already carries the session cookie
  const router = useRouter();

  const [user, setUser] = useState(null); // will hold auth user object
  const [loading, setLoading] = useState(true);

  /* 1️⃣  Check for a logged-in user on first render */
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login"); // not logged-in → kick out
        return;
      }

      setUser(session.user); // logged-in → save user
      setLoading(false);
    })();
  }, [supabase, router]);

  /* 2️⃣  Show a spinner while we verify */
  if (loading) {
    return (
      <main
        style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}
      >
        <p>Loading…</p>
      </main>
    );
  }

  /* 3️⃣  Render user info */
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui,sans-serif" }}>
      <h1>Private area</h1>
      <h2>Signed-in user</h2>

      <ul>
        <li>
          <strong>ID:</strong> {user.id}
        </li>
        <li>
          <strong>Email:</strong> {user.email}
        </li>
      </ul>

      <h3>Full user JSON</h3>
      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: "1rem",
          borderRadius: "0.5rem",
          overflowX: "auto",
        }}
      >
        {JSON.stringify(user, null, 2)}
      </pre>
    </main>
  );
}
