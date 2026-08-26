import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  FileText,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import PersistentHeader from "@/app/components/Navbar/MarketingNavbar/PersistentHeader";
import LoaderLink from "./components/TopLoader/LoaderLink";
import Footer from "./components/Footer/Footer";
import LandingExperience from "./components/LandingExperience/LandingExperience";
import InteractiveAmbientBackground from "./components/InteractiveAmbientBackground/InteractiveAmbientBackground";
import BeforeAfterComparison from "./components/BeforeAfterComparison/BeforeAfterComparison";
import FeatureGrid from "./components/FeatureGrid/FeatureGrid";
import HeroBrandBackdrop from "./components/LandingExperience/HeroBrandBackdrop";
import FinalBrandPattern from "./components/LandingExperience/FinalBrandPattern";
import heroContent from "./components/Hero/hero.json";
import pricingContent from "./components/Pricing/pricing.json";
import styles from "./components/LandingExperience/landingExperience.module.css";

function AnimatedLine({ children }) {
  return (
    <span className={styles.heroLine} aria-hidden="true">
      {children.split(" ").map((word, index) => (
        <span
          className={styles.heroWord}
          data-hero-word
          key={`${word}-${index}`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export default async function LocaleIndex() {
  const tHero = await getTranslations("LandingPage.Hero");
  const tBeforeAfter = await getTranslations("LandingPage.BeforeAfter");
  const tPricing = await getTranslations("LandingPage.Pricing");
  const tJourney = await getTranslations("LandingPage.Journey");

  const heroCards = heroContent.cards.map((card) => ({
    ...card,
    title: tHero(card.titleKey),
    meta: tHero(card.metaKey),
  }));

  const plans = pricingContent.plans.map((plan, index) => ({
    ...plan,
    name: tPricing(plan.nameKey),
    tagline: tPricing(plan.taglineKey),
    unit: tPricing(plan.unitKey),
    color: ["#7cc2ff", "#4ab0ff", "#7c5cfc"][index],
  }));

  const heroTitle = `${tHero(heroContent.titleLines[0])} ${tHero(heroContent.titleLines[1])}`;

  return (
    <main>
      {/* Rendered outside <LandingExperience> so the persistent header is never
          nested inside a sticky / overflow-hidden scroll scene. The hero already
          reserves its own top padding, so no in-flow spacer is needed here. */}
      <PersistentHeader />

      <LandingExperience>
        <section className={`${styles.scene} ${styles.heroScene}`}>
          <div className={styles.sceneSticky} data-scene-sticky>
            <div className={styles.heroBackdrop} aria-hidden="true" />
            <InteractiveAmbientBackground
              variant="aurora"
              intensity="medium"
              interactive
            />
            <HeroBrandBackdrop />
            <div className={styles.heroInner}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow} data-hero-intro>
                  {tJourney("heroEyebrow")}
                </p>
                <h1 className={styles.heroTitle} aria-label={heroTitle}>
                  <AnimatedLine>
                    {tHero(heroContent.titleLines[0])}
                  </AnimatedLine>
                  <AnimatedLine>
                    {tHero(heroContent.titleLines[1])}
                  </AnimatedLine>
                </h1>
                <p className={styles.heroSubhead} data-hero-intro>
                  {tHero(heroContent.subheadLines[0])}
                </p>
                <div className={styles.actions} data-hero-intro>
                  <LoaderLink
                    href={heroContent.primaryCta.href}
                    className={styles.primaryButton}
                    data-magnetic
                    data-page-demo-cta
                  >
                    {tHero(heroContent.primaryCta.labelKey)}
                  </LoaderLink>
                  <LoaderLink
                    href={heroContent.secondaryCta.href}
                    className={styles.secondaryButton}
                  >
                    {tHero(heroContent.secondaryCta.labelKey)}
                  </LoaderLink>
                </div>
                <span
                  className={styles.scrollCue}
                  data-hero-intro
                  aria-hidden="true"
                >
                  <ChevronDown
                    className={styles.scrollCueIcon}
                    size={30}
                    strokeWidth={1.5}
                  />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.scene} ${styles.transformScene} ${styles.legacyTransformationScene}`}
          data-scene="transformation"
        >
          <div className={styles.sceneSticky} data-scene-sticky>
            <div className={styles.sceneInner}>
              <header className={styles.sectionHeader} data-reveal>
                <div>
                  <p className={styles.eyebrow}>
                    {tJourney("transformationEyebrow")}
                  </p>
                  <h2 className={styles.sectionTitle}>
                    {tBeforeAfter("heading")}
                  </h2>
                </div>
                <p className={styles.sectionText}>
                  {tBeforeAfter("subheading")}
                </p>
              </header>

              <div
                className={styles.transformStage}
                data-transform-stage
                aria-label={tBeforeAfter("story.ariaLabel")}
              >
                <div className={styles.stageGlow} data-stage-glow />
                <div className={styles.stageGrid} aria-hidden="true" />

                <div className={styles.storyStatus} aria-live="polite">
                  <span data-story-status="noise">
                    {tBeforeAfter("story.noise")}
                  </span>
                  <span data-story-status="gather">
                    {tBeforeAfter("story.gather")}
                  </span>
                  <span data-story-status="result">
                    {tBeforeAfter("story.result")}
                  </span>
                </div>

                <div className={styles.signalField} aria-hidden="true">
                  <div
                    className={`${styles.signal} ${styles.signalMessage}`}
                    data-signal
                    data-gather-x="255"
                    data-gather-y="130"
                  >
                    <MessageCircle size={17} strokeWidth={1.8} />
                    <span>{tBeforeAfter("story.signals.messages")}</span>
                  </div>
                  <div
                    className={`${styles.signal} ${styles.signalDocument}`}
                    data-signal
                    data-gather-x="-225"
                    data-gather-y="115"
                  >
                    <FileText size={17} strokeWidth={1.8} />
                    <span>{tBeforeAfter("story.signals.documents")}</span>
                  </div>
                  <div
                    className={`${styles.signal} ${styles.signalAlert}`}
                    data-signal
                    data-gather-x="210"
                    data-gather-y="-105"
                  >
                    <Bell size={17} strokeWidth={1.8} />
                    <span>{tBeforeAfter("story.signals.alerts")}</span>
                  </div>
                </div>

                <div className={styles.flowLines} aria-hidden="true">
                  <i data-flow-line />
                  <i data-flow-line />
                  <i data-flow-line />
                </div>

                <article className={styles.knowledgePlatform} data-platform>
                  <header className={styles.platformBar}>
                    <div className={styles.platformBrand}>
                      <span className={styles.brandMark}>
                        <Sparkles size={14} strokeWidth={2} />
                      </span>
                      <span>{tBeforeAfter("story.platform.name")}</span>
                    </div>
                    <span className={styles.liveStatus}>
                      {tBeforeAfter("story.platform.live")}
                    </span>
                  </header>

                  <div className={styles.platformBody}>
                    <div className={styles.platformRail} aria-hidden="true">
                      <span className={styles.railActive}>
                        <Sparkles size={17} />
                      </span>
                      <span>
                        <MessageCircle size={17} />
                      </span>
                      <span>
                        <BarChart3 size={17} />
                      </span>
                    </div>

                    <div className={styles.lessonPanel}>
                      <div className={styles.lessonMeta} data-platform-item>
                        <span>{tBeforeAfter("story.platform.eyebrow")}</span>
                        <span>{tBeforeAfter("story.platform.duration")}</span>
                      </div>
                      <h3 data-platform-item>
                        {tBeforeAfter("story.platform.prompt")}
                      </h3>
                      <p data-platform-item>
                        {tBeforeAfter("story.platform.context")}
                      </p>
                      <div className={styles.lessonAction} data-platform-item>
                        <span className={styles.actionCheck}>
                          <Check size={15} strokeWidth={2.5} />
                        </span>
                        <span>{tBeforeAfter("story.platform.action")}</span>
                      </div>
                    </div>

                    <aside className={styles.impactPanel} data-platform-item>
                      <span className={styles.impactLabel}>
                        {tBeforeAfter("story.platform.impact")}
                      </span>
                      <strong>84%</strong>
                      <span className={styles.impactCaption}>
                        {tBeforeAfter("story.platform.adoption")}
                      </span>
                      <div className={styles.impactBars} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    </aside>
                  </div>
                </article>

                <div className={styles.storyProgress} aria-hidden="true">
                  <div className={styles.progressTrack}>
                    <span data-story-progress />
                  </div>
                  <div className={styles.progressLabels}>
                    <span>{tBeforeAfter("story.steps.chaos")}</span>
                    <span>{tBeforeAfter("story.steps.organize")}</span>
                    <span>{tBeforeAfter("story.steps.outcome")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.scene} ${styles.productScene}`}
          data-scene="product"
        >
          <div
            className={`${styles.sceneSticky} ${styles.productStage}`}
            data-scene-sticky
          >
            <header className={styles.productHeader} data-reveal>
              <p className={styles.eyebrow}>{tJourney("productEyebrow")}</p>
              <h2 className={styles.sectionTitle}>
                {tJourney("productTitle")}
              </h2>
            </header>

            <div className={styles.acts}>
              {heroCards.map((card, index) => (
                <article
                  className={styles.act}
                  data-product-act
                  key={card.id}
                  style={{
                    "--act-color": ["#7cc2ff", "#ffd166", "#7c5cfc"][index],
                  }}
                >
                  <div className={styles.actCopy}>
                    <span className={styles.actNumber}>
                      {String(index + 1).padStart(2, "0")} / 03
                    </span>
                    <h3 className={styles.actTitle}>{card.title}</h3>
                    <p className={styles.actMeta}>{card.meta}</p>
                  </div>
                  <div className={styles.actMedia}>
                    <Image
                      src={card.screenshot}
                      alt={card.title}
                      fill
                      sizes="(max-width: 760px) 100vw, 720px"
                    />
                    <video
                      data-scene-video
                      muted
                      playsInline
                      loop
                      preload="metadata"
                      poster={card.screenshot}
                      aria-label={card.title}
                    >
                      <source src={card.video} type="video/mp4" />
                    </video>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <FeatureGrid />

        <section className={`${styles.scene} ${styles.transformComparisonScene}`}>
          <div className={styles.comparisonInner}>
            <header className={styles.sectionHeader} data-reveal>
              <div>
                <p className={styles.eyebrow}>
                  {tJourney("transformationEyebrow")}
                </p>
                <h2 className={styles.sectionTitle}>
                  {tBeforeAfter("heading")}
                </h2>
              </div>
              <p className={styles.sectionText}>
                {tBeforeAfter("subheading")}
              </p>
            </header>

            <BeforeAfterComparison
              ariaLabel={tBeforeAfter("story.ariaLabel")}
              before={{
                label: tBeforeAfter("before.label"),
                alt: tBeforeAfter("before.alt"),
              }}
              after={{
                label: tBeforeAfter("after.label"),
                alt: tBeforeAfter("after.alt"),
              }}
              beforeBullets={[
                tBeforeAfter("before.bullets.1"),
                tBeforeAfter("before.bullets.0"),
                tBeforeAfter("before.bullets.2"),
                tBeforeAfter("before.bullets.4"),
              ]}
              afterBullets={[
                tBeforeAfter("after.bullets.0"),
                tBeforeAfter("after.bullets.1"),
                tBeforeAfter("after.bullets.2"),
                tBeforeAfter("after.bullets.4"),
              ]}
            />
          </div>
        </section>

        <section
          className={`${styles.scene} ${styles.pricingScene}`}
          data-scene="pricing"
        >
          <div className={styles.pricingStage}>
            <header className={styles.pricingHeader} data-reveal>
              <div>
                <p className={styles.eyebrow}>{tJourney("pricingEyebrow")}</p>
                <h2 className={styles.sectionTitle}>
                  {tJourney("pricingTitle")}
                </h2>
              </div>
              <p className={styles.sectionText}>{tPricing("subheading")}</p>
            </header>

            <div className={styles.pricingGrid}>
              <ul className={styles.benefits} data-reveal>
                {pricingContent.benefitsKeys.map((key) => (
                  <li className={styles.benefit} key={key}>
                    {tPricing(key)}
                  </li>
                ))}
              </ul>

              <div className={styles.planStack}>
                {plans.map((plan) => (
                  <article
                    className={`${styles.planCard} ${plan.popular ? styles.planCardPopular : ""}`}
                    data-plan-card
                    key={plan.id}
                    style={{ "--plan-color": plan.color }}
                  >
                    <span className={styles.planBadge}>{plan.name}</span>
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <p className={styles.planPrice}>
                      {plan.price}
                      <span className={styles.planUnit}>/ {plan.unit}</span>
                    </p>
                    <p className={styles.planTagline}>{plan.tagline}</p>
                    <LoaderLink href="/pricing" className={styles.compareLink}>
                      {tPricing("comparison")}
                    </LoaderLink>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.scene} ${styles.finalScene}`}
          data-scene="finale"
        >
          <div className={styles.finalBackdrop} aria-hidden="true" />
          <InteractiveAmbientBackground
            variant="mist"
            intensity="subtle"
            interactive={false}
            className={styles.finalAmbient}
          />
          <FinalBrandPattern />
          <div className={styles.finalContent} data-reveal>
            <p className={styles.eyebrow}>{tJourney("finalEyebrow")}</p>
            <h2 className={styles.finalTitle}>{tJourney("finalTitle")}</h2>
            <p className={styles.finalText}>{tJourney("finalText")}</p>
            <LoaderLink
              href="/contact"
              className={styles.primaryButton}
              data-magnetic
            >
              {tHero(heroContent.primaryCta.labelKey)}
            </LoaderLink>
          </div>
        </section>

        <Footer />
      </LandingExperience>
    </main>
  );
}
