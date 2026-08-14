"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArticleComposer } from "../../article-composer";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../../lib/supabase";
import type { Database } from "../../../lib/database.types";
import { articlePostPath } from "../../../lib/articles";

type Article = {
  id: number;
  title: string;
  author: string;
  editor: string;
  status: "Published" | "Draft" | "Archived";
  date: string;
  time: string;
  views: string;
  image: string;
  postUrl: string;
  row: ArticleRow;
};

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

const initialArticles: Article[] = [];

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
    status: row.status === "Published" ? "Published" : (row.status === "Archived" ? "Archived" : "Draft"),
    date: new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(articleDate),
    time: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(articleDate),
    views: row.views > 0 ? formatCompact(row.views) : "—",
    image: row.image_style,
    postUrl: articlePostPath(row),
    row,
  };
}

export default function AllArticlesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleRow | null>(null);
  const [articles, setArticles] = useState(initialArticles);
  const [isSyncing, setIsSyncing] = useState(true);
  const [databaseError, setDatabaseError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [canArchive, setCanArchive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      const storedRoleId = localStorage.getItem("active_role_id");
      if (storedRoleId) {
        const { data: roleData } = await supabase.from("roles").select("job_tasks").eq("id", storedRoleId).single();
        if (roleData && roleData.job_tasks) {
          setCanArchive(roleData.job_tasks.includes("Archive Article"));
        } else {
          setCanArchive(false);
        }
      } else {
        // Admin fallback
        setCanArchive(true);
      }
    }

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

    void loadPermissions();
    void loadArticles();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedArticles = useMemo(() => {
    return [...articles].filter(article => {
      if (statusFilter !== "All" && article.status !== statusFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return article.title.toLowerCase().includes(s) || article.author.toLowerCase().includes(s);
      }
      return true;
    }).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [articles, search, statusFilter]);

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Publishing workspace</p>
            <h1>Articles</h1>
            <p>Overview of all published and draft articles.</p>
            <div className={databaseError ? "database-badge error" : "database-badge"}>
              <span aria-hidden="true" />
              {databaseError ? "Local preview" : isSyncing ? "Syncing database" : "Shared database live"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="searchArticles" style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)" }}>Search Articles</label>
              <input 
                id="searchArticles"
                aria-label="Search articles"
                className="gallery-page-search"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or author..."
                value={search}
                style={{ width: "240px", height: "42px", minHeight: "42px", maxHeight: "42px", boxSizing: "border-box" }}
              />
            </div>
            
            <div className="filter-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="statusFilter" style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)" }}>Filter by status</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="gallery-page-search"
                style={{ height: "42px", minHeight: "42px", maxHeight: "42px", boxSizing: "border-box" }}
              >
                <option value="All">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <button className="primary-button" onClick={() => {
              setEditingArticle(null);
              setIsModalOpen(true);
            }} type="button" style={{ height: "42px", minHeight: "42px", maxHeight: "42px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <span aria-hidden="true">✎</span> New Article
            </button>
          </div>
        </header>

        <section className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel articles-panel" id="articles">

            <div className="article-table" role="table" aria-label="All articles">
              <div className="article-row article-row-actions table-header" role="row">
                <span role="columnheader">Article</span>
                <span role="columnheader">Author</span>
                <span role="columnheader">Editor</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Date</span>
                <span role="columnheader">Time</span>
                <span role="columnheader">Views</span>
                <span role="columnheader">Actions</span>
              </div>
              {sortedArticles.map((article) => (
                <div className="article-row article-row-actions" key={article.id} role="row">
                  <div className="article-title" role="cell">
                    <span className="thumbnail" style={{ background: article.image }} aria-hidden="true" />
                    <Link className="article-title-link" href={article.postUrl} target="_blank" rel="noopener noreferrer">
                      {article.title}
                    </Link>
                  </div>
                  <span role="cell" data-label="Author">{article.author}</span>
                  <span role="cell" data-label="Editor">{article.editor}</span>
                  <span role="cell" data-label="Status">
                    <span className={`status ${article.status.toLowerCase()}`}>{article.status}</span>
                  </span>
                  <span role="cell" data-label="Date">{article.date}</span>
                  <span role="cell" data-label="Time">{article.time}</span>
                  <strong role="cell" data-label="Views">{article.views}</strong>
                  <div className="row-actions" role="cell">
                    <button className="action-btn edit-btn" onClick={() => {
                      setEditingArticle(article.row);
                      setIsModalOpen(true);
                    }} type="button" title="Edit article">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                    {canArchive && (
                      <button className="action-btn archive-btn" onClick={async () => {
                        if (!window.confirm("Are you sure you want to archive this article? It will be hidden from the main site.")) return;
                        const { error } = await supabase.from("articles").update({ status: "Archived" }).eq("id", article.id);
                        if (error) {
                          alert("Failed to archive: " + error.message);
                        } else {
                          // Update local state to reflect the archived status instead of removing it
                          setArticles(current => current.map(a => a.id === article.id ? { ...a, status: "Archived" } : a));
                        }
                      }} type="button" title="Archive article">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>

      <ArticleComposer
        article={editingArticle}
        onClose={() => {
          setIsModalOpen(false);
          setEditingArticle(null);
        }}
        onSaved={(article) => {
          setArticles((current) => {
            const formatted = formatArticle(article);
            const exists = current.some((item) => item.id === article.id);
            return exists
              ? current.map((item) => item.id === article.id ? formatted : item)
              : [formatted, ...current];
          });
          setDatabaseError("");
        }}
        open={isModalOpen}
      />
    </main>
  );
}
