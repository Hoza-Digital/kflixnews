"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { articleDateCode } from "../lib/articles";

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
type ArticleImage = Database["public"]["Tables"]["article_images"]["Row"];
type Workflow = "published" | "scheduled" | "draft";
type MediaTab = "upload" | "gallery";

type PendingImage = {
  blob: Blob;
  height: number;
  originalName: string;
  previewUrl: string;
  width: number;
};

type ArticleComposerProps = {
  article?: ArticleRow | null;
  onClose: () => void;
  onSaved: (article: ArticleRow) => void;
  open: boolean;
  presentation?: "modal" | "page";
};

const categories = [
  "Web Design",
  "Product Strategy",
  "Automation",
  "Technology",
  "Business Growth",
  "Culture",
  "Travel",
];

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function localScheduleDefaults() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: "09:00" };
}

function scheduleFields(value: string) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

async function compressToWebp(file: File): Promise<PendingImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("This browser cannot prepare the image.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of [0.84, 0.76, 0.68, 0.6, 0.52]) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= 1024 * 1024) break;
  }

  if (!blob || blob.size > 1024 * 1024) {
    throw new Error("The compressed image is still over 1 MB. Please choose a smaller image.");
  }

  return {
    blob,
    height,
    originalName: file.name,
    previewUrl: URL.createObjectURL(blob),
    width,
  };
}

