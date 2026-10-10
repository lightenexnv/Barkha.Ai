import { motion } from "framer-motion";
import { CalendarCheck, Hammer, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fadeUp, stagger } from "@/components/motion/presets";
import { useToast } from "@/hooks/use-toast";

const INSTALL_STEPS = [
  { title: "Site visit", text: "We check your roof, pipes and open ground." },
  { title: "Plan & quote", text: "You get a simple plan and a fixed price." },
  { title: "Installation", text: "Gutters, filter, tank or recharge pit are fitted, usually in 3–7 days." },
  { title: "Handover", text: "We test it with water and show you how to look after it." },
];

const UPKEEP = [
  { when: "Before the rains", text: "Clean the roof, gutters and leaf screens." },
  { when: "After every heavy rain", text: "Empty the first-flush pipe." },
  { when: "Every 3 months", text: "Wash the filter and check the tank lid is shut." },
  { when: "Once a year", text: "Clean the tank and top up the pit's sand and gravel." },
];

/** Information drawer for the "Maintenance & Installation" nav button (booking is a placeholder). */
export const MaintenanceDrawer = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { toast } = useToast();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-start">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Wrench className="h-5 w-5 text-primary" />
            Maintenance & Installation
          </SheetTitle>
          <SheetDescription>Get your system built and keep it working well.</SheetDescription>
        </SheetHeader>

        <motion.div className="mt-6 space-y-7" initial="hidden" animate={open ? "show" : "hidden"} variants={stagger(0.06, 0.1)}>
          <section className="space-y-3">
            <motion.h3 variants={fadeUp} className="flex items-center gap-2 font-semibold">
              <Hammer className="h-4 w-4 text-primary" /> How installation works
            </motion.h3>
            <ol className="space-y-2">
              {INSTALL_STEPS.map((step, index) => (
                <motion.li key={step.title} variants={fadeUp} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{step.title}</span>
                    <span className="block text-sm text-muted-foreground">{step.text}</span>
                  </span>
                </motion.li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <motion.h3 variants={fadeUp} className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Simple upkeep
            </motion.h3>
            <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
              {UPKEEP.map((item) => (
                <motion.li key={item.when} variants={fadeUp} className="p-3 text-sm">
                  <span className="block font-medium">{item.when}</span>
                  <span className="text-muted-foreground">{item.text}</span>
                </motion.li>
              ))}
            </ul>
          </section>

          <motion.div variants={fadeUp} className="space-y-2 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4">
            <p className="text-sm font-medium">Need help from an expert?</p>
            <Button
              variant="ocean"
              className="w-full"
              onClick={() => toast({ title: "Coming soon", description: "Booking a service visit will be available shortly." })}
            >
              <CalendarCheck className="me-2 h-4 w-4" />
              Book a service visit
            </Button>
          </motion.div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
};
