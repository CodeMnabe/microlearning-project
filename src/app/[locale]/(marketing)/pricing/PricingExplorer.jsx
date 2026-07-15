"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import LoaderLink from "../components/TopLoader/LoaderLink";
import content from "./pricingPage.json";
import styles from "./pricingPage.module.css";

function hasFixedPrice(plan) {
  return /\d/.test(plan.priceMonthly) && /\d/.test(plan.priceYearly);
}

function Price({ plan, billing, unit, className = "" }) {
  const value = billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
  const fixed = hasFixedPrice(plan);

  return (
    <div className={`${styles.priceBlock} ${className}`} aria-live="polite">
      <span className={styles.priceValue}>{value}</span>
      {fixed ? <span className={styles.priceUnit}>{unit}</span> : null}
    </div>
  );
}

function Metrics({ plan, className = "" }) {
  return (
    <dl className={`${styles.metrics} ${className}`}>
      {plan.metrics.map((metric) => (
        <div className={styles.metric} key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FeatureList({ plan, label }) {
  return (
    <div className={styles.featureSummary}>
      <p className={styles.featureSummaryLabel}>{label}</p>
      <ul className={styles.featureList}>
        {plan.included.map((item) => (
          <li key={item}>
            <span className={styles.featureCheck} aria-hidden="true">
              <Check size={13} strokeWidth={2.7} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCard({ plan, billing, unit, recommended, includedLabel }) {
  return (
    <article
      className={`${styles.planCard} ${recommended ? styles.planCardRecommended : ""}`}
    >
      <div className={styles.planCardTop}>
        <div className={styles.planHeadingRow}>
          <h3 className={styles.planName}>{plan.name}</h3>
          {plan.badge ? (
            <span className={styles.planBadge}>{plan.badge}</span>
          ) : null}
        </div>
        <p className={styles.planTagline}>{plan.tagline}</p>
      </div>

      <Price plan={plan} billing={billing} unit={unit} />
      <Metrics plan={plan} />

      <LoaderLink
        href={plan.cta.href}
        className={recommended ? styles.primaryButton : styles.secondaryButton}
      >
        <span>{plan.ctaLabel}</span>
        <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
      </LoaderLink>

      <FeatureList plan={plan} label={includedLabel} />
    </article>
  );
}

function EnterprisePlan({ plan, billing, unit, includedLabel }) {
  return (
    <article className={styles.enterpriseCard}>
      <div>
        <div className={styles.planHeadingRow}>
          <h3 className={styles.enterpriseName}>{plan.name}</h3>
          {plan.badge ? (
            <span className={styles.planBadge}>{plan.badge}</span>
          ) : null}
        </div>
        <p className={styles.enterpriseTagline}>{plan.tagline}</p>
        <p className={styles.enterpriseSummary}>{plan.summary}</p>
      </div>

      <div className={styles.enterpriseDetails}>
        <Metrics plan={plan} className={styles.enterpriseMetrics} />
        <FeatureList plan={plan} label={includedLabel} />
      </div>

      <div className={styles.enterpriseAction}>
        <Price
          plan={plan}
          billing={billing}
          unit={unit}
          className={styles.enterprisePrice}
        />
        <LoaderLink href={plan.cta.href} className={styles.enterpriseButton}>
          <span>{plan.ctaLabel}</span>
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </LoaderLink>
      </div>
    </article>
  );
}

function StateValue({ value, label }) {
  if (value === "included") {
    return (
      <span className={styles.stateIncluded} aria-label={label}>
        <Check size={15} strokeWidth={2.8} aria-hidden="true" />
        <span className={styles.srOnly}>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={value === "limited" ? styles.stateLimited : styles.stateCustom}
    >
      {label}
    </span>
  );
}

function DesktopComparison({ plans, t, recommendedId, label }) {
  const metricRows = plans[0]?.metrics.map((metric, index) => ({
    label: metric.label,
    values: Object.fromEntries(
      plans.map((plan) => [plan.id, plan.metrics[index]?.value]),
    ),
  }));

  return (
    <div className={styles.desktopComparison}>
      <table className={styles.comparisonTable}>
        <caption className={styles.srOnly}>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{t("bands.feature")}</th>
            {plans.map((plan) => (
              <th
                scope="col"
                key={plan.id}
                className={
                  plan.id === recommendedId ? styles.recommendedColumn : ""
                }
              >
                <span className={styles.tablePlanName}>{plan.name}</span>
                {plan.id === recommendedId && plan.badge ? (
                  <span className={styles.tablePlanBadge}>{plan.badge}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {metricRows?.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {plans.map((plan) => (
                <td
                  key={plan.id}
                  className={
                    plan.id === recommendedId ? styles.recommendedColumn : ""
                  }
                >
                  <span className={styles.metricTableValue}>
                    {row.values[plan.id]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {content.bands.map((band) => (
          <tbody key={band.id}>
            <tr className={styles.tableGroupHeader}>
              <th scope="rowgroup" colSpan={plans.length + 1}>
                <span>{t(band.titleKey)}</span>
                <small>{t(band.descriptionKey)}</small>
              </th>
            </tr>
            {band.rows.map((row) => (
              <tr key={row.labelKey}>
                <th scope="row">{t(row.labelKey)}</th>
                {plans.map((plan) => {
                  const state = row.values[plan.id];
                  return (
                    <td
                      key={plan.id}
                      className={
                        plan.id === recommendedId
                          ? styles.recommendedColumn
                          : ""
                      }
                    >
                      <StateValue value={state} label={t(`states.${state}`)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function MobileComparison({
  plans,
  t,
  selectedId,
  onSelect,
  openBand,
  onToggleBand,
}) {
  const selectedPlan = plans.find((plan) => plan.id === selectedId) || plans[0];

  return (
    <div className={styles.mobileComparison}>
      <div
        className={styles.mobilePlanSelector}
        role="group"
        aria-label={plans.map((plan) => plan.name).join(", ")}
      >
        {plans.map((plan) => (
          <button
            type="button"
            key={plan.id}
            aria-pressed={selectedPlan.id === plan.id}
            className={`${styles.mobilePlanButton} ${
              selectedPlan.id === plan.id ? styles.mobilePlanButtonActive : ""
            }`}
            onClick={() => onSelect(plan.id)}
          >
            {plan.name}
          </button>
        ))}
      </div>

      <Metrics plan={selectedPlan} className={styles.mobileMetrics} />

      <div className={styles.mobileBands}>
        {content.bands.map((band) => {
          const isOpen = openBand === band.id;
          const panelId = `mobile-comparison-${band.id}`;

          return (
            <section className={styles.mobileBand} key={band.id}>
              <button
                type="button"
                className={styles.mobileBandTrigger}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => onToggleBand(isOpen ? null : band.id)}
              >
                <span>
                  <strong>{t(band.titleKey)}</strong>
                  <small>{t(band.descriptionKey)}</small>
                </span>
                <ChevronDown size={19} strokeWidth={2} aria-hidden="true" />
              </button>

              <div
                id={panelId}
                className={styles.mobileBandPanel}
                aria-hidden={!isOpen}
              >
                <div>
                  <dl className={styles.mobileFeatureRows}>
                    {band.rows.map((row) => {
                      const state = row.values[selectedPlan.id];
                      return (
                        <div key={row.labelKey}>
                          <dt>{t(row.labelKey)}</dt>
                          <dd>
                            <StateValue
                              value={state}
                              label={t(`states.${state}`)}
                            />
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function PricingExplorer() {
  const t = useTranslations("PricingPage");
  const landingPricingT = useTranslations("LandingPage.Pricing");

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

  const pricedPlans = plans.filter(hasFixedPrice);
  const customPlans = plans.filter((plan) => !hasFixedPrice(plan));
  const compareLabel = landingPricingT("comparison");
  const [billing, setBilling] = useState(content.defaultBilling || "monthly");
  const [comparisonPlanId, setComparisonPlanId] = useState(
    content.defaultPlanId || plans[0]?.id,
  );
  const [openMobileBand, setOpenMobileBand] = useState(
    content.bands[0]?.id || null,
  );
  const [openFaq, setOpenFaq] = useState(-1);

  const scrollToComparison = () => {
    const comparison = document.getElementById("pricing-comparison");
    if (!comparison) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    comparison.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <section className={styles.explorer}>
      <div className={styles.explorerInner}>
        <header className={styles.plansHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{t("explorer.eyebrow")}</p>
            <h2 className={styles.sectionTitle}>{t("explorer.title")}</h2>
          </div>

          <div
            className={styles.billingSwitch}
            role="group"
            aria-label={`${t("billing.monthly")} / ${t("billing.yearly")}`}
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              aria-pressed={billing === "monthly"}
              className={`${styles.billingButton} ${
                billing === "monthly" ? styles.billingButtonActive : ""
              }`}
            >
              {t("billing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              aria-pressed={billing === "yearly"}
              className={`${styles.billingButton} ${
                billing === "yearly" ? styles.billingButtonActive : ""
              }`}
            >
              <span>{t("billing.yearly")}</span>
              <span className={styles.billingBadge}>{t("billing.save")}</span>
            </button>
          </div>
        </header>

        <div className={styles.planGrid}>
          {pricedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              unit={t("billing.unit")}
              recommended={plan.id === content.defaultPlanId}
              includedLabel={t("explorer.outcomes")}
            />
          ))}
        </div>

        <div className={styles.enterpriseList}>
          {customPlans.map((plan) => (
            <EnterprisePlan
              key={plan.id}
              plan={plan}
              billing={billing}
              unit={t("billing.unit")}
              includedLabel={t("explorer.outcomes")}
            />
          ))}
        </div>

        <div className={styles.compareAction}>
          <button
            type="button"
            className={styles.compareButton}
            onClick={scrollToComparison}
          >
            <span>{compareLabel}</span>
            <ChevronDown size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <section className={styles.comparison} id="pricing-comparison">
          <header className={styles.comparisonHeader}>
            <p className={styles.sectionEyebrow}>{t("explorer.outcomes")}</p>
            <h2 className={styles.comparisonTitle}>{compareLabel}</h2>
          </header>

          <DesktopComparison
            plans={plans}
            t={t}
            recommendedId={content.defaultPlanId}
            label={compareLabel}
          />
          <MobileComparison
            plans={plans}
            t={t}
            selectedId={comparisonPlanId}
            onSelect={setComparisonPlanId}
            openBand={openMobileBand}
            onToggleBand={setOpenMobileBand}
          />
        </section>

        <section className={styles.faqWrap}>
          <header className={styles.faqHeader}>
            <p className={styles.sectionEyebrow}>{t("faq.eyebrow")}</p>
            <h2 className={styles.faqTitle}>{t("faq.title")}</h2>
          </header>

          <div className={styles.faqList}>
            {content.faq.map((item, index) => {
              const isOpen = openFaq === index;
              const answerId = `pricing-faq-answer-${index}`;

              return (
                <div
                  key={item.questionKey}
                  className={`${styles.faqItem} ${
                    isOpen ? styles.faqItemOpen : ""
                  }`}
                >
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  >
                    <span>{t(item.questionKey)}</span>
                    <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
                  </button>

                  <div
                    id={answerId}
                    className={styles.faqAnswerWrap}
                    aria-hidden={!isOpen}
                  >
                    <div>
                      <p className={styles.faqAnswer}>{t(item.answerKey)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.finalCtaCard}>
            <div className={styles.finalCtaCopy}>
              <p className={styles.finalEyebrow}>{t("finalCta.eyebrow")}</p>
              <h2 className={styles.finalTitle}>{t("finalCta.title")}</h2>
              <p className={styles.finalText}>{t("finalCta.text")}</p>
            </div>

            <div className={styles.finalActions}>
              <LoaderLink href="/contact" className={styles.finalPrimary}>
                <span>{t("finalCta.primary")}</span>
                <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
              </LoaderLink>
              <LoaderLink href="/" className={styles.finalSecondary}>
                {t("finalCta.secondary")}
              </LoaderLink>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
