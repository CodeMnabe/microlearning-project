import { createRequire } from "node:module";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const SENTINELS = Object.freeze([
  "PRIVATE_MESSAGE_SENTINEL",
  "super-secret-token-should-not-appear",
  "PROVIDER_RESPONSE_SECRET_SENTINEL",
]);

const openai = vi.hoisted(() => ({
  createVectorStore: vi.fn(),
}));

const nodeRequire = createRequire(import.meta.url);
const openAiModulePath = nodeRequire.resolve("openai");
const originalOpenAiModule = nodeRequire.cache[openAiModulePath];
let createOAiVectorStore;

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

describe("vector store lifecycle logging", () => {
  let capture;

  beforeAll(async () => {
    class FakeOpenAI {
      constructor() {
        this.vectorStores = { create: openai.createVectorStore };
        this.beta = { assistants: {}, threads: {} };
        this.files = {};
      }
    }

    nodeRequire.cache[openAiModulePath] = {
      id: openAiModulePath,
      filename: openAiModulePath,
      loaded: true,
      exports: FakeOpenAI,
      children: [],
      paths: [],
    };
    ({ createOAiVectorStore } = await import("@/lib/services/oAi.services"));
  });

  afterAll(() => {
    if (originalOpenAiModule) {
      nodeRequire.cache[openAiModulePath] = originalOpenAiModule;
    } else {
      delete nodeRequire.cache[openAiModulePath];
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capture = captureConsole();
    openai.createVectorStore.mockResolvedValue({
      id: SENTINELS[2],
      name: SENTINELS[0],
    });
  });

  afterEach(() => {
    capture.restore();
  });

  it("logs successful materialization using only a file count", async () => {
    await createOAiVectorStore(SENTINELS[0], [SENTINELS[1], SENTINELS[2]]);
    expect(capture.lines.join("\n")).toContain("openai_operation_completed");
    expect(capture.lines.join("\n")).toContain('"count":2');
    expectNoSentinels(capture.lines);
  });

  it("preserves the previous undefined return for an empty store name", async () => {
    await expect(
      createOAiVectorStore("", ["file-id"]),
    ).resolves.toBeUndefined();
    expect(openai.createVectorStore).not.toHaveBeenCalled();
    expect(capture.lines.join("\n")).toContain("openai_operation_rejected");
  });

  it("classifies provider errors without their message or response", async () => {
    const error = new Error(SENTINELS[0]);
    error.response = { body: SENTINELS[2] };
    openai.createVectorStore.mockRejectedValue(error);
    await createOAiVectorStore(SENTINELS[0], [SENTINELS[1]]);
    expect(capture.lines.join("\n")).toContain("openai_operation_failed");
    expectNoSentinels(capture.lines);
  });
});
