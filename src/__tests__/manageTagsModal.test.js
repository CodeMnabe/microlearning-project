import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import ManageTagsModal from "@/app/[locale]/(app)/users/ManageTagsModal/ManageTagsModal";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  onClose: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key, vars) =>
    vars && Object.prototype.hasOwnProperty.call(vars, "name")
      ? `${key}:${vars.name}`
      : key,
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
const TAGS = [
  { id: "t1", name: "IT" },
  { id: "t2", name: "HR" },
];

beforeEach(() => {
  vi.clearAllMocks();

  mocks.fetch.mockImplementation((input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init?.method || "GET").toUpperCase();

    if (url === "/api/tags" && method === "POST") {
      return makeResponse({ id: "t3", name: "Grupo 3" });
    }

    if (url === "/api/tags" && method === "PATCH") {
      return makeResponse({});
    }

    if (url === "/api/tags" && method === "DELETE") {
      return makeResponse({});
    }

    return makeResponse();
  });

  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderModal(props = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: mocks.onClose,
    orgId: ORG_ID,
    tags: TAGS,
    setTags: mocks.setTags,
  };
  return render(
    React.createElement(ManageTagsModal, { ...defaultProps, ...props }),
  );
}

describe("ManageTagsModal", () => {
  it("renders when open and auto-selects first tag + fills input", async () => {
    renderModal();

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    expect(screen.getByText("IT")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();

    const input = screen.getByLabelText("ManageTagsModal.name");
    await waitFor(() => expect(input).toHaveValue("IT"));
  });

  it("closes when pressing Escape", async () => {
    renderModal();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it("closes when clicking the overlay (outside the card)", async () => {
    const { container } = renderModal();

    const overlay = container.querySelector('[role="dialog"]');
    fireEvent.click(overlay);

    expect(mocks.onClose).toHaveBeenCalled();
  });

  it("creates a new tag (POST) and updates setTags with updater fn", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      screen.getByRole("button", { name: "ManageTagsModal.add" }),
    );

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/tags",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(mocks.setTags).toHaveBeenCalledWith(expect.any(Function));

    const updater = mocks.setTags.mock.calls.at(-1)[0];
    const next = updater([{ id: "old", name: "Old" }]);
    expect(next[0]).toEqual({ id: "t3", name: "Grupo 3" });
  });

  it("renames selected tag (PATCH) when input changes and Save clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText("ManageTagsModal.name");
    await waitFor(() => expect(input).toHaveValue("IT"));

    await user.clear(input);
    await user.type(input, "IT Renamed");

    await user.click(
      screen.getByRole("button", { name: "ManageTagsModal.save" }),
    );

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/tags",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ id: "t1", name: "IT Renamed" }),
        }),
      );
    });

    expect(mocks.setTags).toHaveBeenCalledWith(expect.any(Function));
  });

  it("deletes a tag (DELETE) when clicking the x close inside the chip", async () => {
    renderModal();

    const removeIT = screen.getByLabelText("ManageTagsModal.removeLabel:IT");

    fireEvent.click(removeIT);

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith("/api/tags?id=t1", {
        method: "DELETE",
      });
    });

    expect(mocks.setTags).toHaveBeenCalledWith(expect.any(Function));
  });

  it("shows empty state text when there are no tags", async () => {
    renderModal({ tags: [] });
    expect(screen.getByText("ManageTagsModal.none")).toBeInTheDocument();
  });

  it("does not render when closed and finished unmount animation (render=false)", async () => {
    const { container } = renderModal({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });
});
