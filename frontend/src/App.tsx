import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthModal } from "@/components/AuthModal";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { SettingsProvider } from "@/context/SettingsContext";
import Dashboard from "./pages/Dashboard";
import AssessmentPage from "./pages/AssessmentPage";
import SatelliteAnalysisPage from "./pages/SatelliteAnalysisPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="barkha_theme" disableTransitionOnChange>
      <LanguageProvider>
        <SettingsProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AuthModal />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/assess" element={<AssessmentPage />} />
                  <Route path="/satellite" element={<SatelliteAnalysisPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
