import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api";
import type { ConversationDetail, Message } from "@/api";
import { toast } from "sonner";
import { MessageCircle, UserCheck, BotMessageSquare, Phone, Pause, Play, Send } from "lucide-react";
import { TotumButton } from "@/components/ui/totum-button";

export const Route = createFileRoute("/conversations")({
  head: () => ({
    meta: [{ title: "Console de Conversas — SDR Totum" }],
  }),
  component: ConversationsPage,
});

function statusColor(status: string) {
  if (status === "ativa") return "#35a670";
  if (status === "aguardando") return "#077ac7";
  return "#9ca3af";
}
function statusFg(status: string) {
  // dark ink for light-mid greens/grays so text passes WCAG on liquid glass
  if (status === "aguardando") return "#ffffff";
  return "#0e0918";
}

function tempColor(t: string) {
  if (t === "quente") return "#d91616";
  if (t === "morno") return "#f59e0b";
  if (t === "frio") return "#077ac7";
  return "#9ca3af";
}
function tempFg(t: string) {
  if (t === "quente" || t === "frio") return "#ffffff";
  return "#0e0918";
}

function senderIcon(msg: Message) {
  if (msg.sender === "bot") return <BotMessageSquare className="size-3.5 shrink-0" />;
  if (msg.sender === "human") return <UserCheck className="size-3.5 shrink-0" />;
  return <Phone className="size-3.5 shrink-0" />;
}

function senderLabel(msg: Message) {
  if (msg.sender === "bot") return "Bot";
  if (msg.sender === "human") return "Humano";
  return "Lead";
}

function senderBg(msg: Message) {
  if (msg.sender === "lead") return "#0e0918";
  if (msg.sender === "human") return "#432d33";
  return "#1f192a";
}

function ConversationView({ conv, onClose }: { conv: ConversationDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const sendMsg = useMutation({
    mutationFn: (t: string) => api.sendMessage(conv.id, t),
    onSuccess: () => {
      toast.success("Mensagem enviada");
      setText("");
      qc.invalidateQueries({ queryKey: ["conversation", conv.id] });
    },
  });

  const takeoverMut = useMutation({
    mutationFn: () => api.takeover(conv.id),
    onSuccess: () => {
      toast.success("Takeover: você assumiu");
      qc.invalidateQueries({ queryKey: ["conversation", conv.id] });
    },
  });

  const resumeMut = useMutation({
    mutationFn: () => api.resume(conv.id),
    onSuccess: () => {
      toast.success("Bot retomou");
      qc.invalidateQueries({ queryKey: ["conversation", conv.id] });
    },
  });

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <div className="font-medium text-white">{conv.lead.empresa}</div>
          <div className="text-xs text-[color:var(--color-text-muted)]">
            {conv.lead.numero} · {conv.lead.nomeDono}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: tempColor(conv.temperatura), color: "#fff" }}
          >
            {conv.temperatura}
          </span>
          <span
            className="glass rounded-full px-2 py-0.5 text-[10px]"
            style={{ color: statusColor(conv.status) }}
          >
            {conv.status}
          </span>
          <TotumButton
            variant="outline"
            size="sm"
            onClick={() => takeoverMut.mutate()}
            disabled={takeoverMut.isPending}
          >
            <Pause className="size-3.5" /> Takeover
          </TotumButton>
          <TotumButton
            variant="outline"
            size="sm"
            onClick={() => resumeMut.mutate()}
            disabled={resumeMut.isPending}
          >
            <Play className="size-3.5" /> Retomar Bot
          </TotumButton>
          <button
            onClick={onClose}
            className="text-[color:var(--color-text-muted)] hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {conv.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.direction === "outbound" ? "flex-row-reverse" : ""}`}
          >
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: "#272333", color: "#9ca3af" }}
            >
              {senderIcon(msg)}
            </div>
            <div
              className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
              style={{ background: senderBg(msg), color: "#d1cece" }}
            >
              <div className="mb-1 text-[10px] text-[color:var(--color-text-muted)]">
                {senderLabel(msg)} ·{" "}
                {new Date(msg.ts).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {msg.nodeId && <span className="ml-1 opacity-50">· {msg.nodeId}</span>}
              </div>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 px-5 py-3" style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && text.trim()) {
              e.preventDefault();
              sendMsg.mutate(text.trim());
            }
          }}
          placeholder="Enviar como humano (Enter)…"
          className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
          style={{ background: "#0e0918" }}
        />
        <TotumButton
          variant="primary"
          size="sm"
          onClick={() => text.trim() && sendMsg.mutate(text.trim())}
          disabled={!text.trim() || sendMsg.isPending}
        >
          <Send className="size-3.5" />
        </TotumButton>
      </div>
    </div>
  );
}

function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations(),
    refetchInterval: 5000,
  });

  const { data: detail } = useQuery({
    queryKey: ["conversation", selectedId],
    queryFn: () => api.getConversation(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar list */}
      <div
        className="w-80 shrink-0 flex flex-col overflow-hidden border-r border-border"
      >
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-base text-white flex items-center gap-2">
            <MessageCircle className="size-4" /> Conversas
          </h1>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">Atualiza a cada 5s</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="px-5 py-6 text-xs text-[color:var(--color-text-muted)]">
              Carregando…
            </div>
          )}
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-5 py-3 transition-colors border-b border-border ${selectedId === c.id ? "bg-[color:var(--lg-card-hover)]" : "hover:bg-[color:var(--lg-card)]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white truncate">{c.empresa}</span>
                <span
                  className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: statusColor(c.status),
                    color: statusFg(c.status),
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
                  }}
                >
                  {c.status}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--color-text-muted)]">
                <span
                  className="rounded-full px-1.5 py-0.5 font-semibold"
                  style={{
                    background: tempColor(c.temperatura),
                    color: tempFg(c.temperatura),
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
                  }}
                >
                  {c.temperatura}
                </span>
                <span className="truncate">{c.numero}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-hidden">
        {detail ? (
          <ConversationView conv={detail} onClose={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full items-center justify-center text-[color:var(--color-text-muted)] text-sm">
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}
