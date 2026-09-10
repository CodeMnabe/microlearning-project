import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import OptionsPage from "@/app/[locale]/(app)/options/page";

const mocks = vi.hoisted(() => ({
  startLoading: vi.fn(),
  stopLoading: vi.fn(),
  useAuth: vi.fn(),
  useOrganization: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/app/LoadingScreen/GlobalLoaderContext", () => ({
  useGlobalLoader: () => ({
    startLoading: mocks.startLoading,
    stopLoading: mocks.stopLoading,
  }),
}));

vi.mock("@/app/AuthContext", () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock("@/app/hooks/useOrganization", () => ({
  default: (...args) => mocks.useOrganization(...args),
}));

vi.mock("@/app/components/PillSelect/PillSelect", () => ({
  default: ({ value, options = [], onChange }) =>
    React.createElement(
      "select",
      {
        "aria-label": "area-select",
        value: value ?? "",
        onChange: (e) => onChange?.(e.target.value),
      },
      (options || []).map((o) =>
        React.createElement(
          "option",
          { key: String(o.value), value: o.value },
          o.label,
        ),
      ),
    ),
}));

const ORG_ID = 7;

const ITEMS = [
  {
    id: "row-1",
    action: "user.created",
    entity_type: "user",
    entity_id: "42",
    entity_label: "Ana Silva",
    actor_type: "user",
    actor_email: "owner@x.pt",
    details: {},
    created_at: "2026-09-10T10:00:00.000Z",
  },
  {
    id: "row-2",
    action: "broadcast.sent",
    entity_type: "broadcast",
    entity_id: "grp-1",
    entity_label: null,
    actor_type: "system",
    actor_email: null,
    details: { channel: "whatsapp", recipientCount: 3, ok: 3, failed: 0 },
    created_at: "2026-09-09T09:00:00.000Z",
  },
];

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

function lastFetchParams() {
  const [url] = mocks.fetch.mock.calls.at(-1);

  return new URL(url, "http://localhost").searchParams;
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.useAuth.mockReturnValue({ user: { id: "auth-1" }, loading: false });
  mocks.useOrganization.mockReturnValue({
    org: { id: ORG_ID, name: "Digik" },
    loading: false,
  });

  mocks.fetch.mockImplementation(() =>
    makeResponse({ items: ITEMS, total: 60, page: 1, pageSize: 25 }),
  );

  global.fetch = mocks.fetch;
});

describe("página de Definições com o histórico de atividade", () => {
  it("pede o histórico da organização e mostra as linhas", async () => {
    render(<OptionsPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Title",
    );

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));

    const params = lastFetchParams();
    expect(mocks.fetch.mock.calls[0][0]).toMatch(/^\/api\/audit-log\?/);
    expect(params.get("orgId")).toBe(String(ORG_ID));
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("25");
    expect(params.has("area")).toBe(false);

    expect(await screen.findByText("Actions.user_created")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("owner@x.pt")).toBeInTheDocument();

    expect(screen.getByText("Actions.broadcast_sent")).toBeInTheDocument();
    expect(screen.getByText("Actor.system")).toBeInTheDocument();
    expect(screen.getByText("#grp-1")).toBeInTheDocument();
    expect(screen.getByText("Details.labels.channel")).toBeInTheDocument();
    expect(screen.getByText("Channels.whatsapp")).toBeInTheDocument();
    expect(screen.getByText("Details.labels.recipients")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(mocks.stopLoading).toHaveBeenCalled();
  });

  it("volta a pedir com o filtro de área e reinicia a página", async () => {
    render(<OptionsPage />);

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Pagination.next" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect(lastFetchParams().get("page")).toBe("2");

    fireEvent.change(screen.getByLabelText("area-select"), {
      target: { value: "tag" },
    });

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3));
    expect(lastFetchParams().get("area")).toBe("tag");
    expect(lastFetchParams().get("page")).toBe("1");
  });

  it("filtra por datas e limpa os filtros", async () => {
    render(<OptionsPage />);

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Filters.from"), {
      target: { value: "2026-09-01" },
    });

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect(lastFetchParams().get("from")).toMatch(/^2026-0(8|9)-/);

    fireEvent.click(screen.getByRole("button", { name: /Filters\.clear/ }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3));
    expect(lastFetchParams().has("from")).toBe(false);
  });

  it("desativa 'anterior' na primeira página e mostra o total", async () => {
    render(<OptionsPage />);

    const prev = await screen.findByRole("button", { name: "Pagination.prev" });
    const next = screen.getByRole("button", { name: "Pagination.next" });

    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText("Pagination.total")).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há registos", async () => {
    mocks.fetch.mockImplementation(() =>
      makeResponse({ items: [], total: 0, page: 1, pageSize: 25 }),
    );

    render(<OptionsPage />);

    expect(await screen.findByText("Empty.title")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pagination.next" }),
    ).not.toBeInTheDocument();
  });

  it("mostra o erro quando a API falha", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mocks.fetch.mockImplementation(() =>
      makeResponse({ error: "boom" }, false),
    );

    render(<OptionsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Errors.load");

    warn.mockRestore();
  });

  it("não pede nada enquanto a organização não estiver resolvida", async () => {
    mocks.useOrganization.mockReturnValue({ org: null, loading: true });

    render(<OptionsPage />);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
