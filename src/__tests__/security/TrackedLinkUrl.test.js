import { describe, expect, it } from "vitest";
import {
  TrackedLinkUrlValidationError,
  validateTrackedLinkDestination,
  validateTrackedLinks,
} from "@/lib/services/broadcast/trackedLinkUrl";

const javascriptPayload =
  "javascript:document.body.dataset.securityTest='executed'";

describe("Tracked-link destination validation", () => {
  it("accepts only absolute http and https URLs and canonicalizes them", () => {
    expect(validateTrackedLinkDestination("https://example.com")).toBe(
      "https://example.com/",
    );
    expect(validateTrackedLinkDestination("http://example.com")).toBe(
      "http://example.com/",
    );
    expect(
      validateTrackedLinkDestination(
        " HTTPS://EXAMPLE.COM/path?q=1#section ",
      ),
    ).toBe("https://example.com/path?q=1#section");
  });

  it.each([
    javascriptPayload,
    "JaVaScRiPt:document.body.dataset.securityTest='executed'",
    ` \t${javascriptPayload}`,
    "data:text/html,<p>unsafe-test-payload</p>",
    "file:///tmp/test",
    "vbscript:msgbox(1)",
    "custom-scheme:value",
    "/relative/path",
    "relative/path",
    "www.example.com",
    "",
    "   ",
    "https://[",
    "https://user:pass@example.com/path",
  ])("rejects unsafe or invalid value %s", (value) => {
    expect(() => validateTrackedLinkDestination(value)).toThrow(
      TrackedLinkUrlValidationError,
    );
  });

  it.each([null, undefined, [], {}, 123])(
    "rejects non-string value %p",
    (value) => {
      expect(() => validateTrackedLinkDestination(value)).toThrow(
        TrackedLinkUrlValidationError,
      );
    },
  );

  it("canonicalizes all tracked links before they enter a caller", () => {
    expect(
      validateTrackedLinks([
        { key: "one", label: "One", destinationUrl: " https://example.com " },
      ]),
    ).toEqual([
      { key: "one", label: "One", destinationUrl: "https://example.com/" },
    ]);
  });
});
