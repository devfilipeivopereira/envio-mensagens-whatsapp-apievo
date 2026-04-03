import { NextRequest, NextResponse } from "next/server";

import { fetchChats, fetchContacts, fetchEvolutionSummary, fetchGroupParticipants, fetchMessages } from "@/lib/evolution";
import {
  ensureDefaultInstanceFromEnv,
  getBroadcastLists,
  getCustomContacts,
  getInstanceById,
  listDispatchJobs,
  listInstances,
} from "@/lib/instance-store";
import { requireApiUser } from "@/lib/request-auth";
import { mapGroup, sortChats, sortContacts, sortGroups } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request);
    await ensureDefaultInstanceFromEnv();

    const resource = request.nextUrl.searchParams.get("resource");
    const instanceId = request.nextUrl.searchParams.get("instanceId");

    switch (resource) {
      case "instances": {
        const instances = await listInstances();
        const summaries = await Promise.all(
          instances.map(async (instance) => {
            try {
              const summary = await fetchEvolutionSummary(instance);

              return {
                ...instance,
                summary,
              };
            } catch (error) {
              return {
                ...instance,
                summary: null,
                summaryError:
                  error instanceof Error ? error.message : "Falha ao ler a Evolution API.",
              };
            }
          }),
        );

        return NextResponse.json({ instances: summaries });
      }

      case "contacts": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar os contatos.");
        }

        const instance = await getInstanceById(instanceId);
        const [syncedContacts, customContacts] = await Promise.all([
          fetchContacts(instance),
          getCustomContacts(instanceId),
        ]);

        return NextResponse.json({
          syncedContacts: sortContacts(syncedContacts),
          customContacts,
        });
      }

      case "chats": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar as conversas.");
        }

        const chats = await fetchChats(await getInstanceById(instanceId));
        return NextResponse.json({ chats: sortChats(chats) });
      }

      case "groups": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar os grupos.");
        }

        const chats = await fetchChats(await getInstanceById(instanceId));
        const groups = chats.filter((chat) => chat.isGroup).map((chat) => mapGroup(chat));
        return NextResponse.json({ groups: sortGroups(groups) });
      }

      case "messages": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar as mensagens.");
        }

        const remoteJid = request.nextUrl.searchParams.get("remoteJid");

        if (!remoteJid) {
          throw new Error("Informe o chat desejado.");
        }

        const messages = await fetchMessages(await getInstanceById(instanceId), remoteJid);
        return NextResponse.json({ messages });
      }

      case "group-members": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar os participantes.");
        }

        const groupJid = request.nextUrl.searchParams.get("groupJid");

        if (!groupJid) {
          throw new Error("Informe o grupo desejado.");
        }

        const participants = await fetchGroupParticipants(
          await getInstanceById(instanceId),
          groupJid,
        );
        return NextResponse.json({ participants });
      }

      case "broadcast-lists": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar as listas.");
        }

        const lists = await getBroadcastLists(instanceId);
        return NextResponse.json({ lists });
      }

      case "dispatch-jobs": {
        if (!instanceId) {
          throw new Error("Selecione uma instância para carregar os disparos.");
        }

        const jobs = await listDispatchJobs(instanceId);
        return NextResponse.json({ jobs });
      }

      default:
        throw new Error("Recurso não suportado.");
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
