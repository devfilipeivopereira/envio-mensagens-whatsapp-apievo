import { randomUUID } from "crypto";

import type {
  ChatItem,
  ContactItem,
  DispatchRecipient,
  GroupSummary,
  SimplifiedMessage,
} from "@/lib/types";

export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`A variável de ambiente ${name} não foi configurada.`);
  }

  return value;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function normalizeSendTarget(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return trimmed;
  }

  return normalizeDigits(trimmed);
}

export function safeSchemaName(instanceName: string) {
  const base = instanceName
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return `inst_${base || "instance"}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function parseTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function makeRecipient(
  label: string,
  target: string,
  kind: DispatchRecipient["kind"],
  source: string | null,
): DispatchRecipient {
  return {
    id: randomUUID(),
    label,
    target: normalizeSendTarget(target),
    kind,
    source,
  };
}

export function dedupeRecipients(recipients: DispatchRecipient[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const normalized = normalizeSendTarget(recipient.target);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);

    return true;
  });
}

function fromConversation(message: Record<string, unknown>) {
  const directConversation = message.conversation;

  if (typeof directConversation === "string" && directConversation.trim()) {
    return directConversation;
  }

  const extended = message.extendedTextMessage as
    | { text?: string }
    | undefined;

  if (extended?.text) {
    return extended.text;
  }

  const image = message.imageMessage as { caption?: string } | undefined;

  if (image?.caption) {
    return image.caption;
  }

  const video = message.videoMessage as { caption?: string } | undefined;

  if (video?.caption) {
    return video.caption;
  }

  const location = message.locationMessage as { name?: string } | undefined;

  if (location?.name) {
    return `Localizacao: ${location.name}`;
  }

  const reaction = message.reactionMessage as { text?: string } | undefined;

  if (typeof reaction?.text === "string") {
    return `Reacao: ${reaction.text || "removida"}`;
  }

  const poll = message.pollCreationMessage as { name?: string } | undefined;

  if (poll?.name) {
    return `Enquete: ${poll.name}`;
  }

  const contactMessage = message.contactMessage as
    | { displayName?: string }
    | undefined;

  if (contactMessage?.displayName) {
    return `Contato: ${contactMessage.displayName}`;
  }

  if (message.audioMessage) {
    return "Audio";
  }

  if (message.stickerMessage) {
    return "Sticker";
  }

  if (message.documentMessage) {
    return "Documento";
  }

  if (message.listMessage) {
    return "Lista interativa";
  }

  if (message.buttonsMessage) {
    return "Botoes interativos";
  }

  return "Mensagem sem visualizacao";
}

export function simplifyMessage(record: Record<string, unknown>) {
  const rawMessage =
    (record.message as Record<string, unknown> | undefined) ?? {};
  const key = (record.key as Record<string, unknown> | undefined) ?? {};
  const updates = Array.isArray(record.MessageUpdate)
    ? (record.MessageUpdate as Array<{ status?: string }>)
        .map((update) => update.status)
        .filter((status): status is string => Boolean(status))
    : [];

  const simplified: SimplifiedMessage = {
    id: String(record.id ?? randomUUID()),
    key: {
      id: String(key.id ?? ""),
      remoteJid: String(key.remoteJid ?? ""),
      fromMe: Boolean(key.fromMe),
      participant:
        typeof key.participant === "string" ? key.participant : null,
    },
    pushName:
      typeof record.pushName === "string" ? record.pushName : null,
    messageType:
      typeof record.messageType === "string" ? record.messageType : "unknown",
    preview: fromConversation(rawMessage),
    messageTimestamp:
      typeof record.messageTimestamp === "number"
        ? record.messageTimestamp
        : null,
    source: typeof record.source === "string" ? record.source : null,
    statusUpdates: updates,
    raw: record,
  };

  return simplified;
}

export function mapContact(item: Record<string, unknown>): ContactItem {
  return {
    id: String(item.id ?? ""),
    remoteJid: String(item.remoteJid ?? ""),
    pushName: typeof item.pushName === "string" ? item.pushName : null,
    profilePicUrl:
      typeof item.profilePicUrl === "string" ? item.profilePicUrl : null,
    isGroup: Boolean(item.isGroup),
    isSaved: Boolean(item.isSaved),
    type: typeof item.type === "string" ? item.type : null,
    createdAt:
      typeof item.createdAt === "string" ? item.createdAt : null,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : null,
  };
}

export function mapChat(item: Record<string, unknown>): ChatItem {
  const lastMessage = (item.lastMessage as Record<string, unknown> | undefined) ?? {};
  const rawMessage =
    (lastMessage.message as Record<string, unknown> | undefined) ?? {};

  return {
    id: String(item.id ?? ""),
    remoteJid: String(item.remoteJid ?? ""),
    pushName: typeof item.pushName === "string" ? item.pushName : null,
    profilePicUrl:
      typeof item.profilePicUrl === "string" ? item.profilePicUrl : null,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : null,
    unreadCount:
      typeof item.unreadCount === "number" ? item.unreadCount : 0,
    isSaved: Boolean(item.isSaved),
    isGroup: String(item.remoteJid ?? "").endsWith("@g.us"),
    lastMessagePreview: fromConversation(rawMessage),
    lastMessageType:
      typeof lastMessage.messageType === "string"
        ? lastMessage.messageType
        : null,
  };
}

export function mapGroup(chat: ChatItem): GroupSummary {
  return {
    id: chat.id,
    groupJid: chat.remoteJid,
    subject: chat.pushName ?? "Grupo sem nome",
    profilePicUrl: chat.profilePicUrl,
    updatedAt: chat.updatedAt,
    unreadCount: chat.unreadCount,
    lastMessagePreview: chat.lastMessagePreview,
  };
}

export function sortByUpdatedAt<T extends { updatedAt?: string | null }>(
  items: T[],
) {
  return [...items].sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;

    return rightTime - leftTime;
  });
}

export function sortChats(chats: ChatItem[]) {
  return sortByUpdatedAt(chats);
}

export function sortContacts(contacts: ContactItem[]) {
  return sortByUpdatedAt(contacts);
}

export function sortGroups(groups: GroupSummary[]) {
  return sortByUpdatedAt(groups);
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro desconhecido";
}
