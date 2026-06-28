import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { LiquidToggle } from "./index";

const KEY = "lg-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const initial = saved ? saved === "dark" : true;
    setDark(initial);
    apply(initial);
  }, []);

  function apply(isDark: boolean) {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Sun className="size-4 text-[color:var(--lg-muted-fg)]" />
      <LiquidToggle
        checked={dark}
        onChange={(v) => {
          setDark(v);
          apply(v);
          localStorage.setItem(KEY, v ? "dark" : "light");
        }}
      />
      <Moon className="size-4 text-[color:var(--lg-muted-fg)]" />
    </div>
  );
}
