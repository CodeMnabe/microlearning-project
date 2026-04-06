"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./chip.module.css";

export default function Chips({ items, repeat = 4, speed = 60 }) {
  const viewportRef = useRef(null);
  const set1Ref = useRef(null);
  const set2Ref = useRef(null);
  const [distance, setDistance] = useState(0);

  const tiled = useMemo(() => {
    const out = [];
    for (let i = 0; i < repeat; i++) {
      out.push(...items);
    }
    return out;
  }, [items, repeat]);

  useEffect(() => {
    const set1 = set1Ref.current;
    const set2 = set2Ref.current;
    const viewport = viewportRef.current;

    if (!set1 || !set2 || !viewport) return;

    const update = () => {
      const d = set2.offsetLeft - set1.offsetLeft;
      setDistance(d);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    ro.observe(set1);
    ro.observe(set2);

    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [tiled]);

  const duration = distance ? `${distance / speed}s` : "12s";

  return (
    <div ref={viewportRef} className={styles.chipsViewport}>
      <div
        className={styles.chipsTrack}
        style={{
          "--marquee-distance": `${distance}px`,
          "--marquee-duration": duration,
        }}
      >
        <div ref={set1Ref} className={styles.chipsSet}>
          {tiled.map((c, i) => (
            <span key={`${c}-${i}`} className={styles.chip}>
              {c}
            </span>
          ))}
        </div>

        <div ref={set2Ref} className={styles.chipsSet} aria-hidden="true">
          {tiled.map((c, i) => (
            <span key={`${c}-${i}-dup`} className={styles.chip}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
