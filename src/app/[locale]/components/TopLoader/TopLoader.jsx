"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./topLoader.module.css";

let startLoaderGlobal = null;

export function startTopLoader() {
  startLoaderGlobal?.();
}

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef(null);
  const firstRenderRef = useRef(true);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function start() {
    clearTimer();
    setVisible(true);
    setProgress(12);

    timerRef.current = setInterval(() => {
      setProgree((current) => {
        if (current >= 85) return current;
        return current + Math.max((90 - current) * 0.12, 2);
      });
    }, 140);
  }

  function done() {
    clearTimer();
    setProgress(100);

    window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }

  useEffect(() => {
    startLoaderGlobal = start;
    return () => {
      if (startLoaderGlobal === start) startLoaderGlobal = null;
      clearTimer();
    };
  }, []);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    done();
  }, [pathname, searchParams]);

  return (
    <div
      className={`${styles.wrap} ${visible ? styles.wrapVisible : ""}`}
      aria-hidden="true"
    >
      <div
        className={styles.bar}
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
