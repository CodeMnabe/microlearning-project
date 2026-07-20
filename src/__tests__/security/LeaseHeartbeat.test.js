import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LeaseOwnershipLostError,
  startLeaseHeartbeat,
  withLeaseHeartbeat,
} from "@/lib/webhooks/leaseHeartbeat";

afterEach(() => {
  vi.useRealTimers();
});

describe("lease heartbeat", () => {
  it("renews an owned lease while work is running and stops cleanly", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => ({ id: "owned" }));
    const heartbeat = startLeaseHeartbeat({
      label: "test claim",
      leaseSeconds: 15,
      intervalMs: 1000,
      renew,
    });
    await vi.advanceTimersByTimeAsync(3100);
    expect(renew).toHaveBeenCalledTimes(3);
    heartbeat.assertOwned();
    await heartbeat.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(renew).toHaveBeenCalledTimes(3);
  });

  it("rejects renewal when ownership is no longer valid", async () => {
    vi.useFakeTimers();
    const heartbeat = startLeaseHeartbeat({
      label: "test claim",
      leaseSeconds: 15,
      intervalMs: 1000,
      renew: vi.fn(async () => null),
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(() => heartbeat.assertOwned()).toThrow(LeaseOwnershipLostError);
    await heartbeat.stop();
  });

  it("cleans the heartbeat after operation failure", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => ({ id: "owned" }));
    await expect(
      withLeaseHeartbeat(
        { label: "test claim", leaseSeconds: 15, intervalMs: 1000, renew },
        async () => {
          throw new Error("synthetic failure");
        },
      ),
    ).rejects.toThrow("synthetic failure");
    await vi.advanceTimersByTimeAsync(3000);
    expect(renew).not.toHaveBeenCalled();
  });
});
