import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { Onboarding } from "@/components/Onboarding";
import { Dashboard } from "@/components/Dashboard";

function App() {
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  async function checkOnboarding() {
    try {
      const complete = await invoke<boolean>("is_onboarding_complete");
      setOnboardingComplete(complete);
    } catch (err) {
      console.error("Failed to check onboarding status:", err);
      setOnboardingComplete(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return onboardingComplete ? <Dashboard /> : <Onboarding />;
}

export default App;
