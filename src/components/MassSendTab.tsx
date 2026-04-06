import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import CustomGroupsManager from "@/components/CustomGroupsManager";
import MessageComposer from "@/components/MessageComposer";
import { EvolutionConfig } from "@/lib/evolution-api";
import { dispatchBlocksToTarget } from "@/lib/block-dispatch";
import { normalizePhoneNumber } from "@/lib/phone";
import { runQueue } from "@/lib/queue/dispatch";
import { validateBlock } from "@/lib/message-blocks";
import { Instance } from "@/lib/instances";
import { CustomGroup, MessageBlock, MessageBlockType, QueueItemState } from "@/types/messaging";
import { Loader2, Send, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  config: EvolutionConfig;
  instance: Instance;
  customGroups: CustomGroup[];
  onRefreshCustomGroups: () => Promise<void>;
}

const ALLOWED_TYPES: MessageBlockType[] = ["text", "media", "audio", "sticker", "location", "contact", "reaction", "poll"];

export default function MassSendTab({ config, instance, customGroups, onRefreshCustomGroups }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"manual" | "custom-groups">("manual");
  const [manualNumbers, setManualNumbers] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<MessageBlock[]>([]);
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<QueueItemState[]>([]);
  const cancelSignal = useRef({ cancelled: false });

  const hasValidationError = useMemo(() => blocks.some((block) => Boolean(validateBlock(block))), [blocks]);

  const targets = useMemo(() => {
    if (mode === "manual") {
      return [...new Set(manualNumbers.split(/\r?\n/).map(normalizePhoneNumber).filter(Boolean))];
    }

    const selected = customGroups.filter((group) => selectedGroupIds.includes(group.id));
    return [...new Set(selected.flatMap((group) => group.members).map(normalizePhoneNumber).filter(Boolean))];
  }, [customGroups, manualNumbers, mode, selectedGroupIds]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const start = async () => {
    if (!targets.length) {
      toast({ title: "Nenhum destinatário", variant: "destructive" });
      return;
    }

    if (!blocks.length || hasValidationError) {
      toast({ title: "Revise os blocos da mensagem", variant: "destructive" });
      return;
    }

    setRunning(true);
    cancelSignal.current.cancelled = false;

    await runQueue({
      items: targets,
      delayMs: 10000,
      signal: cancelSignal.current,
      onUpdate: setQueue,
      getLabel: (target) => target,
      worker: async (target) => {
        const result = await dispatchBlocksToTarget(config, instance.name, target, blocks);
        return { success: result.success, error: result.error };
      },
    });

    setRunning(false);
    toast({ title: cancelSignal.current.cancelled ? "Envio cancelado" : "Envio em massa concluído" });
  };

  const cancel = () => {
    cancelSignal.current.cancelled = true;
  };

  const sent = queue.filter((item) => item.status === "sent").length;
  const errors = queue.filter((item) => item.status === "error").length;

  return (
    <div className="space-y-4">
      <CustomGroupsManager groups={customGroups} onRefresh={onRefreshCustomGroups} />

      <Card>
        <CardHeader>
          <CardTitle>Envio em massa (10s por destinatário)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")} disabled={running}>
              Números manuais
            </Button>
            <Button size="sm" variant={mode === "custom-groups" ? "default" : "outline"} onClick={() => setMode("custom-groups")} disabled={running}>
              Grupos custom
            </Button>
          </div>

          {mode === "manual" ? (
            <div className="space-y-2">
              <Label>Números (1 por linha)</Label>
              <Textarea value={manualNumbers} onChange={(event) => setManualNumbers(event.target.value)} rows={5} disabled={running} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Selecione os grupos custom</Label>
              {customGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre grupos personalizados acima.</p>
              ) : (
                <div className="rounded-lg border p-3 space-y-2">
                  {customGroups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={() => toggleGroup(group.id)} disabled={running} />
                      <span className="text-sm">{group.name}</span>
                      <Badge variant="secondary" className="ml-auto">{group.members.length}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border p-3">
            <p className="text-sm">Destinatários únicos: <strong>{targets.length}</strong></p>
          </div>

          <div className="flex gap-2">
            {!running ? (
              <Button onClick={() => void start()} className="gap-2" disabled={!targets.length || !blocks.length}>
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
                    <span className="font-mono">{item.label}</span>
                    <span>{item.status}{item.error ? ` • ${item.error}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MessageComposer instanceName={instance.name} blocks={blocks} onChange={setBlocks} allowedTypes={ALLOWED_TYPES} title="Blocos da campanha em massa" />
    </div>
  );
}
