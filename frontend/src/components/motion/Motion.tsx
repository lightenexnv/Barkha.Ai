// Small animated wrappers built on the shared presets.
import { motion, type HTMLMotionProps } from "framer-motion";
import { spring, stagger } from "./presets";
import { cn } from "@/lib/utils";

/** Wraps a button or link with a springy hover lift and tap squash. */
export const Pressable = ({ className, children, ...props }: HTMLMotionProps<"div">) => (
  <motion.div
    whileHover={{ scale: 1.03, y: -1 }}
    whileTap={{ scale: 0.97 }}
    transition={spring}
    className={cn("inline-flex", className)}
    {...props}
  >
    {children}
  </motion.div>
);

/** Fades and lifts its children into view once, when scrolled to. */
export const Reveal = ({ className, children, delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: "-60px" }}
    variants={stagger(0.08, delay)}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);
