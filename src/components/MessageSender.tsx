import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { EvolutionConfig, sendTextMessage, delay } from "@/lib/evolution-api";
import { Instance } from "@/lib/instances";
import { ContactGroup } from "@/lib/groups";
import { Send, Users, User, Loader2, Square, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  config: EvolutionConfig;
  instance: Instance;
  groups: ContactGroup[];
}

interface QueueItem {
  number: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

export default function MessageSender({ config, instance, groups }: Props) {
  const { toast } = useToast();
  const [singleNumber, setSingleNumber] = useState("");
  const [message, setMessage] = useState("");
  const [batchNumbers, setBatchNumbers] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const [sendingIndividual, setSendingIndividual] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState<"manual" | "groups">("manual");
  const cancelRef = useRef(false);

  const handleSendIndividual = async () => {
    setSendingIndividual(true);
    const result = await sendTextMessage(config, instance.name, { number: singleNumber, text: message });
    setSendingIndividual(false);
    if (result.success) {
      toast({ title: "Mensagem enviada!", description: `Para: ${singleNumber}` });
      setSingleNumber("");
      setMessage("");
    } else {
      toast({ title: "Erro ao enviar", description: result.error, variant: "destructive" });
    }
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const getNumbers = (): string[] => {
    if (batchMode === "groups") {
      const selected = groups.filter((g) => selectedGroupIds.includes(g.id));
      const all = selected.flatMap((g) => g.numbers);
      return [...new Set(all)];
    }
    return batchNumbers.split("\n").map((n) => n.trim()).filter(Boolean);
  };

  const handleStartBatch = useCallback(async () => {
    const numbers = getNumbers();
    if (!numbers.length || !batchMessage.trim()) return;

    const items: QueueItem[] = numbers.map((n) => ({ number: n, status: "pending" }));
    setQueue(items);
    setBatchRunning(true);
    cancelRef.current = false;

    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;

      setQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "sending" } : item)));

      const result = await sendTextMessage(config, instance.name, { number: items[i].number, text: batchMessage });

      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: result.success ? "sent" : "error", error: result.error } : item
        )
      );

      if (i < items.length - 1 && !cancelRef.current) {
        await delay(10000);
      }
    }

    setBatchRunning(false);
    toast({ title: cancelRef.current ? "Envio cancelado" : "Envio em lote concluído!" });
  }, [batchNumbers, batchMessage, batchMode, selectedGroupIds, groups, config, instance, toast]);

  const handleCancelBatch = () => {
    cancelRef.current = true;
  };

  const sentCount = queue.filter((q) => q.status === "sent").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const canStartBatch =
    batchMessage.trim() &&
    (batchMode === "manual" ? batchNumbers.trim() : selectedGroupIds.length > 0);

  return (
    <Tabs defaultValue="individual" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="individual" className="gap-2">
          <User className="h-4 w-4" /> Individual
        </TabsTrigger>
        <TabsTrigger value="batch" className="gap-2">
          <Users className="h-4 w-4" /> Em Lote
        </TabsTrigger>
      </TabsList>

      <TabsContent value="individual">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Enviar Mensagem</CardTitle>
            <p className="text-xs text-muted-foreground">Via: {instance.name}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Número (com DDD e código do país)</Label>
              <Input placeholder="5511999999999" value={singleNumber} onChange={(e) => setSingleNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea placeholder="Digite sua mensagem..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
            </div>
            <Button onClick={handleSendIndividual} disabled={sendingIndividual || !singleNumber || !message} className="w-full gap-2">
              {sendingIndividual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="batch">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Envio em Lote</CardTitle>
            <p className="text-sm text-muted-foreground">Intervalo de 10 segundos entre cada mensagem • Via: {instance.name}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={batchMode === "manual" ? "default" : "outline"} onClick={() => setBatchMode("manual")} disabled={batchRunning}>
                Números manuais
              </Button>
              <Button size="sm" variant={batchMode === "groups" ? "default" : "outline"} onClick={() => setBatchMode("groups")} disabled={batchRunning || groups.length === 0}>
                Selecionar Grupos
              </Button>
            </div>

            {batchMode === "manual" ? (
              <div className="space-y-2">
                <Label>Números (um por linha)</Label>
                <Textarea placeholder={"5511999999999\n5521888888888"} value={batchNumbers} onChange={(e) => setBatchNumbers(e.target.value)} rows={4} disabled={batchRunning} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Selecione os grupos</Label>
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Cadastre grupos primeiro.</p>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    {groups.map((group) => (
                      <label key={group.id} className="flex items-center gap-3 cursor-pointer py-1">
                        <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={() => toggleGroup(group.id)} disabled={batchRunning} />
                        <span className="text-sm font-medium">{group.name}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">{group.numbers.length} contatos</Badge>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea placeholder="Digite a mensagem para todos..." value={batchMessage} onChange={(e) => setBatchMessage(e.target.value)} rows={4} disabled={batchRunning} />
            </div>
            <div className="flex gap-2">
              {!batchRunning ? (
                <Button onClick={handleStartBatch} disabled={!canStartBatch} className="flex-1 gap-2">
                  <Send className="h-4 w-4" /> Iniciar Envio
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleCancelBatch} className="flex-1 gap-2">
                  <Square className="h-4 w-4" /> Cancelar
                </Button>
              )}
            </div>

            {queue.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex gap-2 text-sm">
                  <Badge className="bg-success text-success-foreground">{sentCount} enviadas</Badge>
                  {errorCount > 0 && <Badge variant="destructive">{errorCount} erros</Badge>}
                  <Badge variant="secondary">{queue.length} total</Badge>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                  {queue.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                      <span className="font-mono text-xs">{item.number}</span>
                      {item.status === "pending" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      {item.status === "sending" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                      {item.status === "sent" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                      {item.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
