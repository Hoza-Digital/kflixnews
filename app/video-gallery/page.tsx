"use client";

import Image from "next/image";
import { type DragEvent, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";

type ArticleVideo = Database["public"]["Tables"]["article_videos"]["Row"];

type PendingImage = {
  blob: Blob;
  height: number;
  originalName: string;
  previewUrl: string;
  width: number;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
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
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize canvas context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Could not convert image to WebP");
  return {
    blob,
    height,
    originalName: file.name,
    previewUrl: URL.createObjectURL(blob),
    width,
  };
}

function getThumbnail(url: string) {
  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (hostname === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtube-nocookie.com" || hostname.endsWith(".youtube-nocookie.com")) {
      videoId = parsed.searchParams.get("v") ?? "";
      if (!videoId) {
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(pathParts[0])) videoId = pathParts[1] ?? "";
      }
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } catch {
    // Keep the preview hidden until the entered URL is valid.
  }
  return null;
}

export default function VideoGalleryPage() {
  const [videos, setVideos] = useState<ArticleVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  
  // Edit Manager State
  const [selectedVideo, setSelectedVideo] = useState<ArticleVideo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editThumbnailMode, setEditThumbnailMode] = useState<"url" | "upload">("upload");
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [editThumbnailFile, setEditThumbnailFile] = useState<PendingImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload (Add Link) State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadThumbnailMode, setUploadThumbnailMode] = useState<"url" | "upload">("upload");
  const [uploadThumbnailUrl, setUploadThumbnailUrl] = useState("");
  const [uploadThumbnailFile, setUploadThumbnailFile] = useState<PendingImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [draggingThumbnailMode, setDraggingThumbnailMode] = useState<"edit" | "upload" | null>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    async function loadGallery() {
      const { data, error: dbError } = await supabase
        .from("article_videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbError) {
        setError(`Failed to load gallery: ${dbError.message}`);
      } else {
        setVideos(data || []);
      }
      setIsLoading(false);
    }

    void loadGallery();
  }, []);

  useEffect(() => {
    if (!selectedVideo && !isUploadOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving && !isDeleting && !isUploading) {
        if (selectedVideo) closeManager();
        if (isUploadOpen) closeUpload();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedVideo, isUploadOpen, isSaving, isDeleting, isUploading]);

  const visibleVideos = videos.filter((vid) => {
    const s = search.trim().toLowerCase();
    return !s || vid.title.toLowerCase().includes(s) || vid.video_url.toLowerCase().includes(s);
  });
  const editDefaultThumbnail = getThumbnail(editUrl);
  const uploadDefaultThumbnail = getThumbnail(uploadUrl);

  function openManager(video: ArticleVideo) {
    setSelectedVideo(video);
    setEditTitle(video.title);
    setEditUrl(video.video_url);
    setEditDescription(video.description || "");
    setEditThumbnailUrl(video.thumbnail_url || "");
    setEditThumbnailFile(null);
    setEditThumbnailMode(video.thumbnail_url ? "url" : "upload");
    setError("");
  }

  function closeManager() {
    if (isSaving || isDeleting) return;
    setSelectedVideo(null);
    setEditTitle("");
    setEditUrl("");
    setEditDescription("");
    setEditThumbnailUrl("");
    setEditThumbnailFile(null);
    setEditThumbnailMode("upload");
    setDraggingThumbnailMode(null);
    setError("");
  }

  async function saveDetails() {
    if (!selectedVideo) return;
    if (editTitle.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (editUrl.trim().length < 5) {
      setError("Video URL cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError("");

    let finalThumbnailUrl = editThumbnailUrl.trim() || null;

    if (editThumbnailMode === "upload" && editThumbnailFile) {
      const folder = new Intl.DateTimeFormat("en-CA").format(new Date()).replaceAll("-", "/");
      const storagePath = `${folder}/${Date.now()}-thumb.webp`;
      const { error: storageError } = await supabase.storage
        .from("article-images")
        .upload(storagePath, editThumbnailFile.blob, {
          cacheControl: "3600",
          contentType: "image/webp",
          upsert: false,
        });
      
      if (storageError) {
        setError(`Upload failed: ${storageError.message}`);
        setIsSaving(false);
        return;
      }
      
      const { data: publicUrlData } = supabase.storage.from("article-images").getPublicUrl(storagePath);
      finalThumbnailUrl = publicUrlData.publicUrl;
    } else if (editThumbnailMode === "upload" && !editThumbnailFile && editThumbnailUrl) {
      // Retain existing if they didn't upload a new one but are in upload mode
      finalThumbnailUrl = editThumbnailUrl;
    }

    const { error: updateError } = await supabase
      .from("article_videos")
      .update({ 
        title: editTitle.trim(),
        video_url: editUrl.trim(),
        description: editDescription.trim() || null,
        thumbnail_url: finalThumbnailUrl
      })
      .eq("id", selectedVideo.id);

    if (updateError) {
      setError(`Failed to update details: ${updateError.message}`);
      setIsSaving(false);
      return;
    }

    setVideos((current) =>
      current.map((vid) => (vid.id === selectedVideo.id ? { ...vid, title: editTitle.trim(), video_url: editUrl.trim(), description: editDescription.trim() || null, thumbnail_url: finalThumbnailUrl } : vid))
    );
    setIsSaving(false);
    closeManager();
  }

  async function deleteVideo() {
    if (!selectedVideo) return;
    if (!window.confirm("Are you sure you want to completely delete this video link?")) return;

    setIsDeleting(true);
    setError("");

    const { error: dbError } = await supabase
      .from("article_videos")
      .delete()
      .eq("id", selectedVideo.id);

    if (dbError) {
      setError(`Failed to delete record: ${dbError.message}`);
      setIsDeleting(false);
      return;
    }

    setVideos((current) => current.filter((vid) => vid.id !== selectedVideo.id));
    setIsDeleting(false);
    closeManager();
  }

  function closeUpload() {
    if (isUploading) return;
    setIsUploadOpen(false);
    setUploadTitle("");
    setUploadUrl("");
    setUploadDescription("");
    setUploadThumbnailUrl("");
    setUploadThumbnailFile(null);
    setUploadThumbnailMode("upload");
    setDraggingThumbnailMode(null);
    setUploadError("");
  }

  function handleThumbnailDragOver(event: DragEvent<HTMLLabelElement>, mode: "upload" | "edit") {
    event.preventDefault();
    if (isPreparing || isSaving || isUploading) return;
    event.dataTransfer.dropEffect = "copy";
    setDraggingThumbnailMode(mode);
  }

  function handleThumbnailDragLeave(event: DragEvent<HTMLLabelElement>, mode: "upload" | "edit") {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (draggingThumbnailMode === mode) setDraggingThumbnailMode(null);
  }

  function handleThumbnailDrop(event: DragEvent<HTMLLabelElement>, mode: "upload" | "edit") {
    event.preventDefault();
    setDraggingThumbnailMode(null);
    if (isPreparing || isSaving || isUploading) return;
    void prepareThumbnail(event.dataTransfer.files?.[0], mode);
  }

  async function prepareThumbnail(file: File | undefined, mode: "upload" | "edit") {
    if (!file) return;
    setIsPreparing(true);
    if (mode === "upload") setUploadError("");
    else setError("");

    try {
      const prepared = await compressToWebp(file);
      if (mode === "upload") setUploadThumbnailFile(prepared);
      else setEditThumbnailFile(prepared);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image could not be prepared.";
      if (mode === "upload") setUploadError(msg);
      else setError(msg);
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleUpload() {
    if (uploadTitle.trim().length < 3) {
      setUploadError("Video title must be at least 3 characters.");
      return;
    }
    if (uploadUrl.trim().length < 5) {
      setUploadError("Please provide a valid Video URL.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    let finalThumbnailUrl = uploadThumbnailUrl.trim() || null;

    if (uploadThumbnailMode === "upload" && uploadThumbnailFile) {
      const folder = new Intl.DateTimeFormat("en-CA").format(new Date()).replaceAll("-", "/");
      const storagePath = `${folder}/${Date.now()}-thumb.webp`;
      const { error: storageError } = await supabase.storage
        .from("article-images")
        .upload(storagePath, uploadThumbnailFile.blob, {
          cacheControl: "3600",
          contentType: "image/webp",
          upsert: false,
        });
      
      if (storageError) {
        setUploadError(`Upload failed: ${storageError.message}`);
        setIsUploading(false);
        return;
      }
      
      const { data: publicUrlData } = supabase.storage.from("article-images").getPublicUrl(storagePath);
      finalThumbnailUrl = publicUrlData.publicUrl;
    }

    const { data, error: dbError } = await supabase
      .from("article_videos")
      .insert({
        title: uploadTitle.trim(),
        video_url: uploadUrl.trim(),
        description: uploadDescription.trim() || null,
        thumbnail_url: finalThumbnailUrl,
      })
      .select()
      .single();

    if (dbError) {
      setUploadError(`Failed to save video link: ${dbError.message}`);
      setIsUploading(false);
      return;
    }

    setVideos((current) => [data, ...current]);
    setIsUploading(false);
    closeUpload();
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="dashboard" aria-labelledby="page-title">
        <header className="topbar">
          <div>
            <p className="eyebrow">Media workspace</p>
            <h1 id="page-title">Video Gallery</h1>
            <p>Manage all uploaded video links across your articles.</p>
            <div className="database-badge">
              <span aria-hidden="true" />
              Shared database live
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <input
              aria-label="Search gallery"
              className="gallery-page-search"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos by title or URL..."
              value={search}
              style={{ width: "300px" }}
            />
            <button className="primary-button" onClick={() => setIsUploadOpen(true)} type="button">
              <span aria-hidden="true">＋</span> Add Video Link
            </button>
          </div>
        </header>

        {error && !selectedVideo && (
          <div className="banner error-banner" style={{ margin: "0 40px 20px" }}>
            <span aria-hidden="true">⚠️</span> {error}
          </div>
        )}

        <section className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel">
            <header className="panel-heading">
              <h2 id="gallery-heading">All Video Links</h2>
              <p>Click any video to view details, edit its title, or delete it.</p>
            </header>
            
            <div className="gallery-page-content" style={{ padding: "0 24px 32px" }}>
              {isLoading ? (
                <p className="loading-state">Loading video gallery...</p>
              ) : visibleVideos.length > 0 ? (
                <div className="gallery-page-grid">
                  {visibleVideos.map((video) => {
                    const thumb = video.thumbnail_url || getThumbnail(video.video_url);
                    return (
                      <button
                        aria-label={`Manage video: ${video.title}`}
                        className="gallery-page-item"
                        key={video.id}
                        onClick={() => openManager(video)}
                        type="button"
                      >
                        <div 
                          className="gallery-page-thumb" 
                          style={{ 
                            backgroundImage: thumb ? `url("${thumb}")` : undefined,
                            backgroundColor: thumb ? undefined : "var(--slate)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                            color: "white"
                          }}
                        >
                          {!thumb && "▶"}
                        </div>
                        <div className="gallery-page-item-info">
                          <strong>{video.title}</strong>
                          <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {video.video_url}
                          </small>
                          {video.description && (
                            <small style={{ marginTop: "4px", color: "var(--slate)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {video.description}
                            </small>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <span aria-hidden="true">▶️</span>
                  <h3>No videos found</h3>
                  <p>{search ? "Try adjusting your search terms." : "Video links you add will appear here."}</p>
                </div>
              )}
            </div>
          </article>
        </section>
      </section>

      {/* MANAGER MODAL */}
      {selectedVideo && (
        <div className="image-manager-backdrop" onMouseDown={closeManager} role="presentation">
          <section
            aria-labelledby="manager-title"
            aria-modal="true"
            className="image-manager-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
          >
            <header className="manager-header">
              <h2 id="manager-title">Manage Video Link</h2>
              <button aria-label="Close" className="close-button" onClick={closeManager} type="button">×</button>
            </header>

            <div className="manager-body">
              {error && <p className="form-error composer-error" role="alert">{error}</p>}
              
              <div className="manager-metadata">
                <p><strong>Added:</strong> {new Date(selectedVideo.created_at).toLocaleString()}</p>
              </div>

              <div className="field full-field manager-edit-field" style={{ marginBottom: "16px" }}>
                <label htmlFor="edit-video-url">Video URL <b>*</b></label>
                <input
                  id="edit-video-url"
                  type="url"
                  onChange={(e) => setEditUrl(e.target.value)}
                  value={editUrl}
                />
                {editDefaultThumbnail && (
                  <Image
                    alt="Default video thumbnail preview"
                    className="video-default-thumbnail"
                    height={360}
                    loading="eager"
                    src={editDefaultThumbnail}
                    width={480}
                  />
                )}
              </div>

              <div className="field full-field manager-edit-field">
                <label htmlFor="edit-video-title">Video Title <b>*</b></label>
                <input
                  id="edit-video-title"
                  maxLength={180}
                  onChange={(e) => setEditTitle(e.target.value)}
                  value={editTitle}
                />
              </div>

              <div className="field full-field manager-edit-field" style={{ marginTop: "16px" }}>
                <label htmlFor="edit-video-desc">Description</label>
                <textarea
                  id="edit-video-desc"
                  rows={3}
                  onChange={(e) => setEditDescription(e.target.value)}
                  value={editDescription}
                  placeholder="Optional description..."
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", fontFamily: "inherit" }}
                />
              </div>

              <div className="field full-field manager-edit-field" style={{ marginTop: "16px" }}>
                <label>Custom Thumbnail</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <button 
                    type="button" 
                    onClick={() => setEditThumbnailMode("upload")}
                    style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", background: editThumbnailMode === "upload" ? "var(--ink)" : "var(--light-bg)", color: editThumbnailMode === "upload" ? "white" : "inherit" }}
                  >
                    Upload Image
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditThumbnailMode("url")}
                    style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", background: editThumbnailMode === "url" ? "var(--ink)" : "var(--light-bg)", color: editThumbnailMode === "url" ? "white" : "inherit" }}
                  >
                    Enter URL
                  </button>
                </div>
                
                {editThumbnailMode === "url" ? (
                  <input
                    type="url"
                    onChange={(e) => setEditThumbnailUrl(e.target.value)}
                    value={editThumbnailUrl}
                    placeholder="Leave blank to auto-fetch from YouTube"
                  />
                ) : (
                  <div>
                    {!editThumbnailFile ? (
                      <label
                        className={`upload-dropzone ${draggingThumbnailMode === "edit" ? "drag-active" : ""}`}
                        onDragLeave={(event) => handleThumbnailDragLeave(event, "edit")}
                        onDragOver={(event) => handleThumbnailDragOver(event, "edit")}
                        onDrop={(event) => handleThumbnailDrop(event, "edit")}
                        style={{ border: "2px dashed var(--border)", padding: "24px", textAlign: "center", borderRadius: "8px", cursor: "pointer", position: "relative" }}
                      >
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => prepareThumbnail(e.target.files?.[0], "edit")}
                        />
                        <span style={{ color: "var(--slate)" }}>{isPreparing ? "Preparing..." : draggingThumbnailMode === "edit" ? "Drop image here" : "Click or drag to upload"}</span>
                      </label>
                    ) : (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <img src={editThumbnailFile.previewUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "6px" }} />
                        <button 
                          type="button" 
                          onClick={() => setEditThumbnailFile(null)}
                          style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer" }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {editThumbnailUrl && !editThumbnailFile && (
                      <p style={{ fontSize: "12px", color: "var(--slate)", marginTop: "4px" }}>Currently using a custom URL.</p>
                    )}
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: "16px", padding: "12px", background: "var(--light-bg)", borderRadius: "8px", fontSize: "14px" }}>
                <a href={selectedVideo.video_url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>↗</span> Open video link in new tab
                </a>
              </div>
            </div>

            <footer className="manager-actions">
              <button
                className="secondary-button danger-button"
                disabled={isDeleting || isSaving}
                onClick={deleteVideo}
                type="button"
              >
                {isDeleting ? "Deleting…" : "Delete Link"}
              </button>
              <div className="manager-actions-right">
                <button className="secondary-button" disabled={isDeleting || isSaving} onClick={closeManager} type="button">Cancel</button>
                <button className="primary-button" disabled={isDeleting || isSaving} onClick={saveDetails} type="button">
                  {isSaving ? "Saving…" : "Save Details"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {isUploadOpen && (
        <div className="image-manager-backdrop" onMouseDown={closeUpload} role="presentation">
          <section
            aria-labelledby="upload-title"
            aria-modal="true"
            className="image-manager-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            style={{ maxWidth: "480px" }}
          >
            <header className="manager-header">
              <h2 id="upload-title">Add Video Link</h2>
              <button aria-label="Close upload" className="close-button" disabled={isUploading} onClick={closeUpload} type="button">×</button>
            </header>
            
            <div className="manager-body">
              {uploadError && <p className="form-error" style={{ marginBottom: "16px" }}>{uploadError}</p>}
              
              <div className="field full-field manager-edit-field" style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Video URL (YouTube/Vimeo) *</label>
                <input 
                  type="url"
                  onChange={(e) => setUploadUrl(e.target.value)} 
                  placeholder="https://youtube.com/watch?v=..."
                  value={uploadUrl} 
                  disabled={isUploading}
                />
                {uploadDefaultThumbnail && (
                  <Image
                    alt="Default video thumbnail preview"
                    className="video-default-thumbnail"
                    height={360}
                    loading="eager"
                    src={uploadDefaultThumbnail}
                    width={480}
                  />
                )}
              </div>
              <div className="field full-field manager-edit-field">
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Video Title *</label>
                <input 
                  maxLength={180} 
                  onChange={(e) => setUploadTitle(e.target.value)} 
                  value={uploadTitle}
                  disabled={isUploading}
                  placeholder="e.g. My Awesome Video"
                />
              </div>

              <div className="field full-field manager-edit-field" style={{ marginTop: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Description</label>
                <textarea 
                  rows={3}
                  onChange={(e) => setUploadDescription(e.target.value)} 
                  value={uploadDescription}
                  disabled={isUploading}
                  placeholder="Optional description..."
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", fontFamily: "inherit" }}
                />
              </div>

              <div className="field full-field manager-edit-field" style={{ marginTop: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Custom Thumbnail</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <button 
                    type="button" 
                    onClick={() => setUploadThumbnailMode("upload")}
                    style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", background: uploadThumbnailMode === "upload" ? "var(--ink)" : "var(--light-bg)", color: uploadThumbnailMode === "upload" ? "white" : "inherit" }}
                  >
                    Upload Image
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setUploadThumbnailMode("url")}
                    style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", background: uploadThumbnailMode === "url" ? "var(--ink)" : "var(--light-bg)", color: uploadThumbnailMode === "url" ? "white" : "inherit" }}
                  >
                    Enter URL
                  </button>
                </div>

                {uploadThumbnailMode === "url" ? (
                  <input 
                    type="url"
                    onChange={(e) => setUploadThumbnailUrl(e.target.value)} 
                    value={uploadThumbnailUrl}
                    disabled={isUploading}
                    placeholder="Leave blank to auto-fetch from YouTube"
                  />
                ) : (
                  <div>
                    {!uploadThumbnailFile ? (
                      <label
                        className={`upload-dropzone ${draggingThumbnailMode === "upload" ? "drag-active" : ""}`}
                        onDragLeave={(event) => handleThumbnailDragLeave(event, "upload")}
                        onDragOver={(event) => handleThumbnailDragOver(event, "upload")}
                        onDrop={(event) => handleThumbnailDrop(event, "upload")}
                        style={{ border: "2px dashed var(--border)", padding: "24px", textAlign: "center", borderRadius: "8px", cursor: "pointer", position: "relative" }}
                      >
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => prepareThumbnail(e.target.files?.[0], "upload")}
                          disabled={isUploading || isPreparing}
                        />
                        <span style={{ color: "var(--slate)" }}>{isPreparing ? "Preparing..." : draggingThumbnailMode === "upload" ? "Drop image here" : "Click or drag to upload"}</span>
                      </label>
                    ) : (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <img src={uploadThumbnailFile.previewUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "6px" }} />
                        <button 
                          type="button" 
                          onClick={() => setUploadThumbnailFile(null)}
                          style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer" }}
                          disabled={isUploading}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <footer className="manager-actions">
              <button className="secondary-button" disabled={isUploading} onClick={closeUpload} type="button">Cancel</button>
              <button 
                className="primary-button" 
                disabled={isUploading || !uploadTitle || !uploadUrl} 
                onClick={handleUpload} 
                type="button"
              >
                {isUploading ? "Adding…" : "Add Video"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
