"use client";

import Papa from "papaparse";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/browser-supabase";
import type {
  BroadcastListRecord,
  ChatItem,
  ContactItem,
  CustomContact,
  DispatchJob,
  DispatchMessageType,
  DispatchRecipient,
  EvolutionInstanceSummary,
  GroupParticipant,
  GroupSummary,
  QuotedMessageReference,
  SimplifiedMessage,
} from "@/lib/types";

type SectionKey =
  | "overview"
  | "direct"
  | "messages"
  | "status"
  | "campaigns"
  | "groups"
  | "contacts"
  | "lists"
  | "instances"
  | "explorer";

type WorkspaceKey =
  | "home"
  | "send"
  | "audience"
  | "schedule"
  | "connections"
  | "advanced";

interface ManagedInstanceView {
  id: string;
  instanceName: string;
  apiToken: string;
  baseUrl: string;
  dbSchema: string;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  summary: EvolutionInstanceSummary | null;
  summaryError?: string;
}

interface NoticeState {
  tone: "success" | "error" | "info";
  text: string;
}

interface InstanceFormPayload {
  instanceId?: string;
  instanceName: string;
  apiToken: string;
  baseUrl: string;
  label: string;
  notes: string;
}

interface MessageDraft {
  type: DispatchMessageType;
  text: string;
  mediaType: "image" | "video" | "document";
  mediaSource: string;
  mimeType: string;
  fileName: string;
  caption: string;
  audioSource: string;
  stickerSource: string;
  locationName: string;
  locationAddress: string;
  latitude: string;
  longitude: string;
  contactCardsText: string;
  pollName: string;
  pollOptionsText: string;
  pollSelectableCount: string;
  listTitle: string;
  listDescription: string;
  listButtonText: string;
  listFooterText: string;
  listSectionsText: string;
  buttonsTitle: string;
  buttonsDescription: string;
  buttonsFooter: string;
  buttonsText: string;
  linkPreview: boolean;
  mentionsEveryOne: boolean;
  mentionedText: string;
  delayMs: string;
  quoted: QuotedMessageReference | null;
}

interface StatusDraft {
  type: "text" | "image" | "video" | "audio";
  content: string;
  caption: string;
  backgroundColor: string;
  font: string;
  statusTargetsText: string;
  allContacts: boolean;
}

const NAV_ITEMS: Array<{ key: SectionKey; label: string }> = [
  { key: "overview", label: "Painel" },
  { key: "direct", label: "Envio rapido" },
  { key: "messages", label: "Conversas" },
  { key: "campaigns", label: "Campanhas" },
  { key: "groups", label: "Grupos" },
  { key: "contacts", label: "Contatos" },
  { key: "lists", label: "Listas" },
  { key: "instances", label: "Instâncias" },
  { key: "explorer", label: "Explorador API" },
];

const PRIMARY_NAV_ITEMS: Array<{
  key: WorkspaceKey;
  label: string;
  description: string;
  defaultSection: SectionKey;
}> = [
  {
    key: "home",
    label: "Inicio",
    description: "Resumo da operacao e proximo passo.",
    defaultSection: "overview",
  },
  {
    key: "send",
    label: "Enviar",
    description: "Mensagem rapida, conversa e status.",
    defaultSection: "direct",
  },
  {
    key: "audience",
    label: "Publico",
    description: "Contatos, grupos e listas.",
    defaultSection: "contacts",
  },
  {
    key: "schedule",
    label: "Agenda",
    description: "Campanhas e fila de disparo.",
    defaultSection: "campaigns",
  },
  {
    key: "connections",
    label: "Conexoes",
    description: "Instancias e conta ativa.",
    defaultSection: "instances",
  },
  {
    key: "advanced",
    label: "Avancado",
    description: "Recursos tecnicos e explorer.",
    defaultSection: "explorer",
  },
];

const SECTION_TO_WORKSPACE: Record<SectionKey, WorkspaceKey> = {
  overview: "home",
  direct: "send",
  messages: "send",
  status: "send",
  campaigns: "schedule",
  groups: "audience",
  contacts: "audience",
  lists: "audience",
  instances: "connections",
  explorer: "advanced",
};

const WORKSPACE_TABS: Record<WorkspaceKey, Array<{ key: SectionKey; label: string }>> = {
  home: [{ key: "overview", label: "Visao geral" }],
  send: [
    { key: "direct", label: "Mensagem rapida" },
    { key: "messages", label: "Conversas" },
    { key: "status", label: "Status" },
  ],
  audience: [
    { key: "contacts", label: "Contatos" },
    { key: "groups", label: "Grupos" },
    { key: "lists", label: "Listas" },
  ],
  schedule: [{ key: "campaigns", label: "Campanhas e fila" }],
  connections: [{ key: "instances", label: "Instancias" }],
  advanced: [{ key: "explorer", label: "Ferramentas tecnicas" }],
};

const WORKSPACE_COPY: Record<
  WorkspaceKey,
  { kicker: string; title: string; description: string }
> = {
  home: {
    kicker: "Central de operacao",
    title: "Tudo o que importa aparece em linguagem de negocio.",
    description:
      "Acompanhe sua instancia, veja a fila e encontre rapidamente a proxima acao sem precisar conhecer a Evolution API.",
  },
  send: {
    kicker: "Envio guiado",
    title: "Envie mensagens sem virar campanha por acidente.",
    description:
      "Escolha o destino, monte o conteudo e decida se vai mandar agora, agendar ou responder a partir de uma conversa.",
  },
  audience: {
    kicker: "Base de destinatarios",
    title: "Organize contatos, grupos e listas do jeito que o usuario pensa.",
    description:
      "Aqui voce prepara quem vai receber mensagens, sem depender de nomes tecnicos de endpoint ou JID.",
  },
  schedule: {
    kicker: "Agenda protegida",
    title: "Planeje disparos e acompanhe a fila com seguranca.",
    description:
      "Crie campanhas, revise quem vai receber e acompanhe a execucao com pausa minima de 10 segundos entre envios.",
  },
  connections: {
    kicker: "Conexao com WhatsApp",
    title: "Gerencie as instancias fora do fluxo de envio.",
    description:
      "Cadastre, valide e selecione a conexao ativa antes de enviar mensagens ou montar listas.",
  },
  advanced: {
    kicker: "Ferramentas tecnicas",
    title: "Use a API manualmente so quando realmente precisar.",
    description:
      "O explorador fica isolado aqui para nao atrapalhar quem so quer operar o sistema.",
  },
};

const HOME_STEPS: Array<{
  title: string;
  description: string;
  section: SectionKey;
}> = [
  {
    title: "1. Escolha a conexao",
    description: "Ative a instancia que vai enviar as mensagens e confira o status.",
    section: "instances",
  },
  {
    title: "2. Organize o publico",
    description: "Cadastre contatos, ajuste grupos ou salve listas reutilizaveis.",
    section: "contacts",
  },
  {
    title: "3. Envie com clareza",
    description: "Use o envio rapido para mandar uma mensagem sem entrar no fluxo de campanha.",
    section: "direct",
  },
  {
    title: "4. Agende e acompanhe",
    description: "Monte campanhas e acompanhe a fila sem perder o controle do ritmo.",
    section: "campaigns",
  },
];

const CAPABILITIES = [
  {
    title: "Clareza para quem opera",
    description:
      "As áreas principais seguem tarefas reais do dia a dia: enviar, organizar público, acompanhar agenda e conectar contas.",
  },
  {
    title: "Fila segura",
    description:
      "Toda campanha respeita pausa mínima de 10 segundos entre mensagens para reduzir risco no número.",
  },
  {
    title: "Mais de uma conta",
    description:
      "Cada instância fica separada, com seu próprio perfil e sua própria base de dados.",
  },
  {
    title: "Modo técnico isolado",
    description:
      "O explorador da API continua disponível, mas fora do fluxo principal para não atrapalhar o usuário final.",
  },
];

const EXPLORER_PRESETS = [
  {
    title: "Instâncias disponíveis",
    path: "/instance/fetchInstances",
    method: "GET",
    description: "Lista as instâncias visíveis para o token cadastrado.",
    body: "{}",
    query: "{}",
  },
  {
    title: "Contatos da instância",
    path: "/chat/findContacts/{instanceName}",
    method: "POST",
    description: "Retorna os contatos sincronizados.",
    body: "{}",
    query: "{}",
  },
  {
    title: "Conversas da instância",
    path: "/chat/findChats/{instanceName}",
    method: "POST",
    description: "Lista chats, últimas mensagens e não lidas.",
    body: "{}",
    query: "{}",
  },
  {
    title: "Enviar texto",
    path: "/message/sendText/{instanceName}",
    method: "POST",
    description: "Exemplo mínimo para envio simples.",
    body: '{\n  "number": "5511999999999",\n  "text": "Olá, mundo!"\n}',
    query: "{}",
  },
];

function createMessageDraft(type: DispatchMessageType = "text"): MessageDraft {
  return {
    type,
    text: "",
    mediaType: "image",
    mediaSource: "",
    mimeType: "",
    fileName: "",
    caption: "",
    audioSource: "",
    stickerSource: "",
    locationName: "",
    locationAddress: "",
    latitude: "",
    longitude: "",
    contactCardsText: "",
    pollName: "",
    pollOptionsText: "",
    pollSelectableCount: "1",
    listTitle: "",
    listDescription: "",
    listButtonText: "",
    listFooterText: "",
    listSectionsText: "",
    buttonsTitle: "",
    buttonsDescription: "",
    buttonsFooter: "",
    buttonsText: "",
    linkPreview: false,
    mentionsEveryOne: false,
    mentionedText: "",
    delayMs: "0",
    quoted: null,
  };
}

function createStatusDraft(): StatusDraft {
  return {
    type: "text",
    content: "",
    caption: "",
    backgroundColor: "#0f766e",
    font: "1",
    statusTargetsText: "",
    allContacts: true,
  };
}

function parseJsonInput(value: string) {
  const trimmed = value.trim();
  return trimmed ? JSON.parse(trimmed) : {};
}

function parseNumbers(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRecipientLines(value: string) {
  const recipients: DispatchRecipient[] = [];

  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [labelPart, targetPart] = line.includes("|")
        ? line.split("|")
        : ["", line];
      recipients.push({
        id: crypto.randomUUID(),
        label: labelPart?.trim() || targetPart.trim(),
        target: targetPart?.trim() ?? line,
        kind: "manual",
        source: "lista-local",
      });
    });

  return recipients;
}

