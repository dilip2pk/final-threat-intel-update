import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Rss, AlertTriangle, Settings, Shield, ChevronLeft, ChevronRight, Globe, Eye, Sun, Moon, ClipboardList, Radar, Monitor, Crosshair, LogOut, LogIn, Calendar, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: false },
  { to: "/feeds", icon: Rss, label: "Feed Sources", adminOnly: true },
  { to: "/sources", icon: Globe, label: "By Website", adminOnly: false },
  { to: "/alerts", icon: AlertTriangle, label: "Alert Monitor", adminOnly: false },
  { to: "/activity", icon: ClipboardList, label: "Activity Log", adminOnly: false },
  { to: "/ransomlook", icon: Eye, label: "RansomLook", adminOnly: false },
  { to: "/shodan", icon: Radar, label: "Shodan", adminOnly: false },
  { to: "/software-inventory", icon: Monitor, label: "Software Inv.", adminOnly: false },
  { to: "/scanner", icon: Crosshair, label: "Network Scan", adminOnly: false },
  { to: "/reports", icon: FileText, label: "Reports", adminOnly: false },
  { to: "/schedules", icon: Calendar, label: "Schedules", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Settings", adminOnly: true },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState("");
  const [sidebarIconUrl, setSidebarIconUrl] = useState("");
  const [appName, setAppName] = useState("ThreatIntel");

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "general").single().then(({ data }) => {
      if (data?.value) {
        const val = data.value as any;
        if (val.logoUrl) setLogoUrl(val.logoUrl);
        if (val.sidebarIconUrl) setSidebarIconUrl(val.sidebarIconUrl);
        if (val.appName) {
          setAppName(val.appName);
          document.title = val.appName;
        }
      }
    });
  }, []);

  return (
    <aside className={cn(
      "flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300 h-screen sticky top-0 shadow-lg",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Header with logo + theme toggle */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          {sidebarIconUrl ? (
            <img src={sidebarIconUrl} alt="Icon" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          ) : logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          )}
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground tracking-tight truncate">{appName}</span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={toggleTheme}
            className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Theme toggle when collapsed - show below header */}
      {collapsed && (
        <div className="flex justify-center py-2 border-b border-border/50">
          <button
            onClick={toggleTheme}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <div className="px-3 pb-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Navigation</span>
          </div>
        )}
        {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group relative",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors")} />
            {!collapsed && <span>{item.label}</span>}
            {/* Tooltip for collapsed state */}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs rounded-md shadow-md border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 bg-sidebar">
        {user ? (
          <>
            <div className={cn("px-3 py-3 border-b border-border/30", collapsed && "px-2")}>
              {!collapsed ? (
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary uppercase">
                      {user.email?.charAt(0) || "U"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-foreground font-medium truncate">{user.email}</div>
                    <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">{role || "user"}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center" title={user.email || ""}>
                    <span className="text-xs font-semibold text-primary uppercase">
                      {user.email?.charAt(0) || "U"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => { signOut(); navigate("/"); }}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all text-[13px]",
                collapsed && "justify-center px-0"
              )}
              title="Sign out"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate("/admin-login")}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-2.5 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all text-[13px]",
              collapsed && "justify-center px-0"
            )}
            title="Admin Login"
          >
            <LogIn className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Admin Login</span>}
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2.5 border-t border-border/30 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
