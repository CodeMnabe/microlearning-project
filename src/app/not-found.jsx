// app/not-found.jsx
import Link from "next/link";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/utils/supabase/server";

// Reuse login styles
import styles from "./[locale]/(auth)/login/login.module.css";

export default async function NotFound() {
  // ✅ use the server helper you imported
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Keep current locale in the link if present
  const h = await headers();
  const raw = h.get("x-next-url") || h.get("x-request-url") || "";

  // Support both absolute and relative values in prod
  const pathish = raw.startsWith("http") ? new URL(raw).pathname : raw || "/";

  let prefix = "";
  const segs = pathish.split("/").filter(Boolean);
  if (segs.length && segs[0].length <= 5) prefix = `/${segs[0]}`;

  const targetHref = `${prefix}${session ? "/users" : "/login"}`;
  const targetLabel = session ? "Ir para Utilizadores" : "Ir para Login";

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>

      <section className={styles.card}>
        <h2 className={styles.title}>Página não encontrada</h2>

        <p className={styles.message} style={{ marginBottom: "0.75rem" }}>
          Ups! A página que procura não existe ou foi movida.
        </p>

        <div
          style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}
        >
          <Link href={targetHref} className={styles.btnPrimary}>
            {targetLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
