import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import * as espree from "espree";
import { describe, expect, it } from "vitest";
import { EVENT_SCHEMAS } from "@/lib/observability/logger";

const ROOT = resolve(process.cwd());
const LOGGER_PATH = resolve(ROOT, "src/lib/observability/logger.js");
const LOGGER_MODULE = "@/lib/observability/logger";
const SERVER_ROOTS = [resolve(ROOT, "src/app/api"), resolve(ROOT, "src/lib")];
const LOGGER_METHODS = new Set(["debug", "info", "warn", "error"]);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function serverJavaScriptFiles() {
  return SERVER_ROOTS.flatMap(walk).filter(
    (path) => /\.[cm]?[jt]sx?$/.test(path) && !path.includes("__tests__"),
  );
}

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, callback);
    } else if (value && typeof value.type === "string") {
      visit(value, callback);
    }
  }
}

function memberMethod(node) {
  if (!node || node.type !== "MemberExpression") return null;
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  if (node.computed && node.property.type === "Literal") {
    return node.property.value;
  }
  return null;
}

function declaredNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === "Identifier") return [pattern.name];
  if (pattern.type !== "ObjectPattern") return [];
  return pattern.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    return declaredNames(property.value);
  });
}

function literalPropertyName(property) {
  if (property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return property.key.value;
  return null;
}

function analyzeLoggerSource(source, file = "fixture.js") {
  const violations = [];
  let ast;
  try {
    ast = espree.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
      loc: true,
    });
  } catch (error) {
    return {
      calls: 0,
      events: [],
      violations: [`${file}: parse failed: ${error.message}`],
    };
  }

  const loggerNames = new Set();
  const extractedMethods = new Set();
  const events = [];
  let calls = 0;

  visit(ast, (node) => {
    if (
      node.type === "ImportDeclaration" &&
      node.source.value === LOGGER_MODULE
    ) {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === "ImportSpecifier" &&
          specifier.imported.name === "logger"
        ) {
          loggerNames.add(specifier.local.name);
          if (specifier.local.name !== "logger") {
            violations.push(
              `${file}:${specifier.loc.start.line}: logger import alias is forbidden`,
            );
          }
        }
      }
      return;
    }

    if (node.type === "VariableDeclarator") {
      if (node.init?.type === "Identifier" && loggerNames.has(node.init.name)) {
        for (const name of declaredNames(node.id)) loggerNames.add(name);
        violations.push(
          `${file}:${node.loc.start.line}: direct logger alias is forbidden`,
        );
      }

      const method = memberMethod(node.init);
      if (
        method &&
        LOGGER_METHODS.has(method) &&
        node.init.object.type === "Identifier" &&
        loggerNames.has(node.init.object.name)
      ) {
        for (const name of declaredNames(node.id)) extractedMethods.add(name);
        violations.push(
          `${file}:${node.loc.start.line}: extracted logger method is forbidden`,
        );
      }

      if (
        node.id.type === "ObjectPattern" &&
        node.init?.type === "Identifier" &&
        loggerNames.has(node.init.name)
      ) {
        for (const name of declaredNames(node.id)) extractedMethods.add(name);
        violations.push(
          `${file}:${node.loc.start.line}: destructured logger method is forbidden`,
        );
      }
      return;
    }

    if (node.type !== "CallExpression") return;

    if (
      node.callee.type === "Identifier" &&
      extractedMethods.has(node.callee.name)
    ) {
      violations.push(
        `${file}:${node.loc.start.line}: extracted logger method call is forbidden`,
      );
      return;
    }

    const method = memberMethod(node.callee);
    if (
      !method ||
      !LOGGER_METHODS.has(method) ||
      node.callee.object.type !== "Identifier" ||
      !loggerNames.has(node.callee.object.name)
    ) {
      return;
    }

    calls += 1;
    if (node.callee.computed) {
      violations.push(
        `${file}:${node.loc.start.line}: computed logger method is forbidden`,
      );
    }

    const eventArgument = node.arguments[0];
    if (
      !eventArgument ||
      eventArgument.type !== "Literal" ||
      typeof eventArgument.value !== "string"
    ) {
      violations.push(
        `${file}:${node.loc.start.line}: event must be a direct string literal`,
      );
      return;
    }

    const event = eventArgument.value;
    events.push(event);
    if (!Object.hasOwn(EVENT_SCHEMAS, event)) {
      violations.push(
        `${file}:${node.loc.start.line}: event ${event} is not registered`,
      );
      return;
    }

    const fields = node.arguments[1];
    if (!fields) return;
    if (fields.type !== "ObjectExpression") {
      violations.push(
        `${file}:${node.loc.start.line}: fields must be an object literal`,
      );
      return;
    }

    for (const property of fields.properties) {
      if (property.type === "SpreadElement") {
        violations.push(
          `${file}:${property.loc.start.line}: field spreads are forbidden`,
        );
        continue;
      }
      const field = literalPropertyName(property);
      if (!field) {
        violations.push(
          `${file}:${property.loc.start.line}: computed fields are forbidden`,
        );
      } else if (!Object.hasOwn(EVENT_SCHEMAS[event], field)) {
        violations.push(
          `${file}:${property.loc.start.line}: field ${field} is not allowed for ${event}`,
        );
      }
    }
  });

  return { calls, events, violations };
}