function buildRecipientLine(label: string, target: string) {
  const cleanTarget = target.trim();
  const cleanLabel = label.trim();

  if (!cleanLabel || cleanLabel === cleanTarget) {
    return cleanTarget;
  }

  return `${cleanLabel}|${cleanTarget}`;
}

function parseDirectRecipientsInput(value: string) {
  const recipients: DispatchRecipient[] = [];
  const seenTargets = new Set<string>();

  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const fragments = line.includes("|")
        ? [line]
        : line
            .split(/[;,]+/)
            .map((item) => item.trim())
            .filter(Boolean);

      fragments.forEach((fragment) => {
        const separatorIndex = fragment.indexOf("|");
        const label =
          separatorIndex >= 0
            ? fragment.slice(0, separatorIndex).trim()
            : fragment.trim();
        const target =
          separatorIndex >= 0
            ? fragment.slice(separatorIndex + 1).trim()
            : fragment.trim();

        if (!target) {
          return;
        }

        const targetKey = target.toLowerCase();

        if (seenTargets.has(targetKey)) {
          return;
        }

        seenTargets.add(targetKey);
        recipients.push({
          id: crypto.randomUUID(),
          label: label || target,
          target,
          kind: "manual",
          source: "envio-rapido",
        });
      });
    });

  return recipients;
}

function resolveDirectScheduleValue(baseValue: string, index: number, totalRecipients: number) {
  if (!baseValue && totalRecipients === 1 && index === 0) {
    return null;
  }

  const baseDate = baseValue ? new Date(baseValue) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    return baseValue || null;
  }

  return new Date(baseDate.getTime() + index * 10_000).toISOString();
}

function parseContactCards(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fullName, phoneNumber, email, organization, url, wuid] = line
        .split("|")
        .map((part) => part.trim());
      return {
        fullName,
        phoneNumber,
        email,
        organization,
        url,
        wuid,
      };
    });
}

function parseListSections(value: string) {
  const sections = new Map<
    string,
    Array<{ title: string; description?: string; rowId: string }>
  >();

  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [sectionTitle, rowTitle, description = "", rowId = crypto.randomUUID()] =
        line.split("|").map((part) => part.trim());

      if (!sectionTitle || !rowTitle) {
        return;
      }

      const rows = sections.get(sectionTitle) ?? [];
      rows.push({ title: rowTitle, description, rowId });
      sections.set(sectionTitle, rows);
    });

  return [...sections.entries()].map(([title, rows]) => ({ title, rows }));
}

function parseButtons(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, displayText = title, id = crypto.randomUUID()] = line
        .split("|")
        .map((part) => part.trim());
      return { title, displayText, id };
    });
}

function buildMessagePayload(draft: MessageDraft) {
  return {
    type: draft.type,
    options: {
      linkPreview: draft.linkPreview,
      mentionsEveryOne: draft.mentionsEveryOne,
      mentioned: parseNumbers(draft.mentionedText),
      delayMs: Number(draft.delayMs || "0"),
      quoted: draft.quoted,
    },
    text: draft.text,
    mediaType: draft.mediaType,
    media: draft.mediaSource,
    mimeType: draft.mimeType,
    fileName: draft.fileName,
    caption: draft.caption,
    audio: draft.audioSource,
    sticker: draft.stickerSource,
    locationName: draft.locationName,
    locationAddress: draft.locationAddress,
    latitude: draft.latitude ? Number(draft.latitude) : undefined,
    longitude: draft.longitude ? Number(draft.longitude) : undefined,
    contactCards: parseContactCards(draft.contactCardsText),
    pollName: draft.pollName,
    pollOptions: parseNumbers(draft.pollOptionsText),
    pollSelectableCount: Number(draft.pollSelectableCount || "1"),
    listTitle: draft.listTitle,
    listDescription: draft.listDescription,
    listButtonText: draft.listButtonText,
    listFooterText: draft.listFooterText,
    listSections: parseListSections(draft.listSectionsText),
    buttonsTitle: draft.buttonsTitle,
    buttonsDescription: draft.buttonsDescription,
    buttonsFooter: draft.buttonsFooter,
    buttons: parseButtons(draft.buttonsText),
  };
}

function buildStatusPayload(draft: StatusDraft) {
  return {
    type: "status" as const,
    options: {
      linkPreview: false,
      mentionsEveryOne: false,
      mentioned: [],
      delayMs: 0,
      quoted: null,
    },
    statusType: draft.type,
    statusContent: draft.content,
    caption: draft.caption,
    statusBackgroundColor: draft.backgroundColor,
    statusFont: Number(draft.font || "1"),
  };
}

async function readFileAsBase64(file: File) {
  return new Promise<{ base64: string; mimeType: string; fileName: string }>(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result ?? "");
        const [, base64 = ""] = result.split(",");
        resolve({
          base64,
          mimeType: file.type,
          fileName: file.name,
        });
      };

      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    },
  );
}

function formatDateTime(value?: string | number | null) {
  if (!value) {
    return "sem data";
  }

  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatConnectionStatus(value?: string | null) {
  switch (value) {
    case "open":
      return "conectada";
    case "connecting":
      return "conectando";
    case "close":
      return "desconectada";
    default:
      return "sem status";
  }
}

function replacePresetInstanceName(path: string, instanceName: string) {
  return path.replaceAll("{instanceName}", instanceName);
}

function normalizeMessageForSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function formatAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha no login.";
  }

  const message = normalizeMessageForSearch(error.message);

  if (message.includes("invalid login credentials")) {
    return "Login ou senha inválidos.";
  }

  if (message.includes("email not confirmed")) {
    return "O email ainda não foi confirmado.";
  }

  return error.message;
}

function formatAppError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao processar a solicitação.";
  }

  const message = normalizeMessageForSearch(error.message);

  if (message.includes("não foi encontrada") || message.includes("nao foi encontrada")) {
    return "A instância não foi encontrada nesse token. Confira o nome exato cadastrado na Evolution.";
  }

  if (message.includes("duplicate key") || message.includes("unique constraint")) {
    return "Já existe uma instância com esse nome. Edite a existente ou use outro nome.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Tente novamente em alguns segundos.";
  }

  return error.message;
}

function normalizeSectionParam(value: string | null): SectionKey {
  const allowed: SectionKey[] = [
    "overview",
    "direct",
    "messages",
    "status",
    "campaigns",
    "groups",
    "contacts",
    "lists",
    "instances",
    "explorer",
  ];

  if (value && allowed.includes(value as SectionKey)) {
    return value as SectionKey;
  }

  return "overview";
}

