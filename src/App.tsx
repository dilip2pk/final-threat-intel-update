import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import FeedManagement from "./pages/FeedManagement";
import FeedDetail from "./pages/FeedDetail";
import AlertMonitoring from "./pages/AlertMonitoring";
import SettingsPage from "./pages/SettingsPage";
import SourcesView from "./pages/SourcesView";
import RansomLook from "./pages/RansomLook";
import GroupDashboard from "./pages/GroupDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/feeds" element={<FeedManagement />} />
          <Route path="/sources" element={<SourcesView />} />
          <Route path="/feed/:id" element={<FeedDetail />} />
          <Route path="/alerts" element={<AlertMonitoring />} />
          <Route path="/ransomlook" element={<RansomLook />} />
          <Route path="/group/:groupName" element={<GroupDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
