import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "pt",
  useTranslations: () => (key, vars) => {
    if (!vars) return key;

    if (Object.prototype.hasOwnProperty.call(vars, "name")) {
      return `${key}:${vars.name}`;
    }

    if (Object.prototype.hasOwnProperty.call(vars, "default")) {
      return vars.default;
    }

    return key;
  },
}));
