import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import ChatSandbox from "@/app/[locale]/(app)/assistants/Chatbox/Chatbox.jsx";

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () =>
      Promise.resolve(typeof data === "string" ? data : JSON.stringify(data)),
  });
}

describe("Chatbox", () => {
  const mocks = vi.hoisted(() => ({
    fetch: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fetch.mockImplementation((url, init = {}) => {
      if (String(url).includes("/messages")) {
        return makeResponse({ reply: "Hello back", threadId: "th_1" }, true);
      }
      return makeResponse({});
    });

    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a message and renders assistant reply + threadId", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(ChatSandbox, {
        assistant: { id: "asst_1", open_ai_id: "oa_1", name: "Alpha" },
      }),
    );

    await user.type(screen.getByPlaceholderText("Chatbox.placeholder"), "Hi!");
    await user.click(screen.getByRole("button", { name: "Chatbox.send" }));

    expect(await screen.findByText("Hi!")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/assistants/asst_1/messages",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByText("Hello back")).toBeInTheDocument();

    expect(await screen.findByText(/Thread\s*ID:\s*th_1/i)).toBeInTheDocument();
  });
});
