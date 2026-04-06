"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LoaderLink from "../TopLoader/LoaderLink";
import styles from "./pricing.module.css";
import content from "./pricing.json";

function CheckItem({ children }) {
  return (
    <li className={styles.checkItem}>
      <span className={styles.checkIcon} aria-hidden="true">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function PlanCard({ plan, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`${styles.planCard} ${selected ? styles.planSelected : ""} ${
        plan.popular ? styles.planPopular : ""
      }`}
      onClick={() => onSelect(plan.id)}
    >
      <span className={styles.radio} aria-hidden="true">
        <span className={selected ? styles.radioDotOn : styles.radioDotOff} />
      </span>

      <div className={styles.planMain}>
        <div className={styles.planTop}>
          <div>
            <div className={styles.planNameRow}>
              <h3 className={styles.planName}>{plan.name}</h3>
              {plan.popular ? (
                <span className={styles.popTag}>Popular</span>
              ) : null}
            </div>
            {plan.tagline ? (
              <p className={styles.planTagLine}>{plan.tagline}</p>
            ) : null}
          </div>

          <div className={styles.price}>
            <span className={styles.priceValue}>{plan.price}</span>
            <span className={styles.priceUnit}>/{plan.unit}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Pricing({ onPlanChange }) {
  const t = useTranslations("LandingPage.Pricing");

  const plans = content.plans.map((p) => ({
    ...p,
    name: t(p.nameKey),
    tagline: t(p.taglineKey),
    unit: p.unitKey ? t(p.unitKey) : "month",
  }));

  const benefits = content.benefitsKeys.map((k) => t(k));

  const initial = useMemo(() => {
    return (
      content.defaultPlanId ||
      plans.find((p) => p.popular)?.id ||
      plans[0]?.id ||
      null
    );
  }, [plans]);

  const [selectedId, setSelectedId] = useState(initial);

  function select(id) {
    setSelectedId(id);
    onPlanChange?.(id);
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t(content.eyebrowKey)}</p>
        <h2 className={styles.heading}>{t(content.headingKey)}</h2>
        <p className={styles.subheading}>{t(content.subheadingKey)}</p>
      </header>

      <div className={styles.grid}>
        <aside className={styles.benefitsCard}>
          <ul className={styles.checkList}>
            {benefits.map((b, i) => (
              <CheckItem key={i}>{b}</CheckItem>
            ))}
          </ul>

          {content.comparisonLink?.href ? (
            <LoaderLink
              className={styles.compareLink}
              href={content.comparisonLink.href}
            >
              {t(content.comparisonLink.labelKey)}
            </LoaderLink>
          ) : null}
        </aside>

        <div className={styles.plansCol}>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              selected={p.id === selectedId}
              onSelect={select}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
