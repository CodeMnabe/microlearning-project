export class LeaseOwnershipLostError extends Error {
  constructor(label, cause = null) {
    super(`${label} lease ownership was lost`);
    this.name = "LeaseOwnershipLostError";
    this.cause = cause;
    this.claimLost = true;
  }
}

export function startLeaseHeartbeat({
  label,
  leaseSeconds,
  renew,
  intervalMs = null,
}) {
  const safeLeaseSeconds = Math.min(
    Math.max(Number(leaseSeconds || 120), 15),
    900,
  );
  const delay =
    intervalMs ?? Math.max(1000, Math.floor((safeLeaseSeconds * 1000) / 3));
  let stopped = false;
  let lostError = null;
  let inFlight = null;

  const tick = async () => {
    if (stopped || lostError || inFlight) return;
    inFlight = (async () => {
      try {
        const renewed = await renew();
        if (!renewed) lostError = new LeaseOwnershipLostError(label);
      } catch (error) {
        lostError = new LeaseOwnershipLostError(label, error);
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
  };

  const timer = setInterval(() => {
    void tick();
  }, delay);
  timer.unref?.();

  return {
    async renewNow() {
      await tick();
      this.assertOwned();
    },
    assertOwned() {
      if (lostError) throw lostError;
    },
    async stop() {
      stopped = true;
      clearInterval(timer);
      if (inFlight) await inFlight;
    },
  };
}

export async function withLeaseHeartbeat(options, operation) {
  const heartbeat = startLeaseHeartbeat(options);
  try {
    const result = await operation(heartbeat);
    heartbeat.assertOwned();
    return result;
  } finally {
    await heartbeat.stop();
  }
}