describe("server logging policy", () => {
  it("uses direct console output only inside the central logger sink", () => {
    const violations = serverJavaScriptFiles()
      .filter((path) => path !== LOGGER_PATH)
      .flatMap((path) => {
        const source = readFileSync(path, "utf8");
        return [
          ...source.matchAll(
            /console\.(?:log|info|warn|error|debug|alert)\s*\(/g,
          ),
        ].map(
          (match) =>
            `${path}:${source.slice(0, match.index).split("\n").length}`,
        );
      });
    expect(violations).toEqual([]);
  });

  it("requires direct literals, registered events, and schema-bound fields", () => {
    const results = serverJavaScriptFiles().map((path) =>
      analyzeLoggerSource(readFileSync(path, "utf8"), path),
    );
    expect(results.flatMap((result) => result.violations)).toEqual([]);
    expect(results.reduce((total, result) => total + result.calls, 0)).toBe(
      116,
    );
    expect(new Set(results.flatMap((result) => result.events)).size).toBe(64);
  });

  it.each([
    [
      "dynamic event variable",
      'import { logger } from "@/lib/observability/logger"; const event = "teams_message_received"; logger.info(event, {});',
    ],
    [
      "template event",
      'import { logger } from "@/lib/observability/logger"; logger.info(`teams_message_received`, {});',
    ],
    [
      "concatenated event",
      'import { logger } from "@/lib/observability/logger"; logger.info("teams_" + "message_received", {});',
    ],
    [
      "computed method",
      'import { logger } from "@/lib/observability/logger"; logger["info"]("teams_message_received", {});',
    ],
    [
      "extracted method",
      'import { logger } from "@/lib/observability/logger"; const log = logger.info; log("teams_message_received", {});',
    ],
    [
      "destructured method",
      'import { logger } from "@/lib/observability/logger"; const { info } = logger; info("teams_message_received", {});',
    ],
    [
      "logger alias",
      'import { logger as safeLogger } from "@/lib/observability/logger"; safeLogger.info("teams_message_received", {});',
    ],
    [
      "direct alias",
      'import { logger } from "@/lib/observability/logger"; const alias = logger; alias.info("teams_message_received", {});',
    ],
  ])("rejects %s", (_label, source) => {
    expect(analyzeLoggerSource(source).violations.length).toBeGreaterThan(0);
  });

  it("accepts only the direct literal form", () => {
    const source =
      'import { logger } from "@/lib/observability/logger"; logger.info("teams_message_received", { provider: "teams", operation: "command_dispatch", outcome: "command_detected" });';
    expect(analyzeLoggerSource(source).violations).toEqual([]);
  });
});
