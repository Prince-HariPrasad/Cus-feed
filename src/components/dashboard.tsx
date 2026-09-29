"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Store,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { FeedbackCard } from "./feedback-card";
import { FeedbackForm } from "./feedback-form";
import { StandaloneAnalysis } from "./standalone-analysis";
import { saveReview, useSavedReviews } from "@/lib/review-store";
import { CARDIFF_MODEL, OUTLETS, type Review, type Sentiment } from "@/lib/types";

type View = "overview" | "feedback" | "outlets" | "analyze";
type Filter = "ALL" | Sentiment;

function percentage(reviews: Review[]) {
  return reviews.length
    ? Math.round(
        (reviews.filter((review) => review.sentiment === "POSITIVE").length /
          reviews.length) *
          100,
      )
    : 0;
}

function driverCounts(reviews: Review[], sentiment: Sentiment) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    const topics = new Set(
      review.drivers
        .filter((driver) => driver.sentiment === sentiment)
        .map((driver) => driver.topic),
    );
    for (const topic of topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts].sort((first, second) => second[1] - first[1]);
}

function exportReviews(reviews: Review[]) {
  const escape = (value: string) =>
    `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const rows = [
    [
      "Date",
      "Outlet",
      "Customer",
      "Feedback",
      "Sentiment",
      "Confidence",
      "Source",
      "Rationale",
    ],
    ...reviews.map((review) => [
      review.createdAt,
      review.outletId,
      review.customer,
      review.text,
      review.sentiment,
      String(review.confidence),
      review.source,
      review.rationale,
    ]),
  ];
  const blob = new Blob(
    [rows.map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "outlet-pulse-feedback.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Dashboard({
  initialReviews,
  now,
  demo,
}: {
  initialReviews: Review[];
  now: number;
  demo: boolean;
}) {
  const saved = useSavedReviews();
  const [view, setView] = useState<View>("overview");
  const [outlet, setOutlet] = useState("ALL");
  const [sentiment, setSentiment] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState("30");
  const [visibleCount, setVisibleCount] = useState(4);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [includeSamples, setIncludeSamples] = useState(true);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const deferredQuery = useDeferredValue(query);
  const reviews = [...saved, ...(includeSamples ? initialReviews : [])].sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt),
  );
  const scoped = reviews.filter(
    (review) =>
      (outlet === "ALL" || outlet === review.outletId) &&
      (days === "ALL" ||
        Date.parse(review.createdAt) >= now - Number(days) * 86_400_000) &&
      `${review.text} ${review.customer} ${review.rationale}`
        .toLowerCase()
        .includes(deferredQuery.toLowerCase()),
  );
  const filtered = scoped.filter(
    (review) => sentiment === "ALL" || review.sentiment === sentiment,
  );
  const positiveCount = filtered.filter(
    (review) => review.sentiment === "POSITIVE",
  ).length;
  const negativeCount = filtered.length - positiveCount;
  const ratio = percentage(filtered);
  const positiveDrivers = driverCounts(filtered, "POSITIVE");
  const negativeDrivers = driverCounts(filtered, "NEGATIVE");

  function navigate(next: View) {
    setView(next);
    setMobileNav(false);
    setVisibleCount(4);
  }
  function filterSentiment(next: Filter) {
    setSentiment(next);
    setVisibleCount(4);
  }
  function selectOutlet(id: string) {
    setOutlet(id);
    setSentiment("ALL");
    setQuery("");
    navigate("feedback");
  }
  function complete(review: Review) {
    const persisted = saveReview(review);
    setOutlet("ALL");
    setSentiment("ALL");
    setQuery("");
    setDays("30");
    navigate("feedback");
    setNotice(
      persisted
        ? "Feedback analyzed and saved to this browser."
        : "Feedback analyzed. Browser storage is unavailable; this review will only last for this session.",
    );
  }

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <Link className="brand" href="/" aria-label="Outlet Pulse home">
          <span className="brand-symbol">
            <Activity size={25} strokeWidth={2.4} />
          </span>
          <span>
            outlet<span className="brand-light">pulse</span>
            <span className="brand-period">.</span>
          </span>
        </Link>
        <div className="workspace">
          <div className="workspace-icon">
            <Store size={20} />
          </div>
          <div>
            <strong>Retail workspace</strong>
            <span>Store management</span>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-heading">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button
            className={view === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <button
            className={view === "feedback" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("feedback")}
          >
            <MessageSquare size={18} />
            Feedback<span className="nav-count">{reviews.length}</span>
          </button>
          <button
            className={view === "outlets" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setOutlet("ALL");
              setSentiment("ALL");
              setQuery("");
              navigate("outlets");
            }}
          >
            <Store size={18} />
            Outlets<span className="nav-small">{OUTLETS.length}</span>
          </button>
          <button
            className={view === "analyze" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("analyze")}
            aria-current={view === "analyze" ? "page" : undefined}
          >
            <Sparkles size={18} />
            Analyze feedback
          </button>
        </nav>
        <div className="sidebar-outlets">
          <p className="nav-heading">YOUR OUTLETS</p>
          {OUTLETS.map((item, index) => (
            <button key={item.id} onClick={() => selectOutlet(item.id)}>
              <span className={`location-dot location-${index}`} />
              {item.name}
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="connection-status">
            <span className="connection-icon">
              <Sparkles size={17} />
            </span>
            <div>
              <strong>{demo ? "Demo workspace" : "Live analysis"}</strong>
              <span>
                {demo ? "No API token required" : "Hugging Face configured"}
              </span>
            </div>
            <span className="workspace-dot" />
          </div>
          <button
            className="nav-item help-button"
            onClick={() => helpDialog.current?.showModal()}
          >
            <CircleHelp size={18} />
            Workspace details
            <ArrowUpRight size={15} />
          </button>
          <div className="manager-profile">
            <div className="manager-avatar">SM</div>
            <div>
              <strong>Store manager</strong>
              <span>Local workspace</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              title="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "overview"
                ? "Overview"
                : view === "feedback"
                  ? "Feedback"
                  : view === "analyze"
                    ? "Analyze feedback"
                    : "Outlets"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="live-label">
              <span />
              {demo ? "Demo data" : view === "analyze" ? "Cardiff via HF" : "Live model"}
            </span>
            <span className="topbar-divider" />
            <span className="topbar-avatar">SM</span>
          </div>
        </header>
        <main>
          {view === "analyze" ? <StandaloneAnalysis demo={demo} /> : <>
          <section className="page-heading">
            <div>
              <div className="eyebrow">LISTEN. UNDERSTAND. IMPROVE.</div>
              <h1>
                {view === "overview"
                  ? "Every voice. A clearer picture."
                  : view === "feedback"
                    ? "Your customer conversations."
                    : "Local visits. Shared insights."}
              </h1>
              <p>
                {view === "overview"
                  ? "A little closer to your customers. A step ahead for your stores."
                  : view === "feedback"
                    ? "The stories behind every store visit, all in one place."
                    : "A closer look at the experience across your outlets."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button button-secondary export-button"
                disabled={!filtered.length}
                onClick={() => {
                  exportReviews(filtered);
                  setNotice(`Exported ${filtered.length} reviews.`);
                }}
              >
                <ArrowDownToLine size={16} />
                Export
              </button>
              <FeedbackForm demo={demo} onComplete={complete} />
            </div>
          </section>
          <div className="scope-toolbar">
            <div className="overview-label">
              <span className="section-indicator" />
              {view === "outlets"
                ? "Outlet performance"
                : "Performance at a glance"}
              <span className="subtle-label">
                {outlet === "ALL"
                  ? "All outlets"
                  : OUTLETS.find((item) => item.id === outlet)?.name}
              </span>
            </div>
            <label className="date-select">
              <CalendarDays size={15} />
              <select
                aria-label="Date range"
                value={days}
                onChange={(event) => {
                  setDays(event.target.value);
                  setVisibleCount(4);
                }}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="ALL">All time</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <section className="metrics-grid" aria-label="Feedback metrics">
            <div className="metric">
              <div className="metric-heading">
                <span>Total feedback</span>
                <MessageSquare size={17} />
              </div>
              <div className="metric-value">
                {filtered.length}
                <span className="mini-bars" aria-hidden="true">
                  {OUTLETS.map((item) => (
                    <i
                      key={item.id}
                      style={{
                        height: `${Math.max(8, (filtered.filter((review) => review.outletId === item.id).length / Math.max(filtered.length, 1)) * 100)}%`,
                      }}
                    />
                  ))}
                </span>
              </div>
              <div className="metric-foot">
                Across {new Set(filtered.map((review) => review.outletId)).size}{" "}
                outlets<span>Selected period</span>
              </div>
            </div>
            <div className="metric">
              <div className="metric-heading">
                <span>Positive sentiment</span>
                <Smile size={18} />
              </div>
              <div className="metric-value">
                {filtered.length ? ratio : "--"}
                <span className="metric-unit">%</span>
                <span className="metric-pill positive">
                  <ThumbsUp size={12} />
                  {positiveCount} positive
                </span>
              </div>
              <div className="metric-progress">
                <span style={{ width: `${ratio}%` }} />
              </div>
              <div className="metric-foot">Share of selected feedback</div>
            </div>
            <div className="metric">
              <div className="metric-heading">
                <span>Needs attention</span>
                <span className="metric-warning">
                  <MessageSquare size={17} />
                </span>
              </div>
              <div className="metric-value">
                {negativeCount}
                <span className="metric-pill negative">Negative reviews</span>
              </div>
              <div className="metric-foot">
                {negativeCount
                  ? "An opportunity to make it right"
                  : "No negative reviews in this selection"}
              </div>
            </div>
            <div className="metric highlight-metric">
              <div className="metric-heading">
                <span>Top customer highlight</span>
                <Sparkles size={17} />
              </div>
              <div className="highlight-value">
                {positiveDrivers[0]?.[0] ?? "No highlights yet"}
              </div>
              <div className="metric-foot">
                <span className="small-check">
                  <Check size={12} />
                </span>
                {positiveDrivers[0]
                  ? `${positiveDrivers[0][1]} positive mentions`
                  : "Add feedback to discover themes"}
              </div>
            </div>
          </section>
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {view === "outlets" ? (
            <section className="outlets-view">
              <div className="section-title">
                <h2>Your outlets</h2>
                <span>{OUTLETS.length} locations</span>
              </div>
              <div className="outlet-cards">
                {OUTLETS.map((item) => {
                  const items = filtered.filter(
                    (review) => review.outletId === item.id,
                  );
                  return (
                    <article className="outlet-card" key={item.id}>
                      <Image
                        src={item.image}
                        alt={`Representative ${item.name} retail interior`}
                        width={480}
                        height={280}
                      />
                      <div className="outlet-card-content">
                        <span className="eyebrow">OUTLET #{item.id}</span>
                        <h3>{item.name}</h3>
                        <p>
                          <MapPin size={13} />
                          {item.address}
                        </p>
                        <div className="outlet-card-stats">
                          <span>
                            <strong>{items.length}</strong> reviews
                          </span>
                          <span>
                            <strong>
                              {items.length ? `${percentage(items)}%` : "--"}
                            </strong>{" "}
                            positive
                          </span>
                        </div>
                        <button
                          className="button button-secondary"
                          onClick={() => selectOutlet(item.id)}
                        >
                          View feedback
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="content-grid">
              <section className="feed-section">
                <div className="section-title">
                  <div>
                    <h2>
                      Feedback inbox{" "}
                      <span className="count-label">{scoped.length}</span>
                    </h2>
                    <p>A closer look at what your customers are saying.</p>
                  </div>
                  <span className="feed-order">Newest first</span>
                </div>
                <div
                  className="feed-tabs"
                  role="group"
                  aria-label="Sentiment filter"
                >
                  <button
                    aria-pressed={sentiment === "ALL"}
                    className={sentiment === "ALL" ? "selected" : ""}
                    onClick={() => filterSentiment("ALL")}
                  >
                    All feedback<span>{scoped.length}</span>
                  </button>
                  <button
                    aria-pressed={sentiment === "NEGATIVE"}
                    className={sentiment === "NEGATIVE" ? "selected" : ""}
                    onClick={() => filterSentiment("NEGATIVE")}
                  >
                    <span className="tab-dot negative" />
                    Needs attention
                    <span>
                      {
                        scoped.filter(
                          (review) => review.sentiment === "NEGATIVE",
                        ).length
                      }
                    </span>
                  </button>
                  <button
                    aria-pressed={sentiment === "POSITIVE"}
                    className={sentiment === "POSITIVE" ? "selected" : ""}
                    onClick={() => filterSentiment("POSITIVE")}
                  >
                    <span className="tab-dot positive" />
                    Positive
                    <span>
                      {
                        scoped.filter(
                          (review) => review.sentiment === "POSITIVE",
                        ).length
                      }
                    </span>
                  </button>
                </div>
                <div className="feed-filters">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Search feedback"
                      placeholder="Search feedback or keywords..."
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setVisibleCount(4);
                      }}
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <label className="outlet-filter">
                    <SlidersHorizontal size={14} />
                    <select
                      aria-label="Filter by outlet"
                      value={outlet}
                      onChange={(event) => {
                        setOutlet(event.target.value);
                        setVisibleCount(4);
                      }}
                    >
                      <option value="ALL">All outlets</option>
                      {OUTLETS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} />
                  </label>
                </div>
                <div className="feed-cards" aria-live="polite">
                  {filtered.slice(0, visibleCount).map((review) => (
                    <FeedbackCard key={review.id} review={review} now={now} />
                  ))}
                  {!filtered.length && (
                    <div className="empty-state">
                      <Search size={30} />
                      <h3>No feedback found</h3>
                      <p>There are no reviews matching this selection.</p>
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setQuery("");
                          setOutlet("ALL");
                          setSentiment("ALL");
                          setDays("ALL");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
                <div className="feed-footer">
                  <span>
                    Showing {Math.min(visibleCount, filtered.length)} of{" "}
                    {filtered.length} reviews
                  </span>
                  {visibleCount < filtered.length && (
                    <button
                      className="button button-secondary"
                      onClick={() => setVisibleCount((count) => count + 4)}
                    >
                      Load more
                      <ChevronDown size={14} />
                    </button>
                  )}
                </div>
              </section>
              <aside className="insights-column">
                <section className="sentiment-section">
                  <div className="section-title">
                    <h2>Sentiment snapshot</h2>
                    <ChartNoAxesCombined size={17} />
                  </div>
                  <p className="section-description">
                    The overall mood of your customers.
                  </p>
                  <div className="sentiment-visual">
                    <div
                      className={`sentiment-donut ${!filtered.length ? "donut-empty" : ""}`}
                      style={
                        {
                          "--positive-ratio": `${ratio}%`,
                        } as React.CSSProperties
                      }
                      role="img"
                      aria-label={`${ratio}% positive, ${filtered.length ? 100 - ratio : 0}% negative`}
                    >
                      <div>
                        <Smile size={22} />
                        <strong>{filtered.length ? `${ratio}%` : "--"}</strong>
                        <span>Positive feedback</span>
                      </div>
                    </div>
                  </div>
                  <div className="sentiment-legend">
                    <div>
                      <span className="legend-dot positive" />
                      Positive<strong>{positiveCount}</strong>
                      <span>{filtered.length ? ratio : 0}%</span>
                    </div>
                    <div>
                      <span className="legend-dot negative" />
                      Negative<strong>{negativeCount}</strong>
                      <span>{filtered.length ? 100 - ratio : 0}%</span>
                    </div>
                  </div>
                  <div className="snapshot-note">
                    <Sparkles size={14} />
                    <span>
                      {filtered.some((review) => review.source === "demo")
                        ? "Includes illustrative demo analysis"
                        : filtered.length
                          ? "Analyzed with Hugging Face"
                          : "No analysis in this selection"}
                    </span>
                  </div>
                </section>
                <section className="drivers-section">
                  <div className="section-title">
                    <h2>Behind the feedback</h2>
                    <Sparkles size={17} />
                  </div>
                  <p className="section-description">
                    The themes that come up most often.
                  </p>
                  <div className="driver-group-label">
                    <ThumbsUp size={13} />
                    WHAT&apos;S WORKING
                  </div>
                  {positiveDrivers.slice(0, 3).map(([topic, count]) => (
                    <div className="driver-stat" key={topic}>
                      <div>
                        <span>{topic}</span>
                        <strong>
                          {count}
                          <span> mentions</span>
                        </strong>
                      </div>
                      <div className="driver-bar">
                        <span
                          style={{
                            width: `${(count / Math.max(filtered.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {!positiveDrivers.length && (
                    <p className="no-drivers">No positive themes yet.</p>
                  )}
                  <div className="driver-group-label negative-text">
                    <ThumbsDown size={13} />
                    ROOM TO IMPROVE
                  </div>
                  {negativeDrivers.slice(0, 2).map(([topic, count]) => (
                    <div className="driver-stat negative-driver" key={topic}>
                      <div>
                        <span>{topic}</span>
                        <strong>
                          {count}
                          <span> mentions</span>
                        </strong>
                      </div>
                      <div className="driver-bar">
                        <span
                          style={{
                            width: `${(count / Math.max(filtered.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {!negativeDrivers.length && (
                    <p className="no-drivers">
                      No negative themes in this selection.
                    </p>
                  )}
                  <p className="rules-note">
                    Phrase-based themes · One mention per review
                  </p>
                </section>
                <section className="outlet-section">
                  <div className="section-title">
                    <h2>Across your outlets</h2>
                    <button
                      className="icon-button"
                      title="View all outlets"
                      aria-label="View all outlets"
                      onClick={() => {
                        setOutlet("ALL");
                        setSentiment("ALL");
                        setQuery("");
                        navigate("outlets");
                      }}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  {OUTLETS.map((item) => {
                    const items = filtered.filter(
                      (review) => review.outletId === item.id,
                    );
                    return (
                      <button
                        className="outlet-row"
                        key={item.id}
                        onClick={() => selectOutlet(item.id)}
                      >
                        <Image src={item.image} alt="" width={42} height={42} />
                        <span className="outlet-row-name">
                          <strong>{item.name}</strong>
                          <span>
                            {items.length} reviews · #{item.id}
                          </span>
                        </span>
                        <span
                          className={`outlet-score ${percentage(items) >= 70 ? "positive-text" : items.length ? "negative-text" : ""}`}
                        >
                          {items.length ? `${percentage(items)}%` : "--"}
                          <span>positive</span>
                        </span>
                      </button>
                    );
                  })}
                </section>
              </aside>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Activity size={14} />
              Small insights. Better experiences.
            </span>
            <label>
              <input
                type="checkbox"
                checked={includeSamples}
                onChange={(event) => setIncludeSamples(event.target.checked)}
              />
              Include sample reviews
            </label>
            <span>Outlet Pulse · Iteration 01</span>
          </footer>
          </>}
        </main>
      </div>
      <dialog
        ref={helpDialog}
        className="help-dialog"
        aria-labelledby="workspace-title"
      >
        <div className="dialog-header">
          <span className="eyebrow">WORKSPACE DETAILS</span>
          <button
            className="icon-button"
            aria-label="Close workspace details"
            title="Close"
            onClick={() => helpDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="workspace-title">A closer look under the hood.</h2>
        <dl>
          <dt>Analysis mode</dt>
          <dd>
            {demo
              ? "Demo: deterministic keyword rules"
              : "Hugging Face Inference API"}
          </dd>
          <dt>Configured model</dt>
          <dd>{view === "analyze" ? CARDIFF_MODEL : "siebert/sentiment-roberta-large-english"}</dd>
          <dt>Sentiment classes</dt>
          <dd>{view === "analyze" ? "POSITIVE, NEUTRAL, and NEGATIVE" : "POSITIVE and NEGATIVE only"}</dd>
          <dt>Service rationale</dt>
          <dd>
            Separate phrase-based rules, not the model&apos;s internal
            reasoning.
          </dd>
          <dt>Review storage</dt>
          <dd>
            Up to 300 submitted reviews in this browser. No shared database or
            authentication in this prototype.
          </dd>
          <dt>Sample workspace</dt>
          <dd>
            Fictional customer reviews and outlets. Representative outlet photos
            from Unsplash.
          </dd>
        </dl>
        <p>
          Live mode requires a server-side HF_TOKEN and model availability
          through Hugging Face Inference Providers. Never enter an API token in
          a feedback form.
        </p>
      </dialog>
    </div>
  );
}
