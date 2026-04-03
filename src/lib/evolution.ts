import type {
  ContactItem,
  DispatchMessagePayload,
  EvolutionInstanceSummary,
  GroupParticipant,
  InstanceRecord,
  SimplifiedMessage,
} from "@/lib/types";
import {
  mapChat,
  mapContact,
  normalizeSendTarget,
  simplifyMessage,
} from "@/lib/utils";

interface EvolutionRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown> | null;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: EvolutionRequestOptions["query"],
) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), normalizedBase);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function rawEvolutionRequest<T>(
  instance: Pick<InstanceRecord, "baseUrl" | "apiToken" | "instanceName">,
  path: string,
  options: EvolutionRequestOptions = {},
) {
  const response = await fetch(buildUrl(instance.baseUrl, path, options.query), {
    method: options.method ?? "GET",
    headers: {
      apikey: instance.apiToken,
      "Content-Type": "application/json",
    },
    body:
      options.body && options.method !== "GET"
        ? JSON.stringify(options.body)
        : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      parsed?.response?.message?.[0] ||
      parsed?.message ||
      `Falha na Evolution API (${response.status})`;
    throw new Error(message);
  }

  return parsed as T;
}

export async function validateEvolutionInstance(input: {
  baseUrl: string;
  apiToken: string;
  instanceName: string;
}) {
  const fakeInstance = {
    baseUrl: input.baseUrl,
    apiToken: input.apiToken,
    instanceName: input.instanceName,
  };

  const response = await rawEvolutionRequest<{ value?: Array<Record<string, unknown>> }>(
    fakeInstance,
    "/instance/fetchInstances",
    { method: "GET" },
  );

  const found = response.value?.find(
    (item) => String(item.name ?? "") === input.instanceName,
  );

  if (!found) {
    throw new Error(
      `A instância ${input.instanceName} não foi encontrada nesse token/base URL.`,
    );
  }

  return found;
}

export async function fetchEvolutionSummary(instance: InstanceRecord) {
  const response = await rawEvolutionRequest<{ value?: Array<Record<string, unknown>> }>(
    instance,
    "/instance/fetchInstances",
    { method: "GET" },
  );

  const found = response.value?.find(
    (item) => String(item.name ?? "") === instance.instanceName,
  );

  if (!found) {
    throw new Error("Instância não encontrada na Evolution API.");
  }

  const count = (found._count as Record<string, number> | undefined) ?? {};

  const summary: EvolutionInstanceSummary = {
    id: String(found.id ?? ""),
    name: String(found.name ?? instance.instanceName),
    connectionStatus: String(found.connectionStatus ?? "unknown"),
    ownerJid:
      typeof found.ownerJid === "string" ? found.ownerJid : null,
    profileName:
      typeof found.profileName === "string" ? found.profileName : null,
    profilePicUrl:
      typeof found.profilePicUrl === "string" ? found.profilePicUrl : null,
    integration:
      typeof found.integration === "string" ? found.integration : null,
    createdAt:
      typeof found.createdAt === "string" ? found.createdAt : null,
    updatedAt:
      typeof found.updatedAt === "string" ? found.updatedAt : null,
    counts: {
      messages: Number(count.Message ?? 0),
      contacts: Number(count.Contact ?? 0),
      chats: Number(count.Chat ?? 0),
    },
  };

  return summary;
}

export async function fetchContacts(instance: InstanceRecord) {
  const response = await rawEvolutionRequest<Record<string, unknown>[]>(
    instance,
    `/chat/findContacts/${instance.instanceName}`,
    {
      method: "POST",
      body: {},
    },
  );

  return response.map((item) => mapContact(item));
}

export async function fetchChats(instance: InstanceRecord) {
  const response = await rawEvolutionRequest<Record<string, unknown>[]>(
    instance,
    `/chat/findChats/${instance.instanceName}`,
    {
      method: "POST",
      body: {},
    },
  );

  return response.map((item) => mapChat(item));
}

export async function fetchMessages(instance: InstanceRecord, remoteJid: string) {
  const response = await rawEvolutionRequest<{
    messages?: { records?: Array<Record<string, unknown>> };
  }>(
    instance,
    `/chat/findMessages/${instance.instanceName}`,
    {
      method: "POST",
      body: {
        where: {
          key: {
            remoteJid,
          },
        },
      },
    },
  );

  const records = response.messages?.records ?? [];

  return records.map((record) => simplifyMessage(record));
}

export async function fetchGroupParticipants(
  instance: InstanceRecord,
  groupJid: string,
) {
  const response = await rawEvolutionRequest<{ participants?: Array<Record<string, unknown>> }>(
    instance,
    `/group/participants/${instance.instanceName}`,
    {
      method: "GET",
      query: {
        groupJid,
      },
    },
  );

  return (response.participants ?? []).map(
    (item): GroupParticipant => ({
      id: String(item.id ?? ""),
      phoneNumber:
        typeof item.phoneNumber === "string" ? item.phoneNumber : null,
      admin: typeof item.admin === "string" ? item.admin : null,
      name: typeof item.name === "string" ? item.name : null,
      imgUrl: typeof item.imgUrl === "string" ? item.imgUrl : null,
    }),
  );
}

function baseMessageOptions(message: DispatchMessagePayload) {
  return {
    delay: message.options.delayMs,
    linkPreview: message.options.linkPreview,
    mentionsEveryOne: message.options.mentionsEveryOne,
    mentioned: message.options.mentioned,
    quoted: message.options.quoted
      ? {
          key: {
            id: message.options.quoted.key.id,
          },
          message: {
            conversation: message.options.quoted.conversation,
          },
        }
      : undefined,
  };
}

export async function sendDispatchMessage(
  instance: InstanceRecord,
  target: string,
  message: DispatchMessagePayload,
) {
  const number = normalizeSendTarget(target);

  if (!number && message.type !== "status") {
    throw new Error("Destino inválido para envio.");
  }

  switch (message.type) {
    case "text":
      return rawEvolutionRequest(instance, `/message/sendText/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          text: message.text,
          ...baseMessageOptions(message),
        },
      });

    case "media":
      return rawEvolutionRequest(instance, `/message/sendMedia/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          mediatype: message.mediaType,
          mimetype: message.mimeType,
          media: message.media,
          fileName: message.fileName,
          caption: message.caption,
          ...baseMessageOptions(message),
        },
      });

    case "audio":
      return rawEvolutionRequest(
        instance,
        `/message/sendWhatsAppAudio/${instance.instanceName}`,
        {
          method: "POST",
          body: {
            number,
            audio: message.audio,
            ...baseMessageOptions(message),
          },
        },
      );

    case "sticker":
      return rawEvolutionRequest(instance, `/message/sendSticker/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          sticker: message.sticker,
          ...baseMessageOptions(message),
        },
      });

    case "location":
      return rawEvolutionRequest(instance, `/message/sendLocation/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          name: message.locationName,
          address: message.locationAddress,
          latitude: message.latitude,
          longitude: message.longitude,
          ...baseMessageOptions(message),
        },
      });

    case "contact":
      return rawEvolutionRequest(instance, `/message/sendContact/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          contact: message.contactCards,
        },
      });

    case "poll":
      return rawEvolutionRequest(instance, `/message/sendPoll/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          name: message.pollName,
          options: message.pollOptions,
          selectableCount: message.pollSelectableCount ?? 1,
          ...baseMessageOptions(message),
        },
      });

    case "list":
      return rawEvolutionRequest(instance, `/message/sendList/${instance.instanceName}`, {
        method: "POST",
        body: {
          number,
          title: message.listTitle,
          description: message.listDescription,
          buttonText: message.listButtonText,
          footerText: message.listFooterText,
          values: message.listSections,
          ...baseMessageOptions(message),
        },
      });

    case "buttons":
      throw new Error(
        "A própria documentação da Evolution v2 marca botões como descontinuados e funcionais apenas na Cloud API.",
      );

    case "status":
      return rawEvolutionRequest(instance, `/message/sendStatus/${instance.instanceName}`, {
        method: "POST",
        body: {
          type: message.statusType,
          content: message.statusContent,
          caption: message.caption ?? "",
          backgroundColor: message.statusBackgroundColor ?? "#0f766e",
          font: message.statusFont ?? 1,
          allContacts: false,
          statusJidList: [number],
        },
      });

    default:
      throw new Error("Tipo de mensagem não suportado.");
  }
}