export function ArticleComposer({ article = null, onClose, onSaved, open, presentation = "modal" }: ArticleComposerProps) {
  const [scheduleDefaults] = useState(() => localScheduleDefaults());
  const editorRef = useRef<HTMLDivElement>(null);
  const inlineImageRangeRef = useRef<Range | null>(null);
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState(false);
  const [editSlug, setEditSlug] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("You");
  const [editor, setEditor] = useState("Unassigned");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>("published");
  const [scheduleDate, setScheduleDate] = useState(scheduleDefaults.date);
  const [scheduleTime, setScheduleTime] = useState(scheduleDefaults.time);
  const [mediaTab, setMediaTab] = useState<MediaTab>("upload");
  const [coverName, setCoverName] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [gallery, setGallery] = useState<ArticleImage[]>([]);
  const [gallerySearch, setGallerySearch] = useState("");
  const [selectedImage, setSelectedImage] = useState<ArticleImage | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [inlineImagePickerOpen, setInlineImagePickerOpen] = useState(false);
  const [inlineMediaTab, setInlineMediaTab] = useState<MediaTab>("upload");
  const [inlineImageName, setInlineImageName] = useState("");
  const [inlineImageAlt, setInlineImageAlt] = useState("");
  const [inlineGallerySearch, setInlineGallerySearch] = useState("");
  const [inlineSelectedImage, setInlineSelectedImage] = useState<ArticleImage | null>(null);
  const [inlinePendingImage, setInlinePendingImage] = useState<PendingImage | null>(null);
  const [inlineImageError, setInlineImageError] = useState("");
  const [isInlinePreparing, setIsInlinePreparing] = useState(false);
  const [isInlineUploading, setIsInlineUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Role & Permissions State
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([]);
  const [activeUser, setActiveUser] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(null);
  const [canEditAuthor, setCanEditAuthor] = useState(false);
  const [canEditEditor, setCanEditEditor] = useState(false);

  useEffect(() => {
    async function loadPermissionsAndUsers() {
      // Fetch users
      const { data: usersData } = await supabase.from("users").select("*").order("full_name");
      if (usersData) setUsers(usersData);

      // Check current mock user
      const storedUserId = localStorage.getItem("active_user_id");
      if (storedUserId && usersData) {
        const user = usersData.find(u => u.id === storedUserId) || null;
        setActiveUser(user);
        // Set default values if creating a new article and author/editor not explicitly set
        if (!article) {
          if (user) {
            setAuthor(user.full_name);
          }
        }
      }

      // Fetch active role to determine permissions
      const storedRoleId = localStorage.getItem("active_role_id");
      if (storedRoleId) {
        const { data: roleData } = await supabase.from("roles").select("job_tasks").eq("id", storedRoleId).single();
        if (roleData && roleData.job_tasks) {
          setCanEditAuthor(roleData.job_tasks.includes("Edit Author Name"));
          setCanEditEditor(roleData.job_tasks.includes("Edit Editor Name"));
        } else {
          setCanEditAuthor(false);
          setCanEditEditor(false);
        }
      } else {
        // Admin fallback
        setCanEditAuthor(true);
        setCanEditEditor(true);
      }
    }
    
    if (open) {
      loadPermissionsAndUsers();
    }
  }, [open, article]);

  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingInline, setIsDraggingInline] = useState(false);

  const automaticSlug = slugify(title);
  const slug = editSlug ? slugify(customSlug) : automaticSlug;
  const dateCode = articleDateCode(article?.published_at ?? article?.created_at ?? new Date());

  const visibleGallery = gallery.filter((image) => {
    const search = gallerySearch.trim().toLowerCase();
    return !search || image.original_name.toLowerCase().includes(search) || image.alt_text.toLowerCase().includes(search);
  });

  const visibleInlineGallery = gallery.filter((image) => {
    const search = inlineGallerySearch.trim().toLowerCase();
    return !search || image.original_name.toLowerCase().includes(search) || image.alt_text.toLowerCase().includes(search);
  });

  useEffect(() => {
    if (!open) return;

    if (!article) {
      resetForm();
      return;
    }

    setTitle(article.title);
    setHeadline(article.is_headline);
    setEditSlug(true);
    setCustomSlug(article.slug);
    setCategory(article.category);
    setAuthor(article.author);
    setEditor(article.editor);
    setExcerpt(article.excerpt);
    setContent(article.content);
    setWorkflow(article.scheduled_for ? "scheduled" : article.status === "Published" ? "published" : "draft");
    if (article.scheduled_for) {
      const scheduled = scheduleFields(article.scheduled_for);
      setScheduleDate(scheduled.date);
      setScheduleTime(scheduled.time);
    }
    setMediaTab("gallery");
    setCoverName("");
    setCoverAlt(article.cover_image_alt ?? "");
    setSelectedImage(null);
    setPendingImage(null);
    setFormError("");
    if (editorRef.current) editorRef.current.innerHTML = article.content;
  }, [article, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving && !isUploading) onClose();
    };

    if (presentation === "modal") {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    }

    async function loadGallery() {
      const { data, error } = await supabase
        .from("article_images")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setFormError(`Image library unavailable: ${error.message}`);
      } else {
        setGallery(data);
        if (article?.cover_image_path) {
          const currentCover = data.find((image) => image.storage_path === article.cover_image_path);
          if (currentCover) {
            setSelectedImage(currentCover);
            setCoverName(currentCover.original_name.replace(/\.[^.]+$/, ""));
          }
        }
      }
    }

    void loadGallery();
    return () => {
      if (presentation === "modal") {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [article, isSaving, isUploading, onClose, open, presentation]);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  useEffect(() => {
    return () => {
      if (inlinePendingImage) URL.revokeObjectURL(inlinePendingImage.previewUrl);
    };
  }, [inlinePendingImage]);

  useEffect(() => {
    if (!inlineImagePickerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handlePickerKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isInlinePreparing || isInlineUploading) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setInlineImagePickerOpen(false);
      setInlineImageAlt("");
      setInlineGallerySearch("");
      setInlineSelectedImage(null);
      setInlinePendingImage(null);
      setInlineImageError("");
      inlineImageRangeRef.current = null;
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handlePickerKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handlePickerKeyDown, true);
    };
  }, [inlineImagePickerOpen, isInlinePreparing, isInlineUploading]);

  if (!open) return null;

  function resetForm() {
    setTitle("");
    setHeadline(false);
    setEditSlug(false);
    setCustomSlug("");
    setCategory("");
    setAuthor("You");
    setEditor("Unassigned");
    setExcerpt("");
    setContent("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setWorkflow("published");
    const nextSchedule = localScheduleDefaults();
    setScheduleDate(nextSchedule.date);
    setScheduleTime(nextSchedule.time);
    setMediaTab("upload");
    setCoverName("");
    setCoverAlt("");
    setSelectedImage(null);
    setPendingImage(null);
    setGallerySearch("");
    setInlineImagePickerOpen(false);
    setInlineMediaTab("upload");
    setInlineImageAlt("");
    setInlineGallerySearch("");
    setInlineSelectedImage(null);
    setInlinePendingImage(null);
    setInlineImageError("");
    inlineImageRangeRef.current = null;
    setFormError("");
  }

  function closeComposer() {
    if (isSaving || isUploading || isInlineUploading) return;
    onClose();
  }

  function rememberEditorSelection() {
    const selection = window.getSelection();
    const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (activeRange && editorRef.current?.contains(activeRange.commonAncestorContainer)) {
      inlineImageRangeRef.current = activeRange.cloneRange();
    }
  }

  function openInlineImagePicker() {
    rememberEditorSelection();
    setInlineMediaTab("upload");
    setInlineImageAlt("");
    setInlineGallerySearch("");
    setInlineSelectedImage(null);
    setInlinePendingImage(null);
    setInlineImageError("");
    setInlineImagePickerOpen(true);
  }

  function closeInlineImagePicker() {
    if (isInlinePreparing || isInlineUploading) return;
    setInlineImagePickerOpen(false);
    setInlineImageName("");
    setInlineImageAlt("");
    setInlineGallerySearch("");
    setInlineSelectedImage(null);
    setInlinePendingImage(null);
    setInlineImageError("");
    inlineImageRangeRef.current = null;
  }

  async function prepareInlineImage(file: File | undefined) {
    if (!file) return;
    setIsInlinePreparing(true);
    setInlineImageError("");
    try {
      const prepared = await compressToWebp(file);
      setInlinePendingImage(prepared);
      setInlineImageName(prepared.originalName.replace(/\.[^.]+$/, ""));
      setInlineSelectedImage(null);
    } catch (error) {
      setInlineImageError(error instanceof Error ? error.message : "The image could not be prepared.");
    } finally {
      setIsInlinePreparing(false);
    }
  }

  async function uploadInlineImage() {
    if (!inlinePendingImage) return;
    if (inlineImageAlt.trim().length < 3) {
      setInlineImageError("Add image alt text with at least 3 characters before uploading.");
      return;
    }

    setIsInlineUploading(true);
    setInlineImageError("");
    const folder = new Intl.DateTimeFormat("en-CA").format(new Date()).replaceAll("-", "/");
    const finalName = inlineImageName.trim() || inlinePendingImage.originalName.replace(/\.[^.]+$/, "");
    const safeName = slugify(finalName) || "story-image";
    const storagePath = `${folder}/${Date.now()}-${safeName}-inline.webp`;

    const { error: storageError } = await supabase.storage
      .from("article-images")
      .upload(storagePath, inlinePendingImage.blob, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: false,
      });

    if (storageError) {
      setInlineImageError(`Image upload failed: ${storageError.message}`);
      setIsInlineUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("article-images").getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from("article_images")
      .insert({
        alt_text: inlineImageAlt.trim(),
        height: inlinePendingImage.height,
        mime_type: "image/webp",
        original_name: finalName + ".webp",
        public_url: publicUrlData.publicUrl,
        size_bytes: inlinePendingImage.blob.size,
        storage_path: storagePath,
        width: inlinePendingImage.width,
      })
      .select()
      .single();

    if (error) {
      setInlineImageError(`Image library record failed: ${error.message}`);
      setIsInlineUploading(false);
      return;
    }

    setGallery((current) => [data, ...current]);
    setInlineSelectedImage(data);
    setInlineImageAlt(data.alt_text);
    setInlinePendingImage(null);
    setInlineMediaTab("gallery");
    setIsInlineUploading(false);
  }

  function selectInlineGalleryImage(image: ArticleImage) {
    setInlineSelectedImage(image);
    setInlineImageAlt(image.alt_text);
    setInlineImageError("");
  }

  function insertInlineImage() {
    if (!inlineSelectedImage) {
      setInlineImageError("Upload or choose an image to insert.");
      return;
    }
    if (inlineImageAlt.trim().length < 3) {
      setInlineImageError("Image alt text must be at least 3 characters.");
      return;
    }

    const articleEditor = editorRef.current;
    if (!articleEditor) return;

    const figure = document.createElement("figure");
    figure.className = "article-inline-image";
    figure.contentEditable = "false";
    figure.dataset.imageId = String(inlineSelectedImage.id);
    const image = document.createElement("img");
    image.alt = inlineImageAlt.trim();
    image.loading = "lazy";
    image.src = inlineSelectedImage.public_url;
    figure.append(image);
    const insertionHtml = `${figure.outerHTML}<p><br></p>`;
    const savedRange = inlineImageRangeRef.current;

    articleEditor.focus();
    if (savedRange && articleEditor.contains(savedRange.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
      document.execCommand("insertHTML", false, insertionHtml);
    } else {
      articleEditor.insertAdjacentHTML("beforeend", insertionHtml);
    }

    setContent(articleEditor.innerHTML);
    closeInlineImagePicker();
  }

  async function prepareImage(file: File | undefined) {
    if (!file) return;
    setIsPreparing(true);
    setFormError("");
    try {
      const prepared = await compressToWebp(file);
      setCoverName(prepared.originalName.replace(/\.[^.]+$/, ""));
      setPendingImage(prepared);
      setSelectedImage(null);
      await uploadImage(prepared);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The image could not be prepared.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function uploadImage(image: PendingImage) {
    setIsUploading(true);
    setFormError("");
    const folder = new Intl.DateTimeFormat("en-CA").format(new Date()).replaceAll("-", "/");
    const finalName = image.originalName.replace(/\.[^.]+$/, "");
    const safeName = slugify(finalName) || slugify(title) || "story-cover";
    const storagePath = `${folder}/${Date.now()}-${safeName}.webp`;
    const libraryAltText = coverAlt.trim().length >= 3
      ? coverAlt.trim()
      : title.trim().length >= 3
        ? title.trim()
        : `Cover image ${finalName}`;

    const { error: storageError } = await supabase.storage
      .from("article-images")
      .upload(storagePath, image.blob, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: false,
      });

    if (storageError) {
      setFormError(`Cover upload failed: ${storageError.message}`);
      setIsUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("article-images").getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from("article_images")
      .insert({
        alt_text: libraryAltText.slice(0, 180),
        height: image.height,
        mime_type: "image/webp",
        original_name: finalName + ".webp",
        public_url: publicUrlData.publicUrl,
        size_bytes: image.blob.size,
        storage_path: storagePath,
        width: image.width,
      })
      .select()
      .single();

    if (error) {
      setFormError(`Image library record failed: ${error.message}`);
      setIsUploading(false);
      return;
    }

    setGallery((current) => [data, ...current]);
    setSelectedImage(data);
    setCoverName(data.original_name.replace(/\.[^.]+$/, ""));
    setPendingImage(null);
    setIsUploading(false);
  }

  function selectGalleryImage(image: ArticleImage) {
    setSelectedImage(image);
    setCoverName(image.original_name.replace(/\.[^.]+$/, ""));
    setCoverAlt(image.alt_text);
    setFormError("");
  }

  async function updateCoverImageName() {
    if (!selectedImage || isUploading) return;
    const normalizedName = coverName.trim().replace(/\.[^.]+$/, "");
    if (!normalizedName) {
      setFormError("Image name cannot be empty.");
      return;
    }

    const finalName = `${normalizedName}.webp`;
    if (finalName === selectedImage.original_name) return;

    const { error } = await supabase
      .from("article_images")
      .update({ original_name: finalName })
      .eq("id", selectedImage.id);

    if (error) {
      setFormError(`Image name could not be updated: ${error.message}`);
      return;
    }

    const updatedImage = { ...selectedImage, original_name: finalName };
    setSelectedImage(updatedImage);
    setGallery((current) => current.map((image) => image.id === updatedImage.id ? updatedImage : image));
    setCoverName(normalizedName);
    setFormError("");
  }

  function applyFormat(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setContent(editorRef.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Paste the link URL");
    if (url) applyFormat("createLink", url);
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const storyText = plainText(content);

    if (title.trim().length < 3) return setFormError("Article title must be at least 3 characters.");
    if (!slug) return setFormError("Add a valid article slug.");
    if (category.trim().length < 2) return setFormError("Choose or enter a category.");
    if (!author.trim()) return setFormError("Add an author.");
    if (excerpt.trim().length < 20) return setFormError("Short excerpt must be at least 20 characters.");
    if (storyText.length < 50) return setFormError("Main content must contain at least 50 characters.");
    const coverImageUrl = selectedImage?.public_url ?? article?.cover_image_url;
    const coverImagePath = selectedImage?.storage_path ?? article?.cover_image_path;
    if (!coverImageUrl) return setFormError("Upload or choose a cover image.");
    const normalizedCoverAlt = coverAlt.trim();
    if (normalizedCoverAlt.length > 0 && normalizedCoverAlt.length < 3) {
      return setFormError("Cover-image alt text must be empty or at least 3 characters.");
    }

    let scheduledFor: string | null = null;
    if (workflow === "scheduled") {
      const scheduledDate = new Date(`${scheduleDate}T${scheduleTime}:00+07:00`);
      if (!scheduleDate || !scheduleTime || Number.isNaN(scheduledDate.valueOf()) || scheduledDate <= new Date()) {
        return setFormError("Scheduled publish date and time must be in the future (WIB).");
      }
      scheduledFor = scheduledDate.toISOString();
    }

    setIsSaving(true);
    setFormError("");
    const safeCoverUrl = coverImageUrl.replaceAll('"', "%22");
    const articleFields = {
        author: author.trim(),
        category: category.trim(),
        content,
        cover_image_alt: normalizedCoverAlt || null,
        cover_image_path: coverImagePath,
        cover_image_url: coverImageUrl,
        editor: editor.trim() || "Unassigned",
        excerpt: excerpt.trim(),
        geo_summary: `${category.trim()}: ${excerpt.trim()} ${storyText.slice(0, 320)}`,
        image_style: `url("${safeCoverUrl}") center / cover no-repeat`,
        is_headline: headline,
        published_at: workflow === "published" ? article?.published_at ?? new Date().toISOString() : null,
        scheduled_for: scheduledFor,
        seo_description: excerpt.trim().slice(0, 320),
        seo_title: title.trim(),
        slug,
        status: workflow === "published" ? "Published" : "Draft",
        title: title.trim(),
        updated_at: new Date().toISOString(),
      };
    const { data, error } = article
      ? await supabase.from("articles").update(articleFields).eq("id", article.id).select().single()
      : await supabase.from("articles").insert({ ...articleFields, views: 0 }).select().single();

    if (error) {
      setFormError(error.code === "23505" ? "That article slug is already in use. Edit the slug and try again." : `Article not saved: ${error.message}`);
      setIsSaving(false);
      return;
    }

    onSaved(data);
    resetForm();
    setIsSaving(false);
    onClose();
  }

  function handleDropCover(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingCover(false);
    if (isPreparing || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void prepareImage(file);
  }

  function handleDropInline(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingInline(false);
    if (isInlinePreparing || isInlineUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void prepareInlineImage(file);
  }

  return (
    <div
      className={presentation === "page" ? "composer-page-surface" : "composer-backdrop"}
      onMouseDown={presentation === "modal" ? closeComposer : undefined}
      role={presentation === "modal" ? "presentation" : undefined}
    >
      <section
        aria-labelledby="new-article-title"
        aria-modal={presentation === "modal" ? "true" : undefined}
        className={presentation === "page" ? "article-composer article-composer-page" : "article-composer"}
        onMouseDown={(event) => event.stopPropagation()}
        role={presentation === "modal" ? "dialog" : "region"}
      >
        <header className="composer-header">
          <div>
            <p className="eyebrow">STORY publishing</p>
            <h1 id="new-article-title">{article ? "Edit Article" : "Post a New Article"}</h1>
            <p>{article ? "Update the story, cover, and publishing details." : "Write the story, choose its cover, then publish now or schedule a draft."}</p>
          </div>
          <button
            aria-label={presentation === "page" ? "Back to articles" : "Close article composer"}
            className="close-button"
            onClick={closeComposer}
            type="button"
          >{presentation === "page" ? "←" : "×"}</button>
        </header>

        <form className="composer-form" onSubmit={saveArticle}>
          {formError && <p className="form-error composer-error" role="alert">{formError}</p>}

          <div className="composer-layout">
            <div className="composer-main">
              <section className="composer-card">
                <div className="section-heading">
                  <span className="section-number">01</span>
                  <div><h3>Article story</h3><p>Core details readers will see.</p></div>
                </div>

                <div className="field full-field">
                  <div className="field-heading-row">
                    <label htmlFor="article-title">Article title <b>*</b></label>
                    <label className="headline-toggle">
                      <input checked={headline} onChange={(event) => setHeadline(event.target.checked)} type="checkbox" />
                      Headline
                    </label>
                  </div>
                  <input autoFocus id="article-title" maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="Write a clear, engaging headline" value={title} />
                  <small>{title.length}/180 characters</small>
                </div>

                <div className="slug-panel">
                  <div className="slug-preview">
                    <span>Article URL</span>
                    <code>/post/{dateCode}/{slug || "your-article-title"}</code>
                  </div>
                  <label className="toggle-label">
                    <input checked={editSlug} onChange={(event) => {
                      setEditSlug(event.target.checked);
                      if (event.target.checked && !customSlug) setCustomSlug(automaticSlug);
                    }} type="checkbox" />
                    Edit slug
                  </label>
                  {editSlug && (
                    <input aria-label="Custom article slug" className="slug-input" maxLength={160} onChange={(event) => setCustomSlug(slugify(event.target.value))} value={customSlug} />
                  )}
                </div>

                <div className="two-column-fields">
                  <label className="field full-field">
                    <span>Category <b>*</b></span>
                    <input list="story-categories" maxLength={80} onChange={(event) => setCategory(event.target.value)} placeholder="Choose a category" value={category} />
                    <datalist id="story-categories">
                      {categories.map((item) => <option key={item} value={item} />)}
                    </datalist>
                  </label>
                  <label className="field full-field">
                    <span>Short excerpt <b>*</b></span>
                    <textarea maxLength={500} onChange={(event) => setExcerpt(event.target.value)} placeholder="Summarize the story in 1–2 inviting sentences" rows={4} value={excerpt} />
                    <small>{excerpt.length}/500 characters · minimum 20</small>
                  </label>
                </div>

                <div className="field full-field">
                  <span>Main content <b>*</b></span>
                  <div className="editor-shell">
                    <div aria-label="Formatting toolbar" className="editor-toolbar" role="toolbar">
                      <button aria-label="Bold" onClick={() => applyFormat("bold")} type="button"><strong>B</strong></button>
                      <button aria-label="Italic" onClick={() => applyFormat("italic")} type="button"><em>I</em></button>
                      <button aria-label="Heading" onClick={() => applyFormat("formatBlock", "h2")} type="button">H2</button>
                      <button aria-label="Bulleted list" onClick={() => applyFormat("insertUnorderedList")} type="button">• List</button>
                      <button aria-label="Quote" onClick={() => applyFormat("formatBlock", "blockquote")} type="button">“ Quote</button>
                      <button aria-label="Add link" onClick={addLink} type="button">Link</button>
                      <button
                        aria-label="Insert image from library"
                        className="image-tool-button"
                        onClick={openInlineImagePicker}
                        onMouseDown={(event) => event.preventDefault()}
                        type="button"
                      ><span aria-hidden="true">▧</span> Image</button>
                    </div>
                    <div
                      aria-label="Article main content"
                      className="rich-editor"
                      contentEditable
                      data-placeholder="Start writing your article…"
                      onInput={(event) => {
                        setContent(event.currentTarget.innerHTML);
                        rememberEditorSelection();
                      }}
                      onKeyUp={rememberEditorSelection}
                      onMouseUp={rememberEditorSelection}
                      ref={editorRef}
                      role="textbox"
                      suppressContentEditableWarning
                    />
                  </div>
                  <small>{plainText(content).length} characters · minimum 50</small>
                </div>
              </section>
            </div>

            <aside className="composer-side">
              <section className="composer-card cover-card">
                <div className="section-heading compact">
                  <span className="section-number">02</span>
                  <div><h3>Cover image</h3><p>WebP, up to 1 MB.</p></div>
                </div>

                <div className="media-tabs" role="tablist" aria-label="Cover image source">
                  <button aria-selected={mediaTab === "upload"} className={mediaTab === "upload" ? "active" : ""} onClick={() => setMediaTab("upload")} role="tab" type="button">Upload</button>
                  <button aria-selected={mediaTab === "gallery"} className={mediaTab === "gallery" ? "active" : ""} onClick={() => setMediaTab("gallery")} role="tab" type="button">Gallery <span>{gallery.length}</span></button>
                </div>

                {mediaTab === "upload" ? (
                  <div className="upload-panel">
                    <label 
                      className={`upload-dropzone ${isDraggingCover ? "drag-active" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); if (!isPreparing && !isUploading) setIsDraggingCover(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDraggingCover(false); }}
                      onDrop={handleDropCover}
                    >
                      <span className="upload-mark" aria-hidden="true">＋</span>
                      <strong>{isUploading ? "Uploading automatically…" : isPreparing ? "Preparing image…" : isDraggingCover ? "Drop image to upload" : "Choose cover image"}</strong>
                      <small>JPG, PNG, GIF or WebP</small>
                      <input accept="image/*" disabled={isPreparing || isUploading} onChange={(event) => void prepareImage(event.target.files?.[0])} type="file" />
                    </label>
                    {pendingImage && (
                      <div className="pending-image">
                        <div className="cover-preview" style={{ backgroundImage: `url("${pendingImage.previewUrl}")` }} />
                        <p><strong>{pendingImage.originalName}</strong><span>{pendingImage.width} × {pendingImage.height} · {(pendingImage.blob.size / 1024).toFixed(0)} KB</span></p>
                      </div>
                    )}
                    {selectedImage && !pendingImage && (
                      <div className="pending-image">
                        <div className="cover-preview" style={{ backgroundImage: `url("${selectedImage.public_url}")` }} />
                        <p><strong>{selectedImage.original_name}</strong><span>Uploaded automatically</span></p>
                      </div>
                    )}
                    <label className="field">
                      <span>Image name <b>*</b></span>
                      <input
                        disabled={isPreparing || isUploading}
                        maxLength={175}
                        onBlur={() => void updateCoverImageName()}
                        onChange={(event) => setCoverName(event.target.value)}
                        placeholder="Name this image"
                        value={coverName}
                      />
                    </label>
                    <label className="field">
                      <span>Image alt text <small>(optional)</small></span>
                      <textarea maxLength={180} onChange={(event) => setCoverAlt(event.target.value)} placeholder="Optional description for accessibility" rows={3} value={coverAlt} />
                    </label>
                  </div>
                ) : (
                  <div className="gallery-panel">
                    <input aria-label="Search image library" className="gallery-search" onChange={(event) => setGallerySearch(event.target.value)} placeholder="Search image library" value={gallerySearch} />
                    {visibleGallery.length ? (
                      <div className="image-grid">
                        {visibleGallery.map((image) => (
                          <button
                            aria-label={`Use ${image.alt_text}`}
                            className={selectedImage?.id === image.id ? "selected" : ""}
                            key={image.id}
                            onClick={() => selectGalleryImage(image)}
                            style={{ backgroundImage: `url("${image.public_url}")` }}
                            type="button"
                          ><span>{selectedImage?.id === image.id ? "Selected" : "Choose"}</span></button>
                        ))}
                      </div>
                    ) : <p className="empty-gallery">No images yet. Upload the first cover.</p>}
                    {selectedImage && (
                      <label className="field gallery-alt">
                        <span>Selected image alt text <small>(optional)</small></span>
                        <textarea maxLength={180} onChange={(event) => setCoverAlt(event.target.value)} rows={3} value={coverAlt} />
                      </label>
                    )}
                  </div>
                )}
              </section>

            </aside>
          </div>

          <footer className="composer-actions">
            <section className="workflow-card workflow-floating-card" aria-labelledby="workflow-heading">
              <div className="workflow-floating-heading">
                <div><h3 id="workflow-heading">Workflow</h3><p>Shared dashboard</p></div>
              </div>
              <div className="workflow-people-fields">
                <label className="field">
                  <span>Author <b>*</b></span>
                  {canEditAuthor ? (
                    <select
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="gallery-page-search"
                      style={{ border: "1px solid var(--cloud)", padding: "0 12px", width: "100%", height: "40px", borderRadius: "8px", fontSize: "14px", backgroundColor: "var(--paper)", color: "var(--ink)" }}
                    >
                      <option value="">-- Select Author --</option>
                      {users.filter(u => u.role_id).map(user => (
                        // Ideally we check if their role has 'Is Author', but for simplicity we show all users or map their role if we joined roles.
                        // For now we just list all users as potential authors, to be fully strict we could fetch their role's job_tasks.
                        <option key={user.id} value={user.full_name}>{user.full_name}</option>
                      ))}
                      {/* Allow custom names if they type them in edit mode, or just rely on list */}
                      {!users.some(u => u.full_name === author) && author && <option value={author}>{author}</option>}
                    </select>
                  ) : (
                    <input 
                      maxLength={120} 
                      value={author} 
                      disabled
                      style={{ opacity: 0.7, cursor: "not-allowed", backgroundColor: "var(--cloud)" }}
                    />
                  )}
                </label>
                <label className="field">
                  <span>Editor</span>
                  {canEditEditor ? (
                    <select
                      value={editor}
                      onChange={(e) => setEditor(e.target.value)}
                      className="gallery-page-search"
                      style={{ border: "1px solid var(--cloud)", padding: "0 12px", width: "100%", height: "40px", borderRadius: "8px", fontSize: "14px", backgroundColor: "var(--paper)", color: "var(--ink)" }}
                    >
                      <option value="Unassigned">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.full_name}>{user.full_name}</option>
                      ))}
                      {!users.some(u => u.full_name === editor) && editor !== "Unassigned" && editor && <option value={editor}>{editor}</option>}
                    </select>
                  ) : (
                    <input 
                      maxLength={120} 
                      value={editor} 
                      disabled
                      style={{ opacity: 0.7, cursor: "not-allowed", backgroundColor: "var(--cloud)" }}
                    />
                  )}
                </label>
              </div>
              <div className="workflow-choice-fields">
                <label className={workflow === "published" ? "workflow-option active" : "workflow-option"}>
                  <input checked={workflow === "published"} name="workflow" onChange={() => setWorkflow("published")} type="radio" />
                  <span><strong>Publish now</strong></span>
                </label>
                <label className={workflow === "scheduled" ? "workflow-option active" : "workflow-option"}>
                  <input checked={workflow === "scheduled"} name="workflow" onChange={() => setWorkflow("scheduled")} type="radio" />
                  <span><strong>Schedule</strong></span>
                </label>
                <label className={workflow === "draft" ? "workflow-option active" : "workflow-option"}>
                  <input checked={workflow === "draft"} name="workflow" onChange={() => setWorkflow("draft")} type="radio" />
                  <span><strong>Save as draft</strong></span>
                </label>
              </div>
              {workflow === "scheduled" && (
                <div className="schedule-fields workflow-floating-schedule" style={{ marginTop: "16px" }}>
                  <label className="field"><span>Publish date <b>*</b></span><input onChange={(event) => setScheduleDate(event.target.value)} type="date" value={scheduleDate} /></label>
                  <label className="field"><span>Time (WIB) <b>*</b></span><input onChange={(event) => setScheduleTime(event.target.value)} type="time" value={scheduleTime} /></label>
                </div>
              )}
            </section>
            <div className="composer-action-buttons">
              <button className="secondary-button" onClick={closeComposer} type="button">Cancel</button>
              <button className="primary-button" disabled={isSaving || isUploading || isPreparing || isInlineUploading || isInlinePreparing} type="submit">
                {isSaving ? "Saving…" : article ? "Save Changes" : workflow === "published" ? "Post Article" : "Save Draft"}
              </button>
            </div>
          </footer>
          {inlineImagePickerOpen && (
            <div
              className="inline-image-backdrop"
              data-inline-image-picker
              onMouseDown={closeInlineImagePicker}
              role="presentation"
            >
              <section
                aria-labelledby="inline-image-title"
                aria-modal="true"
                className="inline-image-dialog"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
              >
                <header className="inline-image-heading">
                  <div>
                    <p className="eyebrow">Article media</p>
                    <h3 id="inline-image-title">Insert image</h3>
                    <p>Upload a new image or choose one from the shared gallery.</p>
                  </div>
                  <button aria-label="Close image picker" className="close-button" disabled={isInlinePreparing || isInlineUploading} onClick={closeInlineImagePicker} type="button">×</button>
                </header>

                {inlineImageError && <p className="form-error inline-image-error" role="alert">{inlineImageError}</p>}

                <div className="media-tabs" role="tablist" aria-label="Article image source">
                  <button aria-selected={inlineMediaTab === "upload"} className={inlineMediaTab === "upload" ? "active" : ""} onClick={() => setInlineMediaTab("upload")} role="tab" type="button">Upload</button>
                  <button aria-selected={inlineMediaTab === "gallery"} className={inlineMediaTab === "gallery" ? "active" : ""} onClick={() => setInlineMediaTab("gallery")} role="tab" type="button">Gallery <span>{gallery.length}</span></button>
                </div>

                {inlineMediaTab === "upload" ? (
                  <div className="upload-panel">
                    <label 
                      className={`upload-dropzone ${isDraggingInline ? "drag-active" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); if (!isInlinePreparing && !isInlineUploading) setIsDraggingInline(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDraggingInline(false); }}
                      onDrop={handleDropInline}
                    >
                      <span className="upload-mark" aria-hidden="true">＋</span>
                      <strong>{isInlinePreparing ? "Preparing image…" : isDraggingInline ? "Drop image to upload" : "Choose article image"}</strong>
                      <small>JPG, PNG, GIF or WebP</small>
                      <input accept="image/*" disabled={isInlinePreparing || isInlineUploading} onChange={(event) => void prepareInlineImage(event.target.files?.[0])} type="file" />
                    </label>
                    {inlinePendingImage && (
                      <div className="pending-image">
                        <div className="cover-preview" style={{ backgroundImage: `url("${inlinePendingImage.previewUrl}")` }} />
                        <p><strong>{inlinePendingImage.originalName}</strong><span>{inlinePendingImage.width} × {inlinePendingImage.height} · {(inlinePendingImage.blob.size / 1024).toFixed(0)} KB</span></p>
                      </div>
                    )}
                    <label className="field">
                      <span>Image name <b>*</b></span>
                      <input maxLength={180} onChange={(event) => setInlineImageName(event.target.value)} placeholder="Name this image" value={inlineImageName} />
                    </label>
                    <label className="field">
                      <span>Image alt text <b>*</b></span>
                      <textarea maxLength={180} onChange={(event) => setInlineImageAlt(event.target.value)} placeholder="Describe the image for accessibility" rows={3} value={inlineImageAlt} />
                    </label>
                    <button className="secondary-button upload-button" disabled={!inlinePendingImage || isInlineUploading || isInlinePreparing} onClick={() => void uploadInlineImage()} type="button">
                      {isInlineUploading ? "Uploading…" : "Upload to library"}
                    </button>
                  </div>
                ) : (
                  <div className="gallery-panel">
                    <input aria-label="Search article image library" className="gallery-search" onChange={(event) => setInlineGallerySearch(event.target.value)} placeholder="Search image library" value={inlineGallerySearch} />
                    {visibleInlineGallery.length ? (
                      <div className="image-grid inline-image-grid">
                        {visibleInlineGallery.map((image) => (
                          <button
                            aria-label={`Insert ${image.alt_text}`}
                            className={inlineSelectedImage?.id === image.id ? "selected" : ""}
                            key={image.id}
                            onClick={() => selectInlineGalleryImage(image)}
                            style={{ backgroundImage: `url("${image.public_url}")` }}
                            type="button"
                          ><span>{inlineSelectedImage?.id === image.id ? "Selected" : "Choose"}</span></button>
                        ))}
                      </div>
                    ) : <p className="empty-gallery">No images yet. Upload the first article image.</p>}
                    {inlineSelectedImage && (
                      <label className="field gallery-alt">
                        <span>Image alt text <b>*</b></span>
                        <textarea maxLength={180} onChange={(event) => setInlineImageAlt(event.target.value)} rows={3} value={inlineImageAlt} />
                      </label>
                    )}
                  </div>
                )}

                <footer className="inline-image-actions">
                  <button className="secondary-button" disabled={isInlinePreparing || isInlineUploading} onClick={closeInlineImagePicker} type="button">Cancel</button>
                  <button className="primary-button" disabled={!inlineSelectedImage || isInlinePreparing || isInlineUploading} onClick={insertInlineImage} type="button">Insert image</button>
                </footer>
              </section>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
