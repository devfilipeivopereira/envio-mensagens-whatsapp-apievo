import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import MessageComposer from "@/components/MessageComposer";
import { EvolutionConfig } from "@/lib/evolution-api";
import { dispatchBlocksToTarget } from "@/lib/block-dispatch";
import { validateBlock } from "@/lib/message-blocks";
import { Instance } from "@/lib/instances";
import { MessageBlock, MessageBlockType } from "@/types/messaging";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  config: EvolutionConfig;
  instance: Instance;
}

const ALLOWED_TYPES: MessageBlockType[] = [
  "text",
  "media",
  "audio",
  "sticker",
  "location",
  "contact",
  "reaction",
  "poll",
  "status",
];

export default function SendMessagesTab({ config, instance }: Props) {
  const { toast } = useToast();
  const [target, setTarget] = useState("");
  const [blocks, setBlocks] = useState<MessageBlock[]>([]);
  const [sending, setSending] = useState(false);

  const hasStatusBlock = useMemo(() => blocks.some((block) => block.type === "status"), [blocks]);
  const hasValidationError = useMemo(() => blocks.some((block) => Boolean(validateBlock(block))), [blocks]);

  const handleSend = async () => {
    if (hasValidationError) {
      toast({ title: "Corrija os blocos inválidos", variant: "destructive" });
      return;
    }

    if (!blocks.length) {
      toast({ title: "Adicione ao menos um bloco", variant: "destructive" });
      return;
    }

    if (!hasStatusBlock && !target.trim()) {
      toast({ title: "Informe um destinatário", variant: "destructive" });
      return;
    }

    setSending(true);

    const result = await dispatchBlocksToTarget(config, instance.name, target.trim(), blocks);
    setSending(false);

    if (!result.success) {
      toast({ title: "Falha no envio", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Envio concluído" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Enviar mensagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Destinatário (número com DDI ou JID de grupo)</Label>
            <Input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="5511999999999 ou 1203...@g.us"
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              Se usar apenas bloco de status, o destinatário não é obrigatório.
            </p>
          </div>

          <Button onClick={() => void handleSend()} disabled={sending || !blocks.length} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar sequência
          </Button>
        </CardContent>
      </Card>

      <MessageComposer instanceName={instance.name} blocks={blocks} onChange={setBlocks} allowedTypes={ALLOWED_TYPES} title="Blocos de envio" />
    </div>
  );
}
