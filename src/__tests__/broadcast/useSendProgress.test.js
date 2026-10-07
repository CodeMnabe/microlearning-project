import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import useSendProgress from "@/app/[locale]/(app)/broadcast/hooks/useSendProgress";

/* Um fetch que só responde quando o teste quiser. */
function deferredFetch() {
  const control = {};
  const fetchMock = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        control.resolve = resolve;
        control.reject = reject;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, control };
}

function leavePage() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useSendProgress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fica a enviar até o servidor responder e avisa quem tenta sair", async () => {
    const { fetchMock, control } = deferredFetch();
    const { result } = renderHook(() => useSendProgress());

    let request;
    act(() => {
      request = result.current.sendRequest("/api/broadcast/whatsapp", {
        method: "POST",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/broadcast/whatsapp", {
      method: "POST",
    });
    expect(result.current.waiting).toBe(true);
    expect(leavePage()).toBe(true);

    const response = { ok: true };
    await act(async () => {
      control.resolve(response);
      expect(await request).toBe(response);
    });

    expect(result.current.waiting).toBe(false);
    expect(leavePage()).toBe(false);
  });

  it("deixa de esperar mesmo quando o pedido falha", async () => {
    const { control } = deferredFetch();
    const { result } = renderHook(() => useSendProgress());

    let request;
    act(() => {
      request = result.current.sendRequest("/api/broadcast/whatsapp", {});
    });

    await act(async () => {
      control.reject(new Error("rede em baixo"));
      await expect(request).rejects.toThrow("rede em baixo");
    });

    expect(result.current.waiting).toBe(false);
    expect(leavePage()).toBe(false);
  });

  it("sem envio a decorrer, não avisa ao sair", () => {
    renderHook(() => useSendProgress());

    expect(leavePage()).toBe(false);
  });
});
