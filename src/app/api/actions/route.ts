import { NextRequest, NextResponse } from "next/server";

import {
  archiveChat,
  checkWhatsAppNumbers,
  createGroup,
  fetchProfile,
  fetchProfilePicture,
  fetchGroupInviteCode,
  leaveGroup,
  markChatAsUnread,
  markMessageAsRead,
  revokeGroupInviteCode,
  sendGroupInvite,
  sendReaction,
  sendStatusMessage,
  toggleGroupEphemeral,
  updateBlockStatus,
  updateGroupDescription,
  updateGroupParticipants,
  updateGroupSetting,
  updateGroupSubject,
  updateMessage,
  validateEvolutionInstance,
  deleteMessageForEveryone,
  rawEvolutionRequest,
} from "@/lib/evolution";
import {
  createManagedInstance,
  deleteBroadcastList,
  deleteCustomContact,
  ensureDefaultInstanceFromEnv,
  getInstanceByName,
  getInstanceById,
  saveBroadcastList,
  saveCustomContact,
  updateManagedInstance,
} from "@/lib/instance-store";
import { requireApiUser } from "@/lib/request-auth";
import { buildCampaignRecipients, enqueueDispatchJob, processDueDispatchJobs } from "@/lib/send-queue";
import type { BroadcastListRecord, CustomContact, DispatchMessagePayload, SimplifiedMessage } from "@/lib/types";
import { dedupeRecipients, makeRecipient, normalizeSendTarget, parseTags } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

