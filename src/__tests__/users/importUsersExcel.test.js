// @vitest-environment node

/**
 * Testes da leitura de ficheiros .xlsx na importação de utilizadores.
 *
 * Escrevem um ficheiro com o ExcelJS e voltam a lê-lo com a função que
 * a aplicação usa. É um teste de ida e volta: se o formato mudar de um
 * dos lados, isto apanha.
 *
 * A migração de `xlsx` para `exceljs` foi feita porque o primeiro tem
 * duas vulnerabilidades sem correção no npm, e ambas são de leitura —
 * exatamente o que esta função faz sobre um ficheiro escolhido por
 * quem está do outro lado do ecrã.
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import { readExcelFile } from "@/app/[locale]/(app)/users/components/ImportUsersModal/ImportUsersModal";

/** Escreve um livro em memória e devolve-o como um File do browser. */
async function makeFile(build) {
  const workbook = new ExcelJS.Workbook();
  build(workbook);

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    name: "import.xlsx",
    arrayBuffer: async () => buffer,
  };
}

describe("readExcelFile", () => {
  it("lê cabeçalhos e linhas", async () => {
    const file = await makeFile((workbook) => {
      const sheet = workbook.addWorksheet("Users");
      sheet.addRow(["name", "phone_number", "email"]);
      sheet.addRow(["Ana", "+351910000000", "ana@digik.pt"]);
      sheet.addRow(["Rui", "+351920000000", "rui@digik.pt"]);
    });

    const rows = await readExcelFile(file);

    expect(rows).toEqual([
      { name: "Ana", phone_number: "+351910000000", email: "ana@digik.pt" },
      { name: "Rui", phone_number: "+351920000000", email: "rui@digik.pt" },
    ]);
  });

  it("prefere a folha chamada Users", async () => {
    const file = await makeFile((workbook) => {
      const other = workbook.addWorksheet("Notas");
      other.addRow(["name"]);
      other.addRow(["Errado"]);

      const users = workbook.addWorksheet("Users");
      users.addRow(["name"]);
      users.addRow(["Certo"]);
    });

    const rows = await readExcelFile(file);

    expect(rows).toEqual([{ name: "Certo" }]);
  });

  it("cai na primeira folha quando não há Users", async () => {
    const file = await makeFile((workbook) => {
      const sheet = workbook.addWorksheet("Contactos");
      sheet.addRow(["name"]);
      sheet.addRow(["Ana"]);
    });

    const rows = await readExcelFile(file);

    expect(rows).toEqual([{ name: "Ana" }]);
  });

  it("converte números e datas em texto", async () => {
    // O resto do fluxo de importação espera strings, como o `xlsx`
    // devolvia. Um telefone lido como número perderia o zero à frente.
    const file = await makeFile((workbook) => {
      const sheet = workbook.addWorksheet("Users");
      sheet.addRow(["name", "code", "since"]);
      sheet.addRow(["Ana", 12345, new Date("2026-01-15T00:00:00Z")]);
    });

    const [row] = await readExcelFile(file);

    expect(row.code).toBe("12345");
    expect(typeof row.since).toBe("string");
    expect(row.since).toContain("2026-01-15");
  });

  it("lê texto rico como texto simples", async () => {
    const file = await makeFile((workbook) => {
      const sheet = workbook.addWorksheet("Users");
      sheet.addRow(["name"]);
      sheet.addRow([
        {
          richText: [
            { text: "Ana " },
            { font: { bold: true }, text: "Silva" },
          ],
        },
      ]);
    });

    const [row] = await readExcelFile(file);

    expect(row.name).toBe("Ana Silva");
  });

  it("ignora colunas sem cabeçalho", async () => {
    const file = await makeFile((workbook) => {
      const sheet = workbook.addWorksheet("Users");
      sheet.addRow(["name", ""]);
      sheet.addRow(["Ana", "lixo"]);
    });

    const [row] = await readExcelFile(file);

    expect(Object.keys(row)).toEqual(["name"]);
  });

  it("descarta linhas vazias", async () => {
    // O ExcelJS devolve linhas que só têm formatação. Sem a guarda,
    // entravam como utilizadores em branco.
    const file = await makeFile((workbook) => {
      const sheet = workbook.addWorksheet("Users");
      sheet.addRow(["name"]);
      sheet.addRow(["Ana"]);
      sheet.addRow([""]);
      sheet.getRow(4).getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
    });

    const rows = await readExcelFile(file);

    expect(rows).toEqual([{ name: "Ana" }]);
  });

  it("rebenta com uma mensagem clara num ficheiro sem folhas", async () => {
    const file = await makeFile(() => {});

    await expect(readExcelFile(file)).rejects.toThrow("No sheets found");
  });
});
