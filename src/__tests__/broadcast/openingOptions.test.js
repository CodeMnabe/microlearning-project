import { describe, expect, it } from "vitest";

import { parseOpeningOptions } from "@/lib/services/broadcast/openingOptions";

describe("parseOpeningOptions", () => {
  it("defaults to a normal send without body override", () => {
    expect(parseOpeningOptions({})).toEqual({
      openingOnly: false,
      openingBody: null,
    });
    expect(parseOpeningOptions({ openingBody: "" }).openingBody).toBeNull();
  });

  it("only treats a literal true as openingOnly", () => {
    expect(parseOpeningOptions({ openingOnly: true }).openingOnly).toBe(true);
    expect(parseOpeningOptions({ openingOnly: "true" }).openingOnly).toBe(
      false,
    );
  });

  it("cleans the body override", () => {
    expect(parseOpeningOptions({ openingBody: " Olá\n\n  a todos " })).toEqual({
      openingOnly: false,
      openingBody: "Olá a todos",
    });
  });

  it("rejects a non-string, blank or too long body", () => {
    expect(parseOpeningOptions({ openingBody: 12 }).error).toBeTruthy();
    expect(parseOpeningOptions({ openingBody: "   " }).error).toBeTruthy();
    expect(
      parseOpeningOptions({ openingBody: "x".repeat(601) }).error,
    ).toBeTruthy();
  });
});
