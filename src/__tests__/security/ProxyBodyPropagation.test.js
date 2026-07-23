import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "../../../src/proxy";

vi.mock("next-intl/middleware", () => {
  return {
    default: vi.fn(() => {
      return vi.fn((req) => {
        const res = new Response();
        return res;
      });
    }),
  };
});

vi.mock("@/utils/supabase/middleware", () => {
  return {
    updateSession: vi.fn((request) => {
      const res = new Response();
      res.cookies = {
        getAll: () => [],
        set: () => {},
      };
      return Promise.resolve({ response: res, user: null });
    }),
  };
});

describe("Proxy Middleware Body Propagation", () => {
  it("preserves body, query, and method when cloning with request object", async () => {
    // 1. POST application/json com payload
    const jsonReq = new NextRequest("http://localhost/api?foo=bar", {
      method: "POST",
      body: JSON.stringify({ test: 123 }),
      headers: { "Content-Type": "application/json", "Cookie": "token=123", "Authorization": "Bearer abc" }
    });
    
    let clonedReq = new NextRequest(jsonReq, { headers: new Headers(jsonReq.headers) });
    expect(clonedReq.method).toBe("POST");
    expect(clonedReq.nextUrl.searchParams.get("foo")).toBe("bar");
    expect(clonedReq.cookies.get("token").value).toBe("123");
    expect(clonedReq.headers.get("Authorization")).toBe("Bearer abc");
    expect(await clonedReq.json()).toEqual({ test: 123 });

    // 2. PATCH application/json
    const patchReq = new NextRequest("http://localhost/api", {
      method: "PATCH",
      body: JSON.stringify({ test: 456 }),
      headers: { "Content-Type": "application/json" }
    });
    clonedReq = new NextRequest(patchReq, { headers: new Headers(patchReq.headers) });
    expect(clonedReq.method).toBe("PATCH");
    expect(await clonedReq.json()).toEqual({ test: 456 });

    // 3. PUT application/json
    const putReq = new NextRequest("http://localhost/api", {
      method: "PUT",
      body: JSON.stringify({ test: 789 }),
      headers: { "Content-Type": "application/json" }
    });
    clonedReq = new NextRequest(putReq, { headers: new Headers(putReq.headers) });
    expect(clonedReq.method).toBe("PUT");
    expect(await clonedReq.json()).toEqual({ test: 789 });

    // 4. POST multipart/form-data
    const formData = new FormData();
    formData.append("file", "hello text");
    const multiReq = new NextRequest("http://localhost/api", {
      method: "POST",
      body: formData
    });
    clonedReq = new NextRequest(multiReq, { headers: new Headers(multiReq.headers) });
    expect(clonedReq.method).toBe("POST");
    const clonedForm = await clonedReq.formData();
    expect(clonedForm.get("file")).toBe("hello text");

    // 5. POST application/x-www-form-urlencoded
    const urlReq = new NextRequest("http://localhost/api", {
      method: "POST",
      body: new URLSearchParams({ foo: "bar" }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    clonedReq = new NextRequest(urlReq, { headers: new Headers(urlReq.headers) });
    expect(clonedReq.method).toBe("POST");
    expect((await clonedReq.formData()).get("foo")).toBe("bar");
    
    // 6. GET com query string
    const getReq = new NextRequest("http://localhost/api?a=1&b=2");
    clonedReq = new NextRequest(getReq, { headers: new Headers(getReq.headers) });
    expect(clonedReq.method).toBe("GET");
    expect(clonedReq.nextUrl.searchParams.get("a")).toBe("1");
    expect(clonedReq.nextUrl.searchParams.get("b")).toBe("2");
  });
});
