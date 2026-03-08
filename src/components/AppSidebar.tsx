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
      "flex flex-col border-r border-border bg-sidebar transition-all duration-300 h-screen sticky top-0",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        {sidebarIconUrl ? (
          <img src={sidebarIconUrl} alt="Icon" className="h-7 w-7 shrink-0 rounded object-contain" />
        ) : logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-7 w-7 shrink-0 rounded object-contain" />
        ) : (
          <Shield className="h-7 w-7 text-primary shrink-0" />
        )}
        {!collapsed && (
          <span className="text-lg font-bold text-foreground tracking-tight font-mono">{appName}</span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border">
        {/* Show user info + sign out when logged in */}
        {user ? (
          <>
            <div className="px-4 py-2 border-b border-border">
              {!collapsed && (
                <>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  <span className="text-[10px] font-medium text-primary uppercase">{role || "user"}</span>
                </>
              )}
            </div>
            <button
              onClick={() => { signOut(); navigate("/"); }}
              className="flex items-center gap-3 w-full px-5 py-3 text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm">Sign Out</span>}
            </button>
          </>
        ) : (
          /* Show admin login when not logged in */
          <button
            onClick={() => navigate("/admin-login")}
            className="flex items-center gap-3 w-full px-5 py-3 text-muted-foreground hover:text-primary transition-colors"
            title="Admin Login"
          >
            <LogIn className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-sm">Admin Login</span>}
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-5 py-3 text-muted-foreground hover:text-foreground transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="text-sm">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-3 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
