import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon3D } from "@/components/Icon3D";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const AuthModal = () => {
  const { authModalOpen, closeAuthModal, loginWithGoogle, loginWithEmail, isLoading } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finish = (name: string) => {
    toast({ title: t("auth.welcome", { name }) });
    setPassword("");
    setError(null);
    closeAuthModal();
  };

  const handleGoogle = async () => {
    try {
      finish((await loginWithGoogle()).name);
    } catch (err) {
      console.error("Google sign-in failed:", err);
      setError(t("auth.failed"));
    }
  };

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    try {
      finish((await loginWithEmail(email, password)).name);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "invalid-email"
          ? t("auth.invalidEmail")
          : code === "password-too-short"
            ? t("auth.passwordTooShort")
            : t("auth.failed"),
      );
    }
  };

  return (
    <Dialog
      open={authModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          closeAuthModal();
        }
      }}
    >
      <DialogContent className="sm:max-w-md glass-card">
        <DialogHeader className="items-center text-center space-y-3">
          <Icon3D name="logoDrops" className="h-14 w-14 animate-float" />
          <DialogTitle className="text-2xl">
            <span className="gradient-text">{t("auth.modalTitle")}</span>
          </DialogTitle>
          <DialogDescription>{t("auth.modalSubtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-white text-[#1f1f1f] hover:bg-gray-50 border-gray-300 dark:bg-white dark:hover:bg-gray-100"
            onClick={handleGoogle}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-5 w-5 me-3 animate-spin" /> : <span className="me-3"><GoogleIcon /></span>}
            {isLoading ? t("auth.signingIn") : t("auth.continueWithGoogle")}
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">{t("auth.email")}</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">{t("auth.password")}</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" variant="ocean" className="w-full" disabled={isLoading}>
              {t("auth.signInWithEmail")}
            </Button>
          </form>

          <Button type="button" variant="ghost" className="w-full" onClick={closeAuthModal}>
            {t("auth.continueAsGuest")}
          </Button>

          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>{t("auth.terms")}</p>
            <p>{t("auth.demoNote")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
