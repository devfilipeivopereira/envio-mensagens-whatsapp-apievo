import {
  ContactPayloadItem,
  EvolutionConfig,
  sendContactMessage,
  sendLocationMessage,
  sendMediaMessage,
  sendPollMessage,
  sendReactionMessage,
  sendStatusMessage,
  sendStickerMessage,
  sendTextMessage,
  sendWhatsAppAudioMessage,
} from "@/lib/evolution-api";
import { MessageBlock, SendResult } from "@/types/messaging";

function toRemoteJid(target: string): string {
  if (target.includes("@")) return target;
  return `${target}@s.whatsapp.net`;
}

function trimList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export async function dispatchBlocksToTarget(
  config: EvolutionConfig,
  instanceName: string,
  target: string,
  blocks: MessageBlock[]
): Promise<SendResult> {
  for (const block of blocks) {
    let result: SendResult;

    switch (block.type) {
      case "text":
        result = await sendTextMessage(config, instanceName, {
          number: target,
          text: block.text,
          delay: block.delay,
        });
        break;
      case "media":
        result = await sendMediaMessage(config, instanceName, {
          number: target,
          mediatype: block.mediatype,
          mimetype: block.mimetype,
          caption: block.caption,
          media: block.mediaUrl,
          fileName: block.fileName,
          delay: block.delay,
        });
        break;
      case "audio":
        result = await sendWhatsAppAudioMessage(config, instanceName, {
          number: target,
          audio: block.audioUrl,
          delay: block.delay,
        });
        break;
      case "sticker":
        result = await sendStickerMessage(config, instanceName, {
          number: target,
          sticker: block.stickerUrl,
          delay: block.delay,
        });
        break;
      case "location":
        result = await sendLocationMessage(config, instanceName, {
          number: target,
          name: block.name,
          address: block.address,
          latitude: block.latitude,
          longitude: block.longitude,
          delay: block.delay,
        });
        break;
      case "contact": {
        const contact: ContactPayloadItem[] = block.contacts.map((item) => ({
          fullName: item.fullName,
          wuid: item.wuid?.trim() || undefined,
          phoneNumber: item.phoneNumber?.trim() || undefined,
          organization: item.organization?.trim() || undefined,
          email: item.email?.trim() || undefined,
          url: item.url?.trim() || undefined,
        }));

        result = await sendContactMessage(config, instanceName, {
          number: target,
          contact,
        });
        break;
      }
      case "reaction":
        result = await sendReactionMessage(config, instanceName, {
          reaction: block.reaction,
          key: {
            id: block.messageId,
            fromMe: false,
            remoteJid: toRemoteJid(target),
          },
        });
        break;
      case "poll":
        result = await sendPollMessage(config, instanceName, {
          number: target,
          name: block.name,
          selectableCount: block.selectableCount,
          values: trimList(block.options),
        });
        break;
      case "status":
        result = await sendStatusMessage(config, instanceName, {
          type: block.statusType,
          content: block.content,
          caption: block.caption,
          backgroundColor: block.backgroundColor,
          font: block.font,
          allContacts: block.allContacts ?? true,
          statusJidList: block.statusJidList ?? [],
        });
        break;
      default:
        result = { success: false, error: "Tipo de bloco não suportado" };
    }

    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}
