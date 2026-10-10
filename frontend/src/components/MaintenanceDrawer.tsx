// Professional Maintenance, Installation & Vendor Directory Drawer
// Powered by TinyFish AI Crawler to scrape, rank, and connect nearby sanitary shops, STP suppliers, and labor.
import { useCallback, useEffect, useRef, useState } from "react";
import { reverseGeocode } from "@/lib/climate";
import { enquiryMaterials, materialSheetFile, sendEnquiry, type EnquiryPlan } from "@/lib/enquiry";
import { saveBlob } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  ExternalLink,
  FileText,
  Filter,
  PackageSearch,
  Hammer,
  HardHat,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Star,
  TestTube2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fadeUp, stagger } from "@/components/motion/presets";
import { useToast } from "@/hooks/use-toast";
import { CURATED_VENDORS, searchTinyFishVendors, type Vendor } from "@/lib/tinyFishService";

const INSTALL_STEPS = [
  { title: "Site visit & sizing", text: "We survey roof dimensions, downpipes, slope, and open ground recharge pit locations." },
  { title: "Plan & fixed quote", text: "You receive an exact itemized bill of quantities (BOQ) with fixed labor and material costs." },
  { title: "Installation & piping", text: "Heavy gutters, first-flush diverters, filtration media, and recharge pits installed in 3–7 days." },
  { title: "Testing & handover", text: "Hydraulic pressure testing, water quality sensor checks, and quarterly upkeep handover." },
];

const UPKEEP = [
  { when: "Before monsoon", text: "Inspect roof gutters, remove tree leaves, and flush downpipes with clean water." },
  { when: "After heavy storms", text: "Drain and clear sediment from the first-flush pipe chamber." },
  { when: "Every 3 months", text: "Rinse mechanical mesh filters and ensure storage tank airtight lids are secured." },
  { when: "Annual service", text: "Dewater and clean storage tank silt; replenish sand and gravel media in recharge pit." },
];

