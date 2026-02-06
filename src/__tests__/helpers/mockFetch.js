import { vi } from "vitest";

function okJson(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function badJson(data, httpStatus) {
  return {
    ok: false,
    status: httpStatus,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

export function mockFetch(routes) {
  const fn = vi.fn(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;

    for (const r of routes) {
      if (r.match(url, init)) return r.handle(url, init);
    }

    throw new Error(
      `No mockFetch route matched: ${init.method || "GET"} ${url}`,
    );
  });

  vi.stubGlobal("fetch", fn);

  return { fetchMock: fn, okJson, badJson };
}
