import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  registerAppModulePacks,
  setDefaultAppMockReturns,
  resetAppMocks,
} from "../utils/mocks";

registerAppModulePacks();

const alertMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/app/components/Alert/AlertProvider", () => ({
  useAlert: () => alertMock,
}));

import TemplatesPage from "@/app/[locale]/(app)/templates/page.jsx";
import { presetComponents } from "@/app/[locale]/(app)/templates/lib/templateComponents";

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

const ORG_ID = "org_1";

describe("TemplatesPage create flow", () => {
  const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

  beforeEach(() => {
    resetAppMocks();
    setDefaultAppMockReturns({
      org: { org: { id: ORG_ID, name: "Digik" }, loading: false },
    });

    mocks.fetch.mockImplementation((input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();
      if (url === `/api/template/list?orgId=${ORG_ID}` && method === "GET") {
        return makeResponse({ items: [] });
      }
      if (url === "/api/template/create" && method === "POST") {
        return makeResponse({ ok: true, template: { status: "PENDING" } });
      }
      return makeResponse({});
    });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function openCreateTab() {
    render(<TemplatesPage />);
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        `/api/template/list?orgId=${ORG_ID}`,
      ),
    );
    fireEvent.click(screen.getByText("tabCreate"));
    expect(screen.getByText("builder.start.title")).toBeInTheDocument();
  }

  it("walks start -> compose -> review -> submit with the generated components", async () => {
    await openCreateTab();

    fireEvent.click(screen.getByText("text_quickreplies"));
    expect(screen.getByText("builder.blocks.body.title")).toBeInTheDocument();
    expect(
      screen.getAllByText("builder.variables.kinds.contact_name").length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("builder.meta.name"), {
      target: { value: "Dica Semanal" },
    });
    expect(screen.getByLabelText("builder.meta.name")).toHaveValue(
      "dica_semanal",
    );

    fireEvent.click(screen.getByText("builder.actions.review"));
    expect(await screen.findByText("builder.review.title")).toBeInTheDocument();
    expect(screen.getByText("dica_semanal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("builder.actions.submit"));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/template/create",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = mocks.fetch.mock.calls.find(
      ([url]) => url === "/api/template/create",
    );
    expect(JSON.parse(call[1].body)).toEqual({
      orgId: ORG_ID,
      name: "dica_semanal",
      language: "pt",
      category: "MARKETING",
      components: presetComponents("text_quickreplies"),
    });

    // Back to the list with the flow reset for next time.
    await waitFor(() =>
      expect(screen.queryByText("builder.review.title")).toBeNull(),
    );
  });

  it("stays on compose and shows the name error when the name is missing", async () => {
    await openCreateTab();

    fireEvent.click(screen.getByText("builder.start.blank"));
    fireEvent.click(screen.getByText("builder.actions.review"));

    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    expect(screen.queryByText("builder.review.title")).toBeNull();
    expect(screen.getByText("editor.errors.nameRequired")).toBeInTheDocument();
    expect(screen.getByText("editor.errors.bodyRequired")).toBeInTheDocument();
  });
});
