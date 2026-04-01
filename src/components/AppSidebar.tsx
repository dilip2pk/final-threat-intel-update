import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Rss, AlertTriangle, Settings, Shield, ChevronLeft, ChevronRight, Globe, Eye, Sun, Moon, ClipboardList, ClipboardCheck, Radar, Monitor, Crosshair, LogOut, LogIn, Calendar, FileText, Menu, X } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          {sidebarIconUrl ? (
            <img src={sidebarIconUrl} alt="Icon" className="h-7 w-7 shrink-0 rounded-md object-contain" />
          ) : logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-7 w-7 shrink-0 rounded-md object-contain" />
          ) : (
            <div className="h-7 w-7 shrink-0 rounded-md bg-primary/15 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
          )}
          {(!collapsed || isMobile) && (
            <span className="text-[13px] font-semibold text-foreground tracking-tight truncate">{appName}</span>
          )}
        </div>
        <div className="flex items-center">
          {(!collapsed || isMobile) && (
            <button onClick={toggleTheme} className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all" title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {collapsed && !isMobile && (
        <div className="flex justify-center py-1.5 border-b border-border/40">
          <button onClick={toggleTheme} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all" title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2 px-1.5 space-y-px overflow-y-auto scrollbar-thin">
        {(!collapsed || isMobile) && (
          <div className="px-2.5 pb-1.5 pt-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Navigation</span>
          </div>
        )}
        {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[12.5px] font-medium transition-all duration-150 group relative",
              collapsed && !isMobile && "justify-center px-0",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            )}
            title={collapsed && !isMobile ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0 transition-colors" />
            {(!collapsed || isMobile) && <span>{item.label}</span>}
            {collapsed && !isMobile && (
              <div className="absolute left-full ml-1.5 px-2 py-1 bg-popover text-popover-foreground text-[11px] rounded-md shadow-md border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/40 bg-sidebar">
        {user ? (
          <>
            <div className={cn("px-2.5 py-2.5 border-b border-border/30", collapsed && !isMobile && "px-1.5")}>
              {(!collapsed || isMobile) ? (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-primary uppercase">
                      {user.email?.charAt(0) || "U"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-foreground font-medium truncate">{user.email}</div>
                    <span className="text-[9px] font-semibold text-primary/80 uppercase tracking-wide">{role || "user"}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center" title={user.email || ""}>
                    <span className="text-[10px] font-semibold text-primary uppercase">
                      {user.email?.charAt(0) || "U"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => { signOut(); navigate("/"); }}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all text-[12px]",
                collapsed && !isMobile && "justify-center px-0"
              )}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {(!collapsed || isMobile) && <span>Sign Out</span>}
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate("/admin-login")}
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-2 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all text-[12px]",
              collapsed && !isMobile && "justify-center px-0"
            )}
            title="Admin Login"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            {(!collapsed || isMobile) && <span>Admin Login</span>}
          </button>
        )}

        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 border-t border-border/30 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-sidebar border-b border-border/40 flex items-center px-3 gap-2.5 shadow-sm">
        <button onClick={() => setMobileOpen(true)} className="h-8 w-8 rounded-md flex items-center justify-center text-foreground hover:bg-accent/50 transition-all" aria-label="Open menu">
          <Menu className="h-4.5 w-4.5" />
        </button>
        {sidebarIconUrl ? (
          <img src={sidebarIconUrl} alt="Icon" className="h-6 w-6 shrink-0 rounded-md object-contain" />
        ) : logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-6 w-6 shrink-0 rounded-md object-contain" />
        ) : (
          <div className="h-6 w-6 shrink-0 rounded-md bg-primary/15 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <span className="text-[13px] font-semibold text-foreground tracking-tight truncate">{appName}</span>
        <div className="ml-auto">
          <button onClick={toggleTheme} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile slide-out sidebar */}
      <aside className={cn(
        "md:hidden fixed top-0 left-0 z-50 h-screen w-[240px] bg-sidebar flex flex-col shadow-2xl transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-border/40 bg-sidebar transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-[56px]" : "w-[200px]"
      )}>
        {sidebarContent(false)}
      </aside>
    </>
  );
}
