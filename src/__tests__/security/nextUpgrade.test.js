// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readJson = (name) => JSON.parse(readFileSync(resolve(name), "utf8"));

describe("Atualização de segurança do Next.js", () => {
  it("fixa a versão corrigida e mantém o lock coerente", () => {
    const manifest = readJson("package.json");
    const lock = readJson("package-lock.json");

    expect(manifest.dependencies.next).toBe("16.3.5");
    expect(lock.packages[""].dependencies.next).toBe("16.3.5");
    expect(lock.packages["node_modules/next"].version).toBe("16.3.5");
    expect(lock.packages["node_modules/next"].optionalDependencies.sharp).toBe("^0.35.4");
    expect(lock.packages["node_modules/sharp"].version).toBe("0.35.4");
  });
});
