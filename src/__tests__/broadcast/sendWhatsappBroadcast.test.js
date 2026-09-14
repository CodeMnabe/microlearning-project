import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  org: null,
  getUserById: vi.fn(),
  isWindowOpenForUser: vi.fn(),
  createPendingOutreach: vi.fn(),
  createMessage: vi.fn(),
  createQuestion: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: mocks.org, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/repos/user.repo", () => ({
  getUserById: (...args) => mocks.getUserById(...args),
}));

vi.mock("@/lib/repos/messages.repo", () => ({
  isWindowOpenForUser: (...args) => mocks.isWindowOpenForUser(...args),
  createMessage: (...args) => mocks.createMessage(...args),
}));

vi.mock("@/lib/repos/pendingOutreach.repo", () => ({
  createPendingOutreach: (...args) => mocks.createPendingOutreach(...args),
}));

vi.mock("@/lib/repos/questions.repo", () => ({
  createQuestion: (...args) => mocks.createQuestion(...args),
}));

vi.mock("@/lib/services/broadcast/trackedLinks", () => ({
  resolveTrackedLinksForRecipient: async () => [],
  replaceTrackedPlaceholders: (text) => text,
}));

vi.mock("@/lib/whatsapp/E164", () => ({
  toE164: async (value) => value,
}));

import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import { DEFAULT_OPENING_BODY } from "@/lib/whatsapp/openingTemplate";

const ORG = {
  id: 1,
  name: "DIGIK",
  channel_id: "channel-1",
  waba_namespace: null,
  default_phone_country_code: "+351",
  whatsapp_opening_body: "Corpo guardado na organização",
};

const USER = {
  id: 42,
  organization_id: 1,
  name: "Pedro",
  phone_number: "+351910000000",
};

function birdCall(index = 0) {
  const [url, init] = mocks.fetch.mock.calls[index];
  return { url, body: JSON.parse(init.body) };
}

function templateParams(body) {
  return Object.fromEntries(
    body.template.parameters.map((p) => [p.key, p.value]),
  );
}

