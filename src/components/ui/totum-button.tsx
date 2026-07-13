import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const totumButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-normal cursor-pointer transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[#da2128] text-white shadow-[var(--shadow-btn-primary)] hover:shadow-[var(--shadow-halo-red)]",
        secondary:
          "text-white bg-[image:var(--gradient-secondary)] shadow-[var(--shadow-btn-primary)] hover:brightness-110",
        // Cores via CSS var com fallback no valor original (tema dark). Páginas
        // claras definem --tbtn-fg/--tbtn-hover-bg no wrapper .totum-light.
        ghost:
          "bg-transparent text-[color:var(--tbtn-fg,#fff)] hover:bg-[color:var(--tbtn-hover-bg,hsla(0,0%,100%,0.07))]",
        outline:
          "bg-transparent text-[color:var(--tbtn-fg,#fff)] card-shadow hover:bg-[color:var(--tbtn-hover-bg,hsla(0,0%,100%,0.05))]",
      },
      size: {
        sm: "h-8 px-4 text-xs",
        md: "h-10 px-6 text-sm",
        lg: "h-12 px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface TotumButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof totumButtonVariants> {
  asChild?: boolean;
}

export const TotumButton = React.forwardRef<HTMLButtonElement, TotumButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(totumButtonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
TotumButton.displayName = "TotumButton";
