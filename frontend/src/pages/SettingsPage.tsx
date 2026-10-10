import { BrandLogo } from "@/components/BrandLogo";
import { type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { Download, Eye, Globe, FileArchive, FileText, Loader2, LogIn, LogOut, PencilLine, Trash2 } from "lucide-react";
import { Header, UserAvatar } from "@/components/Header";
import { Icon3D } from "@/components/Icon3D";
import { DrawnIcon } from "@/components/DrawnIcon";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useReportDownload } from "@/components/ReportDownloadMenu";
import { getRecommendationColor, useRecommendationLabel } from "@/components/AssessmentResult";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  STATE_PRESETS,
  useSettings,
  useUnits,
  type UnitSystem,
} from "@/context/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/api";
import {
  deleteAssessment,
  entryVolume,
  useAssessmentHistory,
  type SavedAssessment,
} from "@/lib/historyService";
import { appStorageKeys, removeKey, saveBlob } from "@/lib/storage";

const TABS = ["language", "account", "history", "appearance"] as const;
type SettingsTab = (typeof TABS)[number];

const isTab = (value: string | null): value is SettingsTab => TABS.includes(value as SettingsTab);

const csvCell = (value: unknown) => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** One row of the saved-assessments table, with view, download and delete. */
const HistoryRow = ({ entry }: { entry: SavedAssessment }) => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const units = useUnits();
  const recommendationLabel = useRecommendationLabel();
  const { download, busyFormat } = useReportDownload();

  const reportData = {
    site: entry.site,
    // Satellite entries have no full result; send what the analysis produced
    result: entry.result ?? { assessment_id: entry.id, harvestable_volume: entry.satellite?.annual_harvest_m3 },
  };
  const savings = entry.result?.savings_analysis.annual_cost_savings;
  const system = entry.result?.recommended_option;

  const handleDelete = () => {
    if (!user) return;
    deleteAssessment(user.id, entry.id);
    toast({ title: t("settings.deleted") });
  };

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{entry.site.site_name}</p>
        {entry.site.latitude !== undefined && entry.site.longitude !== undefined && (
          <p className="text-xs text-muted-foreground">
            {entry.site.latitude.toFixed(4)}, {entry.site.longitude.toFixed(4)}
          </p>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {new Date(entry.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
      </TableCell>
      <TableCell>
        <Badge variant={system ? getRecommendationColor(system) : "secondary"} className="whitespace-nowrap">
          {system ? recommendationLabel(system) : t("rec.satellite")}
        </Badge>
      </TableCell>
      <TableCell className="text-end whitespace-nowrap">{units.volume(entryVolume(entry))}</TableCell>
      <TableCell className="text-end whitespace-nowrap">{savings !== undefined ? formatCurrency(savings) : "—"}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {entry.result ? (
            <Button
              size="icon"
              variant="ghost"
              title={t("common.view")}
              aria-label={t("common.view")}
              onClick={() => navigate(`/assess?view=${encodeURIComponent(entry.id)}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              title={t("settings.openInForm")}
              aria-label={t("settings.openInForm")}
              onClick={() => navigate(`/assess?prefill=${encodeURIComponent(entry.id)}`)}
            >
              <PencilLine className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" title={t("common.download")} aria-label={t("common.download")} disabled={busyFormat !== null}>
                {busyFormat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => download(reportData, "pdf")}>
                <Download className="h-4 w-4 me-2" />
                {t("result.downloadPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download(reportData, "txt")}>
                <FileText className="h-4 w-4 me-2" />
                {t("result.downloadTxt")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download(reportData, "zip")}>
                <FileArchive className="h-4 w-4 me-2" />
                {t("result.downloadZip")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                title={t("common.delete")}
                aria-label={t("common.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.deleteDesc", { name: entry.site.site_name })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  {t("common.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
};

const SettingsPage = () => {
  const { t, locale, setLanguage } = useLanguage();
  const { user, openAuthModal, logout } = useAuth();
  const { preferences, updatePreferences, resetPreferences } = useSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const history = useAssessmentHistory(user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: SettingsTab = isTab(requestedTab) ? requestedTab : "language";

  const setTab = (next: string) => setSearchParams(next === "language" ? {} : { tab: next }, { replace: true });

  const saved = () => toast({ title: t("settings.saved") });

  const applyState = (code: string) => {
    const preset = STATE_PRESETS.find((option) => option.code === code) ?? STATE_PRESETS[0];
    updatePreferences({ regionState: preset.code, waterTariff: preset.tariff });
    saved();
  };

  const exportCsv = () => {
    try {
      const header = [
        "id", "type", "created_at", "site_name", "latitude", "longitude", "roof_area_m2", "annual_rainfall_mm",
        "harvestable_volume_m3", "recommended_option", "total_cost_inr", "annual_savings_inr", "payback_years",
      ];
      const rows = history.map((entry) => [
        entry.id,
        entry.kind,
        entry.createdAt,
        entry.site.site_name,
        entry.site.latitude,
        entry.site.longitude,
        entry.satellite?.roof_area ?? entry.site.roof_area,
        entry.satellite?.annual_rainfall ?? entry.site.annual_rainfall,
        entryVolume(entry),
        entry.result?.recommended_option,
        entry.result?.cost_analysis.total_cost,
        entry.result?.savings_analysis.annual_cost_savings,
        entry.result?.payback_period,
      ]);
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
      // BOM so Excel opens UTF-8 site names correctly
      saveBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "barkha-ai-assessments.csv");
      toast({ title: t("settings.exported") });
    } catch (error) {
      console.error("CSV export failed:", error);
      toast({ title: t("report.failed"), variant: "destructive" });
    }
  };

  const wipeAll = () => {
    for (const key of appStorageKeys()) removeKey(key);
    logout();
    resetPreferences();
    setLanguage("en");
    setTheme("light");
    toast({ title: t("settings.wiped") });
  };

  const tabTriggers: { value: SettingsTab; label: string; icon: ReactNode }[] = [
    { value: "language", label: t("settings.tabLanguage"), icon: <Globe className="h-4 w-4" /> },
    { value: "account", label: t("settings.tabAccount"), icon: <DrawnIcon name="house" className="h-4 w-4" /> },
    { value: "history", label: t("settings.tabHistory"), icon: <DrawnIcon name="document" className="h-4 w-4" /> },
    { value: "appearance", label: t("settings.tabAppearance"), icon: <DrawnIcon name="cog" className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center shadow-water">
              <DrawnIcon name="cog" className="h-9 w-9 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl lg:text-4xl font-bold">
                <span className="gradient-text">{t("settings.title")}</span>
              </h1>
              <p className="text-muted-foreground">{t("settings.subtitle")}</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
              {tabTriggers.map((trigger) => (
                <TabsTrigger key={trigger.value} value={trigger.value} className="gap-2 whitespace-normal py-2">
                  {trigger.icon}
                  <span>{trigger.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab 1: Language & region */}
            <TabsContent value="language" className="space-y-6 animate-in fade-in-0 duration-300">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("settings.languageTitle")}</CardTitle>
                  <CardDescription>{t("settings.languageDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LanguageSwitcher className="max-w-sm" />
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("settings.stateTitle")}</CardTitle>
                  <CardDescription>{t("settings.stateDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={preferences.regionState || "default"} onValueChange={(value) => applyState(value === "default" ? "" : value)}>
                    <SelectTrigger className="max-w-sm">
                      <SelectValue placeholder={t("settings.statePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATE_PRESETS.map((option) => (
                        <SelectItem key={option.code || "default"} value={option.code || "default"}>
                          {option.code ? option.name : t("settings.stateDefault")} · ₹{option.tariff}/m³
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("settings.unitsTitle")}</CardTitle>
                  <CardDescription>{t("settings.unitsDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={preferences.units}
                    onValueChange={(value) => {
                      updatePreferences({ units: value as UnitSystem });
                      saved();
                    }}
                    className="max-w-sm space-y-2"
                  >
                    {(["metric", "imperial"] as const).map((system) => (
                      <Label
                        key={system}
                        htmlFor={`units-${system}`}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 font-normal hover:bg-muted/40"
                      >
                        <RadioGroupItem value={system} id={`units-${system}`} />
                        {t(system === "metric" ? "settings.metric" : "settings.imperial")}
                      </Label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Account */}
            <TabsContent value="account" className="space-y-6 animate-in fade-in-0 duration-300">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("settings.accountTitle")}</CardTitle>
                  <CardDescription>{t("settings.accountDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {user ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <UserAvatar user={user} className="h-16 w-16 text-xl" />
                        <div className="min-w-0">
                          <p className="text-lg font-semibold truncate">{user.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        {[
                          [t("settings.provider"), user.provider === "google" ? t("settings.providerGoogle") : t("settings.providerEmail")],
                          [t("settings.memberSince"), new Date(user.joinedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })],
                          [t("settings.session"), t("settings.sessionActive")],
                          [t("settings.savedCount"), String(history.length)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-muted/30 p-3">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="font-medium">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <Button variant="outline" onClick={() => { logout(); toast({ title: t("auth.signedOut") }); }}>
                        <LogOut className="h-4 w-4 me-2" />
                        {t("auth.signOut")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <BrandLogo variant="mark" markClassName="h-14 w-14" />
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">{t("settings.guestTitle")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.guestDesc")}</p>
                      </div>
                      <Button variant="ocean" onClick={openAuthModal}>
                        <LogIn className="h-4 w-4 me-2" />
                        {t("auth.signIn")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Saved assessments */}
            <TabsContent value="history" className="space-y-6 animate-in fade-in-0 duration-300">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon3D name="document" className="h-7 w-7" />
                    {t("settings.historyTitle")}
                  </CardTitle>
                  <CardDescription>{t("settings.historyDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {!user ? (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                      <p className="text-muted-foreground">{t("settings.historyGuest")}</p>
                      <Button variant="ocean" onClick={openAuthModal}>
                        <LogIn className="h-4 w-4 me-2" />
                        {t("auth.signIn")}
                      </Button>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                      <DrawnIcon name="droplets" className="h-12 w-12 text-primary/60" />
                      <p className="max-w-md text-muted-foreground">{t("settings.historyEmpty")}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("settings.colSite")}</TableHead>
                            <TableHead>{t("settings.colDate")}</TableHead>
                            <TableHead>{t("settings.colSystem")}</TableHead>
                            <TableHead className="text-end">{t("settings.colVolume")}</TableHead>
                            <TableHead className="text-end">{t("settings.colSavings")}</TableHead>
                            <TableHead className="text-end">{t("settings.colActions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((entry) => (
                            <HistoryRow key={entry.id} entry={entry} />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Appearance & data */}
            <TabsContent value="appearance" className="space-y-6 animate-in fade-in-0 duration-300">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("settings.appearanceTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="dark-mode">{t("settings.darkMode")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.darkModeDesc")}</p>
                    </div>
                    <Switch
                      id="dark-mode"
                      checked={resolvedTheme === "dark"}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="animations">{t("settings.animations")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.animationsDesc")}</p>
                    </div>
                    <Switch
                      id="animations"
                      checked={preferences.animations}
                      onCheckedChange={(checked) => updatePreferences({ animations: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("settings.dataTitle")}</CardTitle>
                  <CardDescription>{t("settings.dataDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportCsv} disabled={!user}>
                      <Download className="h-4 w-4 me-2" />
                      {t("settings.exportCsv")}
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/40 pt-4">
                    <p className="text-sm text-muted-foreground">{t("settings.wipeDataDesc")}</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="shrink-0">
                          <Trash2 className="h-4 w-4 me-2" />
                          {t("settings.wipeData")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("settings.wipeTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("settings.wipeConfirm")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={wipeAll}
                          >
                            {t("settings.wipeData")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