export const MaintenanceDrawer = ({
  open,
  onOpenChange,
  enquiry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When given, the drawer becomes a material enquiry for this plan */
  enquiry?: EnquiryPlan;
}) => {
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);
  const materials = enquiry ? enquiryMaterials(enquiry.result) : [];

  /** Open WhatsApp with this plan's material list, to a shop or a chat the user picks. */
  const sendMaterialEnquiry = (shop?: Vendor) => {
    if (!enquiry) return;
    sendEnquiry(enquiry, shop ? { name: shop.name, whatsapp: shop.whatsapp || shop.phone } : undefined);
    toast({ title: "Enquiry ready in WhatsApp", description: "The message lists every material with its quantity. Review it and press send." });
  };

  const downloadSheet = async () => {
    if (!enquiry) return;
    setSending("download");
    try {
      const file = await materialSheetFile(enquiry);
      saveBlob(file, file.name);
    } catch {
      toast({ title: "Could not prepare the material sheet", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };
  const [activeTab, setActiveTab] = useState<"vendors" | "workflow">("vendors");
  // Filled from the user's current location when the drawer opens; always editable
  const [searchLocation, setSearchLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const editedByUser = useRef(false);
  const detectedOnce = useRef(false);
  const [vendors, setVendors] = useState<Vendor[]>(CURATED_VENDORS);
  const [isSearching, setIsSearching] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"all" | "sanitary" | "stp" | "labor" | "testing">("all");

  // Live scrape & search using TinyFish API
  const searchVendors = useCallback(async (place: string, quiet = false) => {
    if (!place.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchTinyFishVendors(place.trim());
      setVendors(res.vendors);
      if (!quiet) {
        toast({
          title: "TinyFish AI Scan Completed",
          description: `Discovered and ranked verified sanitary shops and labor in ${place}.`,
        });
      }
    } catch (err) {
      console.error("Search failed:", err);
      toast({
        title: "Search Error",
        description: "Failed to query TinyFish API. Displaying verified local providers.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const handleTinyFishSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    void searchVendors(searchLocation);
  };

  /** Fill the box with "locality, city" from GPS and search there (unless the user typed something). */
  const detectLocation = useCallback(
    (force = false) => {
      if (!navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            const place = await reverseGeocode(coords.latitude, coords.longitude);
            const label = [place.locality, place.city || place.district].filter((part, i, all) => part && all.indexOf(part) === i).join(", ");
            if (label && (force || !editedByUser.current)) {
              editedByUser.current = false;
              setSearchLocation(label);
              void searchVendors(label, true);
            }
          } catch {
            // Keep whatever is in the box; the user can type a place
          } finally {
            setLocating(false);
          }
        },
        () => setLocating(false),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
      );
    },
    [searchVendors],
  );

  useEffect(() => {
    if (!open) return;
    if (enquiry) {
      // Enquiries search near the assessed site, not where the phone is
      setFilterCategory("sanitary");
      setActiveTab("vendors");
      const { latitude, longitude, city, district } = enquiry.input;
      const fallback = city || district || "";
      reverseGeocode(latitude, longitude)
        .then((place) => [place.locality, place.city || place.district].filter((part, i, all) => part && all.indexOf(part) === i).join(", "))
        .catch(() => fallback)
        .then((label) => {
          const where = label || fallback;
          if (where && !editedByUser.current) {
            setSearchLocation(where);
            void searchVendors(where, true);
          }
        });
      return;
    }
    if (!detectedOnce.current) {
      detectedOnce.current = true;
      detectLocation();
    }
    // Re-run per open and per plan location only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enquiry?.input.latitude, enquiry?.input.longitude, detectLocation]);

  const filteredVendors = vendors.filter((v) => {
    if (filterCategory === "all") return true;
    if (filterCategory === "sanitary") return v.category === "sanitary_shop";
    if (filterCategory === "stp") return v.category === "stp_supplier";
    if (filterCategory === "labor") return v.category === "labor_contractor";
    if (filterCategory === "testing") return v.category === "testing_lab";
    return true;
  });

  const getWhatsAppLink = (v: Vendor) => {
    const text = encodeURIComponent(
      `Hello ${v.name}, I found your listing on Barkha.AI. I need supplies for Rainwater Harvesting & STP environmental testing, and also need installation labor in ${searchLocation}. Please share quotation & availability.`,
    );
    return `https://wa.me/${v.whatsapp || "919829012345"}?text=${text}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl md:max-w-2xl p-6">
        <SheetHeader className="text-start pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2.5 text-2xl font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {enquiry ? <PackageSearch className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
              </span>
              {enquiry ? "Enquire for materials" : "Maintenance & Installation"}
            </SheetTitle>
            <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
              <Sparkles className="h-3 w-3" />
              TinyFish Scraper Active
            </span>
          </div>
          <SheetDescription className="text-sm text-muted-foreground mt-1">
            {enquiry
              ? "Send your material list to nearby sanitary shops and get quotations. The list has quantities only, no prices."
              : "Connect with top-rated sanitary shops for environmental & STP testing equipment, and verified installation labor ranked by Google Map ratings."}
          </SheetDescription>
        </SheetHeader>

        {/* Top Segmented Navigation */}
        <div className="mt-5">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "vendors" | "workflow")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vendors" className="font-semibold text-xs sm:text-sm">
                Nearby Vendors & Labor
              </TabsTrigger>
              <TabsTrigger value="workflow" className="font-semibold text-xs sm:text-sm">
                Installation & Upkeep Guide
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Live Vendors & Labor directory */}
            <TabsContent value="vendors" className="mt-5 space-y-5">
              {enquiry && materials.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold">
                      <FileText className="h-4 w-4 text-primary" />
                      Material requirement sheet · {materials.length} items
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={downloadSheet} disabled={sending !== null}>
                        {sending === "download" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                        Download PDF
                      </Button>
                      <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5a]" onClick={() => sendMaterialEnquiry()}>
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                        Share on WhatsApp
                      </Button>
                    </div>
                  </div>
                  <ul className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {materials.map((m) => (
                      <li key={m.item} className="flex justify-between gap-2 border-b border-border/40 py-1">
                        <span className="truncate">{m.item}</span>
                        <span className="shrink-0 font-medium text-foreground">{m.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Search Bar powered by TinyFish */}
              <form onSubmit={handleTinyFishSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchLocation}
                    onChange={(e) => {
                      editedByUser.current = true;
                      setSearchLocation(e.target.value);
                    }}
                    placeholder={locating ? "Detecting your location…" : "Enter city or area (e.g. Jaipur, Mansarovar...)"}
                    aria-label="Your city or area"
                    className="pl-9 pr-10 h-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => detectLocation(true)}
                    disabled={locating}
                    title="Use my current location"
                    aria-label="Use my current location"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:opacity-60"
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="submit" variant="ocean" className="h-10 px-4 font-semibold shrink-0" disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find via TinyFish
                    </>
                  )}
                </Button>
              </form>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
                {[
                  { id: "all", label: "All Ranked" },
                  { id: "sanitary", label: "Sanitary Shops" },
                  { id: "stp", label: "STP Suppliers" },
                  { id: "labor", label: "Installation Labor" },
                  { id: "testing", label: "Water Testing" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterCategory(tab.id as typeof filterCategory)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full font-medium transition-colors ${
                      filterCategory === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Ranked Vendor Cards */}
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredVendors.map((vendor, idx) => (
                    <motion.div
                      key={vendor.id}
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      exit="hidden"
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Top Header: Rank, Name & Google Rating */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                              Rank #{idx + 1}
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              {vendor.rating} ★ ({vendor.reviewCount} reviews)
                            </span>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {vendor.onlinePresenceScore} Online Presence
                            </span>
                          </div>
                          <h4 className="mt-2 text-base sm:text-lg font-bold text-foreground">{vendor.name}</h4>
                          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            {vendor.address} · <span className="text-primary font-medium">{vendor.distanceKm} km away</span>
                          </p>
                        </div>
                      </div>

                      {/* Equipment Supplied */}
                      <div className="mt-3.5 pt-3 border-t">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Equipment & Supplies Available:
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {vendor.equipmentSupplied.map((item) => (
                            <span
                              key={item}
                              className="rounded-lg bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 border border-sky-500/20"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Labor Connection */}
                      <div className="mt-3 rounded-xl bg-muted/50 p-3 border border-border/50">
                        <div className="flex items-start gap-2.5">
                          <HardHat className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                          <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-foreground">
                              Installation Labor: <span className="font-normal text-muted-foreground">{vendor.laborAvailable.role}</span>
                            </p>
                            <p className="text-muted-foreground">
                              Crew: <strong>{vendor.laborAvailable.teamSize}</strong> · Contact: {vendor.laborAvailable.contactPerson}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Call, WhatsApp, Google Maps */}
                      <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" asChild className="h-9 px-3 text-xs font-semibold">
                          <a href={`tel:${vendor.phone.replace(/\s+/g, "")}`}>
                            <Phone className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            Call ({vendor.phone})
                          </a>
                        </Button>
                        {enquiry ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendMaterialEnquiry(vendor)}
                            className="h-9 px-3 text-xs font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <MessageCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                            Send material enquiry
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-9 px-3 text-xs font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <a href={getWhatsAppLink(vendor)} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                              WhatsApp Inquiry
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" asChild className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                          <a href={vendor.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Google Maps
                          </a>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* TAB 2: Installation Workflow & Upkeep Guide */}
            <TabsContent value="workflow" className="mt-5 space-y-6">
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-bold text-base">
                  <Hammer className="h-4 w-4 text-primary" /> How Installation Works
                </h3>
                <ol className="space-y-2.5">
                  {INSTALL_STEPS.map((step, index) => (
                    <li key={step.title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-bold text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Recommended Upkeep Schedule
                </h3>
                <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                  {UPKEEP.map((item) => (
                    <li key={item.when} className="p-3.5 text-xs sm:text-sm">
                      <span className="block font-semibold text-foreground">{item.when}</span>
                      <span className="text-muted-foreground mt-0.5 block">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
