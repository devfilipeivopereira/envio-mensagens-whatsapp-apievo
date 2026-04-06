export type MessageBlockType =
  | "text"
  | "media"
  | "audio"
  | "sticker"
  | "location"
  | "contact"
  | "reaction"
  | "poll"
  | "status";

export type MediaSourceMode = "url" | "upload";

export interface BaseMessageBlock {
  id: string;
  type: MessageBlockType;
}

export interface TextBlock extends BaseMessageBlock {
  type: "text";
  text: string;
  delay?: number;
}

export interface MediaBlock extends BaseMessageBlock {
  type: "media";
  sourceMode: MediaSourceMode;
  mediaUrl: string;
  mediatype: "image" | "video" | "document";
  mimetype: string;
  fileName: string;
  caption: string;
  delay?: number;
  assetId?: string;
}

export interface AudioBlock extends BaseMessageBlock {
  type: "audio";
  sourceMode: MediaSourceMode;
  audioUrl: string;
  delay?: number;
  assetId?: string;
}

export interface StickerBlock extends BaseMessageBlock {
  type: "sticker";
  sourceMode: MediaSourceMode;
  stickerUrl: string;
  delay?: number;
  assetId?: string;
}

export interface LocationBlock extends BaseMessageBlock {
  type: "location";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  delay?: number;
}

export interface ContactItemInput {
  fullName: string;
  wuid?: string;
  phoneNumber?: string;
  organization?: string;
  email?: string;
  url?: string;
}

export interface ContactBlock extends BaseMessageBlock {
  type: "contact";
  contacts: ContactItemInput[];
}

export interface ReactionBlock extends BaseMessageBlock {
  type: "reaction";
  reaction: string;
  messageId: string;
}

export interface PollBlock extends BaseMessageBlock {
  type: "poll";
  name: string;
  options: string[];
  selectableCount: number;
}

export interface StatusBlock extends BaseMessageBlock {
  type: "status";
  statusType: "text" | "image" | "audio";
  content: string;
  caption?: string;
  backgroundColor?: string;
  font?: number;
  allContacts?: boolean;
  statusJidList?: string[];
  sourceMode: MediaSourceMode;
  assetId?: string;
}

export type MessageBlock =
  | TextBlock
  | MediaBlock
  | AudioBlock
  | StickerBlock
  | LocationBlock
  | ContactBlock
  | ReactionBlock
  | PollBlock
  | StatusBlock;

export interface SendResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface QueueItemState {
  id: string;
  label: string;
  status: "pending" | "sending" | "sent" | "error" | "cancelled";
  error?: string;
}

export interface EvolutionGroupParticipant {
  id: string;
  admin?: string;
}

export interface EvolutionGroup {
  id: string;
  subject: string;
  subjectOwner?: string;
  subjectTime?: number;
  pictureUrl?: string | null;
  size?: number;
  creation?: number;
  owner?: string;
  desc?: string;
  descId?: string;
  restrict?: boolean;
  announce?: boolean;
  participants?: EvolutionGroupParticipant[];
}

export interface MediaAsset {
  id: string;
  instanceName: string;
  mediaKind: "image" | "audio" | "video" | "document" | "sticker" | "other";
  bucket: string;
  path: string;
  publicUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  originalFileName?: string;
  createdAt: string;
}

export interface CustomGroup {
  id: string;
  name: string;
  members: string[];
  createdAt: string;
}

export interface CsvImportResult {
  imported: string[];
  duplicates: string[];
  invalid: string[];
}
