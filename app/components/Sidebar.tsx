"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";

const ALL_NAVIGATION = [
  ["Dashboard", "▦", "/admin"],
  ["New Article", "＋", "/admin/new-article"],
  ["Articles", "▤", "/admin/all-article"],
  ["Photo Gallery", "▧", "/admin/photo-gallery"],
  ["Video Gallery", "▶", "/admin/video-gallery"],
  ["Comments", "○", "/admin/comments"],
  ["User Management", "🛠", "/admin/user-management"],
  ["Settings", "⚙", "/admin/settings"],
];

export default function Sidebar() {
  const pathname = usePathname();
  const [visiblePages, setVisiblePages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadPermissions() {
      // 1. Check local storage for the currently active role id (mocking auth)
      const roleId = localStorage.getItem("active_role_id");
      
      if (!roleId) {
        // Fallback: If no role is selected, show everything by default or maybe nothing?
        // Let's show everything to not break the app for unconfigured clients
        setVisiblePages(ALL_NAVIGATION.map((n) => n[0]));
        setIsLoading(false);
        return;
      }

      // 2. Fetch role permissions from Supabase
      const { data, error } = await supabase
        .from("roles")
        .select("can_see_pages")
        .eq("id", roleId)
        .single();

      if (error || !data) {
        console.error("Failed to fetch role permissions", error);
        setVisiblePages(ALL_NAVIGATION.map((n) => n[0]));
      } else {
        setVisiblePages(data.can_see_pages || []);
      }
      setIsLoading(false);
    }

    loadPermissions();
    
    // Allow re-checking when localStorage changes via event listener
    const handleStorageChange = () => loadPermissions();
    window.addEventListener("storage", handleStorageChange);
    
    // Custom event for same-tab updates
    window.addEventListener("roleChanged", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("roleChanged", handleStorageChange);
    };
  }, []);

  // Use pathname to determine if active
  const getIsActive = (label: string, href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div>
        <Link className="brand" href="/" aria-label="Story dashboard home">
          STORY<span>.</span>
        </Link>
        {!isLoading && (
          <nav className="nav-list">
            {ALL_NAVIGATION.map(([label, icon, href]) => {
              if (!visiblePages.includes(label)) return null;
              const isActive = getIsActive(label, href);
              
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "nav-item active" : "nav-item"}
                  href={href}
                  key={label}
                >
                  <span className="nav-icon" aria-hidden="true">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <div>
        {currentTime && (
          <div className="nav-item" style={{ cursor: "default", marginBottom: "8px", background: "transparent" }}>
            <span className="nav-icon" aria-hidden="true" style={{ opacity: 0.7 }}>🕒</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>{currentTime.toLocaleTimeString().replace(/\./g, ':')}</h2>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 500, color: "var(--slate)" }}>{currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h3>
            </div>
          </div>
        )}
        <ThemeToggle />
        <div style={{ borderTop: "1px solid var(--soft-line)", paddingTop: "12px", marginTop: "8px" }}>
          <button className="nav-item" type="button" style={{ width: '100%', justifyContent: 'flex-start' }}>
            <span className="nav-icon" aria-hidden="true" style={{ opacity: 0.7 }}>↪</span> Log out
          </button>
        </div>
      </div>
    </aside>
  );
}

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  
  const isDark = theme === "dark";
  return (
    <button 
      className="nav-item" 
      style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px' }} 
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="nav-icon" aria-hidden="true" style={{ opacity: 0.7 }}>
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
