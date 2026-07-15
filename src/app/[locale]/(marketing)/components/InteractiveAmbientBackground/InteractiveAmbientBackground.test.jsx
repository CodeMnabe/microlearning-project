import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InteractiveAmbientBackground from "./InteractiveAmbientBackground";

describe("InteractiveAmbientBackground", () => {
  let requestAnimationFrameSpy;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    window.IntersectionObserver = class IntersectionObserver {
      constructor(callback) {
        this.callback = callback;
      }

      observe() {
        this.callback([{ isIntersecting: true }]);
      }

      disconnect() {}
    };

    requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 1);
  });

  afterEach(() => {
    delete document.hidden;
    vi.restoreAllMocks();
  });

  it("renders a static, non-interactive layer when reduced motion is preferred", async () => {
    const { container, unmount } = render(
      <section>
        <InteractiveAmbientBackground
          variant="aurora"
          intensity="medium"
          interactive
        />
      </section>,
    );

    const layer = container.querySelector('[data-variant="aurora"]');

    await waitFor(() => {
      expect(layer).toHaveAttribute("data-active", "false");
      expect(layer).toHaveAttribute("data-interactive", "false");
    });

    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();

    unmount();
  });

  it("pauses when the document becomes hidden", async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("pointer: fine"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });

    const { container, unmount } = render(
      <section>
        <InteractiveAmbientBackground interactive />
      </section>,
    );
    const layer = container.querySelector('[data-variant="mist"]');

    await waitFor(() => expect(layer).toHaveAttribute("data-active", "true"));

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(layer).toHaveAttribute("data-active", "false"));

    unmount();
  });

  it("interpolates pointer coordinates and returns to neutral on leave", async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("pointer: fine"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const frames = [];
    requestAnimationFrameSpy.mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const { container, unmount } = render(
      <section>
        <InteractiveAmbientBackground intensity="medium" interactive />
      </section>,
    );
    const section = container.querySelector("section");
    const layer = container.querySelector('[data-variant="mist"]');
    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await waitFor(() =>
      expect(layer).toHaveAttribute("data-interactive", "true"),
    );

    const pointerMove = new Event("pointermove", { bubbles: true });
    Object.defineProperties(pointerMove, {
      clientX: { value: 1000 },
      clientY: { value: 300 },
    });
    section.dispatchEvent(pointerMove);

    for (let index = 0; index < 120 && frames.length; index += 1) {
      frames.shift()();
    }

    expect(
      Number.parseFloat(layer.style.getPropertyValue("--pointer-a-x")),
    ).toBeCloseTo(64, 1);

    section.dispatchEvent(new Event("pointerleave"));
    for (let index = 0; index < 120 && frames.length; index += 1) {
      frames.shift()();
    }

    expect(
      Number.parseFloat(layer.style.getPropertyValue("--pointer-a-x")),
    ).toBeCloseTo(0, 1);

    unmount();
  });
});
