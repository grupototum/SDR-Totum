import type { NodeKind } from "@/stores/flow-store";
import {
  PlayCircle,
  MessageCircle,
  Sparkles,
  Clock,
  GitBranch,
  Tag,
  Zap,
  Flag,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export interface NodeTypeMeta {
  kind: NodeKind;
  label: string;
  description: string;
  icon: LucideIcon;
  badgeLabel: string;
  badgeStyle: React.CSSProperties;
}

export const NODE_TYPES: NodeTypeMeta[] = [
  {
    kind: "start",
    label: "Início",
    description: "Ponto de entrada do flow",
    icon: PlayCircle,
    badgeLabel: "Início",
    badgeStyle: { backgroundImage: "var(--gradient-secondary)", color: "#fff" },
  },
  {
    kind: "send",
    label: "Enviar mensagem",
    description: "Texto humanizado com variações A/B",
    icon: MessageCircle,
    badgeLabel: "Mensagem",
    badgeStyle: { background: "#1f192a", color: "#d1cece" },
  },
  {
    kind: "ai",
    label: "Mensagem IA",
    description: "Resposta gerada por IA, sempre proativa",
    icon: Sparkles,
    badgeLabel: "IA",
    badgeStyle: { backgroundImage: "var(--gradient-primary)", color: "#fff" },
  },
  {
    kind: "wait",
    label: "Aguardar",
    description: "Espera resposta ou timeout",
    icon: Clock,
    badgeLabel: "Aguardar",
    badgeStyle: { background: "#432d33", color: "#ef9a9a" },
  },
  {
    kind: "conditional",
    label: "Condição (IA)",
    description: "Roteamento por classificação",
    icon: GitBranch,
    badgeLabel: "Condição",
    badgeStyle: { background: "#1f192a", color: "#a06ff6", boxShadow: "inset 0 0 0 1px #6b21ef" },
  },
  {
    kind: "variable",
    label: "Definir variável",
    description: "Salva valor no contexto",
    icon: Tag,
    badgeLabel: "Variável",
    badgeStyle: { background: "#1f192a", color: "#9ca3af" },
  },
  {
    kind: "action",
    label: "Ação externa",
    description: "Auditar site, calendário ou webhook",
    icon: Zap,
    badgeLabel: "Ação",
    badgeStyle: { background: "#077ac7", color: "#fff" },
  },
  {
    kind: "end",
    label: "Fim",
    description: "Encerra o flow com resultado",
    icon: Flag,
    badgeLabel: "Fim",
    badgeStyle: { backgroundImage: "var(--gradient-brand-card)", color: "#fff" },
  },
  {
    kind: "log",
    label: "Relatório",
    description: "Grava no Postgres / Sheets",
    icon: ClipboardList,
    badgeLabel: "Relatório",
    badgeStyle: { background: "#1b1728", color: "#35a670", boxShadow: "inset 0 0 0 1px #35a670" },
  },
];

export const nodeMeta = (kind: NodeKind) =>
  NODE_TYPES.find((n) => n.kind === kind)!;
