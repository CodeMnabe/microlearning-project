// @vitest-environment node

/**
 * Verificação da paginação contra a base de dados REAL.
 *
 * Isto não é um teste unitário: liga-se mesmo à Supabase e lê dados.
 * Por isso está desligado por omissão e só corre quando pedires:
 *
 *   npx dotenv -e .env.local -- npx vitest run src/__tests__/analytics/analyticsBase.repo.db.test.js
 *
 * Para limitar a uma organização (mais rápido):
 *
 *   npx dotenv -e .env.local -v CHECK_ORG_ID=1 -- npx vitest run <mesmo caminho>
 *
 * O que compara, por tabela:
 *
 *   count      -> countRows(), a contagem autoritativa. O Max rows não a afeta.
 *   paginado   -> fetchRows(), o teu código novo.
 *   sem página -> um select() direto, que é o que o código ANTIGO fazia.
 *   únicos     -> ids distintos, para apanhar duplicados de paginação instável.
 *
 * Se "sem página" for menor que "count", acabaste de ver o bug em dados reais.
 * Se "paginado" for igual a "count" e "únicos" bater certo, a correção está boa.
 */

import { describe, it, expect } from "vitest";

import { getSupabaseAdminClient } from "@/lib/db/admin";
import {
  countRows,
  fetchRows,
} from "@/lib/repos/analytics/analyticsBase.repo";

const hasCredentials =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const orgId = process.env.CHECK_ORG_ID
  ? Number(process.env.CHECK_ORG_ID)
  : null;

/**
 * As tabelas que a camada Analytics lê com fetchRows,
 * e a coluna por onde cada uma se liga à organização.
 *
 * O tracked_link_event não tem coluna de organização:
 * na aplicação é filtrado pelos ids dos links.
 */
const TABLES = [
  { table: "user", orgColumn: "organization_id" },
  { table: "message", orgColumn: "organization_id" },
  { table: "automation_rule", orgColumn: "organization_id" },
  { table: "automation_run", orgColumn: "organization_id" },
  { table: "scheduled_broadcast", orgColumn: "organization_id" },
  { table: "tracked_link", orgColumn: "org_id" },
  { table: "pending_outreach", orgColumn: "org_id" },
  { table: "tracked_link_event", orgColumn: null },
];

function buildFilter({ orgColumn }) {
  if (!orgColumn || orgId === null) return undefined;

  return (query) => query.eq(orgColumn, orgId);
}

/**
 * Faz um select() direto, sem paginação nenhuma.
 * É exatamente o que o fetchRows fazia antes da correção.
 */
