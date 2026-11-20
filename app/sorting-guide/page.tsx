'use client';
/* eslint-disable @next/next/no-img-element */

import { ArrowRight, Check, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { Suspense, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { categories, type CategorySlug } from '@/lib/categories';
import { PublicHeader } from '@/components/shell/public-header';
import { PublicFooter } from '@/components/shell/public-footer';

const guidePhoto =
  'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1200';

function GuideContent() {
  const params = useSearchParams();
  const initial = params.get('category') as CategorySlug | null;
  const [selectedSlug, setSelectedSlug] = useState<CategorySlug>(
    categories.some((item) => item.slug === initial) ? initial! : 'plastic',
  );
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      categories.filter((item) =>
        `${item.name} ${item.accepts.join(' ')} ${item.avoids.join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );

  const selected =
    categories.find((item) => item.slug === selectedSlug) ?? categories[0];

  return (
    <main className="renew-guide">
      <section className="guide-editorial-hero page-width">
        <div className="guide-editorial-copy">
          <span className="renew-kicker">
            <i /> Simple local guidance
          </span>
          <h1>
            Know before
            <br />
            you <em>throw.</em>
          </h1>
          <p>
            Start with the material. We’ll show common examples, what to keep
            out, and where to find a suitable bin.
          </p>
          <label>
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search an item or material..."
            />
          </label>
          <small>
            Illustrative guidance only—always follow verified local rules.
          </small>
        </div>
        <div className="guide-editorial-photo">
          <img
            src={guidePhoto}
            alt="Recycling symbol on a public recycling bin"
          />
          <span>Photo by Compagnons on Unsplash</span>
          <div>
            <Trash2 size={21} />
            <p>
              <strong>Four clear categories</strong>
              One consistent visual language.
            </p>
          </div>
        </div>
      </section>

      <section className="guide-catalog page-width">
        <div className="renew-section-head">
          <span className="renew-index">01</span>
          <div>
            <span className="renew-kicker">
              <i /> Browse by material
            </span>
            <h2>Choose the closest match.</h2>
          </div>
          <p>
            Categories are configurable and should reflect the rules of the
            actual project location.
          </p>
        </div>
        <div className="guide-tile-grid">
          {filtered.map((category, index) => (
            <button
              className={selected.slug === category.slug ? 'active' : ''}
              key={category.slug}
              onClick={() => setSelectedSlug(category.slug)}
              style={{ '--tile-color': category.color } as CSSProperties}
            >
              <span className="tile-number">0{index + 1}</span>
              <span className="tile-icon">
                <Trash2 size={22} />
              </span>
              <div>
                <h2>{category.name}</h2>
                <p>{category.shortDescription}</p>
              </div>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search />
            <h2>No matching guidance yet.</h2>
            <p>Try plastic, paper, metal, or general waste.</p>
            <button onClick={() => setQuery('')}>Clear search</button>
          </div>
        )}
      </section>

      {filtered.length > 0 && (
        <section
          className="guide-focus"
          style={{ '--focus-color': selected.color } as CSSProperties}
        >
          <div className="page-width guide-focus-grid">
            <aside>
              <span className="renew-kicker light">
                <i /> Selected category
              </span>
              <div className="focus-symbol">
                <Trash2 size={40} />
              </div>
              <h2>{selected.name}</h2>
              <p>{selected.description}</p>
            </aside>
            <div className="focus-guidelines">
              <article>
                <span className="focus-label good">
                  <Check size={14} /> Usually accepted
                </span>
                {selected.accepts.map((item) => (
                  <div key={item}>
                    <Check size={14} /> {item}
                  </div>
                ))}
              </article>
              <article>
                <span className="focus-label avoid">
                  <X size={14} /> Keep these out
                </span>
                {selected.avoids.map((item) => (
                  <div key={item}>
                    <X size={14} /> {item}
                  </div>
                ))}
              </article>
              <article className="preparation-card">
                <span className="focus-label prep">
                  <ShieldAlert size={14} /> Before you dispose
                </span>
                <p>{selected.preparation}</p>
                <small>
                  Check the label on the physical station before disposal.
                </small>
              </article>
              <Link
                className="button button-accent button-large"
                href={`/find-bin?category=${selected.slug}`}
              >
                Find a {selected.name} Bin <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default function SortingGuidePage() {
  return (
    <div className="site-shell">
      <PublicHeader />
      <Suspense
        fallback={
          <div className="route-loading">
            <span />
            <strong>Loading Sorting Guide…</strong>
          </div>
        }
      >
        <GuideContent />
      </Suspense>
      <PublicFooter />
    </div>
  );
}
