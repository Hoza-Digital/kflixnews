"use client";

import { useEffect, useMemo, useState } from "react";
import { ArticleComposer } from "./article-composer";
import Sidebar from "./components/Sidebar";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Article = {
  id: number;
  title: string;
  author: string;
  editor: string;
  status: "Published" | "Draft";
  date: string;
  views: string;
  image: string;
};

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
type Range = keyof typeof chartSets;

const rangeDays: Record<Range, number> = {
  "7 days": 7,
  "30 days": 30,
  "90 days": 90,
};

const initialArticles: Article[] = [];

const chartSets = {
  "7 days": [64, 56, 60, 42, 35, 24, 18],
  "30 days": [70, 60, 56, 63, 48, 35, 29, 36, 49, 58, 44, 28, 19, 25, 41, 51, 55, 70, 58, 45, 34, 26, 31, 48, 61, 44, 29, 23, 14, 9],
  "90 days": [74, 66, 52, 58, 43, 49, 35, 27, 33, 19, 24, 15],
};

// navItems moved to Sidebar

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatArticle(row: ArticleRow): Article {
  const articleDate = new Date(row.published_at ?? row.created_at);

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    editor: row.editor,
    status: row.status === "Published" ? "Published" : "Draft",
    date: new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(articleDate),
    views: row.views > 0 ? formatCompact(row.views) : "—",
    image: row.image_style,
  };
}

