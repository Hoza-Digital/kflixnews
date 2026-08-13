"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";

type Role = Database["public"]["Tables"]["roles"]["Row"];

const AVAILABLE_PAGES = [
  "Dashboard",
  "New Article",
  "Articles",
  "Photo Gallery",
  "Video Gallery",
  "Comments",
  "User Management",
  "Settings",
];

const AVAILABLE_TASKS = [
  "Create Article",
  "Edit Article",
  "Delete Article",
  "Publish Article",
  "Upload Photo",
  "Delete Photo",
  "Add Video",
  "Edit Video",
  "Delete Video",
  "Manage Comments",
  "Manage Users",
  "Manage Settings",
];

export default function SettingsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [savedRoles, setSavedRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState("");
  const [activeMockRole, setActiveMockRole] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [modifiedRoles, setModifiedRoles] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Global Settings State
  const [siteTimezone, setSiteTimezone] = useState("UTC");
  const [siteTimeFormat, setSiteTimeFormat] = useState("24h");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchSettings();
    const storedRole = localStorage.getItem("active_role_id");
    if (storedRole) {
      setActiveMockRole(storedRole);
    }
  }, []);

  async function fetchSettings() {
    const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
    if (!error && data) {
      setSiteTimezone(data.timezone);
      setSiteTimeFormat(data.time_format);
    }
  }

  async function fetchRoles() {
    setIsLoading(true);
    const { data, error } = await supabase.from("roles").select("*").order("created_at", { ascending: true });
    
    if (error) {
      console.error(error);
      setError("Failed to fetch roles.");
    } else {
      setRoles(data || []);
      setSavedRoles(data || []);
      if (data && data.length > 0 && !selectedRoleId) {
        setSelectedRoleId(data[0].id);
      }
    }
    setIsLoading(false);
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setError("");
    const { data, error } = await supabase
      .from("roles")
      .insert({ name: newRoleName.trim(), can_see_pages: [], can_create_roles: [], can_delete_roles: [], can_edit_roles: [], job_tasks: [] })
      .select()
      .single();

    if (error) {
      console.error(error);
      setError(`Failed to create role: ${error.message}`);
    } else if (data) {
      let updatedActiveRole = null;
      if (activeMockRole) {
        const activeRoleObj = roles.find((r) => r.id === activeMockRole);
        if (activeRoleObj) {
          updatedActiveRole = {
            ...activeRoleObj,
            can_create_roles: Array.from(new Set([...(activeRoleObj.can_create_roles || []), data.id])),
            can_delete_roles: Array.from(new Set([...(activeRoleObj.can_delete_roles || []), data.id])),
            can_edit_roles: Array.from(new Set([...(activeRoleObj.can_edit_roles || []), data.id]))
          };
          
          await supabase.from("roles").update({
            can_create_roles: updatedActiveRole.can_create_roles,
            can_delete_roles: updatedActiveRole.can_delete_roles,
            can_edit_roles: updatedActiveRole.can_edit_roles
          }).eq("id", activeMockRole);
        }
      }

      const nextRoles = roles.map(r => r.id === activeMockRole && updatedActiveRole ? updatedActiveRole : r);
      const nextSavedRoles = savedRoles.map(r => r.id === activeMockRole && updatedActiveRole ? updatedActiveRole : r);
      
      setRoles([...nextRoles, data]);
      setSavedRoles([...nextSavedRoles, data]);
      setNewRoleName("");
      setSelectedRoleId(data.id);
    }
  }

  function togglePagePermission(roleId: string, pageName: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const pages = role.can_see_pages || [];
    const hasPage = pages.includes(pageName);
    const newPages = hasPage ? pages.filter((p) => p !== pageName) : [...pages, pageName];
    setRoles(roles.map((r) => (r.id === roleId ? { ...r, can_see_pages: newPages } : r)));
    setModifiedRoles((prev) => ({ ...prev, [roleId]: true }));
  }

  function toggleRoleCreationPermission(roleId: string, targetRoleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const creates = role.can_create_roles || [];
    const hasRole = creates.includes(targetRoleId);
    const newRoles = hasRole ? creates.filter((id) => id !== targetRoleId) : [...creates, targetRoleId];
    setRoles(roles.map((r) => (r.id === roleId ? { ...r, can_create_roles: newRoles } : r)));
    setModifiedRoles((prev) => ({ ...prev, [roleId]: true }));
  }

  function toggleRoleDeletionPermission(roleId: string, targetRoleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const deletes = role.can_delete_roles || [];
    const hasRole = deletes.includes(targetRoleId);
    const newRoles = hasRole ? deletes.filter((id) => id !== targetRoleId) : [...deletes, targetRoleId];
    setRoles(roles.map((r) => (r.id === roleId ? { ...r, can_delete_roles: newRoles } : r)));
    setModifiedRoles((prev) => ({ ...prev, [roleId]: true }));
  }

  function toggleRoleEditPermission(roleId: string, targetRoleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const edits = role.can_edit_roles || [];
    const hasRole = edits.includes(targetRoleId);
    const newRoles = hasRole ? edits.filter((id) => id !== targetRoleId) : [...edits, targetRoleId];
    setRoles(roles.map((r) => (r.id === roleId ? { ...r, can_edit_roles: newRoles } : r)));
    setModifiedRoles((prev) => ({ ...prev, [roleId]: true }));
  }

  function toggleJobTaskPermission(roleId: string, taskName: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const tasks = role.job_tasks || [];
    const hasTask = tasks.includes(taskName);
    const newTasks = hasTask ? tasks.filter((t) => t !== taskName) : [...tasks, taskName];
    setRoles(roles.map((r) => (r.id === roleId ? { ...r, job_tasks: newTasks } : r)));
    setModifiedRoles((prev) => ({ ...prev, [roleId]: true }));
  }

  async function handleSaveChanges(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    setIsSaving(true);
    const { error } = await supabase.from("roles").update({
      can_see_pages: role.can_see_pages,
      job_tasks: role.job_tasks,
      can_create_roles: role.can_create_roles,
      can_delete_roles: role.can_delete_roles,
      can_edit_roles: role.can_edit_roles,
    }).eq("id", roleId);

    if (error) {
      console.error(error);
      setError(`Failed to save changes: ${error.message}`);
    } else {
      setSavedRoles(savedRoles.map(r => r.id === roleId ? role : r));
      setModifiedRoles((prev) => ({ ...prev, [roleId]: false }));
      if (roleId === activeMockRole) {
        window.dispatchEvent(new Event("roleChanged"));
      }
    }
    setIsSaving(false);
  }

  async function handleDeleteRole(roleId: string) {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    
    // Optimistic update
    const prevRoles = [...roles];
    const prevSaved = [...savedRoles];
    setRoles(roles.filter((r) => r.id !== roleId));
    setSavedRoles(savedRoles.filter((r) => r.id !== roleId));
    if (selectedRoleId === roleId) {
      setSelectedRoleId(null);
    }
    if (activeMockRole === roleId) {
      setActiveMockRole("");
      localStorage.removeItem("active_role_id");
      window.dispatchEvent(new Event("roleChanged"));
    }

    const { error } = await supabase.from("roles").delete().eq("id", roleId);
    if (error) {
      console.error(error);
      setError(`Failed to delete role: ${error.message}`);
      setRoles(prevRoles); // Revert on error
      setSavedRoles(prevSaved);
    }
  }

  function handleMockRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setActiveMockRole(val);
    if (val) {
      localStorage.setItem("active_role_id", val);
    } else {
      localStorage.removeItem("active_role_id");
    }
    // Notify the sidebar to re-fetch permissions
    window.dispatchEvent(new Event("roleChanged"));
  }

  async function saveSettings() {
    setIsSavingSettings(true);
    setError("");
    const { error } = await supabase
      .from("site_settings")
      .upsert({ id: 1, timezone: siteTimezone, time_format: siteTimeFormat });
    if (error) {
      setError(`Failed to save global settings: ${error.message}`);
    } else {
      // Small visual feedback could be added, but alert is okay for now.
    }
    setIsSavingSettings(false);
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="dashboard" aria-labelledby="page-title">
        <header className="topbar">
          <div>
            <p className="eyebrow">Administration</p>
            <h1 id="page-title">Settings & Permissions</h1>
            <p>Manage roles, permissions, and global system settings.</p>
            <div className="database-badge">
              <span aria-hidden="true" />
              Shared database live
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label htmlFor="mockRole" style={{ fontSize: "14px", color: "var(--ink)", fontWeight: 500 }}>
              View Dashboard As:
            </label>
            <select 
              id="mockRole" 
              className="gallery-page-search"
              value={activeMockRole} 
              onChange={handleMockRoleChange}
              style={{ width: "200px" }}
            >
              <option value="">-- No Role (See All) --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </header>

        {activeMockRole && !savedRoles.find(r => r.id === activeMockRole)?.job_tasks?.includes("Manage Settings") ? (
          <div className="main-content" style={{ margin: "0 auto", maxWidth: "1440px" }}>
            <div style={{ padding: "64px 32px", backgroundColor: "white", borderRadius: "12px", border: "1px solid var(--line)", textAlign: "center" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)", marginBottom: "16px" }}>Access Denied</h2>
              <p style={{ color: "var(--slate)", fontSize: "16px" }}>
                Your current role does not have permission to view or manage settings. 
                Please use the dropdown above to switch to a role with the "Manage Settings" permission.
              </p>
            </div>
          </div>
        ) : (
          <div className="main-content" style={{ margin: "0 auto", maxWidth: "1440px" }}>
            {error && (
            <div style={{ padding: "16px", backgroundColor: "#FEE2E2", color: "#991B1B", borderRadius: "8px", marginBottom: "24px" }}>
              {error}
            </div>
          )}

          <section className="panel" style={{ padding: "24px", marginBottom: "40px", maxWidth: "1100px" }}>
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 600 }}>Create New Role</h2>
            <form onSubmit={handleCreateRole} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                className="gallery-page-search"
                style={{ flex: 1, maxWidth: "300px", margin: 0 }}
                placeholder="Role name (e.g. Moderator)"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                disabled={isLoading}
              />
              <button className="primary-button" type="submit" disabled={isLoading || !newRoleName.trim()}>
                Create Role
              </button>
            </form>
          </section>

          <section style={{ maxWidth: "1100px" }}>
            <h2 style={{ marginBottom: "24px", fontSize: "20px", fontWeight: 600 }}>Role Permissions</h2>
            
            {isLoading && roles.length === 0 ? (
              <p>Loading roles...</p>
            ) : (
              <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
                
                {/* Role List Menu */}
                <div className="panel" style={{ width: "260px", padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "8px 12px", marginBottom: "4px" }}>
                    Select Role
                  </h3>
                  {roles.map((role) => {
                    const activeRole = savedRoles.find(r => r.id === activeMockRole);
                    const canEdit = !activeRole || activeRole.can_edit_roles?.includes(role.id);
                    const canDelete = !activeRole || activeRole.can_delete_roles?.includes(role.id);
                    
                    if (!canEdit) return null;

                    return (
                      <div 
                        key={role.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center",
                          backgroundColor: selectedRoleId === role.id ? "var(--blue)" : "transparent",
                          boxShadow: selectedRoleId === role.id ? "0 8px 20px rgba(21, 101, 233, 0.2)" : "none",
                          borderRadius: "8px",
                        }}
                      >
                        <button
                          onClick={() => setSelectedRoleId(role.id)}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            padding: "10px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            color: selectedRoleId === role.id ? "white" : "var(--slate)",
                            fontWeight: selectedRoleId === role.id ? 600 : 400,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            fontSize: "15px"
                          }}
                        >
                          {role.name}
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(role.id);
                            }}
                            style={{
                              padding: "8px 12px",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: selectedRoleId === role.id ? "rgba(255, 255, 255, 0.7)" : "var(--slate)",
                              opacity: 0.6,
                              transition: "all 0.2s"
                            }}
                            title="Delete role"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = "1";
                              e.currentTarget.style.color = selectedRoleId === role.id ? "white" : "var(--ink)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = "0.6";
                              e.currentTarget.style.color = selectedRoleId === role.id ? "rgba(255, 255, 255, 0.7)" : "var(--slate)";
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {roles.length === 0 && (
                    <div style={{ padding: "12px", color: "var(--slate)", fontSize: "14px" }}>No roles found.</div>
                  )}
                </div>

                {/* Role Permissions Editor */}
                <div style={{ flex: 1 }}>
                  {roles.filter(r => r.id === selectedRoleId).map((role) => (
                    <div key={role.id} className="panel" style={{ padding: "32px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "22px", fontWeight: 600, margin: 0 }}>
                          {role.name} Permissions
                        </h3>
                        {modifiedRoles[role.id] && (
                          <button 
                            className="primary-button" 
                            onClick={() => handleSaveChanges(role.id)} 
                            disabled={isSaving}
                            style={{ padding: "8px 16px", fontSize: "14px" }}
                          >
                            {isSaving ? "Saving..." : "Save Changes"}
                          </button>
                        )}
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "24px" }}>
                        {/* Page Visibility Permissions */}
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px", minHeight: "44px" }}>
                            Visible Pages (Sidebar)
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {AVAILABLE_PAGES.map((page) => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              const canGrant = !activeRole || activeRole.can_see_pages?.includes(page);
                              if (!canGrant) return null;
                              
                              return (
                                <label key={page} style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", minHeight: "44px" }}>
                                  <input 
                                    type="checkbox"
                                    checked={role.can_see_pages?.includes(page) || false}
                                    onChange={() => togglePagePermission(role.id, page)}
                                    style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, marginTop: "2px" }}
                                  />
                                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: "1.4" }}>{page}</span>
                                </label>
                              );
                            })}
                            {AVAILABLE_PAGES.filter(page => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              return !activeRole || activeRole.can_see_pages?.includes(page);
                            }).length === 0 && (
                              <span style={{ color: "var(--slate)", fontSize: "14px" }}>No permission to grant.</span>
                            )}
                          </div>
                        </div>

                        {/* Job Tasks Permissions */}
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px", minHeight: "44px" }}>
                            Job Tasks
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {AVAILABLE_TASKS.map((task) => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              const canGrant = !activeRole || activeRole.job_tasks?.includes(task);
                              if (!canGrant) return null;
                              
                              return (
                                <label key={task} style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", minHeight: "44px" }}>
                                  <input 
                                    type="checkbox"
                                    checked={role.job_tasks?.includes(task) || false}
                                    onChange={() => toggleJobTaskPermission(role.id, task)}
                                    style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, marginTop: "2px" }}
                                  />
                                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: "1.4" }}>{task}</span>
                                </label>
                              );
                            })}
                            {AVAILABLE_TASKS.filter(task => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              return !activeRole || activeRole.job_tasks?.includes(task);
                            }).length === 0 && (
                              <span style={{ color: "var(--slate)", fontSize: "14px" }}>No permission to grant.</span>
                            )}
                          </div>
                        </div>

                        {/* Role Creation Permissions */}
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px", minHeight: "44px" }}>
                            Can Register Roles
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {roles.map((targetRole) => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              const canGrant = !activeRole || activeRole.can_create_roles?.includes(targetRole.id);
                              if (!canGrant) return null;
                              
                              return (
                                <label key={targetRole.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", minHeight: "44px" }}>
                                  <input 
                                    type="checkbox"
                                    checked={role.can_create_roles?.includes(targetRole.id) || false}
                                    onChange={() => toggleRoleCreationPermission(role.id, targetRole.id)}
                                    style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, marginTop: "2px" }}
                                  />
                                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: "1.4" }}>{targetRole.name}</span>
                                </label>
                              );
                            })}
                            {roles.filter(targetRole => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              return !activeRole || activeRole.can_create_roles?.includes(targetRole.id);
                            }).length === 0 && (
                              <span style={{ color: "var(--slate)", fontSize: "14px" }}>No permission to grant.</span>
                            )}
                          </div>
                        </div>

                        {/* Role Deletion Permissions */}
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px", minHeight: "44px" }}>
                            Can Delete Roles
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {roles.map((targetRole) => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              const canGrant = !activeRole || activeRole.can_delete_roles?.includes(targetRole.id);
                              if (!canGrant) return null;
                              
                              return (
                                <label key={targetRole.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", minHeight: "44px" }}>
                                  <input 
                                    type="checkbox"
                                    checked={role.can_delete_roles?.includes(targetRole.id) || false}
                                    onChange={() => toggleRoleDeletionPermission(role.id, targetRole.id)}
                                    style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, marginTop: "2px" }}
                                  />
                                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: "1.4" }}>{targetRole.name}</span>
                                </label>
                              );
                            })}
                            {roles.filter(targetRole => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              return !activeRole || activeRole.can_delete_roles?.includes(targetRole.id);
                            }).length === 0 && (
                              <span style={{ color: "var(--slate)", fontSize: "14px" }}>No permission to grant.</span>
                            )}
                          </div>
                        </div>

                        {/* Role Edit Permissions */}
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px", minHeight: "44px" }}>
                            Can Edit Roles
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {roles.map((targetRole) => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              const canGrant = !activeRole || activeRole.can_edit_roles?.includes(targetRole.id);
                              if (!canGrant) return null;
                              
                              return (
                                <label key={targetRole.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", minHeight: "44px" }}>
                                  <input 
                                    type="checkbox"
                                    checked={role.can_edit_roles?.includes(targetRole.id) || false}
                                    onChange={() => toggleRoleEditPermission(role.id, targetRole.id)}
                                    style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, marginTop: "2px" }}
                                  />
                                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: "1.4" }}>{targetRole.name}</span>
                                </label>
                              );
                            })}
                            {roles.filter(targetRole => {
                              const activeRole = savedRoles.find(r => r.id === activeMockRole);
                              return !activeRole || activeRole.can_edit_roles?.includes(targetRole.id);
                            }).length === 0 && (
                              <span style={{ color: "var(--slate)", fontSize: "14px" }}>No permission to grant.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {!selectedRoleId && roles.length > 0 && (
                    <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--slate)" }}>
                      Please select a role from the left menu to edit its permissions.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* GLOBAL SETTINGS SECTION */}
          <section className="settings-section" style={{ marginTop: "40px" }}>
            <header className="section-header" style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--ink)" }}>Global Settings</h2>
              <p style={{ fontSize: "14px", color: "var(--slate)", marginTop: "4px" }}>
                Configure site-wide preferences like timezone and time formats.
              </p>
            </header>
            
            <div className="panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div className="field" style={{ flex: 1, minWidth: "250px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Timezone</label>
                  <select 
                    value={siteTimezone}
                    onChange={(e) => setSiteTimezone(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "white", color: "var(--ink)", fontSize: "15px" }}
                  >
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="Etc/GMT+12">(GMT-12:00) International Date Line West</option>
                    <option value="Pacific/Midway">(GMT-11:00) Midway Island, Samoa</option>
                    <option value="Pacific/Honolulu">(GMT-10:00) Hawaii</option>
                    <option value="America/Anchorage">(GMT-09:00) Alaska</option>
                    <option value="America/Los_Angeles">(GMT-08:00) Pacific Time (US & Canada)</option>
                    <option value="America/Tijuana">(GMT-08:00) Tijuana, Baja California</option>
                    <option value="America/Denver">(GMT-07:00) Mountain Time (US & Canada)</option>
                    <option value="America/Phoenix">(GMT-07:00) Arizona</option>
                    <option value="America/Mazatlan">(GMT-07:00) Chihuahua, La Paz, Mazatlan</option>
                    <option value="America/Chicago">(GMT-06:00) Central Time (US & Canada)</option>
                    <option value="America/Mexico_City">(GMT-06:00) Guadalajara, Mexico City, Monterrey</option>
                    <option value="America/Regina">(GMT-06:00) Saskatchewan</option>
                    <option value="America/Guatemala">(GMT-06:00) Central America</option>
                    <option value="America/New_York">(GMT-05:00) Eastern Time (US & Canada)</option>
                    <option value="America/Bogota">(GMT-05:00) Bogota, Lima, Quito</option>
                    <option value="America/Indiana/Indianapolis">(GMT-05:00) Indiana (East)</option>
                    <option value="America/Halifax">(GMT-04:00) Atlantic Time (Canada)</option>
                    <option value="America/Caracas">(GMT-04:00) Caracas, La Paz</option>
                    <option value="America/Santiago">(GMT-04:00) Santiago</option>
                    <option value="America/St_Johns">(GMT-03:30) Newfoundland</option>
                    <option value="America/Sao_Paulo">(GMT-03:00) Brasilia</option>
                    <option value="America/Argentina/Buenos_Aires">(GMT-03:00) Buenos Aires, Georgetown</option>
                    <option value="America/Montevideo">(GMT-03:00) Montevideo</option>
                    <option value="America/Noronha">(GMT-02:00) Mid-Atlantic</option>
                    <option value="Atlantic/Azores">(GMT-01:00) Azores</option>
                    <option value="Atlantic/Cape_Verde">(GMT-01:00) Cape Verde Is.</option>
                    <option value="Europe/London">(GMT+00:00) London, Edinburgh, Lisbon, Dublin</option>
                    <option value="Africa/Casablanca">(GMT+00:00) Casablanca, Monrovia</option>
                    <option value="Europe/Paris">(GMT+01:00) Paris, Rome, Berlin, Madrid</option>
                    <option value="Europe/Belgrade">(GMT+01:00) Belgrade, Bratislava, Budapest, Prague</option>
                    <option value="Europe/Brussels">(GMT+01:00) Brussels, Copenhagen, Amsterdam</option>
                    <option value="Africa/Algiers">(GMT+01:00) West Central Africa</option>
                    <option value="Europe/Athens">(GMT+02:00) Athens, Bucharest, Istanbul</option>
                    <option value="Africa/Cairo">(GMT+02:00) Cairo</option>
                    <option value="Asia/Jerusalem">(GMT+02:00) Jerusalem</option>
                    <option value="Africa/Harare">(GMT+02:00) Harare, Pretoria</option>
                    <option value="Europe/Moscow">(GMT+03:00) Moscow, St. Petersburg, Volgograd</option>
                    <option value="Asia/Kuwait">(GMT+03:00) Kuwait, Riyadh</option>
                    <option value="Africa/Nairobi">(GMT+03:00) Nairobi</option>
                    <option value="Asia/Baghdad">(GMT+03:00) Baghdad</option>
                    <option value="Asia/Tehran">(GMT+03:30) Tehran</option>
                    <option value="Asia/Dubai">(GMT+04:00) Abu Dhabi, Muscat, Dubai</option>
                    <option value="Asia/Baku">(GMT+04:00) Baku, Tbilisi, Yerevan</option>
                    <option value="Asia/Kabul">(GMT+04:30) Kabul</option>
                    <option value="Asia/Karachi">(GMT+05:00) Islamabad, Karachi, Tashkent</option>
                    <option value="Asia/Yekaterinburg">(GMT+05:00) Yekaterinburg</option>
                    <option value="Asia/Kolkata">(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi</option>
                    <option value="Asia/Colombo">(GMT+05:30) Sri Jayawardenepura</option>
                    <option value="Asia/Kathmandu">(GMT+05:45) Kathmandu</option>
                    <option value="Asia/Dhaka">(GMT+06:00) Astana, Dhaka</option>
                    <option value="Asia/Almaty">(GMT+06:00) Almaty, Novosibirsk</option>
                    <option value="Asia/Yangon">(GMT+06:30) Yangon (Rangoon)</option>
                    <option value="Asia/Jakarta">(GMT+07:00) Jakarta, Bangkok, Hanoi</option>
                    <option value="Asia/Krasnoyarsk">(GMT+07:00) Krasnoyarsk</option>
                    <option value="Asia/Shanghai">(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi</option>
                    <option value="Asia/Singapore">(GMT+08:00) Kuala Lumpur, Singapore</option>
                    <option value="Asia/Taipei">(GMT+08:00) Taipei</option>
                    <option value="Australia/Perth">(GMT+08:00) Perth</option>
                    <option value="Asia/Tokyo">(GMT+09:00) Osaka, Sapporo, Tokyo</option>
                    <option value="Asia/Seoul">(GMT+09:00) Seoul</option>
                    <option value="Asia/Yakutsk">(GMT+09:00) Yakutsk</option>
                    <option value="Australia/Adelaide">(GMT+09:30) Adelaide</option>
                    <option value="Australia/Darwin">(GMT+09:30) Darwin</option>
                    <option value="Australia/Brisbane">(GMT+10:00) Brisbane</option>
                    <option value="Australia/Sydney">(GMT+10:00) Canberra, Melbourne, Sydney</option>
                    <option value="Pacific/Guam">(GMT+10:00) Guam, Port Moresby</option>
                    <option value="Asia/Vladivostok">(GMT+10:00) Vladivostok</option>
                    <option value="Asia/Magadan">(GMT+11:00) Magadan, Solomon Is., New Caledonia</option>
                    <option value="Pacific/Auckland">(GMT+12:00) Auckland, Wellington</option>
                    <option value="Pacific/Fiji">(GMT+12:00) Fiji, Kamchatka, Marshall Is.</option>
                    <option value="Pacific/Apia">(GMT+13:00) Samoa</option>
                    <option value="Pacific/Tongatapu">(GMT+13:00) Nuku'alofa</option>
                    <option value="Pacific/Kiritimati">(GMT+14:00) Kiritimati</option>
                  </select>
                </div>

                <div className="field" style={{ flex: 1, minWidth: "250px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px", color: "var(--ink)" }}>Time Format</label>
                  <select 
                    value={siteTimeFormat}
                    onChange={(e) => setSiteTimeFormat(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "white", color: "var(--ink)", fontSize: "15px" }}
                  >
                    <option value="12h">12-hour (e.g. 02:30 PM)</option>
                    <option value="24h">24-hour (e.g. 14:30)</option>
                  </select>
                </div>
                
                <div style={{ flexShrink: 0 }}>
                  <button 
                    className="primary-button" 
                    onClick={saveSettings} 
                    disabled={isSavingSettings}
                    type="button"
                    style={{ height: "42px", padding: "0 24px" }}
                  >
                    {isSavingSettings ? "Saving..." : "Save Global Settings"}
                  </button>
                </div>
              </div>
            </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
