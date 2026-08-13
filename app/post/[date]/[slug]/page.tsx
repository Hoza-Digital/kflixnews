import Link from "next/link";
import { notFound } from "next/navigation";
import { articleDateCode } from "../../../../lib/articles";
import { supabase } from "../../../../lib/supabase";
import { PostActions } from "./post-actions";

type PostPageProps = {
  params: Promise<{ date: string; slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: PostPageProps) {
  const { date, slug } = await params;
  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !article) notFound();

  const articleDate = article.published_at ?? article.created_at;
  if (articleDateCode(articleDate) !== date) notFound();

  return (
    <main className="post-page">
      <nav className="post-nav" aria-label="Post navigation">
        <Link href="/">STORY.</Link>
        <div className="post-nav-actions">
          <Link href="/all-article">All articles</Link>
          <PostActions article={article} />
        </div>
      </nav>

      <article className="post-article">
        <header className="post-header">
          <div className="post-meta">
            <span>{article.category}</span>
            <span>{new Intl.DateTimeFormat("en", {
              day: "numeric",
              month: "long",
              timeZone: "Asia/Jakarta",
              year: "numeric",
            }).format(new Date(articleDate))}</span>
            {article.status !== "Published" && <span className="post-draft">Draft preview</span>}
          </div>
          <h1>{article.title}</h1>
          <p className="post-excerpt">{article.excerpt}</p>
          <p className="post-byline">By {article.author}{article.editor !== "Unassigned" ? ` · Edited by ${article.editor}` : ""}</p>
        </header>

        {article.cover_image_url && (
          <div
            aria-label={article.cover_image_alt ?? article.title}
            className="post-cover"
            role="img"
            style={{ backgroundImage: `url("${article.cover_image_url.replaceAll('"', "%22")}")` }}
          />
        )}

        <div className="post-content" dangerouslySetInnerHTML={{ __html: article.content }} />
      </article>
    </main>
  );
}
