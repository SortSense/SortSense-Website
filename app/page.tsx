'use client';
/* eslint-disable @next/next/no-img-element */

import {
  ArrowDown,
  ArrowRight,
  Bot,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Lightbulb,
  LocateFixed,
  MapPin,
  Route,
  ScanLine,
  Signal,
  Sparkles,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { categories } from '@/lib/categories';
import { PublicHeader } from '@/components/shell/public-header';
import { PublicFooter } from '@/components/shell/public-footer';

const campusPhoto =
  'https://images.unsplash.com/photo-1654145167982-10c1ebde498a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1400';
const binsPhoto =
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1200';

const categoryVisuals: Record<
  string,
  {
    imageUrl: string;
    alt: string;
    hint: string;
  }
> = {
  plastic: {
    imageUrl:
      'https://images.unsplash.com/photo-1571727153934-b9e0059b7ab2?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
    alt: 'Clean transparent plastic bottles and containers',
    hint: 'Rinse out liquids · Keep bottle caps attached',
  },
  paper: {
    imageUrl:
      'https://images.unsplash.com/photo-1654372066379-d8a1c70f7363?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
    alt: 'Clean recyclable paper and flattened cardboard boxes',
    hint: 'Keep dry · Flatten boxes before disposal',
  },
  metal: {
    imageUrl:
      'https://images.unsplash.com/photo-1689555256964-aeabc20d1d3c?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
    alt: 'Clean aluminum drink cans and metal food containers',
    hint: 'Empty residue · Crush cans where possible',
  },
  general: {
    imageUrl:
      'https://images.unsplash.com/photo-1619540034640-0d41b5e0f6fc?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
    alt: 'Everyday non-recyclable items and disposable coffee cup',
    hint: 'Food-soiled packaging · Bag messy items',
  },
};

const walkthroughSteps = [
  {
    id: 'scan',
    stepNumber: '01',
    label: 'Step 01 / Scan',
    title: 'Show the item',
    summary:
      'The user holds an item in front of the dedicated camera scanning area beside the bins.',
    details:
      "SortSense's computer vision module detects the object shape and material within seconds, eliminating disposal guesswork.",
    icon: ScanLine,
    highlight: 'Separate camera scanning zone beside bins',
  },
  {
    id: 'guide',
    stepNumber: '02',
    label: 'Step 02 / Sort',
    title: 'Follow the light',
    summary:
      'The matching category LED indicator lights up directly above the correct bin aperture.',
    details:
      'Four standard bins stand side-by-side. The wall-mounted indicator provides an unmistakable physical cue so anyone can deposit items correctly.',
    icon: Lightbulb,
    highlight: 'Illuminated wall-mounted LED above matching bin',
  },
  {
    id: 'locate',
    stepNumber: '03',
    label: 'Step 03 / Locate',
    title: 'Find a station',
    summary:
      'The web companion helps you check nearby station locations and real-time bin availability.',
    details:
      'Before walking across campus, check which station has an available bin for your specific waste stream and plan your route.',
    icon: LocateFixed,
    highlight: 'Live bin availability & distance preview',
  },
];

export default function HomePage() {
  const [selectedItem, setSelectedItem] = useState('plastic');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const selected =
    categories.find((item) => item.slug === selectedItem) ?? categories[0];
  const currentVisual =
    categoryVisuals[selected.slug] ?? categoryVisuals.plastic;
  const currentStep = walkthroughSteps[activeStepIndex];

  return (
    <div className="site-shell">
      <PublicHeader />

      <main className="renew-home">
        {/* HERO SECTION */}
        <section className="renew-hero page-width" aria-label="Introduction">
          <div className="renew-hero-bg-accent" aria-hidden="true">
            <svg
              className="hero-leaf-motif"
              viewBox="0 0 400 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M360 40C240 40 80 180 80 320C80 360 120 400 160 400C300 400 360 200 360 40Z"
                fill="rgba(23, 107, 69, 0.035)"
              />
              <path
                d="M360 40C250 150 160 280 160 400"
                stroke="rgba(72, 168, 104, 0.12)"
                strokeWidth="2"
                strokeDasharray="4 6"
              />
            </svg>
          </div>

          <div className="renew-hero-copy">
            <span className="renew-kicker">
              <i /> Smarter Sorting. Better Choices.
            </span>
            <h1>
              Every waste
              <br />
              has its <em>place.</em>
            </h1>
            <p>
              One clear system for knowing what goes where—and where to find the
              right bin nearby on campus.
            </p>
            <div className="renew-actions">
              <Link
                className="button button-primary button-large hero-primary-cta"
                href="/find-bin"
              >
                <span>Find a Bin</span>
                <ArrowRight size={18} className="cta-arrow-icon" />
              </Link>
              <a className="renew-text-action" href="#process">
                <span>See how it works</span>
                <ArrowDown size={16} />
              </a>
            </div>
            <div className="renew-microcopy">
              <span>
                <Check size={13} /> No account needed
              </span>
              <span>
                <Check size={13} /> Public campus access
              </span>
              <span>
                <Check size={13} /> Prototype simulation
              </span>
            </div>
          </div>

          <div className="renew-hero-media">
            <img
              src={campusPhoto}
              alt="Sustainable modern architecture with green campus landscaping"
              loading="eager"
            />
            <div className="media-scrim" />
            <span className="photo-credit">Photo by Ahya Agawis on Unsplash</span>

            <div className="hero-live-card">
              <span className="live-card-icon" aria-hidden="true">
                <MapPin size={19} />
              </span>
              <div>
                <small>Nearest demo station</small>
                <strong>Science Building</strong>
                <span>150 m · Plastic available</span>
              </div>
              <Link
                href="/find-bin"
                className="hero-live-card-link"
                aria-label="Open the bin locator for Science Building"
              >
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="hero-scan-chip">
              <span className="sensor-live-dot" aria-hidden="true" />
              <Signal size={14} />
              <span>Demo: 4 stations simulated</span>
            </div>
          </div>
        </section>

        {/* STAT BAND */}
        <section className="renew-stat-band" aria-label="System statistics">
          <div className="page-width">
            <p>
              SortSense turns complex sensing into{' '}
              <strong>one useful next step.</strong>
            </p>
            <div>
              <span>
                <strong>04</strong> waste categories
              </span>
              <span>
                <strong>04</strong> demo stations
              </span>
              <span>
                <strong>01</strong> clear decision
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 1: INTERACTIVE WORKFLOW WALKTHROUGH */}
        <section
          className="renew-process page-width"
          id="process"
          aria-label="How SortSense Works"
        >
          <div className="renew-section-head">
            <span className="renew-index">01</span>
            <div>
              <span className="renew-kicker">
                <i /> From confusion to confidence
              </span>
              <h2>A simpler path from item to bin.</h2>
            </div>
            <p>
              The physical station guides sorting in person. The web app helps you
              locate available bins before you walk.
            </p>
          </div>

          {/* Interactive Walkthrough Component */}
          <div className="walkthrough-shell">
            {/* Step Selector Tabs */}
            <div
              className="walkthrough-nav"
              role="tablist"
              aria-label="Product workflow steps"
            >
              {walkthroughSteps.map((step, idx) => {
                const Icon = step.icon;
                const isSelected = activeStepIndex === idx;
                return (
                  <button
                    key={step.id}
                    role="tab"
                    id={`tab-${step.id}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${step.id}`}
                    className={`walkthrough-tab ${isSelected ? 'active' : ''}`}
                    onClick={() => setActiveStepIndex(idx)}
                  >
                    <div className="tab-indicator">
                      <span className="tab-number">{step.stepNumber}</span>
                      <span className="tab-icon-badge">
                        <Icon size={18} />
                      </span>
                    </div>
                    <div className="tab-text">
                      <span className="tab-label">{step.label}</span>
                      <h3>{step.title}</h3>
                      <p>{step.summary}</p>
                    </div>
                    <ChevronRight size={18} className="tab-chevron" />
                  </button>
                );
              })}
            </div>

            {/* Contextual Interactive Preview Stage */}
            <div
              className="walkthrough-preview-stage"
              role="tabpanel"
              id={`panel-${currentStep.id}`}
              aria-labelledby={`tab-${currentStep.id}`}
            >
              <div className="preview-stage-header">
                <span className="stage-step-tag">
                  <Sparkles size={13} /> {currentStep.highlight}
                </span>
                <span className="stage-counter">
                  Step {activeStepIndex + 1} of 3
                </span>
              </div>

              {/* PREVIEW 1: Camera Scanner Beside Bins */}
              {activeStepIndex === 0 && (
                <div className="preview-card-content preview-scan animate-fade-in">
                  <div className="scanner-visualization">
                    <div className="scanner-booth">
                      <div className="scanner-camera-head">
                        <div className="camera-lens">
                          <Camera size={18} />
                        </div>
                        <span className="camera-label">
                          AI Scanning Camera Area
                        </span>
                        <span className="status-live-pill">Standby Scanning</span>
                      </div>

                      <div className="scanner-viewfinder">
                        <div className="viewfinder-frame">
                          <span className="corner top-left" />
                          <span className="corner top-right" />
                          <span className="corner bottom-left" />
                          <span className="corner bottom-right" />
                          <div className="scan-laser-line" />

                          {/* Item being presented */}
                          <div className="scanned-item-silhouette">
                            <div className="bottle-graphic">
                              <span className="bottle-neck" />
                              <span className="bottle-body">
                                <i>PET</i>
                              </span>
                            </div>
                          </div>

                          {/* Real-time Vision Detection Tag */}
                          <div className="detection-floating-chip">
                            <Check size={13} />
                            <strong>Detected: Plastic Drink Bottle</strong>
                            <small>Confidence 94% · Recyclable PET #1</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="scanner-info-strip">
                      <strong>Separate Optical Scanning Console</strong>
                      <p>
                        Item presented to the camera beside the bins. Vision model
                        estimates classification before disposal.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PREVIEW 2: Wall-Mounted Indicator Light & 4 Bins */}
              {activeStepIndex === 1 && (
                <div className="preview-card-content preview-guide animate-fade-in">
                  <div className="station-setup-visualization">
                    <div className="wall-indicator-strip">
                      <span className="wall-cue-label">
                        Wall-Mounted Indicator Cues:
                      </span>
                      <div className="indicator-leds-row">
                        {/* Bin 1: Plastic - ILLUMINATED */}
                        <div className="led-cue active-cue cue-plastic">
                          <div className="led-lamp">
                            <span className="lamp-glow" />
                            <Lightbulb size={16} />
                          </div>
                          <span className="led-name">Plastic</span>
                          <span className="led-state">MATCHED</span>
                        </div>

                        {/* Bin 2: Paper */}
                        <div className="led-cue cue-paper">
                          <div className="led-lamp unlit" />
                          <span className="led-name">Paper</span>
                          <span className="led-state">Standby</span>
                        </div>

                        {/* Bin 3: Metal */}
                        <div className="led-cue cue-metal">
                          <div className="led-lamp unlit" />
                          <span className="led-name">Metal</span>
                          <span className="led-state">Standby</span>
                        </div>

                        {/* Bin 4: General */}
                        <div className="led-cue cue-general">
                          <div className="led-lamp unlit" />
                          <span className="led-name">General</span>
                          <span className="led-state">Standby</span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Standard Bins Array */}
                    <div className="four-bins-array" aria-hidden="true">
                      {/* Bin 1: Plastic */}
                      <div className="demo-bin-card is-active-bin">
                        <div className="bin-beacon-beam" />
                        <div className="bin-aperture-lid lid-plastic" />
                        <div className="bin-body">
                          <strong>Plastic</strong>
                          <span className="bin-fill-tag fill-ok">42% full</span>
                        </div>
                      </div>

                      {/* Bin 2: Paper */}
                      <div className="demo-bin-card">
                        <div className="bin-aperture-lid lid-paper" />
                        <div className="bin-body">
                          <strong>Paper</strong>
                          <span className="bin-fill-tag fill-warn">78% full</span>
                        </div>
                      </div>

                      {/* Bin 3: Metal */}
                      <div className="demo-bin-card">
                        <div className="bin-aperture-lid lid-metal" />
                        <div className="bin-body">
                          <strong>Metal</strong>
                          <span className="bin-fill-tag fill-alert">
                            94% full
                          </span>
                        </div>
                      </div>

                      {/* Bin 4: General */}
                      <div className="demo-bin-card">
                        <div className="bin-aperture-lid lid-general" />
                        <div className="bin-body">
                          <strong>General</strong>
                          <span className="bin-fill-tag fill-ok">35% full</span>
                        </div>
                      </div>
                    </div>

                    <div className="scanner-info-strip">
                      <strong>Simple Physical Cueing</strong>
                      <p>
                        No moving robotic parts. Four ordinary bins equipped with
                        internal fill sensors and wall-mounted LEDs for instant
                        clarity.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PREVIEW 3: Station Locator Web Companion */}
              {activeStepIndex === 2 && (
                <div className="preview-card-content preview-locator animate-fade-in">
                  <div className="locator-interactive-preview">
                    <div className="preview-station-card">
                      <div className="preview-station-header">
                        <div className="station-avatar">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <span className="station-kicker">
                            Nearest Campus Station
                          </span>
                          <h4>Science Building — Main Entrance</h4>
                          <div className="station-pills">
                            <span>
                              <Route size={12} /> 150 m · 2 min walk
                            </span>
                            <span>
                              <Compass size={12} /> Step-free access
                            </span>
                          </div>
                        </div>
                        <span className="status-pill status-ready">
                          Plastic Available
                        </span>
                      </div>

                      <div className="mini-bins-status-grid">
                        <div className="mini-bin-row">
                          <div className="category-indicator cat-plastic" />
                          <span className="bin-category-name">Plastic</span>
                          <div className="meter-track">
                            <div
                              className="meter-bar fill-available"
                              style={{ width: '42%' }}
                            />
                          </div>
                          <span className="bin-badge badge-available">
                            Available (42%)
                          </span>
                        </div>

                        <div className="mini-bin-row">
                          <div className="category-indicator cat-paper" />
                          <span className="bin-category-name">Paper</span>
                          <div className="meter-track">
                            <div
                              className="meter-bar fill-nearly-full"
                              style={{ width: '78%' }}
                            />
                          </div>
                          <span className="bin-badge badge-warning">
                            Nearly full (78%)
                          </span>
                        </div>

                        <div className="mini-bin-row">
                          <div className="category-indicator cat-metal" />
                          <span className="bin-category-name">Metal</span>
                          <div className="meter-track">
                            <div
                              className="meter-bar fill-full"
                              style={{ width: '94%' }}
                            />
                          </div>
                          <span className="bin-badge badge-danger">
                            Full (94%)
                          </span>
                        </div>

                        <div className="mini-bin-row">
                          <div className="category-indicator cat-general" />
                          <span className="bin-category-name">General</span>
                          <div className="meter-track">
                            <div
                              className="meter-bar fill-available"
                              style={{ width: '35%' }}
                            />
                          </div>
                          <span className="bin-badge badge-available">
                            Available (35%)
                          </span>
                        </div>
                      </div>

                      <div className="preview-action-row">
                        <Link
                          href="/find-bin"
                          className="button button-primary button-compact"
                        >
                          <span>Explore Campus Map</span>
                          <ArrowRight size={14} />
                        </Link>
                        <small>Interactive live demo simulation</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STORY SECTION */}
        <section className="renew-story" aria-label="Philosophy">
          <div className="page-width renew-story-grid">
            <div className="renew-story-photo">
              <img
                src={binsPhoto}
                alt="A row of neatly separated recycling bins on campus"
                loading="lazy"
              />
              <span>Photo by Pawel Czerwinski on Unsplash</span>
            </div>
            <div className="renew-story-copy">
              <span className="renew-kicker light">
                <i /> Useful technology, quietly working
              </span>
              <h2>Not another dashboard. A better decision.</h2>
              <p>
                SortSense brings the information people actually need to the
                surface: the likely category, the correct destination, and whether
                there is room when they arrive.
              </p>
              <div className="story-points">
                <div>
                  <Bot size={20} />
                  <span>
                    <strong>Recognize</strong>
                    AI suggests a likely category in the camera area.
                  </span>
                </div>
                <div>
                  <Lightbulb size={20} />
                  <span>
                    <strong>Guide</strong>
                    LEDs make the next action immediately visible.
                  </span>
                </div>
                <div>
                  <MapPin size={20} />
                  <span>
                    <strong>Locate</strong>
                    Live availability helps choose a station before walking.
                  </span>
                </div>
              </div>
              <Link href="/find-bin">
                Explore the locator <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 2: CATEGORY GUIDANCE ("WHAT ARE YOU HOLDING?") */}
        <section
          className="renew-guide-preview page-width"
          aria-label="Category sorting preview"
        >
          <div className="renew-section-head">
            <span className="renew-index">02</span>
            <div>
              <span className="renew-kicker">
                <i /> Start with the item
              </span>
              <h2>What are you holding?</h2>
            </div>
            <Link href="/sorting-guide">
              Full sorting guide <ArrowRight size={16} />
            </Link>
          </div>

          <div className="renew-category-shell">
            {/* Category selection on the left */}
            <div
              className="renew-category-nav"
              role="tablist"
              aria-label="Waste category options"
            >
              {categories.map((category, index) => {
                const isSelected = selectedItem === category.slug;
                return (
                  <button
                    className={isSelected ? 'active' : ''}
                    key={category.slug}
                    role="tab"
                    id={`cat-tab-${category.slug}`}
                    aria-selected={isSelected}
                    aria-controls={`cat-panel-${category.slug}`}
                    onClick={() => setSelectedItem(category.slug)}
                  >
                    <span>0{index + 1}</span>
                    <strong>{category.name}</strong>
                    <ArrowRight size={16} className="category-nav-arrow" />
                  </button>
                );
              })}
            </div>

            {/* Upgraded Category Visual Preview on the right */}
            <div
              className="renew-category-detail"
              role="tabpanel"
              id={`cat-panel-${selected.slug}`}
              aria-labelledby={`cat-tab-${selected.slug}`}
              style={{ '--category-color': selected.color } as CSSProperties}
            >
              <div className="category-media-frame">
                <div className="category-photo-wrapper">
                  <img
                    key={selected.slug}
                    src={currentVisual.imageUrl}
                    alt={currentVisual.alt}
                    className="category-showcase-image animate-fade-in"
                    loading="lazy"
                  />
                  <div className="category-photo-overlay" />
                  <span
                    className="category-badge-chip"
                    style={{ backgroundColor: selected.color }}
                  >
                    {selected.name}
                  </span>
                </div>
                <span className="category-preparation-hint">
                  {currentVisual.hint}
                </span>
              </div>

              {/* Category Information & Actions */}
              <div className="category-info-body">
                <div className="category-header-badges">
                  <span className="demo-label">Illustrative guidance</span>
                  <span className="category-color-swatch" aria-hidden="true" />
                </div>

                <h3>{selected.name}</h3>
                <p>{selected.shortDescription}</p>

                <div className="accepted-items-label">Accepted examples:</div>
                <div className="example-row">
                  {selected.accepts.map((item) => (
                    <span key={item}>
                      <Check size={13} /> {item}
                    </span>
                  ))}
                </div>

                <div className="category-action-row">
                  <Link
                    className="button button-primary button-compact"
                    href={`/sorting-guide?category=${selected.slug}`}
                  >
                    <span>Read full {selected.name} guide</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    className="button button-secondary button-compact"
                    href={`/find-bin?category=${selected.slug}`}
                  >
                    <span>Find {selected.name} bin</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="renew-final page-width" aria-label="Call to action">
          <div>
            <span className="renew-kicker light">
              <i /> The next right choice is nearby
            </span>
            <h2>Ready to find your bin?</h2>
          </div>
          <p>
            Choose a waste category, compare availability, and open directions to
            a suitable demo station across campus.
          </p>
          <Link className="button button-accent button-large" href="/find-bin">
            Find a Bin <ArrowRight size={17} />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
