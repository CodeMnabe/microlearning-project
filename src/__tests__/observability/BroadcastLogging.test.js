import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SENTINELS = Object.freeze([
  "+351911222333",
  "sensitive-user@example.invalid",
  "super-secret-token-should-not-appear",
  "Bearer secret-jwt-value",
  "session=secret-session-value",
  "PRIVATE_MESSAGE_SENTINEL",
  "https://example.invalid/path?token=secret-link-value",
  "TEMPLATE_SECRET_SENTINEL",
  "PROVIDER_RESPONSE_SECRET_SENTINEL",
]);

const mocks = vi.hoisted(() => ({
  getBotToken: vi.fn(),
  getOrganization: vi.fn(),
  getTeamsUserInstallation: vi.fn(),
  getUserById: vi.fn(),
  isWindowOpenForUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 7,
              name: "Synthetic Org",
              channel_id: "channel-sentinel",
              default_phone_country_code: "+351",
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/teams/auth", () => ({ getBotToken: mocks.getBotToken }));
vi.mock("@/lib/repos/organizations.repo", () => ({
  getOrganization: mocks.getOrganization,
}));
vi.mock("@/lib/repos/teamsInstallations.repo", () => ({
  getTeamsUserInstallation: mocks.getTeamsUserInstallation,
}));
vi.mock("@/lib/repos/user.repo", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/lib/repos/messages.repo", () => ({
  isWindowOpenForUser: mocks.isWindowOpenForUser,
}));
vi.mock("@/lib/repos/pendingOutreach.repo", () => ({
  completePendingOutreachTemplateReservation: vi.fn(),
  createPendingOutreach: vi.fn(),
  failPendingOutreachTemplateReservation: vi.fn(),
  markPendingOutreachTemplateSendStarted: vi.fn(),
  renewPendingOutreachTemplateReservation: vi.fn(),
}));
vi.mock("@/lib/webhooks/leaseHeartbeat", () => ({
  startLeaseHeartbeat: () => null,
}));
vi.mock("@/lib/repos/whatsappTemplates.repo", () => ({
  getWhatsappTemplateById: vi.fn(),
  getWhatsappTemplateByProviderId: vi.fn(),
}));
vi.mock("@/lib/whatsapp/E164", () => ({
  toE164: vi.fn(async () => SENTINELS[0]),
}));
vi.mock("@/lib/services/broadcast/trackedLinks", () => ({
  resolveTrackedLinksForRecipient: vi.fn(async () => []),
  replaceTrackedPlaceholders: vi.fn((message) => message),
}));

import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";

function captureConsole() {
  const lines = [];
  const spies = ["info", "warn", "error"].map((level) =>
    vi
      .spyOn(console, level)
      .mockImplementation((value) => lines.push(String(value))),
  );
  return { lines, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}

function expectNoSentinels(lines) {
  const output = lines.join("\n");
  for (const sentinel of SENTINELS) expect(output).not.toContain(sentinel);
}

describe("broadcast operational logging", () => {
  let capture;
  let originalWorkspaceId;
  let originalBirdKey;

  beforeEach(() => {
    vi.clearAllMocks();
    capture = captureConsole();
    originalWorkspaceId = process.env.WORKSPACE_ID;
    originalBirdKey = process.env.BIRD_API_KEY;
    process.env.WORKSPACE_ID = "workspace-sentinel";
    process.env.BIRD_API_KEY = SENTINELS[2];
    mocks.getBotToken.mockResolvedValue(SENTINELS[2]);
    mocks.getOrganization.mockResolvedValue({ id: 7 });
    mocks.getTeamsUserInstallation.mockResolvedValue({
      tenant_id: "tenant-sentinel",
      service_url: SENTINELS[6],
      conversation_id: "conversation-sentinel",
    });
    mocks.getUserById.mockResolvedValue({
      id: 11,
      organization_id: 7,
      name: SENTINELS[1],
      phone_number: SENTINELS[0],
      whatsapp_bsuid: "bsuid-sensitive-sentinel",
      bird_contact_id: "contact-sensitive-sentinel",
    });
    mocks.isWindowOpenForUser.mockResolvedValue(true);
  });

  afterEach(() => {
    capture.restore();
    vi.unstubAllGlobals();
    if (originalWorkspaceId === undefined) delete process.env.WORKSPACE_ID;
    else process.env.WORKSPACE_ID = originalWorkspaceId;
    if (originalBirdKey === undefined) delete process.env.BIRD_API_KEY;
    else process.env.BIRD_API_KEY = originalBirdKey;
  });

  it("keeps Teams success logs while excluding content, URLs, credentials, and provider bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 202,
        text: async () => JSON.stringify({ body: SENTINELS[8] }),
      })),
    );
    await sendTeamsBroadcast({
      orgId: 7,
      userIds: [11],
      message: SENTINELS[5],
      files: [
        { name: "private", url: SENTINELS[6], contentType: "text/plain" },
      ],
      scheduledBroadcastId: "00000000-0000-4000-8000-000000000030",
    });
    expect(capture.lines.join("\n")).toContain("broadcast_delivery_completed");
    expectNoSentinels(capture.lines);
  });

  it("classifies Teams failures without serializing the Error message", async () => {
    mocks.getBotToken.mockRejectedValue(new Error(SENTINELS[5]));
    await sendTeamsBroadcast({
      orgId: 7,
      userIds: [11],
      message: SENTINELS[5],
    });
    expect(capture.lines.join("\n")).toContain("broadcast_delivery_failed");
    expectNoSentinels(capture.lines);
  });

  it("keeps WhatsApp success logs while excluding PII and provider responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 202,
        json: async () => ({ id: "provider-id", body: SENTINELS[8] }),
      })),
    );
    await sendWhatsappBroadcast({
      orgId: 7,
      recipients: [{ userId: 11, email: SENTINELS[1] }],
      message: SENTINELS[5],
      scheduledBroadcastId: "00000000-0000-4000-8000-000000000030",
    });
    expect(capture.lines.join("\n")).toContain("broadcast_delivery_completed");
    expectNoSentinels(capture.lines);
  });

  it("classifies WhatsApp failures without serializing request or error content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error(SENTINELS[8]))),
    );
    await sendWhatsappBroadcast({
      orgId: 7,
      recipients: [{ userId: 11 }],
      message: SENTINELS[5],
    });
    expect(capture.lines.join("\n")).toContain("broadcast_delivery_failed");
    expectNoSentinels(capture.lines);
  });
});
