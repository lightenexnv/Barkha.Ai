import { useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { FOLLOW_EVENT, HEAVY_RAIN_MM, fetchForecast, getFollowedSite, litresFrom, markNotified, wasNotified } from "@/lib/forecast";

const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;

/**
 * Checks the followed site's forecast while the app is open (on load, every
 * few hours and when alerts are switched on) and warns once per heavy-rain day
 * that is coming tomorrow: a browser notification if allowed, else a toast.
 */
export const RainAlertWatcher = () => {
  const { t, locale } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const site = getFollowedSite();
      if (!site) return;
      try {
        const days = await fetchForecast(site.latitude, site.longitude);
        const tomorrow = days[1];
        if (cancelled || !tomorrow || tomorrow.mm < HEAVY_RAIN_MM || wasNotified(tomorrow.date)) return;
        const litres = litresFrom(tomorrow.mm, site).toLocaleString(locale);
        const title = t("live.alertTitle", { mm: Math.round(tomorrow.mm) });
        const body = t("live.alertBody", { name: site.name, litres });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body, icon: "/favicon.png", tag: `rain-${tomorrow.date}` });
        } else {
          toast({ title, description: body });
        }
        markNotified(tomorrow.date);
      } catch {
        // Offline or forecast unavailable: try again at the next check
      }
    };
    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener(FOLLOW_EVENT, check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(FOLLOW_EVENT, check);
    };
  }, [t, locale, toast]);

  return null;
};