export async function sendStatusMessage(
  instance: InstanceRecord,
  message: DispatchMessagePayload,
  allContacts: boolean,
  statusJidList: string[],
) {
  return rawEvolutionRequest(instance, `/message/sendStatus/${instance.instanceName}`, {
    method: "POST",
    body: {
      type: message.statusType,
      content: message.statusContent,
      caption: message.caption ?? "",
      backgroundColor: message.statusBackgroundColor ?? "#0f766e",
      font: message.statusFont ?? 1,
      allContacts,
      statusJidList,
    },
  });
}

export async function createGroup(
  instance: InstanceRecord,
  subject: string,
  description: string,
  participants: string[],
) {
  return rawEvolutionRequest(instance, `/group/create/${instance.instanceName}`, {
    method: "POST",
    body: {
      subject,
      description,
      participants,
    },
  });
}

export async function updateGroupSubject(
  instance: InstanceRecord,
  groupJid: string,
  subject: string,
) {
  return rawEvolutionRequest(
    instance,
    `/group/updateGroupSubject/${instance.instanceName}`,
    {
      method: "POST",
      query: { groupJid },
      body: { subject },
    },
  );
}

export async function updateGroupDescription(
  instance: InstanceRecord,
  groupJid: string,
  description: string,
) {
  return rawEvolutionRequest(
    instance,
    `/group/updateGroupDescription/${instance.instanceName}`,
    {
      method: "POST",
      query: { groupJid },
      body: { description },
    },
  );
}

export async function updateGroupParticipants(
  instance: InstanceRecord,
  groupJid: string,
  action: "add" | "remove" | "promote" | "demote",
  participants: string[],
) {
  return rawEvolutionRequest(
    instance,
    `/group/updateParticipant/${instance.instanceName}`,
    {
      method: "POST",
      query: { groupJid },
      body: { action, participants },
    },
  );
}

