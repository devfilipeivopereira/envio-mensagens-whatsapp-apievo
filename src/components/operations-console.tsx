"use client";

import Papa from "papaparse";
import type { Session } from "@supabase/supabase-js";
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
  | "messages"
  | "campaigns"
  | "groups"
  | "contacts"
  | "lists"
  | "instances"
  | "explorer";

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
  { key: "messages", label: "Mensagens" },
  { key: "campaigns", label: "Campanhas" },
  { key: "groups", label: "Grupos" },
  { key: "contacts", label: "Contatos" },
  { key: "lists", label: "Listas" },
  { key: "instances", label: "Instâncias" },
  { key: "explorer", label: "Explorador API" },
];

const CAPABILITIES = [
  {
    title: "Guiado para qualquer pessoa",
    description:
      "Mensagens, campanhas, contatos, grupos, listas, instâncias e explorer em linguagem simples.",
  },
  {
    title: "Fila segura e agendamento",
    description:
      "Toda campanha respeita pausa mínima de 10 segundos e pode ficar agendada para rodar via cron no Vercel.",
  },
  {
    title: "Multi-instância de verdade",
    description:
      "Cada instância usa perfil próprio e schema próprio no Postgres do Supabase.",
  },
  {
    title: "Cobertura total da Evolution",
    description:
      "Além do modo amigável, o Explorador API deixa acessar qualquer endpoint manualmente.",
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

function replacePresetInstanceName(path: string, instanceName: string) {
  return path.replaceAll("{instanceName}", instanceName);
}

export function OperationsConsole() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
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

  async function runAction(action: string, payload: Record<string, unknown>) {
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
    setActiveSection("messages");
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
    setDirectTarget(contact.phoneNumber);
    setDirectLabel(contact.fullName);
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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setAuthBusy(true);
      const result = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (result.error) {
        throw result.error;
      }

      setNotice({ tone: "success", text: "Login realizado com sucesso." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha no login.",
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
                <h1 className="hero-title">Um cockpit claro para operar toda a sua stack WhatsApp.</h1>
                <p className="brand-subtitle">
                  Painel multi-instância, campanhas protegidas, listas agendadas e Explorador completo da Evolution API.
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
          <div className="brand-mark">EC</div>
          <div>
            <h1 className="brand-title">Evolution Control Room</h1>
            <p className="brand-subtitle">UI operacional com Supabase, Explorer e cron Vercel.</p>
          </div>
        </div>
        <div className="card">
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
        <nav className="nav">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.key}
              className={`nav-button ${activeSection === item.key ? "is-active" : ""}`}
              onClick={() => setActiveSection(item.key)}
              type="button"
            >
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="button-ghost" type="button" onClick={handleLogout}>
          Sair
        </button>
      </aside>

      <main className="main">
        {notice ? (
          <div className={`notice ${notice.tone === "success" ? "is-success" : notice.tone === "error" ? "is-error" : ""}`}>
            <span>{notice.text}</span>
          </div>
        ) : null}

        <section className="hero">
          <div className="hero-top">
            <div>
              <p className="badge is-good">Modo guiado + Explorer total</p>
              <h2 className="hero-title">{activeInstance?.instanceName ?? "Sem instância"}</h2>
              <p className="brand-subtitle">
                {activeSummary
                  ? `Conexão ${activeSummary.connectionStatus} • ${activeSummary.integration ?? "sem integração"}`
                  : "Cadastre uma instância para começar."}
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
          <div className="three-grid">
            {CAPABILITIES.map((item) => (
              <section className="panel" key={item.title}>
                <h3 className="panel-title">{item.title}</h3>
                <p className="section-copy">{item.description}</p>
              </section>
            ))}
          </div>
        ) : null}

        {activeSection === "messages" ? (
          <div className="three-grid">
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
            <section className="panel">
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
            <section className="panel stack">
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
                  <button className="list-item" key={contact.id} onClick={() => { setDirectTarget(contact.remoteJid); setDirectLabel(contact.pushName ?? contact.remoteJid); }} type="button">
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
                      <button className="button-ghost" type="button" onClick={() => assignBroadcastList(list)}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeSection === "instances" ? (
          <div className="two-grid">
            <section className="panel">
              <div className="scroll-list stack">
                {instances.map((instance) => (
                  <div className="card" key={instance.id}>
                    <strong>{instance.instanceName}</strong>
                    <p className="section-copy">{instance.baseUrl}</p>
                    <div className="badge-row">
                      <span className={`badge ${instance.summary?.connectionStatus === "open" ? "is-good" : "is-warn"}`}>{instance.summary?.connectionStatus ?? "sem status"}</span>
                      <span className="badge">{instance.dbSchema}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel stack">
              <p className="section-copy">Cadastre outra instância informando nome exato, token e base URL. O backend valida e cria um schema dedicado no banco.</p>
              <InstanceForm
                onSubmit={async (payload) => {
                  await runAction("register-instance", payload);
                  await loadInstances();
                  setNotice({
                    tone: "success",
                    text: "Instância validada e salva com sucesso.",
                  });
                }}
                defaultBaseUrl={activeInstance?.baseUrl ?? "https://evolution.filipeivopereira.com"}
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
      <Field label="Tipo de mensagem">
        <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as DispatchMessageType }))}>
          <option value="text">Texto</option>
          <option value="media">Mídia</option>
          <option value="audio">Áudio</option>
          <option value="sticker">Sticker</option>
          <option value="location">Localização</option>
          <option value="contact">Contato</option>
          <option value="poll">Enquete</option>
          <option value="list">Lista</option>
          <option value="buttons">Botões</option>
        </select>
      </Field>
      {draft.type === "text" ? <Field label="Texto"><textarea value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /></Field> : null}
      {draft.type === "media" ? (
        <>
          <Field label="Base64 ou URL"><textarea value={draft.mediaSource} onChange={(event) => setDraft((current) => ({ ...current, mediaSource: event.target.value }))} /></Field>
          <FileLoader label="Carregar arquivo" onLoad={async (file) => {
            const loaded = await readFileAsBase64(file);
            setDraft((current) => ({ ...current, mediaSource: loaded.base64, mimeType: loaded.mimeType, fileName: loaded.fileName }));
          }} />
          <Field label="Legenda"><input value={draft.caption} onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))} /></Field>
        </>
      ) : null}
      {draft.type === "audio" ? <Field label="Base64 ou URL"><textarea value={draft.audioSource} onChange={(event) => setDraft((current) => ({ ...current, audioSource: event.target.value }))} /></Field> : null}
      {draft.type === "sticker" ? <Field label="Base64 ou URL"><textarea value={draft.stickerSource} onChange={(event) => setDraft((current) => ({ ...current, stickerSource: event.target.value }))} /></Field> : null}
      {draft.type === "location" ? <div className="field-grid"><Field label="Nome"><input value={draft.locationName} onChange={(event) => setDraft((current) => ({ ...current, locationName: event.target.value }))} /></Field><Field label="Endereço"><input value={draft.locationAddress} onChange={(event) => setDraft((current) => ({ ...current, locationAddress: event.target.value }))} /></Field><Field label="Latitude"><input value={draft.latitude} onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))} /></Field><Field label="Longitude"><input value={draft.longitude} onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))} /></Field></div> : null}
      {draft.type === "contact" ? <Field label="Nome|Telefone|Email|Empresa|URL|WUID por linha"><textarea value={draft.contactCardsText} onChange={(event) => setDraft((current) => ({ ...current, contactCardsText: event.target.value }))} /></Field> : null}
      {draft.type === "poll" ? <><Field label="Nome da enquete"><input value={draft.pollName} onChange={(event) => setDraft((current) => ({ ...current, pollName: event.target.value }))} /></Field><Field label="Opções"><textarea value={draft.pollOptionsText} onChange={(event) => setDraft((current) => ({ ...current, pollOptionsText: event.target.value }))} /></Field></> : null}
      {draft.type === "list" ? <><Field label="Título"><input value={draft.listTitle} onChange={(event) => setDraft((current) => ({ ...current, listTitle: event.target.value }))} /></Field><Field label="Linhas Seção|Título|Descrição|ID"><textarea value={draft.listSectionsText} onChange={(event) => setDraft((current) => ({ ...current, listSectionsText: event.target.value }))} /></Field></> : null}
      {draft.type === "buttons" ? <p className="badge is-warn">Botões dependem de Cloud API segundo a doc v2.</p> : null}
      <div className="field-grid">
        <Field label="Mencionados"><textarea value={draft.mentionedText} onChange={(event) => setDraft((current) => ({ ...current, mentionedText: event.target.value }))} /></Field>
        <Field label="Delay opcional do endpoint"><input value={draft.delayMs} onChange={(event) => setDraft((current) => ({ ...current, delayMs: event.target.value }))} /></Field>
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
  onSubmit,
}: {
  defaultBaseUrl: string;
  onSubmit: (payload: {
    instanceName: string;
    apiToken: string;
    baseUrl: string;
    label: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [instanceName, setInstanceName] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ instanceName, apiToken, baseUrl, label, notes });
        setInstanceName("");
        setApiToken("");
        setLabel("");
        setNotes("");
      }}
    >
      <Field label="Rótulo amigável">
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </Field>
      <Field label="Nome exato da instância na Evolution">
        <input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} />
      </Field>
      <Field label="Token">
        <input value={apiToken} onChange={(event) => setApiToken(event.target.value)} />
      </Field>
      <Field label="Base URL">
        <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      </Field>
      <Field label="Notas">
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <button className="button" type="submit">
        Validar e salvar instância
      </button>
    </form>
  );
}
