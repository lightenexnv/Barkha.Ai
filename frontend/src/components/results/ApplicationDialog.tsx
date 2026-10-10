import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError, type AssessmentResult, type SiteDetailsInput, type SubsidyScheme } from "@/lib/api";
import { saveBlob } from "@/lib/storage";

/** Collects the few details only the applicant knows, then downloads the filled-in form. */
export const ApplicationDialog = ({
  scheme,
  input,
  result,
  onClose,
}: {
  scheme: SubsidyScheme | null;
  input: SiteDetailsInput;
  result: AssessmentResult;
  onClose: () => void;
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: user?.name ?? "", phone: "", email: user?.email ?? "", address: "" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheme) return;
    setBusy(true);
    try {
      const file = await api.subsidyApplication(input, result, scheme.id, form);
      saveBlob(file.blob, file.filename);
      toast({ title: t("apply.ready"), description: t("apply.readyDesc") });
      onClose();
    } catch (error) {
      toast({
        title: t("apply.failed"),
        description: error instanceof ApiError && error.status === 0 ? t("roof.serverUnreachable") : t("apply.failedDesc"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={scheme !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t("apply.title")}
            </DialogTitle>
            <DialogDescription lang="en">{scheme?.name}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("apply.intro")}</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="apply-name">{t("apply.name")}</Label>
              <Input id="apply-name" value={form.name} onChange={set("name")} autoComplete="name" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apply-phone">{t("apply.phone")}</Label>
                <Input id="apply-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-email">{t("apply.email")}</Label>
                <Input id="apply-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apply-address">{t("apply.address")}</Label>
              <Input id="apply-address" value={form.address} onChange={set("address")} autoComplete="street-address" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("apply.blankNote")}</p>
          <DialogFooter>
            <Button type="submit" variant="ocean" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <FileText className="me-2 h-4 w-4" />}
              {t("apply.download")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
