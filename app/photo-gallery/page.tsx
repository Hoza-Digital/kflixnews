"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";

type ArticleImage = Database["public"]["Tables"]["article_images"]["Row"];

// navItems moved to Sidebar

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

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function GalleryPage() {
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedImage, setSelectedImage] = useState<ArticleImage | null>(null);
  const [editAltText, setEditAltText] = useState("");
  const [editOriginalName, setEditOriginalName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<PendingImage | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadAlt, setUploadAlt] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    async function loadGallery() {
      const { data, error: dbError } = await supabase
        .from("article_images")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbError) {
        setError(`Failed to load gallery: ${dbError.message}`);
      } else {
        setImages(data);
      }
      setIsLoading(false);
    }

    void loadGallery();
  }, []);

  useEffect(() => {
    if (!selectedImage && !isUploadOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving && !isDeleting && !isUploading && !isPreparing) {
        if (selectedImage) closeManager();
        if (isUploadOpen) closeUpload();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, isUploadOpen, isSaving, isDeleting, isUploading, isPreparing]);

  const visibleImages = images.filter((img) => {
    const s = search.trim().toLowerCase();
    return !s || img.original_name.toLowerCase().includes(s) || img.alt_text.toLowerCase().includes(s);
  });

  function openManager(image: ArticleImage) {
    setSelectedImage(image);
    setEditAltText(image.alt_text);
    setEditOriginalName(image.original_name.replace(/\.[^.]+$/, ""));
    setError("");
  }

  function closeManager() {
    if (isSaving || isDeleting) return;
    setSelectedImage(null);
    setEditAltText("");
    setEditOriginalName("");
    setError("");
  }

  async function saveDetails() {
    if (!selectedImage) return;
    if (editAltText.trim().length < 3) {
      setError("Alt text must be at least 3 characters.");
      return;
    }
    if (editOriginalName.trim().length < 1) {
      setError("Image name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError("");

    const finalName = editOriginalName.trim().endsWith(".webp") 
      ? editOriginalName.trim() 
      : `${editOriginalName.trim()}.webp`;

    const { error: updateError } = await supabase
      .from("article_images")
      .update({ 
        alt_text: editAltText.trim(),
        original_name: finalName
      })
      .eq("id", selectedImage.id);

    if (updateError) {
      setError(`Failed to update details: ${updateError.message}`);
      setIsSaving(false);
      return;
    }

    setImages((current) =>
      current.map((img) => (img.id === selectedImage.id ? { ...img, alt_text: editAltText.trim(), original_name: finalName } : img))
    );
    setIsSaving(false);
    closeManager();
  }

  async function deleteImage() {
    if (!selectedImage) return;
    if (!window.confirm("Are you sure you want to completely delete this image? It will be broken in any articles that use it.")) return;

    setIsDeleting(true);
    setError("");

    // 1. Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("article-images")
      .remove([selectedImage.storage_path]);

    if (storageError) {
      setError(`Failed to delete file from storage: ${storageError.message}`);
      setIsDeleting(false);
      return;
    }

    // 2. Delete from Database
    const { error: dbError } = await supabase
      .from("article_images")
      .delete()
      .eq("id", selectedImage.id);

    if (dbError) {
      setError(`Failed to delete record: ${dbError.message}`);
      setIsDeleting(false);
      return;
    }

    setImages((current) => current.filter((img) => img.id !== selectedImage.id));
    setIsDeleting(false);
    closeManager();
  }

  function closeUpload() {
    if (isUploading || isPreparing) return;
    setIsUploadOpen(false);
    setPendingUpload(null);
    setUploadName("");
    setUploadAlt("");
    setUploadError("");
  }

  async function prepareUpload(file: File | undefined) {
    if (!file) return;
    setIsPreparing(true);
    setUploadError("");
    try {
      const prepared = await compressToWebp(file);
      setPendingUpload(prepared);
      setUploadName(prepared.originalName.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "The image could not be prepared.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleUpload() {
    if (!pendingUpload) return;
    if (uploadAlt.trim().length < 3) {
      setUploadError("Add image alt text with at least 3 characters before uploading.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    const folder = new Intl.DateTimeFormat("en-CA").format(new Date()).replaceAll("-", "/");
    const finalName = uploadName.trim() || pendingUpload.originalName.replace(/\.[^.]+$/, "");
    const safeName = slugify(finalName) || "gallery-upload";
    const storagePath = `${folder}/${Date.now()}-${safeName}.webp`;

    const { error: storageError } = await supabase.storage
      .from("article-images")
      .upload(storagePath, pendingUpload.blob, {
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
    const { data, error: dbError } = await supabase
      .from("article_images")
      .insert({
        alt_text: uploadAlt.trim(),
        height: pendingUpload.height,
        mime_type: "image/webp",
        original_name: finalName + ".webp",
        public_url: publicUrlData.publicUrl,
        size_bytes: pendingUpload.blob.size,
        storage_path: storagePath,
        width: pendingUpload.width,
      })
      .select()
      .single();

    if (dbError) {
      setUploadError(`Database record failed: ${dbError.message}`);
      setIsUploading(false);
      return;
    }

    setImages((current) => [data, ...current]);
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
            <h1 id="page-title">Image Gallery</h1>
            <p>Manage all uploaded images across your articles.</p>
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
              placeholder="Search images by name or alt text..."
              value={search}
              style={{ width: "300px" }}
            />
            <button className="primary-button" onClick={() => setIsUploadOpen(true)} type="button">
              <span aria-hidden="true">＋</span> Upload Image
            </button>
          </div>
        </header>

        {error && !selectedImage && (
          <div className="banner error-banner" style={{ margin: "0 40px 20px" }}>
            <span aria-hidden="true">⚠️</span> {error}
          </div>
        )}

        <section className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel">
            <header className="panel-heading">
              <h2 id="gallery-heading">All Uploaded Images</h2>
              <p>Click any image to view details, edit its alt text, or delete it.</p>
            </header>
            
            <div className="gallery-page-content" style={{ padding: "0 24px 32px" }}>
              {isLoading ? (
                <p className="loading-state">Loading gallery...</p>
              ) : visibleImages.length > 0 ? (
                <div className="gallery-page-grid">
                  {visibleImages.map((image) => (
                    <button
                      aria-label={`Manage image: ${image.alt_text}`}
                      className="gallery-page-item"
                      key={image.id}
                      onClick={() => openManager(image)}
                      type="button"
                    >
                      <div className="gallery-page-thumb" style={{ backgroundImage: `url("${image.public_url}")` }} />
                      <div className="gallery-page-item-info">
                        <strong>{image.original_name}</strong>
                        <small>{image.width} × {image.height}</small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span aria-hidden="true">🖼️</span>
                  <h3>No images found</h3>
                  <p>{search ? "Try adjusting your search terms." : "Images uploaded to articles will appear here."}</p>
                </div>
              )}
            </div>
          </article>
        </section>
      </section>

      {selectedImage && (
        <div className="image-manager-backdrop" onMouseDown={closeManager} role="presentation">
          <section
            aria-labelledby="manager-title"
            aria-modal="true"
            className="image-manager-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
          >
            <header className="manager-header">
              <h2 id="manager-title">Manage Image</h2>
              <button aria-label="Close" className="close-button" onClick={closeManager} type="button">×</button>
            </header>

            <div className="manager-body">
              {error && <p className="form-error composer-error" role="alert">{error}</p>}
              
              <div className="manager-image-preview">
                <img alt={selectedImage.alt_text} src={selectedImage.public_url} />
              </div>
              
              <div className="manager-metadata">
                <p><strong>Dimensions:</strong> {selectedImage.width} × {selectedImage.height} pixels</p>
                <p><strong>Size:</strong> {formatBytes(selectedImage.size_bytes)}</p>
                <p><strong>Uploaded:</strong> {new Date(selectedImage.created_at).toLocaleString()}</p>
              </div>

              <div className="field full-field manager-edit-field" style={{ marginBottom: "16px" }}>
                <label htmlFor="edit-original-name">Image name <b>*</b></label>
                <input
                  id="edit-original-name"
                  maxLength={180}
                  onChange={(e) => setEditOriginalName(e.target.value)}
                  value={editOriginalName}
                />
              </div>

              <div className="field full-field manager-edit-field">
                <label htmlFor="edit-alt-text">Image alt text <b>*</b></label>
                <textarea
                  id="edit-alt-text"
                  maxLength={180}
                  onChange={(e) => setEditAltText(e.target.value)}
                  rows={3}
                  value={editAltText}
                />
              </div>
            </div>

            <footer className="manager-actions">
              <button
                className="secondary-button danger-button"
                disabled={isDeleting || isSaving}
                onClick={deleteImage}
                type="button"
              >
                {isDeleting ? "Deleting…" : "Delete Image"}
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
              <h2 id="upload-title">Upload Image</h2>
              <button aria-label="Close upload" className="close-button" disabled={isPreparing || isUploading} onClick={closeUpload} type="button">×</button>
            </header>
            
            <div className="manager-body">
              {uploadError && <p className="form-error" style={{ marginBottom: "16px" }}>{uploadError}</p>}
              
              <label 
                className={`upload-dropzone ${isDraggingUpload ? "drag-active" : ""}`}
                onDragOver={(e) => { e.preventDefault(); if (!isPreparing && !isUploading) setIsDraggingUpload(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingUpload(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingUpload(false);
                  if (isPreparing || isUploading) return;
                  const file = e.dataTransfer.files?.[0];
                  if (file) void prepareUpload(file);
                }}
                style={{ marginBottom: "24px" }}
              >
                <span className="upload-mark" aria-hidden="true">＋</span>
                <strong>{isPreparing ? "Preparing image…" : isDraggingUpload ? "Drop image to upload" : "Choose image file"}</strong>
                <small>JPG, PNG, GIF or WebP</small>
                <input accept="image/*" disabled={isPreparing || isUploading} onChange={(e) => void prepareUpload(e.target.files?.[0])} type="file" />
              </label>

              {pendingUpload && (
                <div className="manager-image-preview">
                  <img src={pendingUpload.previewUrl} alt="Preview" style={{ borderRadius: "4px", maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                </div>
              )}
              
              <div className="field full-field manager-edit-field" style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Image name *</label>
                <input 
                  maxLength={180} 
                  onChange={(e) => setUploadName(e.target.value)} 
                  value={uploadName}
                  disabled={isUploading || !pendingUpload}
                  placeholder={pendingUpload ? "Name this image" : "Select an image first"}
                />
              </div>
              <div className="field full-field manager-edit-field">
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Alt text *</label>
                <textarea 
                  maxLength={180} 
                  onChange={(e) => setUploadAlt(e.target.value)} 
                  placeholder={pendingUpload ? "Describe the image for accessibility" : "Select an image first"}
                  rows={3} 
                  value={uploadAlt} 
                  disabled={isUploading || !pendingUpload}
                />
              </div>
            </div>
            
            <footer className="manager-actions">
              <button className="secondary-button" disabled={isPreparing || isUploading} onClick={closeUpload} type="button">Cancel</button>
              <button 
                className="primary-button" 
                disabled={!pendingUpload || isPreparing || isUploading} 
                onClick={handleUpload} 
                type="button"
              >
                {isUploading ? "Uploading…" : "Upload"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
