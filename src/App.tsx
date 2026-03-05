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
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AuthenticatedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/feeds" element={<FeedManagement />} />
      <Route path="/sources" element={<SourcesView />} />
      <Route path="/feed/:id" element={<FeedDetail />} />
      <Route path="/alerts" element={<AlertMonitoring />} />
      <Route path="/ransomlook" element={<RansomLook />} />
      <Route path="/group/:groupName" element={<GroupDashboard />} />
      <Route path="/activity" element={<ActivityLog />} />
      <Route path="/shodan" element={<ShodanSearch />} />
      <Route path="/software-inventory" element={<SoftwareInventory />} />
      <Route path="/scanner" element={<NetworkScanner />} />
      <Route path="/settings" element={<SettingsPage />} />
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
        <AuthenticatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
