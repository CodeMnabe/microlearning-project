import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  registerAppModulePacks,
  setDefaultAppMockReturns,
  resetAppMocks,
} from "../utils/mocks";

registerAppModulePacks();

import AssistantsHub from "@/app/[locale]/(app)/assistants/page.jsx";

vi.mock("@/app/[locale]/(app)/assistants/CreateAssistantModal", () => ({
  default: ({ isOpen, onClose, onCreated }) =>
    isOpen
      ? React.createElement(
          "div",
          { role: "dialog", "aria-label": "CreateAssistantModal" },
          React.createElement(
            "button",
            { onClick: onCreated, type: "button" },
            "mock-create-done",
          ),
          React.createElement(
            "button",
            { onClick: onClose, type: "button" },
            "mock-close",
          ),
        )
      : null,
}));

vi.mock("@/app/[locale]/(app)/assistants/Chatbox/Chatbox.jsx", () => ({
  default: ({ assistant }) =>
    React.createElement(
      "div",
      { "aria-label": "ChatSandbox" },
      assistant?.name || "no-assistant",
    ),
}));

vi.mock("@/app/component/Slider/Slider", () => ({
  default: ({ value, onChange, min = 0, max = 1, step = 0.01 }) =>
    React.createElement("input", {
      type: range,
      "aria-label": "slider",
      value: value ?? 0,
      min,
      max,
      step,
      onChange,
    }),
}));

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () =>
      Promise.resolve(typeof data === "string" ? data : JSON.stringify(data)),
  });
}

const ORG_ID = "org_1";

const LIST = [
  { id: "asst_1", name: "Alpha" },
  { id: "asst_2", name: "Beta" },
];

const DETAILS_1 = {
  id: "asst_1",
  open_ai_id: "oa_1",
  name: "Alpha",
  description: "Alpha desc",
  instructions: "Alpha instructions",
  model: "gpt-4.1",
  top_p: 0.2,
  temperature: 0.7,
  created_at: new Date("2025-01-01T10:00:00Z").toISOString(),
  vectorStoreId: null,
};

const DETAILS_2 = {
  id: "asst_2",
  open_ai_id: "oa_2",
  name: "Beta",
  description: "Beta desc",
  instructions: "Beta instructions",
  model: "gpt-4.1",
  top_p: 0.5,
  temperature: 1.2,
  created_at: new Date("2025-01-02T10:00:00Z").toISOString(),
  vectorStoreId: null,
};

describe("AssistantsHub Page", () => {
  const mocks = vi.hoisted(() => ({
    fetch: vi.fn(),
  }));

  beforeEach(() => {
    resetAppMocks();

    setDefaultAppMockReturns({
      auth: {
        user: { id: "auth_user_1" },
        loading: false,
        supabase: {
          storage: {
            from: () => ({
              upload: vi.fn().mockResolvedValue({ error: null }),
            }),
          },
        },
      },
      org: { org: { id: ORG_ID }, loading: false },
      confirm: true,
    });

    mocks.fetch.mockImplementation((input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();

      if (url === `/api/assistants?orgId=${ORG_ID}` && method === "GET") {
        return makeResponse(LIST);
      }
      if (url === `/api/assistants/asst_1` && method === "GET") {
        return makeResponse(DETAILS_1);
      }

      if (url === `/api/assistants/asst_2` && method === "GET") {
        return makeResponse(DETAILS_2);
      }

      if (url === `/api/assistants/asst_1` && method === "PATCH") {
        return makeResponse({ ok: true });
      }

      if (url === `/api/assistants/asst_1` && method === "DELETE") {
        return makeResponse({ ok: true });
      }

      return makeResponse();
    });

    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPage() {
    return render(React.createElement(AssistantsHub));
  }

  it("loads assistants list on mount and selects the first item, then loads its details", async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        `/api/assistants?orgId=${ORG_ID}`,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Alpha" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Beta")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_1`);
    });

    expect(
      await screen.findByRole("heading", { name: "Alpha" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Alpha desc")).toBeInTheDocument();
    expect(await screen.findByText("Alpha instructions")).toBeInTheDocument();

    expect(await screen.getByLabelText("ChatSandbox")).toHaveTextContent(
      "Alpha",
    );
  });

  it("switches selection when clicking another assistant in the left list", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alpha");
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_1`),
    );

    await user.click(await screen.findByText("Beta"));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_2`),
    );

    expect(await screen.findByText("Beta desc")).toBeInTheDocument();
    expect(await screen.getByLabelText("ChatSandbox")).toHaveTextContent(
      "Beta",
    );
  });

  it("enter edit mode, edits fields, and saves (PATCH)", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_1`),
    );
    expect(await screen.findByText("Alpha instructions")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Assistants.details.edit" }),
    );

    const titleInput = screen.getByDisplayValue("Alpha");
    await user.clear(titleInput);
    await user.type(titleInput, "Alpha renamed");

    const descriptionInput = screen.getByDisplayValue("Alpha desc");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "New description");

    const instructions = screen.getByDisplayValue("Alpha instructions");
    await user.clear(instructions);
    await user.type(instructions, "New instructions");

    await user.click(
      screen.getByRole("button", { name: "Assistants.details.save" }),
    );

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        `/api/assistants/asst_1`,
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const patchCall = mocks.fetch.mock.calls.find(
      (c) => c[0] === `/api/assistants/asst_1` && c[1]?.method === "PATCH",
    );

    const sent = JSON.parse(patchCall[1].body);

    expect(sent).toMatchObject({
      id: "asst_1",
      open_ai_id: "oa_1",
      name: "Alpha renamed",
      description: "New description",
      instructions: "New instructions",
      model: "gpt-4.1",
    });

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_1`);
    });
  });

  it("deletes assistant after confirmation (DELETE) and selects the remaining one", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_1`),
    );

    await user.click(
      screen.getByRole("button", { name: "Assistants.details.delete" }),
    );

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_1`, {
        method: "DELETE",
      });
    });

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/assistants/asst_2`);
    });

    expect(await screen.findByText("Beta desc")).toBeInTheDocument();
  });

  it("opens create modal, then onCreated refreshes list and selects newest", async () => {
    const user = userEvent.setup();

    let listCallCount = 0;

    mocks.fetch.mockImplementation((input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();

      if (url === `/api/assistants?orgId=${ORG_ID}` && method === "GET") {
        listCallCount += 1;
        if (listCallCount === 1) return makeResponse(LIST);
        return makeResponse([...LIST, { id: "asst_3", name: "Gamma" }]);
      }

      if (url === `/api/assistants/asst_1` && method === "GET")
        return makeResponse(DETAILS_1);
      if (url === `/api/assistants/asst_2` && method === "GET")
        return makeResponse(DETAILS_2);
      if (url === `/api/assistants/asst_3` && method === "GET") {
        return makeResponse({
          ...DETAILS_2,
          id: "asst_3",
          name: "Gamma",
          description: "Gamma desc",
          open_ai_id: "oa_3",
        });
      }

      return makeResponse({});
    });

    renderPage();

    await user.click(
      screen.getByRole("button", { name: "Assistants.createAssistant" }),
    );

    expect(
      screen.getByRole("dialog", { name: "CreateAssistantModal" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "mock-create-done" }));

    expect(
      await screen.findByRole("heading", { name: "Gamma" }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Gamma desc")).toBeInTheDocument();
  });
});