export function OperationsConsole() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [instances, setInstances] = useState<ManagedInstanceView[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState("");
  const [syncedContacts, setSyncedContacts] = useState<ContactItem[]>([]);
  const [customContacts, setCustomContacts] = useState<CustomContact[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [broadcastLists, setBroadcastLists] = useState<BroadcastListRecord[]>([]);
  const [dispatchJobs, setDispatchJobs] = useState<DispatchJob[]>([]);
  const [messages, setMessages] = useState<SimplifiedMessage[]>([]);
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [selectedChatJid, setSelectedChatJid] = useState("");
  const [selectedGroupJid, setSelectedGroupJid] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<SimplifiedMessage | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [directTarget, setDirectTarget] = useState("");
  const [directLabel, setDirectLabel] = useState("");
  const [directJobName, setDirectJobName] = useState("");
  const [directScheduleAt, setDirectScheduleAt] = useState("");
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const [directMessageDraft, setDirectMessageDraft] = useState(createMessageDraft());
  const [campaignName, setCampaignName] = useState("Campanha com fila protegida");
  const [campaignScheduleAt, setCampaignScheduleAt] = useState("");
  const [campaignMessageDraft, setCampaignMessageDraft] = useState(createMessageDraft());
  const [campaignAudience, setCampaignAudience] = useState({
    includeAllContacts: false,
    includeAllGroups: false,
    includeAllGroupMembers: false,
    includeAllCustomContacts: true,
    selectedBroadcastListIds: [] as string[],
    manualNumbersText: "",
    csvNumbers: [] as string[],
  });
  const [statusDraft, setStatusDraft] = useState(createStatusDraft());
  const [customContactForm, setCustomContactForm] = useState({
    id: "",
    fullName: "",
    phoneNumber: "",
    email: "",
    organization: "",
    notes: "",
    tags: "",
  });
  const [broadcastForm, setBroadcastForm] = useState({
    id: "",
    name: "",
    description: "",
    recipientsText: "",
  });
  const [instanceDraft, setInstanceDraft] = useState<InstanceFormPayload>({
    instanceId: "",
    instanceName: "",
    apiToken: "",
    baseUrl: "",
    label: "",
    notes: "",
  });
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [blockStatus, setBlockStatus] = useState<"block" | "unblock">("block");
  const [groupCreateForm, setGroupCreateForm] = useState({
    subject: "",
    description: "",
    participantsText: "",
  });
  const [groupEditForm, setGroupEditForm] = useState({
    subject: "",
    description: "",
    participantAction: "add",
    participantsText: "",
    inviteDescription: "",
    inviteNumbersText: "",
    ephemeralSeconds: "0",
    settingAction: "announcement",
  });
  const [inviteCode, setInviteCode] = useState("");
  const [reactionText, setReactionText] = useState("🙏");
  const [editMessageText, setEditMessageText] = useState("");
  const [explorerMethod, setExplorerMethod] = useState("GET");
  const [explorerPath, setExplorerPath] = useState("/instance/fetchInstances");
  const [explorerQuery, setExplorerQuery] = useState("{}");
  const [explorerBody, setExplorerBody] = useState("{}");
  const [explorerResult, setExplorerResult] = useState("");
  const deferredContactSearch = useDeferredValue(contactSearch);
  const deferredChatSearch = useDeferredValue(chatSearch);
  const deferredGroupSearch = useDeferredValue(groupSearch);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadInstances();
  }, [session]);

  useEffect(() => {
    const sectionFromUrl = searchParams.get("section");

    if (!sectionFromUrl) {
      return;
    }

    const nextSection = normalizeSectionParam(sectionFromUrl);

    if (nextSection !== activeSection) {
      setActiveSection(nextSection);
    }
  }, [searchParams, activeSection]);

  useEffect(() => {
    if (!session || !activeInstanceId) {
      return;
    }

    window.localStorage.setItem("evolution-active-instance", activeInstanceId);
    void Promise.all([
      loadContacts(activeInstanceId),
      loadChats(activeInstanceId),
      loadGroups(activeInstanceId),
      loadBroadcastLists(activeInstanceId),
      loadDispatchJobs(activeInstanceId),
    ]);
  }, [session, activeInstanceId]);

  useEffect(() => {
    if (!session || !activeInstanceId || !selectedChatJid) {
      return;
    }

    void loadMessages(activeInstanceId, selectedChatJid);
  }, [session, activeInstanceId, selectedChatJid]);

  useEffect(() => {
    if (!session || !activeInstanceId || !selectedGroupJid) {
      return;
    }

    void loadParticipants(activeInstanceId, selectedGroupJid);
  }, [session, activeInstanceId, selectedGroupJid]);

  useEffect(() => {
    if (!session || !activeInstanceId) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadDispatchJobs(activeInstanceId, true);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session, activeInstanceId]);

  function navigateToSection(nextSection: SectionKey) {
    setActiveSection(nextSection);

    const params = new URLSearchParams(searchParams.toString());
    params.set("section", nextSection);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function authorizedFetch(url: string, init?: RequestInit) {
    if (!session) {
      throw new Error("Faça login para continuar.");
    }

    const headers = new Headers(init?.headers ?? {});
    headers.set("authorization", `Bearer ${session.access_token}`);

    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Falha ao processar a solicitação.");
    }

    return data;
  }

  async function runAction(action: string, payload: unknown) {
    return authorizedFetch("/api/actions", {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });
  }

  async function loadInstances() {
    const data = await authorizedFetch("/api/data?resource=instances");
    const nextInstances = data.instances as ManagedInstanceView[];
    setInstances(nextInstances);

    const stored = window.localStorage.getItem("evolution-active-instance");
    const desired =
      nextInstances.find((instance) => instance.id === stored)?.id ??
      nextInstances[0]?.id ??
      "";

    if (!activeInstanceId && desired) {
      setActiveInstanceId(desired);
    }
  }

  async function loadContacts(instanceId: string) {
    const data = await authorizedFetch(
      `/api/data?resource=contacts&instanceId=${encodeURIComponent(instanceId)}`,
    );
    setSyncedContacts(data.syncedContacts as ContactItem[]);
    setCustomContacts(data.customContacts as CustomContact[]);
  }

  async function loadChats(instanceId: string) {
    const data = await authorizedFetch(
      `/api/data?resource=chats&instanceId=${encodeURIComponent(instanceId)}`,
    );
    const nextChats = data.chats as ChatItem[];
    setChats(nextChats);

    if (!selectedChatJid && nextChats[0]?.remoteJid) {
      assignSelectedChat(nextChats[0]);
    }
  }

  async function loadGroups(instanceId: string) {
    const data = await authorizedFetch(
      `/api/data?resource=groups&instanceId=${encodeURIComponent(instanceId)}`,
    );
    const nextGroups = data.groups as GroupSummary[];
    setGroups(nextGroups);

    if (!selectedGroupJid && nextGroups[0]?.groupJid) {
      setSelectedGroupJid(nextGroups[0].groupJid);
    }
  }

  async function loadMessages(instanceId: string, remoteJid: string) {
    const data = await authorizedFetch(
      `/api/data?resource=messages&instanceId=${encodeURIComponent(
        instanceId,
      )}&remoteJid=${encodeURIComponent(remoteJid)}`,
    );
    setMessages(data.messages as SimplifiedMessage[]);
  }

  async function loadParticipants(instanceId: string, groupJid: string) {
    const data = await authorizedFetch(
      `/api/data?resource=group-members&instanceId=${encodeURIComponent(
        instanceId,
      )}&groupJid=${encodeURIComponent(groupJid)}`,
    );
    setParticipants(data.participants as GroupParticipant[]);
  }

  async function loadBroadcastLists(instanceId: string) {
    const data = await authorizedFetch(
      `/api/data?resource=broadcast-lists&instanceId=${encodeURIComponent(instanceId)}`,
    );
    setBroadcastLists(data.lists as BroadcastListRecord[]);
  }

  async function loadDispatchJobs(instanceId: string, silent = false) {
    try {
      const data = await authorizedFetch(
        `/api/data?resource=dispatch-jobs&instanceId=${encodeURIComponent(instanceId)}`,
      );
      setDispatchJobs(data.jobs as DispatchJob[]);
    } catch (error) {
      if (!silent) {
        throw error;
      }
    }
  }

  function assignSelectedChat(chat: ChatItem) {
    setSelectedChatJid(chat.remoteJid);
    setDirectTarget(chat.remoteJid);
    setDirectLabel(chat.pushName ?? chat.remoteJid);
  }

  function openDirectComposer(target: string, label: string, mode: "replace" | "append" = "replace") {
    const nextLine = buildRecipientLine(label, target);

    setDirectTarget((current) => {
      const trimmedCurrent = current.trim();

      if (mode === "append" && trimmedCurrent) {
        return `${trimmedCurrent}\n${nextLine}`;
      }

      return nextLine;
    });
    setDirectLabel(label);
    navigateToSection("direct");
  }

  function appendBroadcastListToDirectComposer(list: BroadcastListRecord) {
    const nextLines = list.recipients
      .map((recipient) => buildRecipientLine(recipient.label, recipient.target))
      .join("\n");

    setDirectTarget((current) => {
      const trimmedCurrent = current.trim();
      return trimmedCurrent ? `${trimmedCurrent}\n${nextLines}` : nextLines;
    });
    setNotice({
      tone: "info",
      text: `Lista ${list.name} adicionada ao envio rapido.`,
    });
    navigateToSection("direct");
  }

  function clearDirectComposer() {
    setDirectTarget("");
    setDirectLabel("");
    setDirectJobName("");
    setDirectScheduleAt("");
    setDirectMessageDraft(createMessageDraft());
  }

  function useMessageAsQuote(message: SimplifiedMessage) {
    setDirectMessageDraft((current) => ({
      ...current,
      quoted: {
        key: {
          id: message.key.id,
          remoteJid: message.key.remoteJid,
          fromMe: message.key.fromMe,
        },
        conversation: message.preview,
      },
    }));
    openDirectComposer(message.key.remoteJid, message.pushName ?? message.key.remoteJid);
  }

  function assignCustomContact(contact: CustomContact) {
    setCustomContactForm({
      id: contact.id,
      fullName: contact.fullName,
      phoneNumber: contact.phoneNumber,
      email: contact.email ?? "",
      organization: contact.organization ?? "",
      notes: contact.notes ?? "",
      tags: contact.tags.join(", "),
    });
  }

  function assignBroadcastList(list: BroadcastListRecord) {
    setBroadcastForm({
      id: list.id,
      name: list.name,
      description: list.description ?? "",
      recipientsText: list.recipients
        .map((recipient) => `${recipient.label}|${recipient.target}`)
        .join("\n"),
    });
  }

  function assignInstanceForEditing(instance: ManagedInstanceView) {
    setInstanceDraft({
      instanceId: instance.id,
      instanceName: instance.instanceName,
      apiToken: instance.apiToken,
      baseUrl: instance.baseUrl,
      label: String(instance.profile.label ?? instance.instanceName),
      notes: String(instance.profile.notes ?? ""),
    });
    navigateToSection("instances");
  }

  async function handleRegisterInstance(payload: InstanceFormPayload) {
    const result = await runAction("register-instance", payload);
    await loadInstances();
    setActiveInstanceId(result.instance.id);
    setInstanceDraft({
      instanceId: "",
      instanceName: "",
      apiToken: "",
      baseUrl: activeInstance?.baseUrl ?? payload.baseUrl,
      label: "",
      notes: "",
    });
    setNotice({
      tone: "success",
      text: payload.instanceId
        ? "Instância atualizada com sucesso."
        : "Instância validada e salva com sucesso.",
    });
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setAuthBusy(true);
      const result = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (result.error) {
        throw result.error;
      }

      setNotice({ tone: "success", text: "Login realizado com sucesso." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: formatAuthError(error),
      });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setInstances([]);
    setActiveInstanceId("");
  }

  async function handleQueueDirectMessage() {
    if (!activeInstanceId || !directTarget) {
      setNotice({
        tone: "error",
        text: "Escolha uma instância e informe o destino.",
      });
      return;
    }

    const result = await runAction("queue-message", {
      instanceId: activeInstanceId,
      target: directTarget,
      label: directLabel || directTarget,
      name: directJobName || `Envio para ${directLabel || directTarget}`,
      scheduledFor: directScheduleAt || null,
      message: buildMessagePayload(directMessageDraft),
    });

    setNotice({
      tone: "success",
      text: `Job ${result.job.id} criado com sucesso.`,
    });
    await loadDispatchJobs(activeInstanceId);
  }

  async function handleQueueDirectBatch() {
    const parsedRecipients = parseDirectRecipientsInput(directTarget);
    const recipients = parsedRecipients.map((recipient) => ({
      ...recipient,
      label:
        directLabel.trim() && parsedRecipients.length === 1 && recipient.label === recipient.target
          ? directLabel.trim()
          : recipient.label,
    }));

    if (!activeInstanceId || recipients.length === 0) {
      setNotice({
        tone: "error",
        text: "Escolha uma instancia e informe ao menos um destino valido.",
      });
      return;
    }

    try {
      setDirectSubmitting(true);

      const jobs: DispatchJob[] = [];

      for (const [index, recipient] of recipients.entries()) {
        const result = await runAction("queue-message", {
          instanceId: activeInstanceId,
          target: recipient.target,
          label: recipient.label,
          name:
            directJobName.trim()
              ? recipients.length === 1
                ? directJobName.trim()
                : `${directJobName.trim()} ${String(index + 1).padStart(2, "0")}`
              : `Envio para ${recipient.label || recipient.target}`,
          scheduledFor: resolveDirectScheduleValue(
            directScheduleAt,
            index,
            recipients.length,
          ),
          message: buildMessagePayload(directMessageDraft),
        });

        jobs.push(result.job as DispatchJob);
      }

      setNotice({
        tone: "success",
        text:
          recipients.length === 1
            ? `Job ${jobs[0]?.id ?? ""} criado com sucesso.`
            : `${jobs.length} envios unitarios foram enfileirados com pausa de 10 segundos entre eles.`,
      });
      setDirectMessageDraft((current) => ({
        ...current,
        quoted: null,
      }));
      await loadDispatchJobs(activeInstanceId);
    } catch (error) {
      setNotice({
        tone: "error",
        text: formatAppError(error),
      });
    } finally {
      setDirectSubmitting(false);
    }
  }

  async function handleCreateCampaign() {
    if (!activeInstanceId) {
      return;
    }

    const result = await runAction("create-campaign", {
      instanceId: activeInstanceId,
      name: campaignName,
      scheduledFor: campaignScheduleAt || null,
      audience: {
        includeAllContacts: campaignAudience.includeAllContacts,
        includeAllGroups: campaignAudience.includeAllGroups,
        includeAllGroupMembers: campaignAudience.includeAllGroupMembers,
        includeAllCustomContacts: campaignAudience.includeAllCustomContacts,
        selectedBroadcastListIds: campaignAudience.selectedBroadcastListIds,
        manualNumbers: parseNumbers(campaignAudience.manualNumbersText),
        csvNumbers: campaignAudience.csvNumbers,
      },
      message: buildMessagePayload(campaignMessageDraft),
    });

    setNotice({
      tone: "success",
      text: `Campanha criada com ${result.job.totalRecipients} destinatários.`,
    });
    await loadDispatchJobs(activeInstanceId);
  }

  async function handleStatusSend() {
    if (!activeInstanceId) {
      return;
    }

    await runAction("send-status", {
      instanceId: activeInstanceId,
      allContacts: statusDraft.allContacts,
      statusJidList: parseNumbers(statusDraft.statusTargetsText),
      message: buildStatusPayload(statusDraft),
    });
    setNotice({ tone: "success", text: "Status enviado." });
  }

  async function handleSaveCustomContact() {
    if (!activeInstanceId) {
      return;
    }

    await runAction("save-custom-contact", {
      instanceId: activeInstanceId,
      ...customContactForm,
    });
    await loadContacts(activeInstanceId);
    setNotice({ tone: "success", text: "Contato local salvo." });
  }

  async function handleSaveBroadcastList() {
    if (!activeInstanceId) {
      return;
    }

    await runAction("save-broadcast-list", {
      instanceId: activeInstanceId,
      id: broadcastForm.id,
      name: broadcastForm.name,
      description: broadcastForm.description,
      recipients: parseRecipientLines(broadcastForm.recipientsText),
    });
    await loadBroadcastLists(activeInstanceId);
    setNotice({ tone: "success", text: "Lista salva." });
  }

  async function handleLookup(action: string) {
    if (!activeInstanceId || !lookupNumber) {
      return;
    }

    const payload =
      action === "check-whatsapp"
        ? { instanceId: activeInstanceId, numbers: parseNumbers(lookupNumber) }
        : action === "update-block-status"
          ? { instanceId: activeInstanceId, number: lookupNumber, status: blockStatus }
          : { instanceId: activeInstanceId, number: lookupNumber };

    const result = await runAction(action, payload);
    setLookupResult(JSON.stringify(result.result ?? result, null, 2));
  }

  async function handleCreateGroup() {
    if (!activeInstanceId) {
      return;
    }

    await runAction("create-group", {
      instanceId: activeInstanceId,
      subject: groupCreateForm.subject,
      description: groupCreateForm.description,
      participants: parseNumbers(groupCreateForm.participantsText),
    });
    await loadGroups(activeInstanceId);
    setNotice({ tone: "success", text: "Grupo criado." });
  }

  async function handleGroupAction(action: string) {
    if (!activeInstanceId || !selectedGroupJid) {
      return;
    }

    let payload: Record<string, unknown> = {
      instanceId: activeInstanceId,
      groupJid: selectedGroupJid,
    };

    if (action === "update-group-subject") {
      payload.subject = groupEditForm.subject;
    }

    if (action === "update-group-description") {
      payload.description = groupEditForm.description;
    }

    if (action === "update-group-members") {
      payload = {
        ...payload,
        action: groupEditForm.participantAction,
        participants: parseNumbers(groupEditForm.participantsText),
      };
    }

    if (action === "update-group-setting") {
      payload.action = groupEditForm.settingAction;
    }

    if (action === "toggle-group-ephemeral") {
      payload.expiration = Number(groupEditForm.ephemeralSeconds || "0");
    }

    if (action === "send-group-invite") {
      payload = {
        ...payload,
        numbers: parseNumbers(groupEditForm.inviteNumbersText),
        description: groupEditForm.inviteDescription,
      };
    }

    const result = await runAction(action, payload);

    if (action === "fetch-group-invite-code") {
      setInviteCode(JSON.stringify(result.result ?? result, null, 2));
    }

    await loadGroups(activeInstanceId);
    await loadParticipants(activeInstanceId, selectedGroupJid);
  }

  async function handleMessageAction(action: string) {
    if (!activeInstanceId || !selectedMessage) {
      return;
    }

    const payload: Record<string, unknown> = {
      instanceId: activeInstanceId,
      messageKey: selectedMessage.key,
    };

    if (action === "send-reaction") {
      payload.reaction = reactionText;
    }

    if (action === "update-message") {
      payload.text = editMessageText;
    }

    if (action === "mark-chat-unread" || action === "archive-chat") {
      payload.chat = selectedMessage.key.remoteJid;
    }

    await runAction(action, payload);
    await loadMessages(activeInstanceId, selectedMessage.key.remoteJid);
  }

  async function handleProcessQueueNow() {
    const result = await runAction("process-dispatches", {});
    setNotice({
      tone: "info",
      text: result.result?.reason ?? `Processadas ${result.result?.processed ?? 0} filas.`,
    });
    if (activeInstanceId) {
      await loadDispatchJobs(activeInstanceId);
    }
  }

  async function handleExplorerRun() {
    if (!activeInstanceId) {
      return;
    }

    const result = await runAction("explorer-request", {
      instanceId: activeInstanceId,
      method: explorerMethod,
      path: explorerPath,
      query: parseJsonInput(explorerQuery),
      body: parseJsonInput(explorerBody),
    });

    setExplorerResult(JSON.stringify(result.result ?? result, null, 2));
  }

  const filteredContacts = syncedContacts.filter((contact) => {
    const haystack = `${contact.pushName ?? ""} ${contact.remoteJid} ${contact.type ?? ""}`.toLowerCase();
    return haystack.includes(deferredContactSearch.toLowerCase());
  });

  const filteredChats = chats.filter((chat) => {
    const haystack = `${chat.pushName ?? ""} ${chat.remoteJid} ${chat.lastMessagePreview}`.toLowerCase();
    return haystack.includes(deferredChatSearch.toLowerCase());
  });

  const filteredGroups = groups.filter((group) => {
    const haystack = `${group.subject} ${group.groupJid}`.toLowerCase();
    return haystack.includes(deferredGroupSearch.toLowerCase());
  });

  const activeInstance = instances.find((instance) => instance.id === activeInstanceId) ?? null;
  const activeSummary = activeInstance?.summary ?? null;
  const activeWorkspace = SECTION_TO_WORKSPACE[activeSection];
  const workspaceTabs = WORKSPACE_TABS[activeWorkspace];
  const workspaceCopy = WORKSPACE_COPY[activeWorkspace];
  const directRecipients = parseDirectRecipientsInput(directTarget);
  const quickChats = chats.slice(0, 6);
  const quickContacts = syncedContacts.filter((contact) => !contact.isGroup).slice(0, 6);
  const quickCustomContacts = customContacts.slice(0, 6);
  const quickBroadcastLists = broadcastLists.slice(0, 4);
  const directJobs = dispatchJobs.filter((job) => job.totalRecipients === 1).slice(0, 8);

  if (authLoading) {
    return <div className="empty-state">Inicializando sistema...</div>;
  }

  if (!session) {
    return (
      <div className="login-shell">
        <div className="login-art">
          <div className="orbits">
            <div className="orbit" />
            <div className="orbit" />
            <div className="orbit" />
            <div className="core">
              <div className="hero-copy">
                <p className="badge is-good">Evolution + Supabase + Vercel</p>
                <h1 className="hero-title">Uma central clara para enviar, organizar e acompanhar mensagens no WhatsApp.</h1>
                <p className="brand-subtitle">
                  Interface pensada para o usuário final, com os recursos técnicos separados para não atrapalhar a operação do dia a dia.
                </p>
              </div>
            </div>
            <div className="orbit-node">Mensagens</div>
            <div className="orbit-node">Agendamentos</div>
            <div className="orbit-node">Instâncias</div>
            <div className="orbit-node">Explorer</div>
          </div>
        </div>
        <div className="login-panel">
          <form className="panel stack" onSubmit={handleLogin}>
            <h2 className="panel-title">Entrar no sistema</h2>
            <Field label="Login">
              <input
                autoComplete="email"
                placeholder="voce@empresa.com"
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
            </Field>
            <Field label="Senha">
              <input
                autoComplete="current-password"
                placeholder="Sua senha"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </Field>
            <button className="button" disabled={authBusy} type="submit">
              {authBusy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">CM</div>
          <div>
            <h1 className="brand-title">Central de Mensagens</h1>
            <p className="brand-subtitle">Fluxo diário em linguagem simples, com o modo técnico isolado quando necessário.</p>
          </div>
        </div>
        <div className="card sidebar-card">
          <Field label="Instância ativa">
            <select value={activeInstanceId} onChange={(event) => setActiveInstanceId(event.target.value)}>
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.instanceName}
                </option>
              ))}
            </select>
          </Field>
          <div className="badge-row" style={{ marginTop: 14 }}>
            <span className="badge is-good">Delay mínimo 10s</span>
            <span className="badge">{session.user.email}</span>
          </div>
        </div>
        <div className="sidebar-note">
          <p className="helper-kicker">Uso diário</p>
          <p className="section-copy">
            Primeiro vem o que a pessoa quer fazer. O técnico ficou concentrado apenas na área avançada.
          </p>
        </div>
        <button className="button-ghost sidebar-logout" type="button" onClick={handleLogout}>
          Sair
        </button>
      </aside>

      <main className="main">
        {notice ? (
          <div className={`notice ${notice.tone === "success" ? "is-success" : notice.tone === "error" ? "is-error" : ""}`}>
            <span>{notice.text}</span>
          </div>
        ) : null}

        <section className="workspace-header">
          <div>
            <p className="helper-kicker">{workspaceCopy.kicker}</p>
            <h2 className="workspace-title">{workspaceCopy.title}</h2>
            <p className="section-copy">
              {workspaceCopy.description}
            </p>
          </div>
          <div className="workspace-header-badges">
            <span className="badge is-good">Fluxo guiado</span>
            {activeInstance ? (
              <span className="badge">Instância ativa: {activeInstance.instanceName}</span>
            ) : (
              <span className="badge">Sem instância ativa</span>
            )}
          </div>
        </section>

        <nav className="workspace-nav" aria-label="SeÃ§Ãµes do painel">
          {PRIMARY_NAV_ITEMS.map((item, index) => (
            <button
              key={item.key}
              className={`workspace-nav-button ${activeWorkspace === item.key ? "is-active" : ""}`}
              onClick={() => navigateToSection(item.defaultSection)}
              type="button"
            >
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>

        {workspaceTabs.length > 1 ? (
          <div className="workspace-subnav" aria-label="Tarefas da área atual">
            {workspaceTabs.map((item) => (
              <button
                key={item.key}
                className={`workspace-subnav-button ${activeSection === item.key ? "is-active" : ""}`}
                onClick={() => navigateToSection(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        <section className="hero">
          <div className="hero-top">
            <div>
              <p className="badge is-good">
                {activeWorkspace === "advanced" ? "Área avançada" : "Área guiada"}
              </p>
              <h2 className="hero-title">
                {activeInstance?.profile.label
                  ? String(activeInstance.profile.label)
                  : activeInstance?.instanceName ?? "Conecte uma instância"}
              </h2>
              <p className="brand-subtitle">
                {activeSummary
                  ? `Conta ${formatConnectionStatus(activeSummary.connectionStatus)}${activeSummary.profileName ? ` • ${activeSummary.profileName}` : ""}`
                  : "Cadastre e selecione uma instância para começar a operar."}
              </p>
            </div>
            <div className="actions-row">
              <button className="button-ghost" type="button" onClick={handleProcessQueueNow}>
                Processar fila agora
              </button>
            </div>
          </div>
          <div className="hero-grid">
            <div className="stat-card">
              <span className="muted">Contatos</span>
              <strong>{activeSummary?.counts.contacts ?? 0}</strong>
            </div>
            <div className="stat-card">
              <span className="muted">Conversas</span>
              <strong>{activeSummary?.counts.chats ?? 0}</strong>
            </div>
            <div className="stat-card">
              <span className="muted">Mensagens</span>
              <strong>{activeSummary?.counts.messages ?? 0}</strong>
            </div>
            <div className="stat-card">
              <span className="muted">Jobs</span>
              <strong>{dispatchJobs.length}</strong>
            </div>
          </div>
        </section>

        {activeSection === "overview" ? (
          <div className="overview-grid">
            <section className="panel overview-feature stack">
              <div className="panel-head">
                <div>
                  <p className="badge is-good">Comece por aqui</p>
                  <h3 className="panel-title">O sistema agora segue a jornada de trabalho do usuário final.</h3>
                </div>
                <span className="badge">{instances.length} conexões</span>
              </div>
              <p className="section-copy">
                Em vez de pensar na API, você pode seguir uma sequência simples para conectar, organizar o público, enviar e acompanhar.
              </p>
              <div className="journey-grid">
                {HOME_STEPS.map((step) => (
                  <button
                    className="journey-card"
                    key={step.title}
                    onClick={() => navigateToSection(step.section)}
                    type="button"
                  >
                    <strong>{step.title}</strong>
                    <p className="section-copy">{step.description}</p>
                  </button>
                ))}
              </div>
            </section>
            <div className="overview-side-stack">
              {CAPABILITIES.map((item) => (
                <section className="panel compact-panel" key={item.title}>
                  <h3 className="panel-title">{item.title}</h3>
                  <p className="section-copy">{item.description}</p>
                </section>
              ))}
            </div>
          </div>
        ) : null}

        {activeSection === "direct" ? (
          <div className="direct-layout">
            <section className="panel direct-composer-panel stack">
              <div className="panel-head">
                <div>
                  <p className="helper-kicker">Envio sem campanha</p>
                  <h3 className="panel-title">Monte mensagens unitarias em um lugar proprio.</h3>
                  <p className="section-copy">
                    Cole um numero, um JID ou varias linhas e o sistema cria envios separados, sem virar campanha.
                  </p>
                </div>
                <div className="badge-row">
                  <span className="badge is-good">
                    {directRecipients.length} destino{directRecipients.length === 1 ? "" : "s"}
                  </span>
                  <span className="badge">Tipo {directMessageDraft.type}</span>
                </div>
              </div>

              {directMessageDraft.quoted ? (
                <div className="quote-card">
                  <div>
                    <strong>Citando mensagem</strong>
                    <p className="section-copy">{directMessageDraft.quoted.conversation}</p>
                  </div>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() =>
                      setDirectMessageDraft((current) => ({
                        ...current,
                        quoted: null,
                      }))
                    }
                  >
                    Remover citacao
                  </button>
                </div>
              ) : null}

              <Field label="Destinos">
                <textarea
                  placeholder={"5511999999999\nJoao|551188887777\ngrupo@broadcast"}
                  value={directTarget}
                  onChange={(event) => setDirectTarget(event.target.value)}
                />
              </Field>
              <p className="field-help">
                Use uma linha por destino. Se houver mais de um destino, cada envio vira um job proprio com intervalo minimo de 10 segundos.
              </p>
              <div className="field-grid">
                <Field label="Rotulo padrao">
                  <input value={directLabel} onChange={(event) => setDirectLabel(event.target.value)} />
                </Field>
                <Field label="Nome da fila">
                  <input value={directJobName} onChange={(event) => setDirectJobName(event.target.value)} />
                </Field>
              </div>
              <Field label="Agendar a partir de (opcional)">
                <input type="datetime-local" value={directScheduleAt} onChange={(event) => setDirectScheduleAt(event.target.value)} />
              </Field>
              <MessageBuilder draft={directMessageDraft} setDraft={setDirectMessageDraft} />
              <div className="actions-row">
                <button
                  className="button"
                  disabled={directSubmitting || !activeInstanceId || directRecipients.length === 0}
                  type="button"
                  onClick={handleQueueDirectBatch}
                >
                  {directSubmitting
                    ? "Enfileirando..."
                    : directRecipients.length > 1
                      ? `Enfileirar ${directRecipients.length} envios`
                      : "Enfileirar envio"}
                </button>
                <button className="button-ghost" type="button" onClick={clearDirectComposer}>
                  Limpar composicao
                </button>
              </div>
            </section>

            <div className="direct-side-stack">
              <section className="panel stack">
                <div className="panel-head">
                  <div>
                    <p className="helper-kicker">Atalhos</p>
                    <h3 className="panel-title">Puxe destinos sem sair do fluxo.</h3>
                  </div>
                </div>

                <div className="shortcut-stack">
                  <div className="shortcut-block">
                    <div className="list-item-title-row">
                      <strong>Conversas recentes</strong>
                      <span className="muted">{quickChats.length} atalhos</span>
                    </div>
                    <div className="recipient-chip-grid">
                      {quickChats.map((chat) => (
                        <button
                          className="recipient-chip"
                          key={chat.remoteJid}
                          type="button"
                          onClick={() => openDirectComposer(chat.remoteJid, chat.pushName ?? chat.remoteJid, "append")}
                        >
                          <strong>{chat.pushName ?? chat.remoteJid}</strong>
                          <span>{chat.remoteJid}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="shortcut-block">
                    <div className="list-item-title-row">
                      <strong>Contatos sincronizados</strong>
                      <span className="muted">{quickContacts.length} contatos</span>
                    </div>
                    <div className="recipient-chip-grid">
                      {quickContacts.map((contact) => (
                        <button
                          className="recipient-chip"
                          key={contact.id}
                          type="button"
                          onClick={() => openDirectComposer(contact.remoteJid, contact.pushName ?? contact.remoteJid, "append")}
                        >
                          <strong>{contact.pushName ?? contact.remoteJid}</strong>
                          <span>{contact.remoteJid}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="shortcut-block">
                    <div className="list-item-title-row">
                      <strong>Contatos locais</strong>
                      <span className="muted">{quickCustomContacts.length} salvos</span>
                    </div>
                    <div className="recipient-chip-grid">
                      {quickCustomContacts.map((contact) => (
                        <button
                          className="recipient-chip"
                          key={contact.id}
                          type="button"
                          onClick={() => openDirectComposer(contact.phoneNumber, contact.fullName, "append")}
                        >
                          <strong>{contact.fullName}</strong>
                          <span>{contact.phoneNumber}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="shortcut-block">
                    <div className="list-item-title-row">
                      <strong>Listas salvas</strong>
                      <span className="muted">{quickBroadcastLists.length} listas</span>
                    </div>
                    <div className="recipient-chip-grid">
                      {quickBroadcastLists.map((list) => (
                        <button
                          className="recipient-chip"
                          key={list.id}
                          type="button"
                          onClick={() => appendBroadcastListToDirectComposer(list)}
                        >
                          <strong>{list.name}</strong>
                          <span>{list.recipients.length} destinos</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel stack">
                <div className="panel-head">
                  <div>
                    <p className="helper-kicker">Fila unitaria</p>
                    <h3 className="panel-title">Acompanhe envios fora do modo campanha.</h3>
                  </div>
                </div>

                {directJobs.length > 0 ? (
                  <div className="stack">
                    {directJobs.map((job) => (
                      <div className="card compact-job-card" key={job.id}>
                        <div className="card-head">
                          <div>
                            <h4 className="panel-title">{job.name}</h4>
                            <p className="section-copy">
                              {job.recipients[0]?.label ?? job.recipients[0]?.target ?? "Destino nao identificado"}
                            </p>
                          </div>
                          <span
                            className={`badge ${
                              job.status === "completed"
                                ? "is-good"
                                : job.status === "failed"
                                  ? "is-danger"
                                  : "is-warn"
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>
                        <div className="badge-row">
                          <span className="badge">Agenda {formatDateTime(job.scheduledFor)}</span>
                          <span className="badge">Throttle {Math.round(job.throttleMs / 1000)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">Nenhum envio unitario foi criado ainda.</div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {activeSection === "messages" ? (
          <div className="conversation-layout">
            <section className="panel">
              <Field label="Buscar conversa">
                <input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} />
              </Field>
              <div className="scroll-list stack" style={{ marginTop: 16 }}>
                {filteredChats.slice(0, 120).map((chat) => (
                  <button className={`list-item ${selectedChatJid === chat.remoteJid ? "is-selected" : ""}`} key={chat.remoteJid} onClick={() => assignSelectedChat(chat)} type="button">
                    <strong>{chat.pushName ?? chat.remoteJid}</strong>
                    <span className="muted">{chat.remoteJid}</span>
                    <span className="section-copy">{chat.lastMessagePreview}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="panel stack">
              <div className="panel-head">
                <div>
                  <p className="helper-kicker">Conversa ativa</p>
                  <h3 className="panel-title">{selectedChatJid || "Selecione uma conversa"}</h3>
                </div>
                {selectedChatJid ? (
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() =>
                      openDirectComposer(
                        selectedChatJid,
                        chats.find((chat) => chat.remoteJid === selectedChatJid)?.pushName ?? selectedChatJid,
                      )
                    }
                  >
                    Abrir no envio rapido
                  </button>
                ) : null}
              </div>
              <div className="scroll-list thread">
                {messages.map((message) => (
                  <button
                    className={`message-bubble ${message.key.fromMe ? "is-me" : ""} ${selectedMessage?.id === message.id ? "is-selected" : ""}`}
                    key={message.id}
                    onClick={() => {
                      setSelectedMessage(message);
                      setEditMessageText(message.preview);
                    }}
                    type="button"
                  >
                    <div className="message-meta">
                      <span>{message.pushName ?? message.key.remoteJid}</span>
                      <span>{formatDateTime(message.messageTimestamp)}</span>
                    </div>
                    <strong>{message.messageType}</strong>
                    <span>{message.preview}</span>
                    <div className="actions-row">
                      <button className="button-ghost" onClick={() => useMessageAsQuote(message)} type="button">
                        Citar
                      </button>
                    </div>
                  </button>
                ))}
              </div>
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="field-grid">
                  <Field label="Reação">
                    <input value={reactionText} onChange={(event) => setReactionText(event.target.value)} />
                  </Field>
                  <Field label="Novo texto">
                    <input value={editMessageText} onChange={(event) => setEditMessageText(event.target.value)} />
                  </Field>
                </div>
                <div className="actions-row" style={{ marginTop: 14 }}>
                  <button className="button-ghost" type="button" onClick={() => handleMessageAction("send-reaction")}>Reagir</button>
                  <button className="button-ghost" type="button" onClick={() => handleMessageAction("update-message")}>Editar</button>
                  <button className="button-danger" type="button" onClick={() => handleMessageAction("delete-message")}>Apagar</button>
                </div>
              </div>
            </section>
            <section className="panel stack legacy-direct-panel" aria-hidden="true">
              <Field label="Destino">
                <input value={directTarget} onChange={(event) => setDirectTarget(event.target.value)} />
              </Field>
              <Field label="Rótulo">
                <input value={directLabel} onChange={(event) => setDirectLabel(event.target.value)} />
              </Field>
              <Field label="Agendar para (opcional)">
                <input type="datetime-local" value={directScheduleAt} onChange={(event) => setDirectScheduleAt(event.target.value)} />
              </Field>
              <MessageBuilder draft={directMessageDraft} setDraft={setDirectMessageDraft} />
              <button className="button" type="button" onClick={handleQueueDirectMessage}>
                Enfileirar envio
              </button>
            </section>
          </div>
        ) : null}

        {activeSection === "status" ? (
          <div className="two-grid">
            <section className="panel stack">
              <div className="panel-head">
                <div>
                  <p className="helper-kicker">Status do WhatsApp</p>
                  <h3 className="panel-title">Publique um status sem sair da central de envio.</h3>
                  <p className="section-copy">
                    Use esta área para avisos rápidos, convites, chamadas para culto ou qualquer atualização que deva aparecer no status.
                  </p>
                </div>
              </div>
              <div className="field-grid">
                <Field label="Tipo">
                  <select
                    value={statusDraft.type}
                    onChange={(event) =>
                      setStatusDraft((current) => ({
                        ...current,
                        type: event.target.value as StatusDraft["type"],
                      }))
                    }
                  >
                    <option value="text">Texto</option>
                    <option value="image">Imagem</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </Field>
                <Field label="Enviar para">
                  <select
                    value={statusDraft.allContacts ? "all" : "selected"}
                    onChange={(event) =>
                      setStatusDraft((current) => ({
                        ...current,
                        allContacts: event.target.value === "all",
                      }))
                    }
                  >
                    <option value="all">Todos os contatos</option>
                    <option value="selected">Somente números escolhidos</option>
                  </select>
                </Field>
              </div>
              <Field label={statusDraft.type === "text" ? "Texto do status" : "Base64 ou URL"}>
                <textarea
                  value={statusDraft.content}
                  onChange={(event) =>
                    setStatusDraft((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                />
              </Field>
              {statusDraft.type !== "text" ? (
                <FileLoader
                  label="Carregar arquivo"
                  onLoad={async (file) => {
                    const result = await readFileAsBase64(file);
                    setStatusDraft((current) => ({
                      ...current,
                      content: result.base64,
                    }));
                  }}
                />
              ) : null}
              <Field label="Legenda (opcional)">
                <input
                  value={statusDraft.caption}
                  onChange={(event) =>
                    setStatusDraft((current) => ({
                      ...current,
                      caption: event.target.value,
                    }))
                  }
                />
              </Field>
              {statusDraft.type === "text" ? (
                <div className="field-grid">
                  <Field label="Cor de fundo">
                    <input
                      type="color"
                      value={statusDraft.backgroundColor}
                      onChange={(event) =>
                        setStatusDraft((current) => ({
                          ...current,
                          backgroundColor: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Fonte">
                    <select
                      value={statusDraft.font}
                      onChange={(event) =>
                        setStatusDraft((current) => ({
                          ...current,
                          font: event.target.value,
                        }))
                      }
                    >
                      <option value="1">Fonte 1</option>
                      <option value="2">Fonte 2</option>
                      <option value="3">Fonte 3</option>
                      <option value="4">Fonte 4</option>
                    </select>
                  </Field>
                </div>
              ) : null}
              {!statusDraft.allContacts ? (
                <Field label="Números permitidos">
                  <textarea
                    placeholder={"5511999999999\n551188887777"}
                    value={statusDraft.statusTargetsText}
                    onChange={(event) =>
                      setStatusDraft((current) => ({
                        ...current,
                        statusTargetsText: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}
              <div className="actions-row">
                <button className="button" type="button" onClick={handleStatusSend}>
                  Publicar status
                </button>
                <button
                  className="button-ghost"
                  type="button"
                  onClick={() => setStatusDraft(createStatusDraft())}
                >
                  Limpar
                </button>
              </div>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <div>
                  <p className="helper-kicker">Quando usar</p>
                  <h3 className="panel-title">Status serve para comunicar, não para substituir campanha.</h3>
                </div>
              </div>
              <div className="helper-grid">
                <div className="helper-card">
                  <strong>Bom para avisos</strong>
                  <p className="section-copy">Use para lembretes, convites, programação semanal ou comunicados curtos.</p>
                </div>
                <div className="helper-card">
                  <strong>Bom para reforço visual</strong>
                  <p className="section-copy">Imagem, vídeo ou áudio ajudam quando você quer chamar atenção sem abrir conversa individual.</p>
                </div>
                <div className="helper-card">
                  <strong>Todos ou selecionados</strong>
                  <p className="section-copy">Você pode publicar para todos os contatos ou restringir a uma lista de números.</p>
                </div>
                <div className="helper-card">
                  <strong>Fluxo separado</strong>
                  <p className="section-copy">O status fica nesta área para não confundir com envio rápido ou campanha agendada.</p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeSection === "campaigns" ? (
          <div className="two-grid">
            <section className="panel stack">
              <Field label="Nome da campanha">
                <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
              </Field>
              <Field label="Agendar para (opcional)">
                <input type="datetime-local" value={campaignScheduleAt} onChange={(event) => setCampaignScheduleAt(event.target.value)} />
              </Field>
              <div className="toggle-row">
                <label className="toggle"><input checked={campaignAudience.includeAllContacts} onChange={(event) => setCampaignAudience((current) => ({ ...current, includeAllContacts: event.target.checked }))} type="checkbox" /><span>Todos os contatos</span></label>
                <label className="toggle"><input checked={campaignAudience.includeAllGroups} onChange={(event) => setCampaignAudience((current) => ({ ...current, includeAllGroups: event.target.checked }))} type="checkbox" /><span>Todos os grupos</span></label>
                <label className="toggle"><input checked={campaignAudience.includeAllGroupMembers} onChange={(event) => setCampaignAudience((current) => ({ ...current, includeAllGroupMembers: event.target.checked }))} type="checkbox" /><span>Todos os membros dos grupos</span></label>
                <label className="toggle"><input checked={campaignAudience.includeAllCustomContacts} onChange={(event) => setCampaignAudience((current) => ({ ...current, includeAllCustomContacts: event.target.checked }))} type="checkbox" /><span>Todos os contatos locais</span></label>
              </div>
              <Field label="Números manuais">
                <textarea value={campaignAudience.manualNumbersText} onChange={(event) => setCampaignAudience((current) => ({ ...current, manualNumbersText: event.target.value }))} />
              </Field>
              <section className="card">
                <div className="card-head">
                  <div>
                    <h4 className="panel-title">Listas personalizadas para envio agendado</h4>
                    <p className="section-copy">Selecione uma ou várias listas salvas para compor a campanha.</p>
                  </div>
                </div>
                <div className="toggle-row">
                  {broadcastLists.map((list) => (
                    <label className="toggle" key={list.id}>
                      <input
                        checked={campaignAudience.selectedBroadcastListIds.includes(list.id)}
                        onChange={(event) => {
                          setCampaignAudience((current) => ({
                            ...current,
                            selectedBroadcastListIds: event.target.checked
                              ? [...current.selectedBroadcastListIds, list.id]
                              : current.selectedBroadcastListIds.filter((item) => item !== list.id),
                          }));
                        }}
                        type="checkbox"
                      />
                      <span>{list.name}</span>
                    </label>
                  ))}
                </div>
              </section>
              <FileLoader
                label={`Importar CSV (${campaignAudience.csvNumbers.length} números)`}
                accept=".csv,text/csv"
                onLoad={async (file) => {
                  const text = await file.text();
                  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
                  const extracted = parsed.data.flatMap((row) => Object.values(row).map((value) => String(value ?? "").trim()).filter((value) => /[\d+]/.test(value)));
                  setCampaignAudience((current) => ({ ...current, csvNumbers: extracted }));
                }}
              />
              <MessageBuilder draft={campaignMessageDraft} setDraft={setCampaignMessageDraft} />
              <button className="button" type="button" onClick={handleCreateCampaign}>
                Criar campanha
              </button>
            </section>
            <section className="panel">
              <div className="scroll-list stack">
                {dispatchJobs.map((job) => (
                  <div className="card" key={job.id}>
                    <div className="card-head">
                      <div>
                        <h4 className="panel-title">{job.name}</h4>
                        <p className="section-copy">Agenda: {formatDateTime(job.scheduledFor)}</p>
                      </div>
                      <span className={`badge ${job.status === "completed" ? "is-good" : job.status === "failed" ? "is-danger" : "is-warn"}`}>{job.status}</span>
                    </div>
                    <div className="badge-row">
                      <span className="badge">Total {job.totalRecipients}</span>
                      <span className="badge is-good">Ok {job.successfulRecipients}</span>
                      <span className="badge is-danger">Falhas {job.failedRecipients}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeSection === "groups" ? (
          <div className="three-grid">
            <section className="panel">
              <Field label="Buscar grupo">
                <input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} />
              </Field>
              <div className="scroll-list stack" style={{ marginTop: 16 }}>
                {filteredGroups.map((group) => (
                  <button className={`list-item ${selectedGroupJid === group.groupJid ? "is-selected" : ""}`} key={group.groupJid} onClick={() => setSelectedGroupJid(group.groupJid)} type="button">
                    <strong>{group.subject}</strong>
                    <span className="muted">{group.groupJid}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="scroll-list stack">
                {participants.map((participant) => (
                  <div className="card" key={participant.id}>
                    <strong>{participant.name ?? participant.phoneNumber ?? participant.id}</strong>
                    <p className="section-copy">{participant.admin ?? "membro"}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel stack">
              <Field label="Novo grupo • assunto"><input value={groupCreateForm.subject} onChange={(event) => setGroupCreateForm((current) => ({ ...current, subject: event.target.value }))} /></Field>
              <Field label="Descrição"><textarea value={groupCreateForm.description} onChange={(event) => setGroupCreateForm((current) => ({ ...current, description: event.target.value }))} /></Field>
              <Field label="Participantes"><textarea value={groupCreateForm.participantsText} onChange={(event) => setGroupCreateForm((current) => ({ ...current, participantsText: event.target.value }))} /></Field>
              <button className="button" type="button" onClick={handleCreateGroup}>Criar grupo</button>
              <Field label="Novo assunto"><input value={groupEditForm.subject} onChange={(event) => setGroupEditForm((current) => ({ ...current, subject: event.target.value }))} /></Field>
              <button className="button-ghost" type="button" onClick={() => handleGroupAction("update-group-subject")}>Atualizar assunto</button>
              <Field label="Descrição"><textarea value={groupEditForm.description} onChange={(event) => setGroupEditForm((current) => ({ ...current, description: event.target.value }))} /></Field>
              <button className="button-ghost" type="button" onClick={() => handleGroupAction("update-group-description")}>Atualizar descrição</button>
              <button className="button-ghost" type="button" onClick={() => handleGroupAction("fetch-group-invite-code")}>Buscar link</button>
              {inviteCode ? <Field label="Resposta"><textarea readOnly value={inviteCode} /></Field> : null}
            </section>
          </div>
        ) : null}

        {activeSection === "contacts" ? (
          <div className="three-grid">
            <section className="panel">
              <Field label="Buscar contato">
                <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} />
              </Field>
              <div className="scroll-list stack" style={{ marginTop: 16 }}>
                {filteredContacts.slice(0, 200).map((contact) => (
                  <button className="list-item" key={contact.id} onClick={() => openDirectComposer(contact.remoteJid, contact.pushName ?? contact.remoteJid)} type="button">
                    <strong>{contact.pushName ?? contact.remoteJid}</strong>
                    <span className="muted">{contact.remoteJid}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="panel stack">
              <Field label="Nome"><input value={customContactForm.fullName} onChange={(event) => setCustomContactForm((current) => ({ ...current, fullName: event.target.value }))} /></Field>
              <Field label="Telefone"><input value={customContactForm.phoneNumber} onChange={(event) => setCustomContactForm((current) => ({ ...current, phoneNumber: event.target.value }))} /></Field>
              <Field label="Email"><input value={customContactForm.email} onChange={(event) => setCustomContactForm((current) => ({ ...current, email: event.target.value }))} /></Field>
              <Field label="Empresa"><input value={customContactForm.organization} onChange={(event) => setCustomContactForm((current) => ({ ...current, organization: event.target.value }))} /></Field>
              <Field label="Tags"><input value={customContactForm.tags} onChange={(event) => setCustomContactForm((current) => ({ ...current, tags: event.target.value }))} /></Field>
              <Field label="Notas"><textarea value={customContactForm.notes} onChange={(event) => setCustomContactForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
              <button className="button" type="button" onClick={handleSaveCustomContact}>Salvar contato local</button>
              <div className="scroll-list stack">
                {customContacts.map((contact) => (
                  <div className="card" key={contact.id}>
                    <strong>{contact.fullName}</strong>
                    <p className="section-copy">{contact.phoneNumber}</p>
                    <div className="actions-row">
                      <button className="button-ghost" type="button" onClick={() => openDirectComposer(contact.phoneNumber, contact.fullName)}>
                        Enviar sem campanha
                      </button>
                      <button className="button-ghost" type="button" onClick={() => assignCustomContact(contact)}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel stack">
              <Field label="Número ou JID"><textarea value={lookupNumber} onChange={(event) => setLookupNumber(event.target.value)} /></Field>
              <Field label="Ação de bloqueio"><select value={blockStatus} onChange={(event) => setBlockStatus(event.target.value as "block" | "unblock")}><option value="block">Bloquear</option><option value="unblock">Desbloquear</option></select></Field>
              <div className="actions-row">
                <button className="button-ghost" type="button" onClick={() => handleLookup("check-whatsapp")}>Checar WhatsApp</button>
                <button className="button-ghost" type="button" onClick={() => handleLookup("fetch-profile")}>Buscar perfil</button>
                <button className="button-ghost" type="button" onClick={() => handleLookup("fetch-profile-picture")}>Buscar foto</button>
                <button className="button-danger" type="button" onClick={() => handleLookup("update-block-status")}>Bloquear / desbloquear</button>
              </div>
              <Field label="Resultado"><textarea readOnly value={lookupResult} /></Field>
            </section>
          </div>
        ) : null}

        {activeSection === "lists" ? (
          <div className="two-grid">
            <section className="panel stack">
              <Field label="Nome"><input value={broadcastForm.name} onChange={(event) => setBroadcastForm((current) => ({ ...current, name: event.target.value }))} /></Field>
              <Field label="Descrição"><input value={broadcastForm.description} onChange={(event) => setBroadcastForm((current) => ({ ...current, description: event.target.value }))} /></Field>
              <Field label="Destinatários • Nome|Número ou só número"><textarea value={broadcastForm.recipientsText} onChange={(event) => setBroadcastForm((current) => ({ ...current, recipientsText: event.target.value }))} /></Field>
              <button className="button" type="button" onClick={handleSaveBroadcastList}>Salvar lista</button>
            </section>
            <section className="panel">
              <div className="scroll-list stack">
                {broadcastLists.map((list) => (
                  <div className="card" key={list.id}>
                    <strong>{list.name}</strong>
                    <p className="section-copy">{list.description ?? "Sem descrição"}</p>
                    <div className="badge-row"><span className="badge">{list.recipients.length} destinos</span></div>
                    <div className="actions-row" style={{ marginTop: 12 }}>
                      <button className="button-ghost" type="button" onClick={() => appendBroadcastListToDirectComposer(list)}>Usar no envio rapido</button>
                      <button className="button-ghost" type="button" onClick={() => assignBroadcastList(list)}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeSection === "instances" ? (
          <div className="instance-layout">
            <section className="panel stack">
              <div className="panel-head">
                <div>
                  <p className="helper-kicker">Instancias cadastradas</p>
                  <h3 className="panel-title">Selecione, revise ou edite uma conexao Evolution.</h3>
                </div>
                <span className="badge">{instances.length} cadastradas</span>
              </div>
              {instances.length ? (
                <div className="instance-cards">
                  {instances.map((instance) => (
                    <div className={`card instance-card ${activeInstanceId === instance.id ? "is-active" : ""}`} key={instance.id}>
                      <div className="panel-head">
                        <div>
                          <strong>{instance.profile.label ? String(instance.profile.label) : instance.instanceName}</strong>
                          <p className="section-copy">{instance.instanceName}</p>
                        </div>
                        <span className={`badge ${instance.summary?.connectionStatus === "open" ? "is-good" : "is-warn"}`}>
                          {instance.summary?.connectionStatus ?? "sem status"}
                        </span>
                      </div>
                      <p className="section-copy">{instance.baseUrl}</p>
                      <div className="badge-row">
                        <span className="badge">{instance.dbSchema}</span>
                        {instance.summary?.integration ? <span className="badge">{instance.summary.integration}</span> : null}
                      </div>
                      <div className="actions-row" style={{ marginTop: 14 }}>
                        <button className="button-ghost" type="button" onClick={() => setActiveInstanceId(instance.id)}>
                          Usar agora
                        </button>
                        <button className="button-ghost" type="button" onClick={() => assignInstanceForEditing(instance)}>
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  Nenhuma instancia cadastrada ainda. Preencha o formulario ao lado com o nome exato da instancia e o
                  token correspondente.
                </div>
              )}
            </section>
            <section className="panel stack instance-form-shell">
              <div className="panel-head">
                <div>
                  <p className="helper-kicker">{instanceDraft.instanceId ? "Editar instancia" : "Nova instancia"}</p>
                  <h3 className="panel-title">
                    {instanceDraft.instanceId ? "Atualize token, base URL e rotulo." : "Cadastre uma instancia com validacao imediata."}
                  </h3>
                </div>
                <span className="badge is-good">Validacao real</span>
              </div>
              <div className="helper-grid">
                <div className="helper-card">
                  <strong>Nome exato</strong>
                  <p className="section-copy">Use o mesmo nome que aparece em `fetchInstances` na Evolution.</p>
                </div>
                <div className="helper-card">
                  <strong>Token correto</strong>
                  <p className="section-copy">Se a instancia ja existir no banco, o cadastro agora atualiza em vez de duplicar.</p>
                </div>
              </div>
              <InstanceForm
                defaultBaseUrl={activeInstance?.baseUrl ?? "https://evolution.filipeivopereira.com"}
                initialValues={instanceDraft}
                onCancel={() =>
                  setInstanceDraft({
                    instanceId: "",
                    instanceName: "",
                    apiToken: "",
                    baseUrl: activeInstance?.baseUrl ?? "",
                    label: "",
                    notes: "",
                  })
                }
                onSubmit={handleRegisterInstance}
              />
            </section>
          </div>
        ) : null}

        {activeSection === "explorer" ? (
          <div className="two-grid">
            <section className="panel stack">
              {EXPLORER_PRESETS.map((preset) => (
                <button className="list-item" key={preset.title} onClick={() => {
                  setExplorerMethod(preset.method);
                  setExplorerPath(replacePresetInstanceName(preset.path, activeInstance?.instanceName ?? "MinhaInstancia"));
                  setExplorerQuery(preset.query);
                  setExplorerBody(preset.body);
                }} type="button">
                  <strong>{preset.title}</strong>
                  <span className="section-copy">{preset.description}</span>
                </button>
              ))}
            </section>
            <section className="panel stack">
              <Field label="Método"><select value={explorerMethod} onChange={(event) => setExplorerMethod(event.target.value)}><option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option></select></Field>
              <Field label="Path"><input value={explorerPath} onChange={(event) => setExplorerPath(event.target.value)} /></Field>
              <Field label="Query JSON"><textarea value={explorerQuery} onChange={(event) => setExplorerQuery(event.target.value)} /></Field>
              <Field label="Body JSON"><textarea value={explorerBody} onChange={(event) => setExplorerBody(event.target.value)} /></Field>
              <button className="button" type="button" onClick={handleExplorerRun}>Executar</button>
              <Field label="Resposta"><textarea readOnly value={explorerResult} /></Field>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function MessageBuilder({ draft, setDraft }: { draft: MessageDraft; setDraft: React.Dispatch<React.SetStateAction<MessageDraft>> }) {
  return (
    <section className="card stack">
      <p className="field-help">
        Escolha o formato da mensagem. Sempre que possível, use o botão de arquivo em vez de colar conteúdo técnico manualmente.
      </p>
      <Field label="Tipo de mensagem">
        <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as DispatchMessageType }))}>
          <option value="text">Texto</option>
          <option value="media">Mídia</option>
          <option value="audio">Áudio</option>
          <option value="sticker">Figurinha</option>
          <option value="location">Localização</option>
          <option value="contact">Cartão de contato</option>
          <option value="poll">Enquete</option>
          <option value="list">Menu em lista</option>
          <option value="buttons">Botões</option>
        </select>
      </Field>
      {draft.type === "text" ? <Field label="Texto"><textarea value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /></Field> : null}
      {draft.type === "media" ? (
        <>
          <Field label="URL da mídia ou conteúdo colado"><textarea value={draft.mediaSource} onChange={(event) => setDraft((current) => ({ ...current, mediaSource: event.target.value }))} /></Field>
          <FileLoader label="Carregar arquivo" onLoad={async (file) => {
            const loaded = await readFileAsBase64(file);
            setDraft((current) => ({ ...current, mediaSource: loaded.base64, mimeType: loaded.mimeType, fileName: loaded.fileName }));
          }} />
          <Field label="Legenda"><input value={draft.caption} onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))} /></Field>
        </>
      ) : null}
      {draft.type === "audio" ? <Field label="URL do áudio ou conteúdo colado"><textarea value={draft.audioSource} onChange={(event) => setDraft((current) => ({ ...current, audioSource: event.target.value }))} /></Field> : null}
      {draft.type === "sticker" ? <Field label="URL da figurinha ou conteúdo colado"><textarea value={draft.stickerSource} onChange={(event) => setDraft((current) => ({ ...current, stickerSource: event.target.value }))} /></Field> : null}
      {draft.type === "location" ? <div className="field-grid"><Field label="Nome"><input value={draft.locationName} onChange={(event) => setDraft((current) => ({ ...current, locationName: event.target.value }))} /></Field><Field label="Endereço"><input value={draft.locationAddress} onChange={(event) => setDraft((current) => ({ ...current, locationAddress: event.target.value }))} /></Field><Field label="Latitude"><input value={draft.latitude} onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))} /></Field><Field label="Longitude"><input value={draft.longitude} onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))} /></Field></div> : null}
      {draft.type === "contact" ? <Field label="Um contato por linha: Nome|Telefone|Email|Empresa|URL|WUID"><textarea value={draft.contactCardsText} onChange={(event) => setDraft((current) => ({ ...current, contactCardsText: event.target.value }))} /></Field> : null}
      {draft.type === "poll" ? <><Field label="Nome da enquete"><input value={draft.pollName} onChange={(event) => setDraft((current) => ({ ...current, pollName: event.target.value }))} /></Field><Field label="Opções"><textarea value={draft.pollOptionsText} onChange={(event) => setDraft((current) => ({ ...current, pollOptionsText: event.target.value }))} /></Field></> : null}
      {draft.type === "list" ? <><Field label="Título"><input value={draft.listTitle} onChange={(event) => setDraft((current) => ({ ...current, listTitle: event.target.value }))} /></Field><Field label="Linhas: Seção|Título|Descrição|ID"><textarea value={draft.listSectionsText} onChange={(event) => setDraft((current) => ({ ...current, listSectionsText: event.target.value }))} /></Field></> : null}
      {draft.type === "buttons" ? <p className="badge is-warn">Botões podem depender do tipo de integração ativa da sua conta.</p> : null}
      <div className="field-grid">
        <Field label="Mencionar números"><textarea value={draft.mentionedText} onChange={(event) => setDraft((current) => ({ ...current, mentionedText: event.target.value }))} /></Field>
        <Field label="Espera extra antes do envio (ms)"><input value={draft.delayMs} onChange={(event) => setDraft((current) => ({ ...current, delayMs: event.target.value }))} /></Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FileLoader({ label, accept, onLoad }: { label: string; accept?: string; onLoad: (file: File) => void | Promise<void> }) {
  return (
    <label className="button-ghost" style={{ display: "inline-flex" }}>
      <input
        accept={accept}
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          await onLoad(file);
          event.currentTarget.value = "";
        }}
        type="file"
      />
      {label}
    </label>
  );
}

function InstanceForm({
  defaultBaseUrl,
  initialValues,
  onCancel,
  onSubmit,
}: {
  defaultBaseUrl: string;
  initialValues: InstanceFormPayload;
  onCancel: () => void;
  onSubmit: (payload: InstanceFormPayload) => Promise<void>;
}) {
  const [formState, setFormState] = useState<InstanceFormPayload>({
    ...initialValues,
    baseUrl: initialValues.baseUrl || defaultBaseUrl,
    label: initialValues.label || initialValues.instanceName || "",
    notes: initialValues.notes || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Boolean(formState.instanceId);

  useEffect(() => {
    setFormState({
      ...initialValues,
      baseUrl: initialValues.baseUrl || defaultBaseUrl,
      label: initialValues.label || initialValues.instanceName || "",
      notes: initialValues.notes || "",
    });
    setError("");
  }, [defaultBaseUrl, initialValues]);

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
          await onSubmit({
            ...formState,
            instanceName: formState.instanceName.trim(),
            apiToken: formState.apiToken.trim(),
            baseUrl: formState.baseUrl.trim(),
            label: formState.label.trim(),
            notes: formState.notes.trim(),
          });
        } catch (submissionError) {
          setError(formatAppError(submissionError));
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {error ? (
        <div className="notice is-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      <Field label="Rótulo amigável">
        <input
          value={formState.label}
          onChange={(event) =>
            setFormState((current) => ({ ...current, label: event.target.value }))
          }
        />
      </Field>
      <Field label="Nome exato da instância na Evolution">
        <input
          autoCapitalize="none"
          autoCorrect="off"
          value={formState.instanceName}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              instanceName: event.target.value,
            }))
          }
        />
      </Field>
      <Field label="Token">
        <input
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="new-password"
          type="password"
          value={formState.apiToken}
          onChange={(event) =>
            setFormState((current) => ({ ...current, apiToken: event.target.value }))
          }
        />
      </Field>
      <Field label="Base URL">
        <input
          value={formState.baseUrl}
          onChange={(event) =>
            setFormState((current) => ({ ...current, baseUrl: event.target.value }))
          }
        />
      </Field>
      <Field label="Notas">
        <textarea
          value={formState.notes}
          onChange={(event) =>
            setFormState((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </Field>
      <p className="field-help">
        A validacao consulta `/instance/fetchInstances` antes de salvar, entao voce recebe retorno real da Evolution.
      </p>
      <div className="actions-row">
        <button className="button button-label-shell" disabled={submitting} type="submit">
          <span className="button-label">
            {submitting
              ? isEditing
                ? "Atualizando..."
                : "Validando..."
              : isEditing
                ? "Atualizar instancia"
                : "Validar e salvar instancia"}
          </span>
        </button>
        {isEditing ? (
          <button
            className="button-ghost"
            disabled={submitting}
            type="button"
            onClick={() => {
              setError("");
              onCancel();
            }}
          >
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </form>
  );
}
