import { describe, it, expect } from "vitest";
import { downloadWithLimit } from "@/lib/security/streamReader";

describe("Bounded stream reader", () => {
  it("downloads buffer successfully when under limits", async () => {
    const fakeChunk = Buffer.from("hello world");
    let readCount = 0;
    
    const fakeResponse = {
      ok: true,
      headers: new Map([["content-length", "11"]]),
      body: {
        getReader: () => ({
          read: async () => {
            if (readCount === 0) {
              readCount++;
              return { done: false, value: fakeChunk };
            }
            return { done: true };
          },
          cancel: async () => {}
        })
      }
    };
    
    const { buffer, size } = await downloadWithLimit(fakeResponse, 1024);
    expect(size).toBe(11);
    expect(buffer.toString()).toBe("hello world");
  });

  it("aborts when Content-Length header strictly exceeds max bytes", async () => {
    const fakeResponse = {
      ok: true,
      headers: new Map([["content-length", "5000000"]]), // 5MB
      body: { getReader: () => {} }
    };
    
    await expect(downloadWithLimit(fakeResponse, 1024)).rejects.toThrow("exceeds maximum allowed size");
  });

  it("aborts stream reading progressively when chunks exceed max limit", async () => {
    const fakeChunk = Buffer.alloc(1024, "a"); // 1KB
    let readCount = 0;
    let cancelled = false;
    
    const fakeResponse = {
      ok: true,
      headers: new Map(), // No content-length
      body: {
        getReader: () => ({
          read: async () => {
            readCount++;
            return { done: false, value: fakeChunk };
          },
          cancel: async () => { cancelled = true; }
        })
      }
    };
    
    // Max 1.5 KB. First chunk is 1KB. Second chunk pushes to 2KB -> exceeds limit.
    await expect(downloadWithLimit(fakeResponse, 1500)).rejects.toThrow("exceeded maximum allowed size");
    expect(readCount).toBe(2);
    expect(cancelled).toBe(true);
  });
});