async function fetchWithoutPaging({ table, orgColumn }) {
  const supabaseAdmin = getSupabaseAdminClient();

  let query = supabaseAdmin.from(table).select("id");

  if (orgColumn && orgId !== null) {
    query = query.eq(orgColumn, orgId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return data ?? [];
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function padLeft(value, width) {
  return String(value).padStart(width);
}

describe.skipIf(!hasCredentials)(
  "paginação do fetchRows contra a base de dados real",
  () => {
    it(
      "traz todas as linhas que o count anuncia, sem duplicados",
      { timeout: 300000 },
      async () => {
        const results = [];

        for (const entry of TABLES) {
          const startedAt = Date.now();

          try {
            const total = await countRows(entry.table, buildFilter(entry));

            const paged = await fetchRows(
              entry.table,
              "id",
              buildFilter(entry),
            );

            const unpaged = await fetchWithoutPaging(entry);

            const uniqueIds = new Set(paged.map((row) => row.id)).size;

            results.push({
              table: entry.table,
              total,
              paged: paged.length,
              unpaged: unpaged.length,
              unique: uniqueIds,
              ms: Date.now() - startedAt,
              error: null,
            });
          } catch (err) {
            results.push({
              table: entry.table,
              error: err.message,
              ms: Date.now() - startedAt,
            });
          }
        }

        // ---------- relatório ----------

        const scope =
          orgId === null
            ? "todas as organizações"
            : `organização ${orgId}`;

        console.log(`\n  Âmbito: ${scope}\n`);
        console.log(
          `  ${pad("tabela", 22)}${padLeft("count", 9)}${padLeft("paginado", 10)}${padLeft("sem pág.", 10)}${padLeft("únicos", 8)}${padLeft("ms", 8)}  estado`,
        );
        console.log(`  ${"-".repeat(76)}`);

        for (const row of results) {
          if (row.error) {
            console.log(
              `  ${pad(row.table, 22)}${padLeft("—", 9)}${padLeft("—", 10)}${padLeft("—", 10)}${padLeft("—", 8)}${padLeft(row.ms, 8)}  ERRO: ${row.error}`,
            );
            continue;
          }

          const correct = row.paged === row.total && row.unique === row.paged;
          const wasTruncated = row.unpaged < row.total;

          let status = correct ? "ok" : "FALHA";

          if (correct && wasTruncated) {
            status = `ok — corrigiu ${row.total - row.unpaged} linhas escondidas`;
          }

          if (row.unique !== row.paged) {
            status = `FALHA — ${row.paged - row.unique} duplicados`;
          }

          console.log(
            `  ${pad(row.table, 22)}${padLeft(row.total, 9)}${padLeft(row.paged, 10)}${padLeft(row.unpaged, 10)}${padLeft(row.unique, 8)}${padLeft(row.ms, 8)}  ${status}`,
          );
        }

        const truncatedBefore = results.filter(
          (row) => !row.error && row.unpaged < row.total,
        );

        console.log("");

        if (truncatedBefore.length === 0) {
          console.log(
            "  Nenhuma tabela passava o Max rows — a correção está certa,\n" +
              "  mas ainda não tens volume suficiente para a ver a agir.\n",
          );
        } else {
          console.log(
            `  ${truncatedBefore.length} tabela(s) estavam truncadas antes da correção:\n` +
              truncatedBefore
                .map(
                  (row) =>
                    `    ${row.table}: mostrava ${row.unpaged} de ${row.total}`,
                )
                .join("\n") +
              "\n",
          );
        }

        // ---------- verificação ----------

        const failed = results.filter((row) => row.error);

        expect(
          failed.map((row) => `${row.table}: ${row.error}`),
          "nenhuma tabela devia dar erro",
        ).toEqual([]);

        for (const row of results) {
          expect(
            row.paged,
            `${row.table}: fetchRows trouxe ${row.paged} mas count diz ${row.total}`,
          ).toBe(row.total);

          expect(
            row.unique,
            `${row.table}: há ids repetidos — a ordenação da paginação não é estável`,
          ).toBe(row.paged);
        }
      },
    );

    /**
     * Quatro chamadas reais da camada Analytics selecionam apenas uma
     * coluna de data e deixam o fetchRows ordenar por "id" — uma coluna
     * que não está no select.
     *
     * O teste acima pede sempre "id", por isso nunca exercita essa forma.
     * Se o PostgREST recusasse ordenar por coluna não selecionada,
     * o getDailyAnalyticsRows rebentava em produção e não aqui.
     */
    it(
      "ordena por uma coluna que não está no select",
      { timeout: 120000 },
      async () => {
        const shapes = [
          { table: "message", column: "created_at" },
          { table: "automation_run", column: "processed_at" },
          { table: "tracked_link_event", column: "created_at" },
        ];

        console.log("\n  Forma real usada pelo getDailyAnalyticsRows:\n");

        for (const shape of shapes) {
          const total = await countRows(shape.table);
          const rows = await fetchRows(shape.table, shape.column);

          console.log(
            `  ${pad(`${shape.table} → select("${shape.column}")`, 46)}${padLeft(rows.length, 6)} de ${total}`,
          );

          expect(
            rows.length,
            `${shape.table}: selecionar "${shape.column}" e ordenar por "id" não trouxe tudo`,
          ).toBe(total);

          // Confirma que veio mesmo a coluna pedida, e não o id.
          if (rows.length > 0) {
            expect(Object.keys(rows[0])).toEqual([shape.column]);
          }
        }

        console.log("");
      },
    );
  },
);