interface ActionRequestBody {
  action: string;
  payload: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request);
    await ensureDefaultInstanceFromEnv();

    const body = (await request.json()) as ActionRequestBody;
    const payload = body.payload ?? {};
    const action = body.action;

    switch (action) {
      case "register-instance": {
        const instanceName = String(payload.instanceName ?? "").trim();
        const apiToken = String(payload.apiToken ?? "").trim();
        const baseUrl = String(payload.baseUrl ?? process.env.EVOLUTION_BASE_URL ?? "").trim();
        const instanceId =
          typeof payload.instanceId === "string" ? payload.instanceId : "";

        if (!instanceName || !apiToken || !baseUrl) {
          throw new Error("Nome da instância, token e base URL são obrigatórios.");
        }

        await validateEvolutionInstance({
          instanceName,
          apiToken,
          baseUrl,
        });

        const profile = {
          label: String(payload.label ?? instanceName).trim(),
          notes: String(payload.notes ?? "").trim(),
        };

        const existingByName =
          !instanceId ? await getInstanceByName(instanceName) : null;
        const targetInstanceId = instanceId || existingByName?.id || "";

        const instance = targetInstanceId
          ? await updateManagedInstance(targetInstanceId, {
              instanceName,
              apiToken,
              baseUrl,
              profile,
            })
          : await createManagedInstance({
              instanceName,
              apiToken,
              baseUrl,
              profile,
            });

        return NextResponse.json({ instance });
      }

      case "save-custom-contact": {
        const instanceId = String(payload.instanceId ?? "");

        const contact = await saveCustomContact(instanceId, {
          id: String(payload.id ?? ""),
          fullName: String(payload.fullName ?? "").trim(),
          phoneNumber: String(payload.phoneNumber ?? "").trim(),
          email: payload.email ? String(payload.email) : null,
          organization: payload.organization ? String(payload.organization) : null,
          notes: payload.notes ? String(payload.notes) : null,
          tags: parseTags(String(payload.tags ?? "")),
        } satisfies Omit<CustomContact, "createdAt" | "updatedAt">);

        return NextResponse.json({ contact });
      }

      case "delete-custom-contact": {
        const instanceId = String(payload.instanceId ?? "");
        const contactId = String(payload.contactId ?? "");
        await deleteCustomContact(instanceId, contactId);
        return NextResponse.json({ success: true });
      }

      case "save-broadcast-list": {
        const instanceId = String(payload.instanceId ?? "");
        const list = await saveBroadcastList(instanceId, {
          id: String(payload.id ?? ""),
          name: String(payload.name ?? "").trim(),
          description: payload.description ? String(payload.description) : null,
          recipients: Array.isArray(payload.recipients)
            ? dedupeRecipients(
                payload.recipients.map(
                  (recipient: unknown) =>
                    recipient as BroadcastListRecord["recipients"][number],
                ),
              )
            : [],
        } satisfies Omit<BroadcastListRecord, "createdAt" | "updatedAt">);
        return NextResponse.json({ list });
      }

      case "delete-broadcast-list": {
        const instanceId = String(payload.instanceId ?? "");
        const listId = String(payload.listId ?? "");
        await deleteBroadcastList(instanceId, listId);
        return NextResponse.json({ success: true });
      }

      case "queue-message": {
        const instanceId = String(payload.instanceId ?? "");
        const target = normalizeSendTarget(String(payload.target ?? ""));
        const label = String(payload.label ?? target).trim();
        const message = payload.message as DispatchMessagePayload;

        if (!target) {
          throw new Error("Selecione um destino válido.");
        }

        const job = await enqueueDispatchJob({
          instanceId,
          name: String(payload.name ?? `Envio para ${label}`).trim(),
          recipients: [makeRecipient(label, target, "manual", "envio-unitario")],
          message,
          scheduledFor:
            typeof payload.scheduledFor === "string" && payload.scheduledFor
              ? String(payload.scheduledFor)
              : null,
        });

        return NextResponse.json({ job });
      }

      case "create-campaign": {
        const instanceId = String(payload.instanceId ?? "");
        const audience = payload.audience as {
          includeAllContacts?: boolean;
          includeAllGroups?: boolean;
          includeAllGroupMembers?: boolean;
          includeAllCustomContacts?: boolean;
          selectedBroadcastListIds?: string[];
          manualNumbers?: string[];
          csvNumbers?: string[];
        };
        const recipients = await buildCampaignRecipients(instanceId, {
          includeAllContacts: Boolean(audience.includeAllContacts),
          includeAllGroups: Boolean(audience.includeAllGroups),
          includeAllGroupMembers: Boolean(audience.includeAllGroupMembers),
          includeAllCustomContacts: Boolean(audience.includeAllCustomContacts),
          selectedBroadcastListIds: Array.isArray(audience.selectedBroadcastListIds)
            ? audience.selectedBroadcastListIds.map((item) => String(item))
            : [],
          manualNumbers: Array.isArray(audience.manualNumbers)
            ? audience.manualNumbers.map((item) => String(item))
            : [],
          csvNumbers: Array.isArray(audience.csvNumbers)
            ? audience.csvNumbers.map((item) => String(item))
            : [],
        });

        if (recipients.length === 0) {
          throw new Error("Nenhum destinatário foi montado para esse disparo.");
        }

        const job = await enqueueDispatchJob({
          instanceId,
          name: String(payload.name ?? "Novo disparo em massa").trim(),
          recipients,
          message: payload.message as DispatchMessagePayload,
          scheduledFor:
            typeof payload.scheduledFor === "string" && payload.scheduledFor
              ? String(payload.scheduledFor)
              : null,
        });

        return NextResponse.json({ job });
      }

      case "send-status": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await sendStatusMessage(
          instance,
          payload.message as DispatchMessagePayload,
          Boolean(payload.allContacts),
          Array.isArray(payload.statusJidList)
            ? payload.statusJidList.map((item) => String(item))
            : [],
        );

        return NextResponse.json({ result });
      }

      case "create-group": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await createGroup(
          instance,
          String(payload.subject ?? "").trim(),
          String(payload.description ?? "").trim(),
          Array.isArray(payload.participants)
            ? payload.participants.map((item) => String(item))
            : [],
        );
        return NextResponse.json({ result });
      }

      case "update-group-subject": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await updateGroupSubject(
          instance,
          String(payload.groupJid ?? ""),
          String(payload.subject ?? "").trim(),
        );
        return NextResponse.json({ result });
      }

      case "update-group-description": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await updateGroupDescription(
          instance,
          String(payload.groupJid ?? ""),
          String(payload.description ?? "").trim(),
        );
        return NextResponse.json({ result });
      }

      case "update-group-members": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await updateGroupParticipants(
          instance,
          String(payload.groupJid ?? ""),
          payload.action as "add" | "remove" | "promote" | "demote",
          Array.isArray(payload.participants)
            ? payload.participants.map((item) => String(item))
            : [],
        );
        return NextResponse.json({ result });
      }

      case "update-group-setting": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await updateGroupSetting(
          instance,
          String(payload.groupJid ?? ""),
          payload.action as "announcement" | "not_announcement" | "locked" | "unlocked",
        );
        return NextResponse.json({ result });
      }

      case "toggle-group-ephemeral": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await toggleGroupEphemeral(
          instance,
          String(payload.groupJid ?? ""),
          Number(payload.expiration ?? 0),
        );
        return NextResponse.json({ result });
      }

      case "fetch-group-invite-code": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await fetchGroupInviteCode(
          instance,
          String(payload.groupJid ?? ""),
        );
        return NextResponse.json({ result });
      }

      case "revoke-group-invite-code": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await revokeGroupInviteCode(
          instance,
          String(payload.groupJid ?? ""),
        );
        return NextResponse.json({ result });
      }

      case "send-group-invite": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await sendGroupInvite(
          instance,
          String(payload.groupJid ?? ""),
          Array.isArray(payload.numbers)
            ? payload.numbers.map((item) => String(item))
            : [],
          String(payload.description ?? ""),
        );
        return NextResponse.json({ result });
      }

      case "leave-group": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await leaveGroup(instance, String(payload.groupJid ?? ""));
        return NextResponse.json({ result });
      }

      case "check-whatsapp": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await checkWhatsAppNumbers(
          instance,
          Array.isArray(payload.numbers)
            ? payload.numbers.map((item) => String(item))
            : [],
        );
        return NextResponse.json({ result });
      }

      case "fetch-profile": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await fetchProfile(instance, String(payload.number ?? ""));
        return NextResponse.json({ result });
      }

      case "fetch-profile-picture": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await fetchProfilePicture(instance, String(payload.number ?? ""));
        return NextResponse.json({ result });
      }

      case "update-block-status": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await updateBlockStatus(
          instance,
          String(payload.number ?? ""),
          payload.status as "block" | "unblock",
        );
        return NextResponse.json({ result });
      }

      case "mark-message-read": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await markMessageAsRead(
          instance,
          payload.messageKey as SimplifiedMessage["key"],
        );
        return NextResponse.json({ result });
      }

      case "mark-chat-unread": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await markChatAsUnread(
          instance,
          String(payload.chat ?? ""),
          payload.messageKey as SimplifiedMessage["key"],
        );
        return NextResponse.json({ result });
      }

      case "archive-chat": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await archiveChat(instance, String(payload.chat ?? ""));
        return NextResponse.json({ result });
      }

      case "delete-message": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await deleteMessageForEveryone(
          instance,
          payload.messageKey as SimplifiedMessage["key"],
        );
        return NextResponse.json({ result });
      }

      case "update-message": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await updateMessage(
          instance,
          payload.messageKey as SimplifiedMessage["key"],
          String(payload.text ?? ""),
        );
        return NextResponse.json({ result });
      }

      case "send-reaction": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await sendReaction(
          instance,
          payload.messageKey as SimplifiedMessage["key"],
          String(payload.reaction ?? ""),
        );
        return NextResponse.json({ result });
      }

      case "explorer-request": {
        const instance = await getInstanceById(String(payload.instanceId ?? ""));
        const result = await rawEvolutionRequest(
          instance,
          String(payload.path ?? ""),
          {
            method: String(payload.method ?? "GET").toUpperCase() as
              | "GET"
              | "POST"
              | "PUT"
              | "DELETE",
            query:
              typeof payload.query === "object" && payload.query !== null
                ? (payload.query as Record<string, string | number | boolean>)
                : undefined,
            body:
              typeof payload.body === "object" && payload.body !== null
                ? (payload.body as Record<string, unknown>)
                : null,
          },
        );
        return NextResponse.json({ result });
      }

      case "process-dispatches": {
        const result = await processDueDispatchJobs();
        return NextResponse.json({ result });
      }

      default:
        throw new Error("Ação não suportada.");
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro inesperado.",
      },
      { status: 400 },
    );
  }
}
