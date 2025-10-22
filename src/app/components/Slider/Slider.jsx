"use client";
import styles from "./slider.module.css";

export default function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  className,
  ...rest
}) {
  const n = (x) => Number(x);
  const percent = ((n(value) - n(min)) / (n(max) - n(min) || 1)) * 100;
  const merged = className ? `${styles.slider} ${className}` : styles.slider;

  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      className={merged}
      style={{ "--percent": `${percent}%` }}
      {...rest}
    />
  );
}