describe("sendWhatsappBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.org = { ...ORG };
    mocks.getUserById.mockResolvedValue({ ...USER });
    mocks.isWindowOpenForUser.mockResolvedValue(false);
    mocks.createPendingOutreach.mockResolvedValue({ id: "po-1" });
    mocks.createMessage.mockResolvedValue({ id: 900 });
    mocks.createQuestion.mockResolvedValue({ id: 10 });
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "bird-msg-1" }),
    });

    vi.stubGlobal("fetch", mocks.fetch);
    vi.stubEnv("WORKSPACE_ID", "ws-1");
    vi.stubEnv("BIRD_API_KEY", "key-1");
    vi.stubEnv("BIRD_OPENING_TEMPLATE_PROJECT_ID", "project-opening");
    vi.stubEnv("BIRD_OPENING_TEMPLATE_LOCALE", "pt-PT");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });


  it.each([true, false])("envia pergunta aberta sem botões ou guarda-a em espera (janela=%s)", async (windowOpen) => {
    mocks.isWindowOpenForUser.mockResolvedValue(windowOpen);
    const result = await sendWhatsappBroadcast({
      orgId: 1, recipients: [{ userId: 42 }], scheduledBroadcastId: "schedule-1",
      question: { kind: "open", body: "Como verificas os pneus?", expectedAnswer: "A frio.", aiEvaluation: false },
    });
    expect(result.questionId).toBe(10);
    expect(mocks.createQuestion).toHaveBeenCalledWith(expect.objectContaining({
      kind: "open", expectedAnswer: "A frio.", options: { aiEvaluation: false }, scheduledBroadcastId: "schedule-1",
    }));
    if (windowOpen) {
      expect(birdCall().body.body).toEqual({ type: "text", text: { text: "Como verificas os pneus?" } });
      expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({ questionId: 10 }));
    } else {
      expect(mocks.createPendingOutreach).toHaveBeenCalledWith(expect.objectContaining({ payload: {
        type: "open", questionId: 10, message: "Como verificas os pneus?", imageUrls: [], actions: null,
      } }));
    }
  });

  it("sends the message directly when the 24h window is open", async () => {
    mocks.isWindowOpenForUser.mockResolvedValue(true);

    const result = await sendWhatsappBroadcast({
      orgId: 1,
      message: "Olá {{nome}}",
      recipients: [{ userId: 42 }],
    });

    expect(result.ok).toBe(1);
    expect(result.queued).toBe(0);
    expect(result.results[0].kind).toBe("freeform");

    const { body } = birdCall();
    expect(body.body).toEqual({ type: "text", text: { text: "Olá Pedro" } });
    expect(mocks.createPendingOutreach).not.toHaveBeenCalled();
  });

  it("sends the opening template with the organization body and queues the message when the window is closed", async () => {
    const result = await sendWhatsappBroadcast({
      orgId: 1,
      message: "Dica de hoje",
      recipients: [{ userId: 42 }],
    });

    expect(result.ok).toBe(1);
    expect(result.queued).toBe(1);
    expect(result.note).toMatch(/opening message/);
    expect(result.results[0].kind).toBe("template");

    const { body } = birdCall();
    expect(body.template.projectId).toBe("project-opening");
    expect(body.template.version).toBe("latest");
    expect(body.template.locale).toBe("pt-PT");
    expect(templateParams(body)).toEqual({
      nome: "Pedro",
      empresa: "DIGIK",
      mensagem: "Corpo guardado na organização",
    });

    expect(mocks.createPendingOutreach).toHaveBeenCalledTimes(1);
    expect(mocks.createPendingOutreach.mock.calls[0][0]).toMatchObject({
      orgId: 1,
      userId: 42,
      payload: { message: "Dica de hoje", imageUrls: [] },
      templateMessageId: "bird-msg-1",
    });
  });

  it("uses the default body when the organization has none", async () => {
    mocks.org = { ...ORG, whatsapp_opening_body: null };

    await sendWhatsappBroadcast({
      orgId: 1,
      message: "Dica",
      recipients: [{ userId: 42 }],
    });

    expect(templateParams(birdCall().body).mensagem).toBe(DEFAULT_OPENING_BODY);
  });

  it("lets a send override the body for that send only", async () => {
    await sendWhatsappBroadcast({
      orgId: 1,
      message: "Dica",
      openingBody: "  Corpo\n\nsó para este envio ",
      recipients: [{ userId: 42 }],
    });

    expect(templateParams(birdCall().body).mensagem).toBe(
      "Corpo só para este envio",
    );
  });

  it("sends only the opening template when openingOnly is set, even inside the window", async () => {
    mocks.isWindowOpenForUser.mockResolvedValue(true);

    const result = await sendWhatsappBroadcast({
      orgId: 1,
      openingOnly: true,
      recipients: [{ userId: 42 }],
    });

    expect(result.ok).toBe(1);
    expect(result.queued).toBe(0);
    expect(result.note).toBeNull();
    expect(result.results[0].kind).toBe("template");
    expect(birdCall().body.template).toBeTruthy();
    expect(mocks.isWindowOpenForUser).not.toHaveBeenCalled();
    expect(mocks.createPendingOutreach).not.toHaveBeenCalled();
  });

  it("rejects a send with nothing to deliver", async () => {
    await expect(
      sendWhatsappBroadcast({ orgId: 1, recipients: [{ userId: 42 }] }),
    ).rejects.toThrow(/Missing message\/images/);
  });

  it("fails the recipient with a clear error when the template is not configured", async () => {
    vi.stubEnv("BIRD_OPENING_TEMPLATE_PROJECT_ID", "");

    const result = await sendWhatsappBroadcast({
      orgId: 1,
      message: "Dica",
      recipients: [{ userId: 42 }],
    });

    expect(result.ok).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].data.error).toMatch(
      /BIRD_OPENING_TEMPLATE_PROJECT_ID/,
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not need the template when every recipient is inside the window", async () => {
    vi.stubEnv("BIRD_OPENING_TEMPLATE_PROJECT_ID", "");
    mocks.isWindowOpenForUser.mockResolvedValue(true);

    const result = await sendWhatsappBroadcast({
      orgId: 1,
      message: "Dica",
      recipients: [{ userId: 42 }],
    });

    expect(result.ok).toBe(1);
  });

  describe("quiz", () => {
    const QUIZ = {
      kind: "quiz",
      body: "Olá {{nome}}, qual é a pressão certa?",
      options: [
        { label: "2,2 bar", correct: false },
        { label: "2,8 bar", correct: true },
      ],
      feedbackCorrect: "Boa!",
      feedbackIncorrect: "",
    };

    it("creates the question once and sends it with reply buttons inside the window", async () => {
      mocks.isWindowOpenForUser.mockResolvedValue(true);

      const result = await sendWhatsappBroadcast({
        orgId: 1,
        recipients: [{ userId: 42 }],
        question: QUIZ,
        scheduledBroadcastId: "sb-1",
      });

      expect(result.ok).toBe(1);
      expect(result.questionId).toBe(10);
      expect(result.results[0]).toMatchObject({
        kind: "freeform",
        questionId: 10,
      });

      expect(mocks.createQuestion).toHaveBeenCalledTimes(1);
      expect(mocks.createQuestion.mock.calls[0][0]).toMatchObject({
        organizationId: 1,
        kind: "quiz",
        body: QUIZ.body,
        options: QUIZ.options,
        feedbackCorrect: "Boa!",
        scheduledBroadcastId: "sb-1",
        sendGroupId: result.sendGroupId,
      });
      expect(
        mocks.createQuestion.mock.calls[0][0].expiresAt.getTime(),
      ).toBeGreaterThan(Date.now());

      const { body } = birdCall();
      expect(body.body).toEqual({
        type: "text",
        text: {
          text: "Olá Pedro, qual é a pressão certa?",
          actions: [
            { type: "reply", reply: { text: "2,2 bar" } },
            { type: "reply", reply: { text: "2,8 bar" } },
          ],
        },
      });

      /* A mensagem entregue fica ligada à pergunta pelo id do Bird. */
      expect(mocks.createMessage).toHaveBeenCalledTimes(1);
      expect(mocks.createMessage.mock.calls[0][0]).toMatchObject({
        userId: 42,
        organizationId: 1,
        channel: "whatsapp",
        messageId: "bird-msg-1",
        content: "Olá Pedro, qual é a pressão certa?",
        role: "assistant",
        questionId: 10,
        scheduledBroadcastId: "sb-1",
      });
      expect(mocks.createPendingOutreach).not.toHaveBeenCalled();
    });

    it("queues the quiz with its buttons behind the opening template when the window is closed", async () => {
      const result = await sendWhatsappBroadcast({
        orgId: 1,
        recipients: [{ userId: 42 }],
        question: QUIZ,
      });

      expect(result.queued).toBe(1);
      expect(birdCall().body.template).toBeTruthy();
      expect(mocks.createMessage).not.toHaveBeenCalled();

      expect(mocks.createPendingOutreach).toHaveBeenCalledTimes(1);
      expect(mocks.createPendingOutreach.mock.calls[0][0].payload).toEqual({
        message: "Olá Pedro, qual é a pressão certa?",
        imageUrls: [],
        type: "quiz",
        questionId: 10,
        actions: [
          { type: "reply", reply: { text: "2,2 bar" } },
          { type: "reply", reply: { text: "2,8 bar" } },
        ],
      });
    });

    it("rejects attachments and unknown question kinds", async () => {
      await expect(
        sendWhatsappBroadcast({
          orgId: 1,
          recipients: [{ userId: 42 }],
          question: QUIZ,
          imageUrls: ["https://x/img.png"],
        }),
      ).rejects.toThrow(/anexos/);

      await expect(
        sendWhatsappBroadcast({
          orgId: 1,
          recipients: [{ userId: 42 }],
          question: { kind: "unsupported", body: "?" },
        }),
      ).rejects.toThrow(/Unsupported question kind/);

      expect(mocks.createQuestion).not.toHaveBeenCalled();
    });
  });
});
