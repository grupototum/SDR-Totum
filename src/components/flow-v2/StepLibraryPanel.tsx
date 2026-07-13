/**
 * StepLibraryPanel.tsx — biblioteca de etapas do Canvas (estilo Manychat
 * "Choose first step"): painel direito exibido quando nenhum estágio está
 * selecionado. Clicar num tipo cria um estágio v2 pré-preenchido no flow.
 *
 * 🔌 INTEGRAÇÃO FUTURA COM O MOTOR: hoje cada tipo vira um estágio v2 comum
 * (goal + instruction template) — o schema v2 não muda. Quando o motor
 * ganhar tipos nativos de bloco (condição, delay, transferência etc.),
 * mapear `kind` para o campo/semântica real aqui.
 */
import { useFlowV2Store } from "@/stores/flow-v2-store";
import {
  Zap,
  UserPlus,
  ListChecks,
  MessageCircle,
  Clock,
  GitBranch,
  Headset,
  Flag,
} from "lucide-react";

interface StepTemplate {
  kind: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  goal: string;
  instruction: string;
  terminal?: boolean;
}

const GROUPS: { title: string; steps: StepTemplate[] }[] = [
  {
    title: "Gatilhos",
    steps: [
      {
        kind: "novo_lead",
        label: "Novo lead",
        description: "Início do fluxo quando um lead novo chega.",
        icon: <UserPlus className="size-4" style={{ color: "#175cd3" }} />,
        goal: "Receber o lead novo e abrir a conversa.",
        instruction: "Abra a conversa com o lead recém-chegado. // TODO: conectar gatilho real",
      },
    ],
  },
  {
    title: "Etapas SDR",
    steps: [
      {
        kind: "qualificacao",
        label: "Qualificação",
        description: "Descobrir se o lead tem perfil e decisão.",
        icon: <ListChecks className="size-4" style={{ color: "#6941c6" }} />,
        goal: "Qualificar o lead: perfil, dor e poder de decisão.",
        instruction: "Faça perguntas de qualificação sem soar interrogatório.",
      },
      {
        kind: "mensagem",
        label: "Envio de mensagem",
        description: "Mensagem do roteiro para o lead.",
        icon: <MessageCircle className="size-4" style={{ color: "#067647" }} />,
        goal: "Entregar a mensagem-chave desta etapa.",
        instruction: "Envie a mensagem desta etapa do roteiro.",
      },
      {
        kind: "follow_up",
        label: "Follow-up",
        description: "Retomar contato após silêncio do lead.",
        icon: <Clock className="size-4" style={{ color: "#b54708" }} />,
        goal: "Reengajar o lead que parou de responder.",
        instruction:
          "Retome o contato com um gancho leve. // TODO: ligar à fila de follow-up do motor",
      },
    ],
  },
  {
    title: "Lógica",
    steps: [
      {
        kind: "condicao",
        label: "Condição",
        description: "Ramificar o fluxo por resposta ou variável.",
        icon: <GitBranch className="size-4" style={{ color: "#c11574" }} />,
        goal: "Decidir o próximo passo conforme a resposta do lead.",
        instruction:
          "Avalie a resposta e siga o ramo adequado. // TODO: condição nativa quando o motor suportar",
      },
    ],
  },
  {
    title: "Ações",
    steps: [
      {
        kind: "transferencia",
        label: "Transferência para humano",
        description: "Passar a conversa para o time.",
        icon: <Headset className="size-4" style={{ color: "#175cd3" }} />,
        goal: "Transferir a conversa para atendimento humano.",
        instruction: "Avise o lead e acione o humano. // TODO: integrar handoff real",
      },
      {
        kind: "fechamento",
        label: "Fechamento / descarte",
        description: "Encerrar com agendamento ou descarte educado.",
        icon: <Flag className="size-4" style={{ color: "#067647" }} />,
        goal: "Encerrar a conversa (agendado ou descartado).",
        instruction: "Encerre cordialmente registrando o desfecho.",
        terminal: true,
      },
    ],
  },
];

export function StepLibraryPanel() {
  function addFromTemplate(tpl: StepTemplate) {
    const { addStage, updateStage } = useFlowV2Store.getState();
    addStage(); // cria e seleciona um estágio novo com id único
    const id = useFlowV2Store.getState().selectedStageId;
    if (!id) return;
    updateStage(id, {
      goal: tpl.goal,
      instruction: tpl.instruction,
      ...(tpl.terminal ? { terminal: true } : {}),
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-medium text-[#111827]">
          <Zap className="size-4 text-[#da2128]" /> Adicionar etapa
        </h2>
        <p className="mt-1 text-xs text-[#6b7280]">
          Escolha um tipo para criar a etapa no canvas. Clique num bloco do canvas para editá-lo.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-[#6b7280]">{group.title}</p>
          <div className="flex flex-col gap-2">
            {group.steps.map((tpl) => (
              <button
                key={tpl.kind}
                onClick={() => addFromTemplate(tpl)}
                className="flex items-start gap-3 rounded-xl bg-white p-3 text-left transition-shadow hover:shadow-md"
                style={{ boxShadow: "inset 0 0 0 1px #e5e7eb" }}
              >
                <span
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "#f6f7f9" }}
                >
                  {tpl.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#111827]">
                    {tpl.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-[#6b7280]">
                    {tpl.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
