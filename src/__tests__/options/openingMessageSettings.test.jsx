import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  registerAppModulePacks,
  setDefaultAppMockReturns,
  resetAppMocks,
} from "../utils/mocks";

registerAppModulePacks();

import OptionsPage from "@/app/[locale]/(app)/options/page.jsx";

const ORG_ID = 7;

const ITEM = {
  body: "Corpo atual da organização",
  isDefault: false,
  defaultBody: "Texto por omissão",
  intro: "Olá {{nome}}!\n\nDesejas receber comunicações da {{empresa}}?",
  outro: "Confirma a tua escolha clicando no botão abaixo.",
  button: "Aceito",
  maxLength: 600,
};

function makeResponse(data, ok = true, status = ok ? 200 : 500) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("OptionsPage opening message", () => {
  const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

  beforeEach(() => {
    resetAppMocks();
    setDefaultAppMockReturns({
      org: { org: { id: ORG_ID, name: "Digik" }, loading: false },
    });

    mocks.fetch.mockImplementation((input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();

      if (url.startsWith("/api/organizations/opening-message") && method === "GET") {
        return makeResponse({ item: ITEM });
      }

      if (url === "/api/organizations/opening-message" && method === "PUT") {
        const sent = JSON.parse(init.body);
        return makeResponse({
          ok: true,
          item: { ...ITEM, body: sent.body, isDefault: false },
        });
      }

      return makeResponse({});
    });

    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the fixed parts with sample values and the editable body", async () => {
    render(<OptionsPage />);

    const input = await screen.findByLabelText("bodyLabel");

    expect(input).toHaveValue(ITEM.body);
    expect(screen.getByTestId("whatsapp-phone")).toHaveTextContent(
      "Desejas receber comunicações da Digik?",
    );
    expect(screen.getByTestId("whatsapp-phone")).toHaveTextContent(
      ITEM.outro,
    );
    expect(screen.getByText("Aceito")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  });

  it("saves the cleaned body and shows confirmation", async () => {
    render(<OptionsPage />);

    const input = await screen.findByLabelText("bodyLabel");

    fireEvent.change(input, {
      target: { value: "  Novo corpo\n\ncom   espaços " },
    });

    const save = screen.getByRole("button", { name: "save" });
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("saved");
    });

    const putCall = mocks.fetch.mock.calls.find(
      ([, init]) => (init?.method || "GET").toUpperCase() === "PUT",
    );

    expect(JSON.parse(putCall[1].body)).toEqual({
      orgId: ORG_ID,
      body: "Novo corpo com espaços",
    });
    expect(input).toHaveValue("Novo corpo com espaços");
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  });

  it("blocks saving an empty body and restores the default text", async () => {
    render(<OptionsPage />);

    const input = await screen.findByLabelText("bodyLabel");

    fireEvent.change(input, { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    expect(screen.getByText("empty")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(input).toHaveValue(ITEM.defaultBody);
    expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
  });

  it("shows an error with retry when loading fails", async () => {
    mocks.fetch.mockImplementation(() =>
      makeResponse({ error: "boom" }, false),
    );

    render(<OptionsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("loadFailed");
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });
});
