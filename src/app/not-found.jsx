// app/not-found.jsx
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

import styles from "./[locale]/(auth)/login/login.module.css";

export default async function NotFound() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Try to keep the current locale in the link
  const h = await headers();
  const raw = h.get("x-next-url") || h.get("x-request-url") || "";
  let prefix = "";
  try {
    const pathname = new URL(raw).pathname || "/";
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length && segs[0].length <= 5) prefix = `/${segs[0]}`;
  } catch {}

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
          {/* Eventually there will be a button for the landing page part of the website */}
          {/* <Link href={`${prefix}/`} className={styles.btnSecondary}>
            Ir para Início
          </Link> */}
        </div>
      </section>
    </main>
  );
}
