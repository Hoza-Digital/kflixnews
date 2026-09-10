import type { Database } from "./database.types";

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

export function articleDateCode(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}${part("month")}${part("day")}`;
}

export function articlePostPath(article: Pick<ArticleRow, "created_at" | "published_at" | "slug">) {
  const articleDate = article.published_at ?? article.created_at;
  return `/post/${articleDateCode(articleDate)}/${article.slug}`;
}
