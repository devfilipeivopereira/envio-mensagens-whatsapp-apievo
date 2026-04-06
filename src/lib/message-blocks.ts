import { MessageBlock, MessageBlockType } from "@/types/messaging";

export function createDefaultBlock(type: MessageBlockType): MessageBlock {
  const id = crypto.randomUUID();

  switch (type) {
    case "text":
      return { id, type, text: "" };
    case "media":
      return {
        id,
        type,
        sourceMode: "url",
        mediaUrl: "",
        mediatype: "image",
        mimetype: "image/png",
        fileName: "arquivo.png",
        caption: "",
      };
    case "audio":
      return { id, type, sourceMode: "url", audioUrl: "" };
    case "sticker":
      return { id, type, sourceMode: "url", stickerUrl: "" };
    case "location":
      return {
        id,
        type,
        name: "",
        address: "",
        latitude: -23.55052,
        longitude: -46.633308,
      };
    case "contact":
      return {
        id,
        type,
        contacts: [{ fullName: "", phoneNumber: "" }],
      };
    case "reaction":
      return { id, type, reaction: "👍", messageId: "" };
    case "poll":
      return { id, type, name: "", selectableCount: 1, options: ["Opção 1", "Opção 2"] };
    case "status":
      return {
        id,
        type,
        statusType: "text",
        content: "",
        sourceMode: "url",
        allContacts: true,
        statusJidList: [],
        backgroundColor: "#008000",
        font: 1,
      };
    default:
      return { id, type: "text", text: "" };
  }
}

export const blockLabels: Record<MessageBlockType, string> = {
  text: "Texto",
  media: "Mídia",
  audio: "Áudio",
  sticker: "Sticker",
  location: "Localização",
  contact: "Contato",
  reaction: "Reação",
  poll: "Enquete",
  status: "Status",
};

export function validateBlock(block: MessageBlock): string | null {
  switch (block.type) {
    case "text":
      return block.text.trim() ? null : "Texto é obrigatório";
    case "media":
      if (!block.mediaUrl.trim()) return "URL da mídia é obrigatória";
      if (!block.fileName.trim()) return "Nome do arquivo é obrigatório";
      if (!block.mimetype.trim()) return "Mimetype é obrigatório";
      return null;
    case "audio":
      return block.audioUrl.trim() ? null : "URL do áudio é obrigatória";
    case "sticker":
      return block.stickerUrl.trim() ? null : "URL do sticker é obrigatória";
    case "location":
      if (!block.name.trim()) return "Nome da localização é obrigatório";
      if (!block.address.trim()) return "Endereço da localização é obrigatório";
      return null;
    case "contact":
      if (!block.contacts.length) return "Adicione ao menos um contato";
      return block.contacts.some((c) => !c.fullName.trim()) ? "Nome do contato é obrigatório" : null;
    case "reaction":
      return block.messageId.trim() ? null : "ID da mensagem para reação é obrigatório";
    case "poll":
      if (!block.name.trim()) return "Título da enquete é obrigatório";
      return block.options.filter((o) => o.trim()).length >= 2 ? null : "Informe ao menos 2 opções";
    case "status":
      if (block.statusType === "text") return block.content.trim() ? null : "Texto do status é obrigatório";
      return block.content.trim() ? null : "URL da mídia do status é obrigatória";
    default:
      return null;
  }
}
