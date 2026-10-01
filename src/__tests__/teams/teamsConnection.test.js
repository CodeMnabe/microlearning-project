import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/teamsInstallations.repo", () => ({
  getPendingTeamsUserInstallations: vi.fn(),
  getTeamsInstallationByConversation: vi.fn(),
  upsertTeamsInstallation: vi.fn(),
}));
vi.mock("@/lib/repos/user.repo", () => ({
  getUserByAadObjectId: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("@/lib/repos/assistants.repo", () => ({
  getFirstAssistantInOrg: vi.fn(),
}));
vi.mock("@/lib/services/automations/automationEngine", () => ({
  emitAutomationEvent: vi.fn(),
}));
vi.mock("@/lib/teams/auth", () => ({
  getBotToken: vi.fn(),
}));

import {
  linkPendingTeamsInstallations,
  linkTeamsUserByEmail,
} from "@/lib/services/teams/teamsConnection";

const ORG = { id: 4 };

const CONTEXT = {
  organization: ORG,
  tenantId: "tenant-1",
  aadObjectId: "aad-ana",
  teamsUserId: "29:ana",
  serviceUrl: "https://smba.trafficmanager.net/emea/",
  conversationId: "a:ana",
  conversationType: "personal",
};

const ANA = {
  id: 42,
  organization_id: 4,
  email: "ana@empresa.pt",
  assistant_id: 7,
  teams_aad_object_id: null,
};

function makeDeps(overrides = {}) {
  return {
    emitAutomationEvent: vi.fn(async () => []),
    getFirstAssistantInOrg: vi.fn(async () => ({ id: 1 })),
    getPendingTeamsUserInstallations: vi.fn(async () => []),
    getTeamsInstallationByConversation: vi.fn(async () => null),
    getTeamsMember: vi.fn(async () => ({
      email: "Ana@Empresa.pt",
      userPrincipalName: "ana@empresa.onmicrosoft.com",
      aadObjectId: "aad-ana",
    })),
    getUserByAadObjectId: vi.fn(async () => null),
    getUserByEmail: vi.fn(async (email) => (email === "ana@empresa.pt" ? 42 : null)),
    getUserById: vi.fn(async () => ANA),
    updateUser: vi.fn(async () => ({})),
    upsertTeamsInstallation: vi.fn(async (row) => row),
    ...overrides,
  };
}

describe("Teams connection by Microsoft email", () => {
  let deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("links someone who installs the app and is already on the platform", async () => {
    const result = await linkTeamsUserByEmail({ ...CONTEXT, deps });

    expect(result.linked).toBe(true);
    expect(deps.updateUser).toHaveBeenCalledWith(42, {
      teamsAadObjectId: "aad-ana",
      teamsFromId: "29:ana",
    });
    expect(deps.upsertTeamsInstallation).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 42,
        assistant_id: 7,
        conversation_id: "a:ana",
      }),
    );
    expect(deps.emitAutomationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, channels: ["teams"] }),
    );
  });

  it("does not take over a user already linked to another Teams account", async () => {
    deps.getUserById.mockResolvedValue({
      ...ANA,
      teams_aad_object_id: "aad-someone-else",
    });

    const result = await linkTeamsUserByEmail({ ...CONTEXT, deps });

    expect(result).toMatchObject({ linked: false, reason: "linked_elsewhere" });
    expect(deps.updateUser).not.toHaveBeenCalled();
  });

  it("links a pending installation when the admin adds that email", async () => {
    deps.getPendingTeamsUserInstallations.mockResolvedValue([
      {
        assistant_id: 1,
        tenant_id: "tenant-1",
        service_url: CONTEXT.serviceUrl,
        conversation_id: "a:ana",
        conversation_type: "personal",
        teams_user_id: "29:ana",
      },
    ]);

    await linkPendingTeamsInstallations({ user: ANA, deps });

    expect(deps.updateUser).toHaveBeenCalledWith(42, {
      teamsAadObjectId: "aad-ana",
      teamsFromId: "29:ana",
    });
    expect(deps.upsertTeamsInstallation).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 42, conversation_id: "a:ana" }),
    );
  });
});
