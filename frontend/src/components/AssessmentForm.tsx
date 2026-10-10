import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, Droplets, Loader2 } from "lucide-react";
import { DrawnIcon } from "@/components/DrawnIcon";
import { useToast } from "@/hooks/use-toast";
import { api, SiteDetailsInput, AssessmentResult, ROOF_MATERIALS, ROOF_CONDITIONS, SOIL_TYPES } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { buildAssessmentEntry, saveAssessment } from "@/lib/historyService";
import type { TranslationKey } from "@/lib/i18n";

type Translate = (key: TranslationKey) => string;

const buildSchema = (t: Translate) =>
  z.object({
    site_name: z.string().trim().min(2, t("val.siteName")),
    latitude: z.number().min(-90, t("val.latitude")).max(90, t("val.latitude")),
    longitude: z.number().min(-180, t("val.longitude")).max(180, t("val.longitude")),
    roof_area: z.number().min(1, t("val.roofArea")),
    roof_material: z.enum(ROOF_MATERIALS),
    roof_condition: z.enum(ROOF_CONDITIONS),
    soil_type: z.enum(SOIL_TYPES),
    annual_rainfall: z.number().min(0, t("val.rainfall")),
    water_demand: z.number().min(1, t("val.demand")),
  });

export type AssessmentFormData = z.infer<ReturnType<typeof buildSchema>>;

interface AssessmentFormProps {
  onSuccess?: (result: AssessmentResult, input: SiteDetailsInput, savedToAccount: boolean) => void;
  /** Values to start from, e.g. a saved satellite analysis. */
  initialValues?: Partial<AssessmentFormData>;
}

export const AssessmentForm = ({ onSuccess, initialValues }: AssessmentFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { preferences } = useSettings();
  const schema = useMemo(() => buildSchema(t), [t]);

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      site_name: "",
      latitude: 0,
      longitude: 0,
      roof_area: 0,
      roof_material: preferences.defaultRoofMaterial,
      roof_condition: "good",
      soil_type: preferences.defaultSoilType,
      annual_rainfall: 0,
      water_demand: 0,
      ...initialValues,
    },
  });

  const onSubmit = async (data: AssessmentFormData) => {
    setIsLoading(true);

    try {
      const siteData: SiteDetailsInput = {
        site_name: data.site_name,
        latitude: data.latitude,
        longitude: data.longitude,
        roof_area: data.roof_area,
        roof_material: data.roof_material,
        roof_condition: data.roof_condition,
        soil_type: data.soil_type,
        annual_rainfall: data.annual_rainfall,
        water_demand: data.water_demand,
        water_tariff: preferences.waterTariff,
        first_flush_mm: preferences.firstFlushMm,
      };

      const result = await api.createAssessment(siteData);

      // Signed-in users keep every assessment in their account automatically
      const saved = user ? saveAssessment(buildAssessmentEntry(user.id, siteData, result)) : false;

      toast({
        title: t("toast.assessmentComplete"),
        description: saved
          ? `${t("toast.assessmentCompleteDesc")} ${t("toast.assessmentSaved")}`
          : t("toast.assessmentCompleteDesc"),
      });

      onSuccess?.(result, siteData, saved);
      form.reset();
    } catch (error) {
      console.error('Assessment failed:', error);
      toast({
        title: t("toast.assessmentFailed"),
        description: t("toast.assessmentFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("latitude", position.coords.latitude);
          form.setValue("longitude", position.coords.longitude);
          toast({
            title: t("toast.locationUpdated"),
            description: t("toast.locationUpdatedDesc"),
          });
        },
        () => {
          toast({
            title: t("toast.locationError"),
            description: t("toast.locationErrorDesc"),
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: t("toast.locationError"),
        description: t("toast.locationUnsupported"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DrawnIcon name="droplets" className="h-6 w-6 text-primary" />
            <span>{t("form.title")}</span>
          </CardTitle>
          <CardDescription>
            {t("form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Site Information */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-lg font-semibold">
                  <DrawnIcon name="house" className="h-5 w-5 text-accent" />
                  <span>{t("form.siteInfo")}</span>
                </div>

                <FormField
                  control={form.control}
                  name="site_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.siteName")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("form.siteNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.latitude")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="12.9716"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.longitude")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="77.5946"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  className="w-fit"
                >
                  <MapPin className="h-4 w-4 me-2" />
                  {t("form.useLocation")}
                </Button>
              </div>

              {/* Roof Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-lg font-semibold">
                  <DrawnIcon name="cottage" className="h-5 w-5 text-accent" />
                  <span>{t("form.roofDetails")}</span>
                </div>

                <FormField
                  control={form.control}
                  name="roof_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.roofArea")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="150"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("form.roofAreaHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="roof_material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.roofMaterial")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("form.selectMaterial")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="concrete">{t("material.concrete")}</SelectItem>
                            <SelectItem value="tile">{t("material.tile")}</SelectItem>
                            <SelectItem value="metal">{t("material.metal")}</SelectItem>
                            <SelectItem value="asbestos">{t("material.asbestos")}</SelectItem>
                            <SelectItem value="thatched">{t("material.thatched")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roof_condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.roofCondition")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("form.selectCondition")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="good">{t("condition.good")}</SelectItem>
                            <SelectItem value="fair">{t("condition.fair")}</SelectItem>
                            <SelectItem value="poor">{t("condition.poor")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Site Conditions */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-lg font-semibold">
                  <DrawnIcon name="gauge" className="h-5 w-5 text-accent" />
                  <span>{t("form.siteConditions")}</span>
                </div>

                <FormField
                  control={form.control}
                  name="soil_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.soilType")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("form.selectSoil")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sandy">{t("soil.sandy")}</SelectItem>
                          <SelectItem value="loamy">{t("soil.loamy")}</SelectItem>
                          <SelectItem value="clay">{t("soil.clay")}</SelectItem>
                          <SelectItem value="rocky">{t("soil.rocky")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t("form.soilHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="annual_rainfall"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.rainfall")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1200"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("form.rainfallHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="water_demand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.demand")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="500"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("form.demandHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {t("form.tariffNote", { tariff: preferences.waterTariff })}
              </p>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                variant="ocean"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t("form.submitting")}
                  </>
                ) : (
                  <>
                    <Droplets className="h-4 w-4 me-2" />
                    {t("form.submit")}
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};