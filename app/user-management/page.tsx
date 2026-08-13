"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../../lib/supabase";
import type { Database } from "../../../lib/database.types";

type Role = Database["public"]["Tables"]["roles"]["Row"];

export default function UserManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [timeFormat, setTimeFormat] = useState("default");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // File dropzone state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchRoles() {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (!error && data) {
        setRoles(data);
        if (data.length > 0) {
          setRoleId(data[0].id);
        }
      }
    }
    fetchRoles();
  }, []);

  // Password validation rules
  const hasMinLen = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumeric = /[0-9]/.test(password);
  const hasAlpha = /[a-zA-Z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const isPasswordValid = hasMinLen && hasLower && hasUpper && hasNumeric && hasAlpha && hasSpecial;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoSelected(e.dataTransfer.files[0]);
    }
  };

  const handlePhotoSelected = async (file: File) => {
    // Mock upload for now
    setPhotoUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setMessage({ type: "error", text: "Please ensure password meets all criteria." });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.from("users").insert({
      full_name: fullName,
      email: email,
      password_hash: "MOCK_HASHED_" + password, // Mocking
      role_id: roleId,
      time_format: timeFormat,
      profile_photo_url: photoUrl || null,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "User created successfully!" });
      setFullName("");
      setEmail("");
      setPassword("");
      setPhotoUrl("");
    }
    setIsSubmitting(false);
  };

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="dashboard" aria-labelledby="page-title">
        <header className="topbar">
          <div>
            <p className="eyebrow" style={{ textTransform: "uppercase" }}>Account Provisioning</p>
            <h1 id="page-title">Add New User</h1>
            <p>Manage system users, passwords, and assign roles.</p>
            <div className="database-badge">
              <span aria-hidden="true" />
              Shared database live
            </div>
          </div>
        </header>

        <div className="main-content" style={{ margin: "0 auto", maxWidth: "1440px" }}>
          {message && (
            <div style={{
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "24px",
              backgroundColor: message.type === "success" ? "#ECFDF5" : "#FEE2E2",
              color: message.type === "success" ? "#065F46" : "#991B1B",
            }}>
              {message.text}
            </div>
          )}

          <div className="panel" style={{ padding: "32px", maxWidth: "800px" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <label className="field">
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Name *</span>
                <input 
                  type="text" 
                  placeholder="Full name" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                  style={{ height: "48px", fontSize: "16px" }}
                />
              </label>

              <label className="field">
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Username (Email) *</span>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--slate)", fontSize: "18px" }}>✉</span>
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    style={{ height: "48px", fontSize: "16px", paddingLeft: "48px", width: "100%" }}
                  />
                </div>
              </label>

              <div>
                <label className="field" style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Password *</span>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--slate)", fontSize: "18px" }}>🔑</span>
                    <input 
                      type="password" 
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                      style={{ height: "48px", fontSize: "16px", paddingLeft: "48px", width: "100%" }}
                    />
                  </div>
                </label>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "var(--slate)" }}>
                  <div style={{ color: hasMinLen ? "var(--green)" : "inherit" }}>
                    <span style={{ marginRight: "6px" }}>{hasMinLen ? "✓" : "□"}</span> Minimum 8 characters
                  </div>
                  <div style={{ color: hasUpper ? "var(--green)" : "inherit" }}>
                    <span style={{ marginRight: "6px" }}>{hasUpper ? "✓" : "□"}</span> At least 1 uppercase letter
                  </div>
                  <div style={{ color: hasLower ? "var(--green)" : "inherit" }}>
                    <span style={{ marginRight: "6px" }}>{hasLower ? "✓" : "□"}</span> At least 1 lowercase letter
                  </div>
                  <div style={{ color: hasAlpha ? "var(--green)" : "inherit" }}>
                    <span style={{ marginRight: "6px" }}>{hasAlpha ? "✓" : "□"}</span> At least 1 alphabetic character
                  </div>
                  <div style={{ color: hasNumeric ? "var(--green)" : "inherit" }}>
                    <span style={{ marginRight: "6px" }}>{hasNumeric ? "✓" : "□"}</span> At least 1 numeric character
                  </div>
                  <div style={{ color: hasSpecial ? "var(--green)" : "inherit" }}>
                    <span style={{ marginRight: "6px" }}>{hasSpecial ? "✓" : "□"}</span> At least 1 special character
                  </div>
                </div>
              </div>

              <label className="field">
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Role *</span>
                <select 
                  required
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  style={{ height: "48px", fontSize: "16px", width: "100%" }}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Time Format preference</span>
                <select 
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value)}
                  style={{ height: "48px", fontSize: "16px", width: "100%" }}
                >
                  <option value="default">Use Global Default</option>
                  <option value="12h">12-hour (e.g. 02:30 PM)</option>
                  <option value="24h">24-hour (e.g. 14:30)</option>
                </select>
              </label>

              <div className="field">
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                  Profile Photo <span style={{ fontWeight: 400, color: "var(--slate-light)" }}>OPTIONAL</span>
                </span>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  style={{
                    border: `2px dashed ${isDragging ? "var(--blue)" : "var(--line)"}`,
                    borderRadius: "12px",
                    padding: "24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "24px",
                    backgroundColor: isDragging ? "var(--blue-light)" : "transparent",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ 
                    width: "80px", 
                    height: "80px", 
                    borderRadius: "50%", 
                    border: "1px solid var(--line)", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    backgroundColor: "var(--surface)",
                    overflow: "hidden",
                    flexShrink: 0
                  }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: "24px", color: "var(--slate)" }}>📷</span>
                    )}
                  </div>
                  <div>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="secondary-button" 
                      style={{ marginBottom: "8px" }}
                    >
                      Choose photo
                    </button>
                    <p style={{ fontSize: "12px", color: "var(--slate)" }}>Optional · JPG, PNG or WebP · automatically cropped and optimized</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    ref={fileInputRef} 
                    style={{ display: "none" }} 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoSelected(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <button 
                  className="primary-button" 
                  type="submit" 
                  disabled={isSubmitting || !isPasswordValid || !isEmailValid || !fullName.trim() || !roleId}
                  style={{ width: "100%", padding: "16px", fontSize: "16px", textTransform: "uppercase", letterSpacing: "1px" }}
                >
                  {isSubmitting ? "Creating..." : "↗ Create User"}
                </button>
              </div>

            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
