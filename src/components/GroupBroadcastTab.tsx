import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import MessageComposer from "@/components/MessageComposer";
import { EvolutionConfig } from "@/lib/evolution-api";
import { dispatchBlocksToTarget } from "@/lib/block-dispatch";
import { runQueue } from "@/lib/queue/dispatch";
import { validateBlock } from "@/lib/message-blocks";
import { Instance } from "@/lib/instances";
import { EvolutionGroup, MessageBlock, MessageBlockType, QueueItemState } from "@/types/messaging";
import { Loader2, Send, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  config: EvolutionConfig;
  instance: Instance;
  groups: EvolutionGroup[];
  onRefreshGroups: () => Promise<void>;
}

const ALLOWED_TYPES: MessageBlockType[] = ["text", "media", "audio", "sticker", "location", "contact", "reaction", "poll"];

export default function GroupBroadcastTab({ config, instance, groups, onRefreshGroups }: Props) {
  const { toast } = useToast();
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<MessageBlock[]>([]);
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<QueueItemState[]>([]);
  const cancelSignal = useRef({ cancelled: false });

  const selectedGroups = useMemo(
    () => groups.filter((group) => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds]
  );

  const hasValidationError = useMemo(() => blocks.some((block) => Boolean(validateBlock(block))), [blocks]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const start = async () => {
    if (!selectedGroups.length) {
      toast({ title: "Selecione ao menos um grupo", variant: "destructive" });
      return;
    }

    if (!blocks.length || hasValidationError) {
      toast({ title: "Revise os blocos da mensagem", variant: "destructive" });
      return;
    }

    setRunning(true);
    cancelSignal.current.cancelled = false;

    await runQueue({
      items: selectedGroups,
      delayMs: 20000,
      signal: cancelSignal.current,
      onUpdate: setQueue,
      getLabel: (group) => `${group.subject} (${group.id})`,
      worker: async (group) => {
        const result = await dispatchBlocksToTarget(config, instance.name, group.id, blocks);
        return { success: result.success, error: result.error };
      },
    });

    setRunning(false);
    toast({ title: cancelSignal.current.cancelled ? "Envio cancelado" : "Envio para grupos concluído" });
  };

  const cancel = () => {
    cancelSignal.current.cancelled = true;
  };

  const sent = queue.filter((item) => item.status === "sent").length;
  const errors = queue.filter((item) => item.status === "error").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Envio para grupos (20s por grupo)</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void onRefreshGroups()}>
              Atualizar grupos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum grupo oficial encontrado.</p>
          ) : (
            <div className="rounded-lg border p-3 space-y-2 max-h-56 overflow-auto">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={() => toggleGroup(group.id)} disabled={running} />
                  <span className="text-sm truncate">{group.subject}</span>
                  <Badge variant="secondary" className="ml-auto">{group.size ?? group.participants?.length ?? 0}</Badge>
                </label>
              ))}
            </div>
          )}

          <div className="text-sm">Grupos selecionados: <strong>{selectedGroups.length}</strong></div>

          <div className="flex gap-2">
            {!running ? (
              <Button onClick={() => void start()} className="gap-2" disabled={!selectedGroups.length || !blocks.length}>
                <Send className="h-4 w-4" /> Iniciar envio
              </Button>
            ) : (
              <Button variant="destructive" onClick={cancel} className="gap-2">
                <Square className="h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>

          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2 text-sm">
                <Badge className="bg-success text-success-foreground">{sent} enviados</Badge>
                <Badge variant="destructive">{errors} erros</Badge>
                <Badge variant="secondary">{queue.length} total</Badge>
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="max-h-44 overflow-auto rounded-lg border p-2 space-y-1">
                {queue.map((item) => (
                  <div key={item.id} className="text-xs flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                    <span className="truncate">{item.label}</span>
                    <span>{item.status}{item.error ? ` • ${item.error}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MessageComposer instanceName={instance.name} blocks={blocks} onChange={setBlocks} allowedTypes={ALLOWED_TYPES} title="Blocos para envio em grupos" />
    </div>
  );
}
