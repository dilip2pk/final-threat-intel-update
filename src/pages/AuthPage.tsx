import { useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, LogIn, UserPlus, ArrowLeft, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type AuthView = "login" | "signup" | "reset";

const AuthPage = forwardRef<HTMLDivElement>((_props, ref) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // If already logged in as admin, redirect to dashboard
  if (user && isAdmin) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/admin-login`,
        });
        if (error) throw error;
        toast({
          title: "Reset email sent",
          description: "Check your inbox for a password reset link.",
        });
        setView("login");
      } else if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Signed in as administrator" });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "The first user gets Admin role automatically." });
        navigate("/");
      }
    } catch (err: any) {
      toast({ title: "Authentication failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={ref} className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-mono">
            {view === "reset" ? "Reset Password" : "Admin Login"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {view === "login"
              ? "Sign in to manage the platform"
              : view === "signup"
              ? "Create an admin account"
              : "Enter your email to receive a reset link"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-lg bg-card p-6">
          {view === "signup" && (
            <div>
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              className="mt-1"
            />
          </div>
          {view !== "reset" && (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
          )}
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : view === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : view === "signup" ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {view === "login" ? "Sign In" : view === "signup" ? "Create Account" : "Send Reset Link"}
          </Button>
        </form>

        <div className="space-y-3 text-center">
          {view === "login" && (
            <p className="text-sm text-muted-foreground">
              <button onClick={() => setView("reset")} className="text-primary hover:underline font-medium">
                Forgot password?
              </button>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {view === "login" ? "Don't have an account?" : view === "signup" ? "Already have an account?" : "Remember your password?"}{" "}
            <button
              onClick={() => setView(view === "signup" ? "login" : view === "login" ? "signup" : "login")}
              className="text-primary hover:underline font-medium"
            >
              {view === "signup" ? "Sign In" : view === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
});

AuthPage.displayName = "AuthPage";

export default AuthPage;
