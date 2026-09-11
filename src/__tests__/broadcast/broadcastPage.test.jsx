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

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({}) } }),
}));

import BroadcastPage from "@/app/[locale]/(app)/broadcast/page.jsx";

const ORG_ID = 7;

const USERS = [
  { id: 1, name: "Pedro Silva", phone_number: "+351910000001", tags: [] },
  { id: 2, name: "Ana Costa", phone_number: "+351910000002", tags: [] },
];

const OPENING = {
  body: "Corpo guardado da organização",
  isDefault: false,
  defaultBody: "Texto por omissão",
  intro: "Olá {{nome}}!\n\nDesejas receber comunicações da {{empresa}}?",
  outro: "Confirma a tua escolha clicando no botão abaixo.",
  button: "Aceito",
  maxLength: 600,
};

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe("BroadcastPage", () => {
  const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

  beforeEach(() => {
    resetAppMocks();
    setDefaultAppMockReturns({
      org: { org: { id: ORG_ID, name: "Digik" }, loading: false },
    });

    mocks.fetch.mockImplementation((input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();

      if (url.startsWith("/api/users")) return makeResponse({ items: USERS });
      if (url.startsWith("/api/assistants")) return makeResponse({ items: [] });
      if (url.startsWith("/api/tags")) return makeResponse({ items: [] });
      if (url.startsWith("/api/organizations/messaging-feature")) {
        return makeResponse({ item: { read_chains_enabled: false } });
      }
      if (url.startsWith("/api/organizations/opening-message")) {
        return makeResponse({ item: OPENING });
      }
      if (url === "/api/broadcast/whatsapp" && method === "POST") {
        return makeResponse({ ok: 1, failed: 0, results: [], note: null });
      }
      if (url === "/api/broadcast/teams" && method === "POST") {
        return makeResponse({ ok: 1, failed: 0, results: [] });
      }

      return makeResponse({});
    });

    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastPostTo(path) {
    const call = [...mocks.fetch.mock.calls]
      .reverse()
      .find(
        ([url, init]) =>
          url === path && (init?.method || "GET").toUpperCase() === "POST",
      );
    return call ? JSON.parse(call[1].body) : null;
  }

  async function openWhatsapp() {
    render(<BroadcastPage />);
    await screen.findByText("Pedro Silva");
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
  }

  it("shows the start menu for WhatsApp and the editor for Teams", async () => {
    render(<BroadcastPage />);
    await screen.findByText("Pedro Silva");

    expect(screen.queryByTestId("start-menu")).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Broadcast.message" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(screen.getByTestId("start-menu")).toBeInTheDocument();
    expect(screen.getByText("Broadcast.start.opening")).toBeInTheDocument();
    expect(screen.getByText("Broadcast.start.blank")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Broadcast.send" })).toBeDisabled();
  });

  it("sends only the opening template with the edited body", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByText("Broadcast.start.opening"));

    const body = await screen.findByLabelText("Broadcast.composer.openingBody");
    expect(body).toHaveValue(OPENING.body);
    expect(screen.getByTestId("whatsapp-phone")).toHaveTextContent(
      "Desejas receber comunicações da Digik?",
    );

    fireEvent.change(body, { target: { value: "  Corpo\n\nsó hoje " } });
    fireEvent.click(screen.getByText("Pedro Silva"));

    const send = screen.getByRole("button", { name: "Broadcast.send" });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => {
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull();
    });

    expect(lastPostTo("/api/broadcast/whatsapp")).toMatchObject({
      orgId: ORG_ID,
      openingOnly: true,
      openingBody: "Corpo só hoje",
      message: "",
      recipients: [{ userId: 1 }],
    });
  });

  it("sends a blank message written in the bubble with a variable chip", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByText("Broadcast.start.blank"));

    const editor = screen.getByRole("textbox", { name: "Broadcast.message" });
    editor.appendChild(document.createTextNode("Olá "));
    fireEvent.input(editor);

    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.composer.add" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "Broadcast.composer.variableName",
      }),
    );

    fireEvent.click(screen.getByText("Ana Costa"));
    fireEvent.click(screen.getByRole("button", { name: "Broadcast.send" }));

    await waitFor(() => {
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull();
    });

    expect(lastPostTo("/api/broadcast/whatsapp")).toMatchObject({
      message: "Olá {{nome}} ",
      recipients: [{ userId: 2 }],
    });
    expect(lastPostTo("/api/broadcast/whatsapp").openingOnly).toBeUndefined();
  });

  it("goes back to the start menu from the editor", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByText("Broadcast.start.blank"));
    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.composer.back" }),
    );

    expect(screen.getByTestId("start-menu")).toBeInTheDocument();
  });
});
