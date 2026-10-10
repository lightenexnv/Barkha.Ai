import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Filled Sky Signal — the single primary action on a screen
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85",
        ocean: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85",
        // Ghost — secondary actions: Slate text, Ash fill on hover, no border
        ghost: "bg-transparent text-slate hover:bg-secondary",
        // Outline — hairline Linen border on white
        outline: "border border-border bg-card text-slate hover:bg-secondary",
        secondary: "bg-secondary text-slate hover:bg-secondary/70",
        link: "h-auto px-0 text-link underline underline-offset-4 hover:opacity-80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Legacy variants mapped onto the system
        nature: "bg-primary text-primary-foreground hover:bg-primary/90",
        glass: "border border-border bg-card text-slate hover:bg-secondary",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-5 text-[15px]",
        xl: "h-12 px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
