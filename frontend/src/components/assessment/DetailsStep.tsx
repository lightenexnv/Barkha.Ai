import { motion } from "framer-motion";
import { ArrowLeft, Droplets, Users } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrawnIcon } from "@/components/DrawnIcon";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings, useUnits } from "@/context/SettingsContext";
import { ROOF_CONDITION_OPTIONS, ROOF_MATERIAL_OPTIONS, SOIL_TYPE_OPTIONS } from "@/lib/siteOptions";
import { detailsValid, MAX_DEMAND, type SiteDetails } from "./model";
import { OptionCardGroup } from "./OptionCardGroup";

// CPHEEO norm for urban households with sewerage: 135 litres per person per day
const LPCD = 135;
const PEOPLE_PRESETS = [4, 10, 25, 50];
const MAX_PEOPLE = 5000;
interface DetailsStepProps {
  details: SiteDetails;
  onChange: (details: SiteDetails) => void;
  roofArea: number;
  annualRainfall: number | null;
  onBack: () => void;
  onSubmit: () => void;
}

export const DetailsStep = ({ details, onChange, roofArea, annualRainfall, onBack, onSubmit }: DetailsStepProps) => {
  const { t } = useLanguage();
  const units = useUnits();
  const { preferences } = useSettings();
  const set = <K extends keyof SiteDetails>(key: K, value: SiteDetails[K]) => onChange({ ...details, [key]: value });
  // People are a shortcut for demand; typing litres directly clears the match
  const people = details.water_demand > 0 && details.water_demand % LPCD === 0 ? details.water_demand / LPCD : null;
  const setPeople = (count: number) => set("water_demand", Math.min(count * LPCD, MAX_DEMAND));
  const nameError = details.site_name.trim().length < 2;

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (detailsValid(details)) onSubmit();
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold">{t("details.title")}</h2>
          <p className="text-muted-foreground">{t("details.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
            {t("details.chipRoof", { area: units.area(roofArea) })}
          </span>
          {annualRainfall !== null && (
            <span className="rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-700 dark:text-sky-300">
              {t("details.chipRain", { rain: units.rainfall(annualRainfall) })}
            </span>
          )}
        </div>
      </div>

      <section className="glass-card space-y-2 rounded-2xl p-5">
        <Label htmlFor="site-name" className="text-base font-semibold">
          {t("form.siteName")}
        </Label>
        <Input
          id="site-name"
          value={details.site_name}
          onChange={(event) => set("site_name", event.target.value)}
          placeholder={t("form.siteNamePlaceholder")}
          aria-invalid={nameError}
          className="max-w-xl"
        />
        {nameError && <p className="text-sm text-destructive">{t("val.siteName")}</p>}
      </section>

      <section className="space-y-3">
        <SectionTitle icon="cottage" title={t("form.roofMaterial")} help={t("details.materialHelp")} />
        <OptionCardGroup
          label={t("form.roofMaterial")}
          options={ROOF_MATERIAL_OPTIONS}
          value={details.roof_material}
          onChange={(value) => set("roof_material", value)}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle icon="house" title={t("form.roofCondition")} help={t("details.conditionHelp")} />
        <OptionCardGroup
          label={t("form.roofCondition")}
          options={ROOF_CONDITION_OPTIONS}
          value={details.roof_condition}
          onChange={(value) => set("roof_condition", value)}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle icon="gauge" title={t("form.soilType")} help={t("form.soilHelp")} />
        <OptionCardGroup
          label={t("form.soilType")}
          options={SOIL_TYPE_OPTIONS}
          value={details.soil_type}
          onChange={(value) => set("soil_type", value)}
        />
      </section>

      <section className="glass-card space-y-4 rounded-2xl p-5">
        <SectionTitle icon="droplets" title={t("form.demand")} help={t("form.demandHelp")} />
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            {t("details.peopleOnSite")}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {PEOPLE_PRESETS.map((count) => (
              <motion.div key={count} whileTap={{ scale: 0.94 }} whileHover={{ y: -1 }}>
                <Button
                  type="button"
                  size="sm"
                  variant={people === count ? "default" : "outline"}
                  onClick={() => setPeople(count)}
                >
                  {t("details.people", { count })}
                </Button>
              </motion.div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={MAX_PEOPLE}
                step={1}
                inputMode="numeric"
                aria-label={t("details.customPeople")}
                placeholder={t("details.customPeople")}
                value={people && !PEOPLE_PRESETS.includes(people) ? people : ""}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(value) && value > 0) setPeople(Math.min(value, MAX_PEOPLE));
                }}
                className="h-9 w-36"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="water-demand" className="text-sm font-medium sm:min-w-44">
            {t("details.litresPerDay")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="water-demand"
              type="number"
              min={0}
              max={MAX_DEMAND}
              step={10}
              inputMode="numeric"
              value={Number.isFinite(details.water_demand) ? details.water_demand : 0}
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                set("water_demand", Number.isFinite(value) ? Math.min(Math.max(value, 0), MAX_DEMAND) : 0);
              }}
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">L/day</span>
            <InfoTip>{t("details.lpcdNote", { lpcd: LPCD })}</InfoTip>
          </div>
        </div>
        {details.water_demand === 0 && <p className="text-xs text-muted-foreground">{t("details.zeroDemand")}</p>}
      </section>

      <p className="text-xs text-muted-foreground">{t("form.tariffNote", { tariff: preferences.waterTariff })}</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("wizard.back")}
        </Button>
        <Button type="submit" size="lg" variant="ocean" disabled={!detailsValid(details)} className="sm:min-w-64">
          <Droplets className="me-2 h-4 w-4" />
          {t("form.submit")}
        </Button>
      </div>
    </form>
  );
};

const SectionTitle = ({ icon, title, help }: { icon: "cottage" | "house" | "gauge" | "droplets"; title: string; help: string }) => (
  <div className="flex items-start gap-2.5">
    <DrawnIcon name={icon} className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
    <div>
      <h3 className="text-lg font-semibold leading-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{help}</p>
    </div>
  </div>
);
