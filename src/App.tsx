import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import FeedManagement from "./pages/FeedManagement";
import FeedDetail from "./pages/FeedDetail";
import AlertMonitoring from "./pages/AlertMonitoring";
import SettingsPage from "./pages/SettingsPage";
import SourcesView from "./pages/SourcesView";
import RansomLook from "./pages/RansomLook";
import GroupDashboard from "./pages/GroupDashboard";
import ActivityLog from "./pages/ActivityLog";
import ShodanSearch from "./pages/ShodanSearch";
import SoftwareInventory from "./pages/SoftwareInventory";
import NetworkScanner from "./pages/NetworkScanner";
import AuthPage from "./pages/AuthPage";
import ScheduleManager from "./pages/ScheduleManager";
import Reports from "./pages/Reports";
import ThreatHunt from "./pages/ThreatHunt";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/sources" element={<SourcesView />} />
      <Route path="/feed/:id" element={<FeedDetail />} />
      <Route path="/alerts" element={<AlertMonitoring />} />
      <Route path="/ransomlook" element={<RansomLook />} />
      <Route path="/group/:groupName" element={<GroupDashboard />} />
      <Route path="/activity" element={<ActivityLog />} />
      <Route path="/shodan" element={<ShodanSearch />} />
      <Route path="/software-inventory" element={<SoftwareInventory />} />
      <Route path="/scanner" element={<NetworkScanner />} />

      {/* Admin login page */}
      <Route path="/admin-login" element={<AuthPage />} />

      {/* Admin-only routes */}
      <Route path="/feeds" element={<AdminRoute><FeedManagement /></AdminRoute>} />
      <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
      <Route path="/schedules" element={<AdminRoute><ScheduleManager /></AdminRoute>} />
      <Route path="/reports" element={<Reports />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