export async function updateGroupSetting(
  instance: InstanceRecord,
  groupJid: string,
  action:
    | "announcement"
    | "not_announcement"
    | "locked"
    | "unlocked",
) {
  return rawEvolutionRequest(
    instance,
    `/group/updateSetting/${instance.instanceName}`,
    {
      method: "POST",
      query: { groupJid },
      body: { action },
    },
  );
}

export async function toggleGroupEphemeral(
  instance: InstanceRecord,
  groupJid: string,
  expiration: number,
) {
  return rawEvolutionRequest(instance, `/group/toggleEphemeral/${instance.instanceName}`, {
    method: "POST",
    query: { groupJid },
    body: { expiration },
  });
}

export async function fetchGroupInviteCode(
  instance: InstanceRecord,
  groupJid: string,
) {
  return rawEvolutionRequest(instance, `/group/fetchInviteCode/${instance.instanceName}`, {
    method: "GET",
    query: { groupJid },
  });
}

export async function revokeGroupInviteCode(
  instance: InstanceRecord,
  groupJid: string,
) {
  return rawEvolutionRequest(instance, `/group/revokeInviteCode/${instance.instanceName}`, {
    method: "POST",
    query: { groupJid },
    body: {},
  });
}

export async function sendGroupInvite(
  instance: InstanceRecord,
  groupJid: string,
  numbers: string[],
  description: string,
) {
  return rawEvolutionRequest(instance, `/group/sendInvite/${instance.instanceName}`, {
    method: "POST",
    body: {
      groupJid,
      numbers,
      description,
    },
  });
}

export async function leaveGroup(instance: InstanceRecord, groupJid: string) {
  return rawEvolutionRequest(instance, `/group/leaveGroup/${instance.instanceName}`, {
    method: "DELETE",
    query: { groupJid },
  });
}

export async function checkWhatsAppNumbers(
  instance: InstanceRecord,
  numbers: string[],
) {
  return rawEvolutionRequest(instance, `/chat/whatsappNumbers/${instance.instanceName}`, {
    method: "POST",
    body: {
      numbers,
    },
  });
}

export async function fetchProfile(
  instance: InstanceRecord,
  number: string,
) {
  return rawEvolutionRequest(instance, `/chat/fetchProfile/${instance.instanceName}`, {
    method: "POST",
    body: {
      number,
    },
  });
}

export async function fetchProfilePicture(
  instance: InstanceRecord,
  number: string,
) {
  return rawEvolutionRequest(
    instance,
    `/chat/fetchProfilePictureUrl/${instance.instanceName}`,
    {
      method: "POST",
      body: {
        number,
      },
    },
  );
}

export async function updateBlockStatus(
  instance: InstanceRecord,
  number: string,
  status: "block" | "unblock",
) {
  return rawEvolutionRequest(
    instance,
    `/message/updateBlockStatus/${instance.instanceName}`,
    {
      method: "POST",
      body: {
        number,
        status,
      },
    },
  );
}

export async function markMessageAsRead(
  instance: InstanceRecord,
  messageKey: SimplifiedMessage["key"],
) {
  return rawEvolutionRequest(instance, `/chat/markMessageAsRead/${instance.instanceName}`, {
    method: "POST",
    body: {
      readMessages: [messageKey],
    },
  });
}

export async function markChatAsUnread(
  instance: InstanceRecord,
  chat: string,
  messageKey: SimplifiedMessage["key"],
) {
  return rawEvolutionRequest(instance, `/chat/markChatUnread/${instance.instanceName}`, {
    method: "POST",
    body: {
      lastMessage: [messageKey],
      chat,
    },
  });
}

export async function archiveChat(instance: InstanceRecord, chat: string) {
  return rawEvolutionRequest(instance, `/chat/archiveChat/${instance.instanceName}`, {
    method: "POST",
    body: {
      chat,
      archive: true,
    },
  });
}

export async function deleteMessageForEveryone(
  instance: InstanceRecord,
  messageKey: SimplifiedMessage["key"],
) {
  return rawEvolutionRequest(
    instance,
    `/chat/deleteMessageForEveryone/${instance.instanceName}`,
    {
      method: "DELETE",
      body: {
        id: messageKey.id,
        remoteJid: messageKey.remoteJid,
        fromMe: messageKey.fromMe,
      },
    },
  );
}

export async function updateMessage(
  instance: InstanceRecord,
  messageKey: SimplifiedMessage["key"],
  text: string,
) {
  return rawEvolutionRequest(instance, `/chat/updateMessage/${instance.instanceName}`, {
    method: "POST",
    body: {
      number: Number(normalizeSendTarget(messageKey.remoteJid)),
      text,
      key: messageKey,
    },
  });
}

export async function sendReaction(
  instance: InstanceRecord,
  messageKey: SimplifiedMessage["key"],
  reaction: string,
) {
  return rawEvolutionRequest(instance, `/message/sendReaction/${instance.instanceName}`, {
    method: "POST",
    body: {
      key: messageKey,
      reaction,
    },
  });
}