export default function Home() {
  const [range, setRange] = useState<Range>("30 days");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [showAll, setShowAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [articles, setArticles] = useState(initialArticles);
  const [trafficValues, setTrafficValues] = useState<number[]>(chartSets["30 days"]);
  const [trafficLabels, setTrafficLabels] = useState(["Apr 21", "Apr 28", "May 5", "May 12", "May 19"]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [databaseError, setDatabaseError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadArticles() {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setDatabaseError("The shared database could not be reached. Showing the local preview data.");
      } else {
        setArticles(data.map(formatArticle));
        setDatabaseError("");
      }
      setIsSyncing(false);
    }

    void loadArticles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTraffic() {
      setIsSyncing(true);
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - (rangeDays[range] - 1));

      const { data, error } = await supabase
        .from("traffic_daily")
        .select("day, page_views")
        .gte("day", start.toISOString().slice(0, 10))
        .order("day", { ascending: true });

      if (cancelled) return;

      if (error || data.length === 0) {
        setTrafficValues(chartSets[range]);
        if (error) {
          setDatabaseError("The shared database could not be reached. Showing the local preview data.");
        }
      } else {
        setTrafficValues(data.map((entry) => entry.page_views));
        const indexes = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
          Math.round((data.length - 1) * ratio),
        );
        setTrafficLabels(
          indexes.map((index) =>
            new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
              new Date(`${data[index].day}T00:00:00Z`),
            ),
          ),
        );
      }
      setIsSyncing(false);
    }

    void loadTraffic();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const points = useMemo(() => {
    const maximum = Math.max(...trafficValues);
    const minimum = Math.min(...trafficValues);
    const spread = Math.max(maximum - minimum, 1);

    return trafficValues.map((value, index) => ({
      x: Number((((index / Math.max(trafficValues.length - 1, 1)) * 100)).toFixed(4)),
      y: Number((78 - ((value - minimum) / spread) * 66).toFixed(4)),
    }));
  }, [trafficValues]);

  const visibleArticles = showAll ? articles : articles.slice(0, 5);
  const publishedCount = articles.filter((article) => article.status === "Published").length;
  const draftCount = articles.filter((article) => article.status === "Draft").length;
  const totalViews = trafficValues.reduce((sum, value) => sum + value, 0);
  const midpoint = Math.max(Math.floor(trafficValues.length / 2), 1);
  const earlierViews = trafficValues.slice(0, midpoint).reduce((sum, value) => sum + value, 0);
  const recentViews = trafficValues.slice(midpoint).reduce((sum, value) => sum + value, 0);
  const trafficTrend = earlierViews > 0 ? ((recentViews - earlierViews) / earlierViews) * 100 : 0;

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="dashboard" id="top">
        <header className="topbar">
          <div>
            <p className="eyebrow">Publishing workspace</p>
            <h1>{activeNav}</h1>
            <p>Overview of your content and site traffic.</p>
            <div className={databaseError ? "database-badge error" : "database-badge"}>
              <span aria-hidden="true" />
              {databaseError ? "Local preview" : isSyncing ? "Syncing database" : "Shared database live"}
            </div>
          </div>
          <button className="primary-button" onClick={() => setIsModalOpen(true)} type="button">
            <span aria-hidden="true">✎</span> New Article
          </button>
        </header>

        <section className="stat-grid" aria-label="Publishing statistics">
          <article className="stat-card">
            <div className="stat-icon green" aria-hidden="true">✓</div>
            <div>
              <p>Published</p>
              <strong>{publishedCount}</strong>
              <small className="positive">+12 this month</small>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon amber" aria-hidden="true">□</div>
            <div>
              <p>Drafts</p>
              <strong>{draftCount}</strong>
              <small className="warning">+3 this week</small>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon blue" aria-hidden="true">◉</div>
            <div>
              <p>Total Views</p>
              <strong>{formatCompact(totalViews)}</strong>
              <small className={trafficTrend >= 0 ? "positive" : "warning"}>
                {trafficTrend >= 0 ? "+" : ""}{trafficTrend.toFixed(1)}% this period
              </small>
            </div>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel traffic-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Analytics</p>
                <h2>Traffic Overview</h2>
              </div>
              <label className="range-select">
                <span className="sr-only">Traffic date range</span>
                <select value={range} onChange={(event) => setRange(event.target.value as Range)}>
                  <option value="7 days">Last 7 days</option>
                  <option value="30 days">Last 30 days</option>
                  <option value="90 days">Last 90 days</option>
                </select>
              </label>
            </div>

            <div className="chart" aria-label={`Page views for the last ${range}`}>
              <span className="axis-label top">40K</span>
              <span className="axis-label upper">30K</span>
              <span className="axis-label middle">20K</span>
              <span className="axis-label lower">10K</span>
              <span className="axis-label bottom">0</span>
              <div className="chart-plot">
                <div className="grid-line line-1" />
                <div className="grid-line line-2" />
                <div className="grid-line line-3" />
                <div className="grid-line line-4" />
                <div
                  className="chart-area"
                  style={{
                    clipPath: `polygon(0 100%, ${points.map((point) => `${point.x}% ${point.y}%`).join(", ")}, 100% 100%)`,
                  }}
                />
                {points.slice(0, -1).map((point, index) => {
                  const next = points[index + 1];
                  const angle = Math.atan2((next.y - point.y) * 0.42, next.x - point.x) * (180 / Math.PI);
                  return (
                    <span
                      className="chart-segment"
                      key={`${range}-${index}`}
                      style={{
                        left: `${point.x.toFixed(4)}%`,
                        top: `${point.y.toFixed(4)}%`,
                        width: `${(next.x - point.x + 0.45).toFixed(4)}%`,
                        transform: `rotate(${angle.toFixed(4)}deg)`,
                      }}
                    />
                  );
                })}
                <div className="x-axis">
                  {trafficLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
                </div>
              </div>
            </div>

            <div className="traffic-summary">
              <div className="legend"><span /> Page Views</div>
              <strong>{formatCompact(totalViews)}</strong>
              <div>
                <b className={trafficTrend >= 0 ? "" : "negative-trend"}>
                  {trafficTrend >= 0 ? "↑" : "↓"} {Math.abs(trafficTrend).toFixed(1)}%
                </b>
                <small>within the selected {range}</small>
              </div>
            </div>
          </article>

          <article className="panel articles-panel" id="articles">
            <div className="panel-heading article-heading">
              <div>
                <p className="panel-kicker">Content</p>
                <h2>Recent Articles</h2>
              </div>
              <button
                className="text-button"
                onClick={() => window.location.assign("/admin/all-article")}
                type="button"
              >
                View all articles
              </button>
            </div>
            <div className="article-table" role="table" aria-label="Recent articles">
              <div className="article-row table-header" role="row">
                <span role="columnheader">Article</span>
                <span role="columnheader">Author</span>
                <span role="columnheader">Editor</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Date</span>
                <span role="columnheader">Views</span>
              </div>
              {visibleArticles.map((article) => (
                <div className="article-row" key={article.id} role="row">
                  <div className="article-title" role="cell">
                    <span className="thumbnail" style={{ background: article.image }} aria-hidden="true" />
                    <span>{article.title}</span>
                  </div>
                  <span role="cell" data-label="Author">{article.author}</span>
                  <span role="cell" data-label="Editor">{article.editor}</span>
                  <span role="cell" data-label="Status">
                    <span className={`status ${article.status.toLowerCase()}`}>{article.status}</span>
                  </span>
                  <span role="cell" data-label="Date">{article.date}</span>
                  <strong role="cell" data-label="Views">{article.views}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>

      <ArticleComposer
        onClose={() => setIsModalOpen(false)}
        onSaved={(article) => {
          setArticles((current) => [formatArticle(article), ...current]);
          setDatabaseError("");
        }}
        open={isModalOpen}
      />
    </main>
  );
}
