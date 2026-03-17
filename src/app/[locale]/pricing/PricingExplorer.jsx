"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import LoaderLink from "../components/TopLoader/LoaderLink";
import content from "./pricingPage.json";
import styles from "./pricingPage.module.css";

function StatePill({ value, children }) {
  return (
    <span
      className={`${styles.statePill} ${value === "included"
        ? styles.stateIncluded
        : value === "limited"
          ? styles.stateLimited
          : styles.stateCustom
        }`}
    >
      {children}
    </span>
  );
}

function FeatureBand({ band, plans, t }) {
  return (
    <section className={styles.bandCard}>
      <div className={styles.bandTop}>
        <h3 className={styles.bandTitle}>{t(band.titleKey)}</h3>
        <p className={styles.bandText}>{t(band.descriptionKey)}</p>
      </div>

      <div className={styles.bandTable}>
        <div className={styles.bandHead}>
          <div className={styles.bandFeatureCol}>{t("bands.feature")}</div>
          {plans.map((plan) => (
            <div key={plan.id} className={styles.bandPlanCol}>
              <span className={styles.bandHeadPlanName}>{plan.name}</span>
            </div>
          ))}
        </div>

        <div className={styles.bandBody}>
          {band.rows.map((row) => (
            <div key={row.labelKey} className={styles.bandRow}>
              <div className={styles.bandFeatureCol}>{t(row.labelKey)}</div>

              {plans.map((plan) => {
                const state = row.values[plan.id];

                return (
                  <div key={plan.id} className={styles.bandPlanCol}>
                    <span className={styles.mobilePlanName}>{plan.name}</span>
                    <StatePill value={state}>{t(`states.${state}`)}</StatePill>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PricingExplorer() {
  const t = useTranslations("PricingPage");

  const plans = content.plans.map((plan) => ({
    ...plan,
    name: t(plan.nameKey),
    badge: plan.badgeKey ? t(plan.badgeKey) : null,
    tagline: t(plan.taglineKey),
    summary: t(plan.summaryKey),
    idealFor: t(plan.idealForKey),
    ctaLabel: t(plan.cta.labelKey),
    highlights: plan.highlightsKeys.map((key) => t(key)),
    included: plan.includedKeys.map((key) => t(key)),
    metrics: plan.metrics.map((metric) => ({
      ...metric,
      label: t(metric.labelKey),
    })),
  }));

  const [billing, setBilling] = useState(content.defaultBilling || "monthly");
  const [selectedId, setSelectedId] = useState(
    content.defaultPlanId || plans[0]?.id,
  );

  const activePlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedId) || plans[0];
  }, [plans, selectedId]);

  const activePrice =
    billing === "yearly" ? activePlan.priceYearly : activePlan.priceMonthly;

  return (
    <section className={styles.explorer}>
      <div className={styles.explorerInner}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.sectionEyebrow}>{t("explorer.eyebrow")}</p>
            <h2 className={styles.sectionTitle}>{t("explorer.title")}</h2>
            <p className={styles.sectionText}>{t("explorer.subhead")}</p>
          </div>
        </div>

        <div className={styles.railControls}>
          <div className={styles.billingSwitch}>
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`${styles.billingBtn} ${billing === "monthly" ? styles.billingBtnActive : ""}`}
            >
              {t("billing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`${styles.billingBtn} ${billing === "yearly" ? styles.billingBtnActive : ""}`}
            >
              {t("billing.yearly")}
              <span className={styles.billingBadge}>{t("billing.save")}</span>
            </button>
          </div>
        </div>

        <div className={styles.planRail}>
          {plans.map((plan) => {
            const railPrice =
              billing === "yearly" ? plan.priceYearly : plan.priceMonthly;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedId(plan.id)}
                aria-pressed={selectedId === plan.id}
                className={`${styles.railCard} ${selectedId === plan.id ? styles.railCardActive : ""}`}
              >
                <div className={styles.railTop}>
                  <div>
                    <div className={styles.railNameRow}>
                      <span className={styles.railName}>{plan.name}</span>
                      {plan.badge ? (
                        <span className={styles.railBadge}>{plan.badge}</span>
                      ) : null}
                    </div>
                    <p className={styles.railTagline}>{plan.tagline}</p>
                  </div>

                  <div className={styles.railPriceWrap}>
                    <span className={styles.railPrice}>{railPrice}</span>
                    <span className={styles.railUnit}>{t("billing.unit")}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={styles.canvasGrid}>
          <article className={styles.canvasMain}>
            <div className={styles.canvasHead}>
              <div>
                <div className={styles.canvasNameRow}>
                  <h3 className={styles.canvasName}>{activePlan.name}</h3>
                  {activePlan.badge ? (
                    <span className={styles.canvasBadge}>
                      {activePlan.badge}
                    </span>
                  ) : null}
                </div>

                {/* <p className={styles.canvasTagline}>{activePlan.tagline}</p> */}
              </div>
              <div className={styles.canvasPriceBox}>
                <div className={styles.canvasPrice}>{activePrice}</div>
                <div className={styles.canvasPriceUnit}>
                  {t("billing.unit")}
                </div>
              </div>
            </div>

            <p className={styles.canvasSummary}>{activePlan.summary}</p>

            <div className={styles.metricGrid}>
              {activePlan.metrics.map((metric) => (
                <div key={metric.label} className={styles.metricCard}>
                  <span className={styles.metricValue}>{metric.value}</span>
                  <span className={styles.metricLabel}>{metric.label}</span>
                </div>
              ))}
            </div>

            <div className={styles.canvasSplit}>
              <div className={styles.canvasInfoBlock}>
                <p className={styles.blockEyebrow}>{t("explorer.bestFor")}</p>
                <p className={styles.blockText}>{activePlan.idealFor}</p>
              </div>

              <div className={styles.canvasInfoBlock}>
                <p className={styles.blockEyebrow}>{t("explorer.outcomes")}</p>
                <ul className={styles.bulletList}>
                  {/* {activePlan.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))} */}
                  {activePlan.included.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={styles.canvasActions}>
              <LoaderLink
                href={activePlan.cta.href}
                className={styles.primaryBtn}
              >
                {activePlan.ctaLabel}
              </LoaderLink>

              <LoaderLink href="/contact" className={styles.secondaryBtn}>
                {t("explorer.secondaryCta")}
              </LoaderLink>
            </div>
          </article>

          {/* <aside className={styles.canvasSide}>
            <div className={styles.sideCard}>
              <p className={styles.sideEyebrow}>{t("included.eyebrow")}</p>
              <h3 className={styles.sideTitle}>{t("included.title")}</h3>

              <ul className={styles.sideList}>
                {activePlan.included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={styles.sideCard}>
              <p className={styles.sideEyebrow}>{t("billingInfo.eyebrow")}</p>
              <h3 className={styles.sideTitle}>{t("billingInfo.title")}</h3>
              <p className={styles.sideText}>{t("billingInfo.text")}</p>
            </div>
          </aside> */}
        </div>

        <div className={styles.bandGrid}>
          {content.bands.map((band) => (
            <FeatureBand key={band.id} band={band} plans={plans} t={t} />
          ))}
        </div>

        <section className={styles.faqWrap}>
          <div className={styles.faqHeader}>
            <p className={styles.sectionEyebrow}>{t("faq.eyebrow")}</p>
            <h2 className={styles.sectionTitle}>{t("faq.title")}</h2>
          </div>

          <div className={styles.faqGrid}>
            {content.faq.map((item) => (
              <article key={item.questionKey} className={styles.faqCard}>
                <h3 className={styles.faqQuestion}>{t(item.questionKey)}</h3>
                <p className={styles.faqAnswer}>{t(item.answerKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.finalCtaCard}>
            <p className={styles.sectionEyebrow}>{t("finalCta.eyebrow")}</p>
            <h2 className={styles.sectionTitle}>{t("finalCta.title")}</h2>
            <p className={styles.sectionText}>{t("finalCta.text")}</p>

            <div className={styles.canvasActions}>
              <LoaderLink href="/contact" className={styles.primaryBtn}>
                {t("finalCta.primary")}
              </LoaderLink>

              <LoaderLink href="/" className={styles.secondaryBtn}>
                {t("finalCta.secondary")}
              </LoaderLink>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
