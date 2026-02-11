import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import CreateAssistantModal from "@/app/[locale]/(app)/assistants/CreateAssistantModal";

vi.mock("@/app/components/PillSelect/PillSelect", () => ({
  default: ({ value, options = [], onChange, placeholder }) =>
    React.createElement(
      "select",
      {
        "aria-label": placeholder || "pillselect",
        value: value ?? "",
        onChange: (e) => onChange?.(e.target.value),
      },
      options.map((o) =>
        React.createElement(
          "option",
          { key: o.value, value: o.value },
          o.label,
        ),
      ),
    ),
}));

vi.mock("@/app/components/Slider/Slider", () => ({
  default: ({ value, onChange, min = 0, max = 1, step = 0.01 }) =>
    React.createElement("input", {
      type: "range",
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

describe("CreateAssistantModal", () => {
  const mocks = vi.hoisted(() => ({
    fetch: vi.fn(),
    onClose: vi.fn(),
    onCreated: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fetch.mockImplementation((url, init = {}) => {
      const method = (init.method || "GET").toUpperCase();

      if (url === "/api/assistants" && method === "POST") {
        return makeResponse({ id: "asst_new" }, true);
      }

      return makeResponse({});
    });

    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderModal(props = {}) {
    const base = {
      orgId: "org_1",
      isOpen: true,
      onClose: mocks.onClose,
      onCreated: mocks.onCreated,
    };

    return render(
      React.createElement(CreateAssistantModal, { ...base, ...props }),
    );
  }

  it("renders when open", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("CreateAssistant.title")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it("closes when clicking overlay", async () => {
    renderModal();

    const overlay = screen.getByRole("dialog");
    expect(overlay).toBeTruthy();

    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(mocks.onClose).toHaveBeenCalled();
    });
  });

  it("submits POST and calls onCreated on success", async () => {
    const user = userEvent.setup();
    renderModal();

    const [nameInput, descInput, instructionsInput] =
      screen.getAllByRole("textbox");

    await user.type(nameInput, "My Assistant");
    await user.type(descInput, "Desc");
    await user.type(instructionsInput, "Instr");

    await user.click(
      screen.getByRole("button", { name: "CreateAssistant.create" }),
    );

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/assistants",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      organizationId: "org_1",
      name: "My Assistant",
      description: "Desc",
      instructions: "Instr",
      model: "gpt-4.1",
    });

    expect(mocks.onCreated).toHaveBeenCalled();
  });
});
