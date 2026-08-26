"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeftRight, Check } from "lucide-react";
import styles from "./BeforeAfterComparison.module.css";

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

export default function BeforeAfterComparison({
  before,
  after,
  beforeBullets,
  afterBullets,
  ariaLabel,
}) {
  const frameRef = useRef(null);
  const [position, setPosition] = useState(50);
  const [entered, setEntered] = useState(false);

  const roundedPosition = Math.round(position);
  const activeSide =
    position <= 45 ? "after" : position >= 55 ? "before" : "balanced";

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setEntered(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.22 },
    );
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  const updatePosition = (clientX) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  };

  const handlePointerDown = (event) => {
    updatePosition(event.clientX);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer may no longer be active (e.g. fast touch taps); ignore.
    }
  };

  const handlePointerMove = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      updatePosition(event.clientX);
    }
  };

  const handleKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 4;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPosition((current) => clamp(current - step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPosition((current) => clamp(current + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPosition(100);
    }
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={frameRef}
        className={`${styles.frame} ${entered ? styles.entered : ""}`}
        style={{ "--comparison-position": `${position}%` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <Image
          className={styles.image}
          src="/images/after.jpg"
          alt={after.alt}
          fill
          sizes="(max-width: 900px) calc(100vw - 32px), 1080px"
          quality={95}
        />
        <div className={styles.beforeLayer}>
          <Image
            className={styles.image}
            src="/images/before.jpg"
            alt={before.alt}
            fill
            sizes="(max-width: 900px) calc(100vw - 32px), 1080px"
            quality={95}
          />
        </div>

        <span className={`${styles.label} ${styles.beforeLabel}`}>
          {before.label}
        </span>
        <span className={`${styles.label} ${styles.afterLabel}`}>
          {after.label}
        </span>

        <button
          className={styles.divider}
          type="button"
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPosition}
          aria-valuetext={`${before.label} ${roundedPosition}% / ${after.label} ${100 - roundedPosition}%`}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <span className={styles.handle}>
            <ArrowLeftRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className={`${styles.details} ${styles[`${activeSide}Active`]}`}>
        <ul className={`${styles.list} ${styles.beforeDetails}`}>
          {beforeBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <ul className={`${styles.list} ${styles.afterDetails}`}>
          {afterBullets.map((bullet) => (
            <li key={bullet}>
              <span className={styles.checkIcon} aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
