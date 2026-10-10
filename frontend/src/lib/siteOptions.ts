// Visual choices for roof material, roof condition and soil type. Photos are
// from Wikimedia Commons (licences below), cropped to 4:3 and compressed.
import materialConcrete from "@/assets/options/material-concrete.webp";
import materialTile from "@/assets/options/material-tile.webp";
import materialMetal from "@/assets/options/material-metal.webp";
import materialAsbestos from "@/assets/options/material-asbestos.webp";
import materialThatched from "@/assets/options/material-thatched.webp";
import conditionGood from "@/assets/options/condition-good.webp";
import conditionFair from "@/assets/options/condition-fair.webp";
import conditionPoor from "@/assets/options/condition-poor.webp";
import soilSandy from "@/assets/options/soil-sandy.webp";
import soilLoamy from "@/assets/options/soil-loamy.webp";
import soilClay from "@/assets/options/soil-clay.webp";
import soilRocky from "@/assets/options/soil-rocky.webp";
import type { ROOF_CONDITIONS, ROOF_MATERIALS, SOIL_TYPES } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n";

export interface PhotoCredit {
  author: string;
  license: string;
  source: string;
}

export interface SiteOption<V extends string> {
  value: V;
  image: string;
  label: TranslationKey;
  caption: TranslationKey;
  /** Short technical fact shown as a chip, e.g. the runoff coefficient */
  metric: string;
  credit: PhotoCredit;
}

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

export const ROOF_MATERIAL_OPTIONS: SiteOption<(typeof ROOF_MATERIALS)[number]>[] = [
  {
    value: "concrete",
    image: materialConcrete,
    label: "material.concrete",
    caption: "option.concrete",
    metric: "C = 0.80",
    credit: { author: "Anna Frodesiak", license: "CC0", source: commons("Concrete_roof_insulation_in_Haikou,_Hainan,_China_-_04.JPG") },
  },
  {
    value: "tile",
    image: materialTile,
    label: "material.tile",
    caption: "option.tile",
    metric: "C = 0.75",
    credit: { author: "SnapMeUp", license: "CC BY-SA 4.0", source: commons("Mangalore_tiles_closeup_view.jpg") },
  },
  {
    value: "metal",
    image: materialMetal,
    label: "material.metal",
    caption: "option.metal",
    metric: "C = 0.90",
    credit: { author: "Wikideas1", license: "CC0", source: commons("Corrugated_metal_roof-2.jpg") },
  },
  {
    value: "asbestos",
    image: materialAsbestos,
    label: "material.asbestos",
    caption: "option.asbestos",
    metric: "C = 0.80",
    credit: { author: "Biswarup Ganguly", license: "CC BY 3.0", source: commons("Corrugated_Asbestos_Sheet_Roofing_-_Howrah_2011-07-10_00392.jpg") },
  },
  {
    value: "thatched",
    image: materialThatched,
    label: "material.thatched",
    caption: "option.thatched",
    metric: "C = 0.55",
    credit: { author: "Sindugab", license: "CC0", source: commons("Coconut_leaf_thatched_hut_Tamilnadu,India.jpg") },
  },
];

export const ROOF_CONDITION_OPTIONS: SiteOption<(typeof ROOF_CONDITIONS)[number]>[] = [
  {
    value: "good",
    image: conditionGood,
    label: "condition.good",
    caption: "option.good",
    metric: "×1.00",
    credit: { author: "SnapMeUp", license: "CC BY-SA 4.0", source: commons("Mangalore_tiles,_on_a_house_in_Tamil_Nadu,_Southern_India.jpg") },
  },
  {
    value: "fair",
    image: conditionFair,
    label: "condition.fair",
    caption: "option.fair",
    metric: "×0.90",
    credit: { author: "Acabashi", license: "CC BY-SA 4.0", source: commons("Moss_on_tiled_roof_at_Nuthurst,_West_Sussex,_England.jpg") },
  },
  {
    value: "poor",
    image: conditionPoor,
    label: "condition.poor",
    caption: "option.poor",
    metric: "×0.75",
    credit: { author: "Andy Beecroft", license: "CC BY-SA 2.0", source: commons("Leaking_Roof_-_geograph.org.uk_-_2515793.jpg") },
  },
];

export const SOIL_TYPE_OPTIONS: SiteOption<(typeof SOIL_TYPES)[number]>[] = [
  {
    value: "sandy",
    image: soilSandy,
    label: "soil.sandy",
    caption: "option.sandy",
    metric: "≈30 mm/h",
    credit: { author: "Ochiedike Angus", license: "CC BY-SA 4.0", source: commons("Sandy_soil_in_DMGS,_Onitsha.jpg") },
  },
  {
    value: "loamy",
    image: soilLoamy,
    label: "soil.loamy",
    caption: "option.loamy",
    metric: "≈13 mm/h",
    credit: { author: "Wikimedia Commons contributor", license: "CC BY 4.0", source: commons("Texture_of_a_fertile_soil.jpg") },
  },
  {
    value: "clay",
    image: soilClay,
    label: "soil.clay",
    caption: "option.clay",
    metric: "≈2.5 mm/h",
    credit: { author: "Andrew Cattoir, NPS", license: "Public domain", source: commons("Dry_Cracked_Mud_(4957b8b2-f52c-43b0-acc2-ead42cf6f03b).jpg") },
  },
  {
    value: "rocky",
    image: soilRocky,
    label: "soil.rocky",
    caption: "option.rocky",
    metric: "≈1 mm/h",
    credit: { author: "Eloquenttheory", license: "CC BY-SA 4.0", source: commons("Laterite_stones_05.jpg") },
  },
];

export const ALL_SITE_OPTIONS = [...ROOF_MATERIAL_OPTIONS, ...ROOF_CONDITION_OPTIONS, ...SOIL_TYPE_OPTIONS];
