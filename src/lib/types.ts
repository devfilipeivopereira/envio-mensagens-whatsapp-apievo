export type InstanceConnectionStatus =
  | "open"
  | "close"
  | "connecting"
  | "unknown"
  | string;

export interface InstanceRecord {
  id: string;
  instanceName: string;
  apiToken: string;
  baseUrl: string;
  dbSchema: string;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EvolutionInstanceSummary {
  id: string;
  name: string;
  connectionStatus: InstanceConnectionStatus;
  ownerJid: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  integration: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  counts: {
    messages: number;
    contacts: number;
    chats: number;
  };
}

export interface ContactItem {
  id: string;
  remoteJid: string;
  pushName: string | null;
  profilePicUrl: string | null;
  isGroup: boolean;
  isSaved: boolean;
  type: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CustomContact {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  organization: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatItem {
  id: string;
  remoteJid: string;
  pushName: string | null;
  profilePicUrl: string | null;
  updatedAt: string | null;
  unreadCount: number;
  isSaved: boolean;
  isGroup: boolean;
  lastMessagePreview: string;
  lastMessageType: string | null;
}

export interface GroupParticipant {
  id: string;
  phoneNumber: string | null;
  admin: string | null;
  name: string | null;
  imgUrl: string | null;
}

export interface GroupSummary {
  id: string;
  groupJid: string;
  subject: string;
  profilePicUrl: string | null;
  updatedAt: string | null;
  unreadCount: number;
  lastMessagePreview: string;
}

export interface SimplifiedMessage {
  id: string;
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string | null;
  };
  pushName: string | null;
  messageType: string;
  preview: string;
  messageTimestamp: number | null;
  source: string | null;
  statusUpdates: string[];
  raw: Record<string, unknown>;
}

export interface BroadcastListRecord {
  id: string;
  name: string;
  description: string | null;
  recipients: DispatchRecipient[];
  createdAt: string;
  updatedAt: string;
}

export type DispatchRecipientKind =
  | "contact"
  | "group"
  | "group-member"
  | "custom-contact"
  | "manual"
  | "csv"
  | "broadcast-list";

export interface DispatchRecipient {
  id: string;
  label: string;
  target: string;
  kind: DispatchRecipientKind;
  source: string | null;
}

export interface QuotedMessageReference {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  conversation: string;
}

export interface CommonMessageOptions {
  linkPreview: boolean;
  mentionsEveryOne: boolean;
  mentioned: string[];
  delayMs: number;
  quoted: QuotedMessageReference | null;
}

export type DispatchMessageType =
  | "text"
  | "media"
  | "audio"
  | "sticker"
  | "location"
  | "contact"
  | "poll"
  | "list"
  | "status"
  | "buttons";

export interface DispatchMessagePayload {
  type: DispatchMessageType;
  options: CommonMessageOptions;
  text?: string;
  media?: string;
  mediaType?: "image" | "video" | "document";
  mimeType?: string;
  fileName?: string;
  caption?: string;
  audio?: string;
  sticker?: string;
  statusType?: "text" | "image" | "video" | "audio";
  statusContent?: string;
  statusBackgroundColor?: string;
  statusFont?: number;
  locationName?: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  contactCards?: Array<{
    phoneNumber: string;
    fullName: string;
    organization?: string;
    email?: string;
    url?: string;
    wuid?: string;
  }>;
  pollName?: string;
  pollOptions?: string[];
  pollSelectableCount?: number;
  listTitle?: string;
  listDescription?: string;
  listButtonText?: string;
  listFooterText?: string;
  listSections?: Array<{
    title: string;
    rows: Array<{
      title: string;
      description?: string;
      rowId: string;
    }>;
  }>;
  buttonsTitle?: string;
  buttonsDescription?: string;
  buttonsFooter?: string;
  buttons?: Array<{
    title: string;
    displayText: string;
    id: string;
  }>;
}

export type DispatchJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed";

export interface DispatchJobRecipient extends DispatchRecipient {
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  error: string | null;
}

export interface DispatchJob {
  id: string;
  name: string;
  instanceId: string;
  instanceName: string;
  status: DispatchJobStatus;
  throttleMs: number;
  createdAt: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  totalRecipients: number;
  successfulRecipients: number;
  failedRecipients: number;
  message: DispatchMessagePayload;
  recipients: DispatchJobRecipient[];
}

export interface CampaignAudienceRequest {
  includeAllContacts: boolean;
  includeAllGroups: boolean;
  includeAllGroupMembers: boolean;
  includeAllCustomContacts: boolean;
  selectedBroadcastListIds: string[];
  manualNumbers: string[];
  csvNumbers: string[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}
