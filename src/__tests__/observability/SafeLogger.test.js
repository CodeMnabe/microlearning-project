import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_LOG_FIELDS,
  EVENT_SCHEMAS,
  classifyLogError,
  createLogger,
  sanitizeLogFields,
} from "@/lib/observability/logger";
import { handleApiError } from "@/lib/auth/guards";

const UUID = "00000000-0000-4000-8000-000000000030";
const SENTINELS = Object.freeze({
  phone: "+351911222333",
  numericPhone: 351911222333,
  token: "super-secret-token-should-not-appear",
  content: "PRIVATE_MESSAGE_SENTINEL",
  provider: "PROVIDER_RESPONSE_SECRET_SENTINEL",
});

function capture(environment = "test") {
  const lines = [];
  return {
    lines,
    entries: () => lines.map((line) => JSON.parse(line)),
    logger: createLogger({
      environment,
      now: () => "2026-07-22T12:00:00.000Z",
      sink: (serialized) => lines.push(serialized),
    }),
  };
}

function expectNoSentinels(entries) {
  const values = Object.values(SENTINELS);
  for (const entry of entries) {
    const serialized = JSON.stringify(entry);
    for (const sentinel of values) {
      expect(serialized).not.toContain(String(sentinel));
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safe application logger", () => {
  it("keeps only fields declared by the selected event schema", () => {
    const output = sanitizeLogFields("broadcast_delivery_completed", {
      provider: "teams",
      operation: "broadcast_send",
      outcome: "succeeded",
      statusCode: 202,
      broadcastId: UUID,
      userId: 11,
      arbitrary: "value",
    });

    expect({ ...output }).toEqual({
      provider: "teams",
      operation: "broadcast_send",
      outcome: "succeeded",
      statusCode: 202,
      broadcastId: UUID,
      userId: 11,
    });
  });

  it("does not add error fields to an event schema that does not declare them", () => {
    const { logger, entries } = capture();
    const error = Object.create(null);
    error.code = "ETIMEDOUT";

    expect(
      logger.info(
        "teams_message_received",
        {
          provider: "teams",
          operation: "command_dispatch",
          outcome: "command_detected",
        },
        error,
      ),
    ).toBe(true);
    expect(entries()[0]).not.toHaveProperty("errorType");
    expect(entries()[0]).not.toHaveProperty("errorCode");
  });

  it.each([
    [
      "operation",
      "broadcast_delivery_completed",
      { operation: SENTINELS.token },
    ],
    ["outcome", "broadcast_delivery_completed", { outcome: SENTINELS.token }],
    ["status", "webhook_identity_conflict", { status: SENTINELS.token }],
    ["errorCode", "openai_operation_failed", { errorCode: SENTINELS.token }],
    [
      "internal ID",
      "openai_operation_failed",
      { assistantId: SENTINELS.token },
    ],
  ])("rejects a token supplied through %s", (_label, event, unsafeFields) => {
    const { logger, entries } = capture();
    expect(() =>
      logger.error(event, {
        provider: event === "webhook_identity_conflict" ? "bird" : "openai",
        operation:
          event === "webhook_identity_conflict"
            ? "webhook_registration"
            : event === "broadcast_delivery_completed"
              ? "broadcast_send"
              : "assistant_update",
        outcome:
          event === "webhook_identity_conflict"
            ? "payload_conflict"
            : event === "broadcast_delivery_completed"
              ? "succeeded"
              : "failed",
        ...unsafeFields,
      }),
    ).not.toThrow();
    expectNoSentinels(entries());
  });

  it("does not inspect statusList or counts, including their first values", () => {
    let arrayGetterExecutions = 0;
    const statusList = [];
    Object.defineProperty(statusList, "0", {
      enumerable: true,
      get() {
        arrayGetterExecutions += 1;
        return SENTINELS.token;
      },
    });
    statusList.length = 1;

    const { logger, entries } = capture();
    expect(() =>
      logger.info("teams_message_received", {
        provider: "teams",
        operation: "command_dispatch",
        outcome: "command_detected",
        statusList,
        counts: {
          count: SENTINELS.phone,
          succeeded: SENTINELS.numericPhone,
        },
      }),
    ).not.toThrow();

    expect(arrayGetterExecutions).toBe(0);
    expect(entries()[0]).not.toHaveProperty("statusList");
    expect(entries()[0]).not.toHaveProperty("counts");
    expectNoSentinels(entries());
  });

  it.each([
    ["numeric string", "2", 0],
    [
      "valueOf object",
      {
        valueOf() {
          throw new Error("valueOf executed");
        },
      },
      0,
    ],
    [
      "Symbol.toPrimitive object",
      {
        [Symbol.toPrimitive]() {
          throw new Error("Symbol.toPrimitive executed");
        },
      },
      0,
    ],
  ])("does not coerce a %s into a counter", (_label, count, expectedLines) => {
    const { logger, lines, entries } = capture();
    expect(() =>
      logger.info("broadcast_delivery_attempted", {
        provider: "teams",
        operation: "broadcast_send",
        outcome: "prepared",
        count,
      }),
    ).not.toThrow();
    expect(lines).toHaveLength(expectedLines + 1);
    expect(entries()[0]).not.toHaveProperty("count");
  });

  it("accepts only primitive non-negative integer counters", () => {
    const output = sanitizeLogFields("broadcast_delivery_attempted", {
      provider: "teams",
      operation: "broadcast_send",
      outcome: "prepared",
      count: 2,
    });
    expect(output.count).toBe(2);
  });

  it.each(["name", "code", "status", "statusCode", "retryable"])(
    "does not execute an accessor on error.%s",
    (property) => {
      let getterExecutions = 0;
      const error = new Error(SENTINELS.content);
      Object.defineProperty(error, property, {
        configurable: true,
        get() {
          getterExecutions += 1;
          throw new Error(`${property} getter executed`);
        },
      });

      const { logger, entries } = capture();
      expect(() =>
        logger.error(
          "openai_operation_failed",
          {
            provider: "openai",
            operation: "assistant_update",
            outcome: "failed",
          },
          error,
        ),
      ).not.toThrow();
      expect(getterExecutions).toBe(0);
      expect(entries()[0].errorType).toBe("unknown_error");
      expectNoSentinels(entries());
    },
  );

  it("maps only known own error data properties to finite values", () => {
    const error = new Error(SENTINELS.content);
    error.code = "ETIMEDOUT";
    error.status = 503;
    error.retryable = true;
    error.response = { body: SENTINELS.provider };

    expect({ ...classifyLogError(error) }).toEqual({
      errorType: "timeout_error",
      errorCode: "timeout",
      statusCode: 503,
      retryable: true,
    });
  });

  it("does not copy an unknown provider error code", () => {
    const error = new Error(SENTINELS.content);
    error.code = SENTINELS.provider;
    const output = classifyLogError(error);
    expect(output.errorType).toBe("unknown_error");
    expect(output).not.toHaveProperty("errorCode");
    expectNoSentinels([{ ...output }]);
  });

  it("does not invoke getters in the fields object", () => {
    let getterExecutions = 0;
    const fields = {
      operation: "command_dispatch",
      outcome: "command_detected",
    };
    Object.defineProperty(fields, "provider", {
      enumerable: true,
      get() {
        getterExecutions += 1;
        return SENTINELS.token;
      },
    });

    const { logger, entries } = capture();
    expect(() => logger.info("teams_message_received", fields)).not.toThrow();
    expect(getterExecutions).toBe(0);
    expect(entries()[0]).not.toHaveProperty("provider");
  });

  it("rejects unknown snake_case events without emitting or throwing", () => {
    const { logger, lines } = capture();
    expect(() =>
      logger.info("syntactically_valid_unknown_event", {}),
    ).not.toThrow();
    expect(logger.info("syntactically_valid_unknown_event", {})).toBe(false);
    expect(lines).toEqual([]);
  });

  it("drops a field that is valid elsewhere but absent from this schema", () => {
    const { logger, entries } = capture();
    expect(
      logger.info("teams_message_received", {
        provider: "teams",
        operation: "command_dispatch",
        outcome: "command_detected",
        organizationId: 7,
      }),
    ).toBe(true);
    expect(entries()[0]).not.toHaveProperty("organizationId");
  });

  it("returns false when the sink throws and never propagates", () => {
    const logger = createLogger({
      environment: "test",
      sink() {
        throw new Error("sink failure");
      },
    });
    expect(() =>
      logger.info("teams_message_received", {
        provider: "teams",
        operation: "command_dispatch",
        outcome: "command_detected",
      }),
    ).not.toThrow();
    expect(
      logger.info("teams_message_received", {
        provider: "teams",
        operation: "command_dispatch",
        outcome: "command_detected",
      }),
    ).toBe(false);
  });

  it("does not let a malicious error or throwing sink prevent handleApiError", () => {
    const error = { status: 500 };
    for (const property of ["name", "code", "retryable"]) {
      Object.defineProperty(error, property, {
        get() {
          throw new Error(`${property} getter must not execute`);
        },
      });
    }
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("synthetic console sink failure");
    });

    let response;
    expect(() => {
      response = handleApiError(error, "Safe fallback");
    }).not.toThrow();
    expect(response.status).toBe(500);
  });

  it("returns false when JSON serialization throws", () => {
    const { logger } = capture();
    const stringify = vi.spyOn(JSON, "stringify").mockImplementationOnce(() => {
      throw new Error("serialization failure");
    });

    let result;
    expect(() => {
      result = logger.info("teams_message_received", {
        provider: "teams",
        operation: "command_dispatch",
        outcome: "command_detected",
      });
    }).not.toThrow();
    stringify.mockRestore();
    expect(result).toBe(false);
  });

  it("emits exactly one parseable JSON line with deterministic timestamps", () => {
    const { logger, lines, entries } = capture("production");
    expect(
      logger.info("broadcast_delivery_completed", {
        provider: "teams",
        operation: "broadcast_send",
        outcome: "succeeded",
        statusCode: 202,
        broadcastId: UUID,
        userId: 11,
      }),
    ).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(entries()[0]).toEqual({
      level: "info",
      event: "broadcast_delivery_completed",
      provider: "teams",
      operation: "broadcast_send",
      outcome: "succeeded",
      statusCode: 202,
      broadcastId: UUID,
      userId: 11,
      timestamp: "2026-07-22T12:00:00.000Z",
    });
  });

  it("applies the same schemas in development", () => {
    const { logger, entries } = capture("development");
    logger.error("provider_request_failed", {
      provider: "bird",
      operation: "template_send",
      outcome: "failed",
      errorCode: SENTINELS.token,
      statusList: [SENTINELS.token],
    });
    expectNoSentinels(entries());
  });

  it("does not mutate original objects", () => {
    const fields = Object.freeze({
      provider: "teams",
      operation: "broadcast_send",
      outcome: "prepared",
      count: 2,
      counts: Object.freeze({ count: SENTINELS.phone }),
    });
    const before = {
      provider: fields.provider,
      operation: fields.operation,
      outcome: fields.outcome,
      count: fields.count,
      counts: fields.counts,
    };

    const { logger } = capture();
    expect(() =>
      logger.info("broadcast_delivery_attempted", fields),
    ).not.toThrow();
    expect(fields).toEqual(before);
  });

  it("publishes exactly 58 finite event schemas without generic containers", () => {
    expect(Object.keys(EVENT_SCHEMAS)).toHaveLength(58);
    expect(ALLOWED_LOG_FIELDS).not.toContain("statusList");
    expect(ALLOWED_LOG_FIELDS).not.toContain("counts");

    for (const schema of Object.values(EVENT_SCHEMAS)) {
      for (const rule of Object.values(schema)) {
        expect([
          "enum",
          "positive_integer",
          "uuid",
          "non_negative_integer",
          "http_status",
          "boolean",
        ]).toContain(rule.type);
        if (rule.type === "enum") {
          expect(rule.values.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
