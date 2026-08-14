"use client";

import { ArticleComposer } from "../article-composer";
import Sidebar from "../components/Sidebar";

// navItems moved to Sidebar

export default function NewArticlePage() {
  function returnToArticles() {
    window.location.assign("/admin/all-article");
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <ArticleComposer
        onClose={returnToArticles}
        onSaved={() => undefined}
        open
        presentation="page"
      />
    </main>
  );
}
