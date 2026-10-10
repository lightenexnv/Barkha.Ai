// Month-by-month water balance used to animate the Rain Replay: rain fills
// the tank, the household draws from it, and what the tank cannot hold
// overflows to the recharge pit.

export interface ReplayMonth {
  rainMm: number;
  inflowM3: number;
  startLevel: number; // m³
  peakLevel: number; // after the month's rain, before use
  endLevel: number; // after the month's use
  usedM3: number;
  overflowM3: number;
}

export interface ReplayYear {
  months: ReplayMonth[];
  capacityM3: number;
  maxRainMm: number;
  maxOverflowM3: number;
}

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const simulateYear = (
  monthlyRainMm: number[],
  monthlyHarvestM3: number[],
  capacityM3: number,
  demandLitresPerDay: number,
): ReplayYear => {
  const run = (start: number) => {
    let level = start;
    return monthlyHarvestM3.map((inflow, m) => {
      const startLevel = level;
      const filled = level + inflow;
      const peakLevel = Math.min(capacityM3, filled);
      const overflowM3 = Math.max(0, filled - capacityM3);
      const usedM3 = Math.min(peakLevel, (demandLitresPerDay * DAYS[m]) / 1000);
      level = peakLevel - usedM3;
      return { rainMm: monthlyRainMm[m] ?? 0, inflowM3: inflow, startLevel, peakLevel, endLevel: level, usedM3, overflowM3 };
    });
  };
  // Run a warm-up year so January starts from a realistic carried-over level
  const warm = run(capacityM3 / 2);
  const months = run(warm[11].endLevel);
  return {
    months,
    capacityM3,
    maxRainMm: Math.max(1, ...months.map((m) => m.rainMm)),
    maxOverflowM3: Math.max(0.001, ...months.map((m) => m.overflowM3)),
  };
};

/** Tank level (m³) partway through a month: rain fills it first, then use draws it down. */
export const levelAt = (month: ReplayMonth, progress: number) => {
  if (progress < 0.5) return month.startLevel + (month.peakLevel - month.startLevel) * (progress / 0.5);
  return month.peakLevel - (month.peakLevel - month.endLevel) * ((progress - 0.5) / 0.5);
};
