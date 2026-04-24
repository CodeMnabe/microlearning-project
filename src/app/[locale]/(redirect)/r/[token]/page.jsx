"use client";

import { use, useEffect, useMemo, useState } from "react";
import styles from "./redirect.module.css";

export default function TrackedRedirectPage({ params }) {
  const resolvedParams = use(params);
  const token = String(resolvedParams?.token || "");

  const [status, setStatus] = useState("loading");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`/api/tracked-links/${token}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.error("Tracked link API failed", {
            status: res.status,
            data,
            token,
          });

          throw new Error(
            data?.error ||
              `Could not resolve tracked link (status ${res.status}).`,
          );
        }

        const url = String(data?.destinationUrl || "").trim();

        if (!url) {
          throw new Error("Tracked link has no destination URL.");
        }

        if (cancelled) return;

        setDestinationUrl(url);
        setStatus("redirecting");

        window.location.replace(url);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not open link.");
        setStatus("error");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>MyDigitalBot</div>
        </div>

        <h1 className={styles.title}>
          {status === "error" ? "Link unavailable" : "A abrir ligação..."}
        </h1>

        {status !== "error" && (
          <>
            <p className={styles.text}>
              Estamos a preparar o redirecionamento. Se nada acontecer, podes
              usar o botão abaixo.
            </p>

            <div className={styles.spinnerWrap}>
              <div className={styles.spinner} />
            </div>
          </>
        )}

        {status === "error" && (
          <p className={styles.errorText}>
            {error || "Não foi possível abrir esta ligação."}
          </p>
        )}

        {destinationUrl && (
          <div className={styles.statusBox}>
            <div className={styles.statusLabel}>Destino</div>
            <div className={styles.statusValue}>{destinationUrl}</div>
          </div>
        )}

        <div className={styles.actions}>
          {destinationUrl && (
            <a href={destinationUrl} className={styles.primaryBtn}>
              Continuar
            </a>
          )}

          {status === "redirecting" && destinationUrl && (
            <button
              type="button"
              onClick={() => window.location.assign(destinationUrl)}
              className={styles.secondaryBtn}
            >
              Tentar novamente
            </button>
          )}
        </div>

        <p className={styles.footnote}>
          Esta página pode fechar automaticamente ao concluir o
          redirecionamento.
        </p>
      </div>
    </main>
  );
}
