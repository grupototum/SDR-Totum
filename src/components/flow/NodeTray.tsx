import { useState } from "react";
import { Plus, X } from "lucide-react";
import { NODE_TYPES } from "./node-types";

export function NodeTray() {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute left-4 top-4 z-10">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex size-10 items-center justify-center rounded-full text-white"
          style={{
            background: "#1b1728",
            boxShadow: "var(--shadow-card)",
          }}
          aria-label="Abrir paleta de nodes"
        >
          <Plus className="size-5" />
        </button>
      )}
      {open && (
        <div
          className="w-[240px] rounded-2xl p-3"
          style={{ background: "#1b1728", boxShadow: "var(--shadow-card)", borderRadius: 16 }}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Nodes
            </span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-[color:var(--color-text-muted)] hover:bg-[hsla(0,0%,100%,0.07)] hover:text-white"
              aria-label="Fechar paleta"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {NODE_TYPES.map((nt) => {
              const Icon = nt.icon;
              return (
                <div
                  key={nt.kind}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/node-kind", nt.kind);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="flex cursor-grab items-start gap-2 rounded-lg p-2 transition-colors hover:bg-[#272333] active:cursor-grabbing"
                >
                  <span
                    className="mt-0.5 flex size-7 items-center justify-center rounded-full"
                    style={nt.badgeStyle}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white">{nt.label}</div>
                    <div className="truncate text-[10px] text-[color:var(--color-text-muted)]">
                      {nt.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
