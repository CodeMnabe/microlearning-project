"use client";

import { useRef } from "react";
import styles from "./cards.module.css";

function CardItem({ item }) {
  const videoRef = useRef(null);

  const handleEnter = async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.currentTime = 0;
      await videoRef.current.play();
    } catch (err) {
      console.error("Video play failed:", err);
    }
  };

  const handleLeave = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  return (
    <div
      className={styles.card}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className={styles.cardMedia}>
        {item.screenshot || item.video ? (
          <>
            <img
              src={item.screenshot}
              alt={item.title}
              className={styles.cardImg}
            />

            {item.video && (
              <video
                ref={videoRef}
                className={styles.cardVideo}
                muted
                playsInline
                preload="metadata"
              >
                <source src={item.video} type="video/mp4" />
              </video>
            )}
          </>
        ) : (
          "Screenshot"
        )}
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.cardTitle}>{item.title}</div>
        <div className={styles.cardMeta}>{item.meta}</div>
      </div>
    </div>
  );
}

export default function Cards({ items }) {
  return (
    <div className={styles.showcaseWrap}>
      <div className={styles.showcase}>
        {items.map((item) => (
          <CardItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
