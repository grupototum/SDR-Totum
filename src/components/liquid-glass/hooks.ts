import { useCallback, useEffect, useRef } from "react";

export function useShimmer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };
    const onLeave = () => {
      el.style.setProperty("--mx", `-200px`);
      el.style.setProperty("--my", `-200px`);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return ref;
}

export function useRipple() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const host = e.currentTarget;
    const rect = host.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "lg-ripple-dot";
    dot.style.left = `${e.clientX - rect.left}px`;
    dot.style.top = `${e.clientY - rect.top}px`;
    dot.style.width = dot.style.height = "12px";
    host.appendChild(dot);
    setTimeout(() => dot.remove(), 620);
  }, []);
}
