import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import ActivityLog from "@/app/[locale]/(app)/settings/components/ActivityLog";

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

function auditFetchCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).startsWith("/api/audit-log?"),
  );
}

function lastAuditParams(fetchMock) {
  const calls = auditFetchCalls(fetchMock);
  const [url] = calls.at(-1);
  return new URL(url, "http://localhost").searchParams;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  fetchMock.mockImplementation(() =>
    makeResponse({ items: ITEMS, total: 60, page: 1, pageSize: 25 }),
  );

  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Settings ActivityLog", () => {
  it("pede o histórico da organização e mostra as linhas", async () => {
    render(<ActivityLog orgId={ORG_ID} />);

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(1));

    const params = lastAuditParams(fetchMock);
    expect(auditFetchCalls(fetchMock)[0][0]).toMatch(/^\/api\/audit-log\?/);
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
  });

  it("volta a pedir com o filtro de área e reinicia a página", async () => {
    render(<ActivityLog orgId={ORG_ID} />);

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Pagination.next" }));

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(2));
    expect(lastAuditParams(fetchMock).get("page")).toBe("2");

    fireEvent.change(screen.getByLabelText("area-select"), {
      target: { value: "tag" },
    });

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(3));
    expect(lastAuditParams(fetchMock).get("area")).toBe("tag");
    expect(lastAuditParams(fetchMock).get("page")).toBe("1");
  });

  it("filtra por datas e limpa os filtros", async () => {
    render(<ActivityLog orgId={ORG_ID} />);

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(1));

    fireEvent.change(screen.getByLabelText("Filters.from"), {
      target: { value: "2026-09-01" },
    });

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(2));
    expect(lastAuditParams(fetchMock).get("from")).toMatch(/^2026-0(8|9)-/);

    fireEvent.click(screen.getByRole("button", { name: /Filters\.clear/ }));

    await waitFor(() => expect(auditFetchCalls(fetchMock)).toHaveLength(3));
    expect(lastAuditParams(fetchMock).has("from")).toBe(false);
  });

  it("desativa 'anterior' na primeira página e mostra o total", async () => {
    render(<ActivityLog orgId={ORG_ID} />);

    const prev = await screen.findByRole("button", { name: "Pagination.prev" });
    const next = screen.getByRole("button", { name: "Pagination.next" });

    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText("Pagination.total")).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há registos", async () => {
    fetchMock.mockImplementation(() =>
      makeResponse({ items: [], total: 0, page: 1, pageSize: 25 }),
    );

    render(<ActivityLog orgId={ORG_ID} />);

    expect(await screen.findByText("Empty.title")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pagination.next" }),
    ).not.toBeInTheDocument();
  });

  it("mostra o erro quando a API falha", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    fetchMock.mockImplementation(() => makeResponse({ error: "boom" }, false));

    render(<ActivityLog orgId={ORG_ID} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Errors.load");

    warn.mockRestore();
  });

  it("não pede nada sem orgId", async () => {
    render(<ActivityLog orgId={null} />);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
