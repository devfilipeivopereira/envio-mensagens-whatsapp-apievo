import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { deleteMediaAsset, listMediaAssets, uploadMediaAsset } from "@/lib/media-assets";
import { blockLabels, createDefaultBlock, validateBlock } from "@/lib/message-blocks";
import { MediaAsset, MessageBlock, MessageBlockType } from "@/types/messaging";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react";

interface MessageComposerProps {
  instanceName: string;
  blocks: MessageBlock[];
  onChange: (blocks: MessageBlock[]) => void;
  allowedTypes: MessageBlockType[];
  title?: string;
}

export default function MessageComposer({ instanceName, blocks, onChange, allowedTypes, title = "Composer" }: MessageComposerProps) {
  const { toast } = useToast();
  const [newType, setNewType] = useState<MessageBlockType>(allowedTypes[0] ?? "text");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  const hasStatusType = useMemo(() => blocks.some((block) => block.type === "status"), [blocks]);

  const refreshAssets = async () => {
    if (!instanceName) return;
    setLoadingAssets(true);
    const all = await listMediaAssets(instanceName);
    setAssets(all);
    setLoadingAssets(false);
  };

  useEffect(() => {
    void refreshAssets();
  }, [instanceName]);

  const updateBlock = (id: string, updater: (block: MessageBlock) => MessageBlock) => {
    const updated = blocks.map((block) => (block.id === id ? updater(block) : block));
    onChange(updated);
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((block) => block.id !== id));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const clone = [...blocks];
    const [item] = clone.splice(index, 1);
    clone.splice(target, 0, item);
    onChange(clone);
  };

  const addBlock = () => {
    if (newType === "status" && hasStatusType) {
      toast({ title: "Status já adicionado", description: "Use um único bloco de status por composição." });
      return;
    }
    onChange([...blocks, createDefaultBlock(newType)]);
  };

  const handleUpload = async (blockId: string, file?: File | null) => {
    if (!file) return;
    setUploadingBlockId(blockId);
    const result = await uploadMediaAsset(instanceName, file);
    setUploadingBlockId(null);

    if (!result.success || !result.asset) {
      toast({ title: "Erro no upload", description: result.error, variant: "destructive" });
      return;
    }

    updateBlock(blockId, (block) => {
      if (block.type === "media") {
        return {
          ...block,
          mediaUrl: result.asset!.publicUrl,
          fileName: result.asset!.originalFileName || block.fileName,
          mimetype: result.asset!.mimeType || block.mimetype,
          assetId: result.asset!.id,
        };
      }

      if (block.type === "audio") {
        return { ...block, audioUrl: result.asset!.publicUrl, assetId: result.asset!.id };
      }

      if (block.type === "sticker") {
        return { ...block, stickerUrl: result.asset!.publicUrl, assetId: result.asset!.id };
      }

      if (block.type === "status") {
        return { ...block, content: result.asset!.publicUrl, assetId: result.asset!.id };
      }

      return block;
    });

    toast({ title: "Upload concluído", description: file.name });
    await refreshAssets();
  };

  const selectAsset = (blockId: string, assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;

    updateBlock(blockId, (block) => {
      if (block.type === "media") {
        return {
          ...block,
          mediaUrl: asset.publicUrl,
          fileName: asset.originalFileName || block.fileName,
          mimetype: asset.mimeType || block.mimetype,
          assetId: asset.id,
        };
      }

      if (block.type === "audio") return { ...block, audioUrl: asset.publicUrl, assetId: asset.id };
      if (block.type === "sticker") return { ...block, stickerUrl: asset.publicUrl, assetId: asset.id };
      if (block.type === "status") return { ...block, content: asset.publicUrl, assetId: asset.id };
      return block;
    });
  };

  const deleteAsset = async (asset: MediaAsset) => {
    const result = await deleteMediaAsset(asset);
    if (!result.success) {
      toast({ title: "Erro ao remover arquivo", description: result.error, variant: "destructive" });
      return;
    }

    setAssets((prev) => prev.filter((item) => item.id !== asset.id));
  };

  const getAssetOptions = (block: MessageBlock): MediaAsset[] => {
    if (block.type === "media") {
      return assets.filter((asset) => {
        if (block.mediatype === "image") return asset.mediaKind === "image";
        if (block.mediatype === "video") return asset.mediaKind === "video";
        return asset.mediaKind === "document" || asset.mediaKind === "other";
      });
    }

    if (block.type === "audio") return assets.filter((asset) => asset.mediaKind === "audio");
    if (block.type === "sticker") return assets.filter((asset) => asset.mediaKind === "sticker" || asset.mediaKind === "image");
    if (block.type === "status") {
      if (block.statusType === "image") return assets.filter((asset) => asset.mediaKind === "image");
      if (block.statusType === "audio") return assets.filter((asset) => asset.mediaKind === "audio");
    }

    return [];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={newType} onValueChange={(value) => setNewType(value as MessageBlockType)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {blockLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addBlock} className="gap-2" size="sm">
              <Plus className="h-4 w-4" /> Adicionar bloco
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">Adicione blocos para montar sua mensagem sequencial.</p>
        )}

        {blocks.map((block, index) => {
          const error = validateBlock(block);
          const assetsForBlock = getAssetOptions(block);

          return (
            <div key={block.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="font-medium text-sm">{blockLabels[block.type]}</span>
                  {error && <Badge variant="destructive">{error}</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveBlock(index, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveBlock(index, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeBlock(block.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {block.type === "text" && (
                <div className="space-y-2">
                  <Label>Texto</Label>
                  <Textarea
                    value={block.text}
                    onChange={(event) => updateBlock(block.id, (current) => ({ ...current, text: event.target.value } as MessageBlock))}
                    rows={3}
                  />
                </div>
              )}

              {block.type === "media" && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Tipo da mídia</Label>
                      <Select
                        value={block.mediatype}
                        onValueChange={(value) =>
                          updateBlock(block.id, (current) => ({ ...current, mediatype: value as "image" | "video" | "document" } as MessageBlock))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="document">Documento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mimetype</Label>
                      <Input
                        value={block.mimetype}
                        onChange={(event) => updateBlock(block.id, (current) => ({ ...current, mimetype: event.target.value } as MessageBlock))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do arquivo</Label>
                      <Input
                        value={block.fileName}
                        onChange={(event) => updateBlock(block.id, (current) => ({ ...current, fileName: event.target.value } as MessageBlock))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Legenda</Label>
                    <Input
                      value={block.caption}
                      onChange={(event) => updateBlock(block.id, (current) => ({ ...current, caption: event.target.value } as MessageBlock))}
                    />
                  </div>

                  <MediaSourceEditor
                    blockId={block.id}
                    sourceMode={block.sourceMode}
                    urlValue={block.mediaUrl}
                    onSourceModeChange={(mode) => updateBlock(block.id, (current) => ({ ...current, sourceMode: mode } as MessageBlock))}
                    onUrlChange={(url) => updateBlock(block.id, (current) => ({ ...current, mediaUrl: url } as MessageBlock))}
                    uploading={uploadingBlockId === block.id}
                    onUpload={handleUpload}
                    assets={assetsForBlock}
                    onSelectAsset={selectAsset}
                  />
                </div>
              )}

              {block.type === "audio" && (
                <MediaSourceEditor
                  blockId={block.id}
                  sourceMode={block.sourceMode}
                  urlValue={block.audioUrl}
                  onSourceModeChange={(mode) => updateBlock(block.id, (current) => ({ ...current, sourceMode: mode } as MessageBlock))}
                  onUrlChange={(url) => updateBlock(block.id, (current) => ({ ...current, audioUrl: url } as MessageBlock))}
                  uploading={uploadingBlockId === block.id}
                  onUpload={handleUpload}
                  assets={assetsForBlock}
                  onSelectAsset={selectAsset}
                />
              )}

              {block.type === "sticker" && (
                <MediaSourceEditor
                  blockId={block.id}
                  sourceMode={block.sourceMode}
                  urlValue={block.stickerUrl}
                  onSourceModeChange={(mode) => updateBlock(block.id, (current) => ({ ...current, sourceMode: mode } as MessageBlock))}
                  onUrlChange={(url) => updateBlock(block.id, (current) => ({ ...current, stickerUrl: url } as MessageBlock))}
                  uploading={uploadingBlockId === block.id}
                  onUpload={handleUpload}
                  assets={assetsForBlock}
                  onSelectAsset={selectAsset}
                />
              )}

              {block.type === "location" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={block.name} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, name: event.target.value } as MessageBlock))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input value={block.address} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, address: event.target.value } as MessageBlock))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input
                      value={String(block.latitude)}
                      onChange={(event) => updateBlock(block.id, (current) => ({ ...current, latitude: Number(event.target.value || 0) } as MessageBlock))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input
                      value={String(block.longitude)}
                      onChange={(event) => updateBlock(block.id, (current) => ({ ...current, longitude: Number(event.target.value || 0) } as MessageBlock))}
                    />
                  </div>
                </div>
              )}

              {block.type === "contact" && (
                <div className="space-y-3">
                  {block.contacts.map((contact, contactIndex) => (
                    <div key={contactIndex} className="grid gap-2 md:grid-cols-3">
                      <Input
                        placeholder="Nome completo"
                        value={contact.fullName}
                        onChange={(event) =>
                          updateBlock(block.id, (current) => {
                            const clone = [...(current.type === "contact" ? current.contacts : [])];
                            clone[contactIndex] = { ...clone[contactIndex], fullName: event.target.value };
                            return { ...(current as MessageBlock), contacts: clone } as MessageBlock;
                          })
                        }
                      />
                      <Input
                        placeholder="Telefone"
                        value={contact.phoneNumber ?? ""}
                        onChange={(event) =>
                          updateBlock(block.id, (current) => {
                            const clone = [...(current.type === "contact" ? current.contacts : [])];
                            clone[contactIndex] = { ...clone[contactIndex], phoneNumber: event.target.value };
                            return { ...(current as MessageBlock), contacts: clone } as MessageBlock;
                          })
                        }
                      />
                      <Input
                        placeholder="Email"
                        value={contact.email ?? ""}
                        onChange={(event) =>
                          updateBlock(block.id, (current) => {
                            const clone = [...(current.type === "contact" ? current.contacts : [])];
                            clone[contactIndex] = { ...clone[contactIndex], email: event.target.value };
                            return { ...(current as MessageBlock), contacts: clone } as MessageBlock;
                          })
                        }
                      />
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateBlock(block.id, (current) => {
                        if (current.type !== "contact") return current;
                        return {
                          ...current,
                          contacts: [...current.contacts, { fullName: "", phoneNumber: "" }],
                        } as MessageBlock;
                      })
                    }
                  >
                    Adicionar contato
                  </Button>
                </div>
              )}

              {block.type === "reaction" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Emoji</Label>
                    <Input value={block.reaction} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, reaction: event.target.value } as MessageBlock))} />
                  </div>
                  <div className="space-y-2">
                    <Label>ID da mensagem alvo</Label>
                    <Input value={block.messageId} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, messageId: event.target.value } as MessageBlock))} />
                  </div>
                </div>
              )}

              {block.type === "poll" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Título da enquete</Label>
                    <Input value={block.name} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, name: event.target.value } as MessageBlock))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Opções (uma por linha)</Label>
                    <Textarea
                      value={block.options.join("\n")}
                      onChange={(event) =>
                        updateBlock(block.id, (current) => ({
                          ...current,
                          options: event.target.value.split(/\r?\n/),
                        } as MessageBlock))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade selecionável</Label>
                    <Input
                      type="number"
                      min={1}
                      value={String(block.selectableCount)}
                      onChange={(event) =>
                        updateBlock(block.id, (current) => ({ ...current, selectableCount: Math.max(1, Number(event.target.value || 1)) } as MessageBlock))
                      }
                    />
                  </div>
                </div>
              )}

              {block.type === "status" && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de status</Label>
                      <Select
                        value={block.statusType}
                        onValueChange={(value) =>
                          updateBlock(block.id, (current) => ({
                            ...current,
                            statusType: value as "text" | "image" | "audio",
                            content: "",
                          } as MessageBlock))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="audio">Áudio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fonte</Label>
                      <div className="flex items-center gap-2 pt-2">
                        <Checkbox
                          checked={block.sourceMode === "upload"}
                          onCheckedChange={(checked) =>
                            updateBlock(block.id, (current) => ({ ...current, sourceMode: checked ? "upload" : "url" } as MessageBlock))
                          }
                        />
                        <span className="text-sm">Usar upload Supabase</span>
                      </div>
                    </div>
                  </div>

                  {block.statusType === "text" ? (
                    <div className="space-y-2">
                      <Label>Texto do status</Label>
                      <Textarea value={block.content} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, content: event.target.value } as MessageBlock))} />
                    </div>
                  ) : (
                    <MediaSourceEditor
                      blockId={block.id}
                      sourceMode={block.sourceMode}
                      urlValue={block.content}
                      onSourceModeChange={(mode) => updateBlock(block.id, (current) => ({ ...current, sourceMode: mode } as MessageBlock))}
                      onUrlChange={(url) => updateBlock(block.id, (current) => ({ ...current, content: url } as MessageBlock))}
                      uploading={uploadingBlockId === block.id}
                      onUpload={handleUpload}
                      assets={assetsForBlock}
                      onSelectAsset={selectAsset}
                    />
                  )}

                  <div className="space-y-2">
                    <Label>Legenda (opcional)</Label>
                    <Input value={block.caption ?? ""} onChange={(event) => updateBlock(block.id, (current) => ({ ...current, caption: event.target.value } as MessageBlock))} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Biblioteca de mídia (Supabase)</span>
            <Button size="sm" variant="outline" onClick={refreshAssets} disabled={loadingAssets}>
              {loadingAssets ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
          {assets.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum arquivo salvo.</p>
          ) : (
            <div className="max-h-44 overflow-auto space-y-2">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded border p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{asset.originalFileName || asset.path}</p>
                    <p className="text-xs text-muted-foreground">{asset.mediaKind} • {asset.mimeType || "sem-mime"}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => void deleteAsset(asset)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MediaSourceEditorProps {
  blockId: string;
  sourceMode: "url" | "upload";
  urlValue: string;
  onSourceModeChange: (mode: "url" | "upload") => void;
  onUrlChange: (url: string) => void;
  uploading: boolean;
  onUpload: (blockId: string, file?: File | null) => Promise<void>;
  assets: MediaAsset[];
  onSelectAsset: (blockId: string, assetId: string) => void;
}

function MediaSourceEditor(props: MediaSourceEditorProps) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={props.sourceMode === "url" ? "default" : "outline"}
          onClick={() => props.onSourceModeChange("url")}
        >
          URL
        </Button>
        <Button
          type="button"
          size="sm"
          variant={props.sourceMode === "upload" ? "default" : "outline"}
          onClick={() => props.onSourceModeChange("upload")}
        >
          Upload Supabase
        </Button>
      </div>

      <div className="space-y-2">
        <Label>URL final usada no envio</Label>
        <Input value={props.urlValue} onChange={(event) => props.onUrlChange(event.target.value)} placeholder="https://..." />
      </div>

      {props.assets.length > 0 && (
        <div className="space-y-2">
          <Label>Selecionar da biblioteca</Label>
          <Select onValueChange={(value) => props.onSelectAsset(props.blockId, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um arquivo salvo" />
            </SelectTrigger>
            <SelectContent>
              {props.assets.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.originalFileName || asset.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {props.sourceMode === "upload" && (
        <div className="space-y-2">
          <Label>Arquivo</Label>
          <div className="flex items-center gap-3">
            <Input type="file" onChange={(event) => void props.onUpload(props.blockId, event.target.files?.[0])} />
            {props.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </div>
        </div>
      )}
    </div>
  );
}
