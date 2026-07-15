"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeftRight } from "lucide-react";
import styles from "./BeforeAfterComparison.module.css";

const clamp = (value, min = 4, max = 96) =>
  Math.min(max, Math.max(min, value));

export default function BeforeAfterComparison({
  before,
  after,
  beforeBullets,
  afterBullets,
  ariaLabel,
}) {
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const [position, setPosition] = useState(92);
  const [entered, setEntered] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [userControlled, setUserControlled] = useState(false);

  const activeSide =
    position <= 45 ? "after" : position >= 55 ? "before" : "balanced";

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const reveal = () => {
      setEntered(true);
      if (userControlled) return;
      setAnimating(true);
      timerRef.current = window.setTimeout(() => {
        setPosition(64);
        timerRef.current = window.setTimeout(() => setAnimating(false), 1250);
      }, 420);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntered(true);
      setPosition(64);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.22 },
    );
    observer.observe(frame);

    return () => {
      observer.disconnect();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [userControlled]);

  const updatePosition = (clientX) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  };

  const beginManualControl = (event) => {
    setUserControlled(true);
    setAnimating(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    updatePosition(event.clientX);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveManualControl = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      updatePosition(event.clientX);
    }
  };

  const handleKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 4;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setUserControlled(true);
      setAnimating(false);
      setPosition((current) =>
        clamp(current + (event.key === "ArrowRight" ? step : -step)),
      );
    }
  };

  const cssPosition = { "--comparison-position": `${position}%` };

  return (
    <div className={styles.wrap}>
      <div
        ref={frameRef}
        className={`${styles.frame} ${entered ? styles.entered : ""} ${animating ? styles.animating : ""}`}
        style={cssPosition}
        aria-label={ariaLabel}
        onPointerDown={beginManualControl}
        onPointerMove={moveManualControl}
      >
        <Image
          className={`${styles.image} ${styles.beforeImage}`}
          src="/images/after.jpg"
          alt={before.alt}
          fill
          sizes="(max-width: 900px) calc(100vw - 32px), 1180px"
          quality={95}
        />
        <div className={styles.afterLayer} aria-hidden="true">
          <Image
            className={`${styles.image} ${styles.afterImage}`}
            src="/images/before.jpg"
            alt=""
            fill
            sizes="(max-width: 900px) calc(100vw - 32px), 1180px"
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
          aria-valuemin={4}
          aria-valuemax={96}
          aria-valuenow={Math.round(position)}
          onKeyDown={handleKeyDown}
          onPointerDown={beginManualControl}
          onPointerMove={moveManualControl}
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
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
