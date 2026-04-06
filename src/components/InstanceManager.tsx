import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EvolutionConfig, checkConnection, connectInstance, createInstance, deleteInstance } from "@/lib/evolution-api";
import { generateInstanceName, generateToken, Instance, InstanceStatus } from "@/lib/instances";
import { Loader2, Plus, QrCode, Radio, RefreshCw, Smartphone, Trash2, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  config: EvolutionConfig;
  instances: Instance[];
  selectedInstanceId: string | null;
  onInstancesChange: (instances: Instance[]) => void;
  onSelectInstanceId: (id: string | null) => void;
}

const statusConfig: Record<InstanceStatus, { label: string; className: string; icon: React.ReactNode }> = {
  created: { label: "Criada", className: "bg-muted text-muted-foreground", icon: <Smartphone className="h-3 w-3" /> },
  connecting: { label: "Conectando", className: "bg-warning/20 text-warning", icon: <Radio className="h-3 w-3 animate-pulse" /> },
  open: { label: "Conectada", className: "bg-success/20 text-success", icon: <Wifi className="h-3 w-3" /> },
  close: { label: "Desconectada", className: "bg-destructive/20 text-destructive", icon: <WifiOff className="h-3 w-3" /> },
};

export default function InstanceManager({ config, instances, selectedInstanceId, onInstancesChange, onSelectInstanceId }: Props) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customName, setCustomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const qrInstance = instances.find((item) => item.id === qrInstanceId) ?? null;

  useEffect(() => {
    if (!qrInstance || !qrDialogOpen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const poll = async () => {
      try {
        const state = await checkConnection(config, qrInstance.name);
        if (state === "open") {
          const updated = instances.map((instance) =>
            instance.id === qrInstance.id ? { ...instance, status: "open" as InstanceStatus, qrcode: undefined } : instance
          );
          onInstancesChange(updated);
          onSelectInstanceId(qrInstance.id);
          setQrDialogOpen(false);
          setQrCode(null);
          toast({ title: "Instância conectada", description: qrInstance.name });
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // ignore polling errors
      }
    };

    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [config, instances, onInstancesChange, onSelectInstanceId, qrDialogOpen, qrInstance, toast]);

  const handleCreateInstance = async () => {
    const instanceName = customName.trim() || generateInstanceName(phoneNumber);
    const token = generateToken();

    setCreating(true);
    const result = await createInstance(config, {
      instanceName,
      token,
      number: phoneNumber.trim() || undefined,
    });
    setCreating(false);

    if (!result.success) {
      toast({ title: "Erro ao criar instância", description: result.error, variant: "destructive" });
      return;
    }

    const newInstance: Instance = {
      id: crypto.randomUUID(),
      name: instanceName,
      token,
      phoneNumber: phoneNumber.trim(),
      status: "created",
      createdAt: new Date().toISOString(),
    };

    const updated = [...instances, newInstance];
    onInstancesChange(updated);
    onSelectInstanceId(newInstance.id);

    setPhoneNumber("");
    setCustomName("");
    setCreateDialogOpen(false);

    toast({ title: "Instância criada", description: instanceName });

    await handleOpenQr(newInstance.id);
  };

  const handleOpenQr = async (instanceId: string) => {
    const instance = instances.find((item) => item.id === instanceId);
    if (!instance) return;

    setQrInstanceId(instance.id);
    setQrDialogOpen(true);
    setQrLoading(true);
    setQrCode(null);

    const updated = instances.map((item) =>
      item.id === instance.id ? { ...item, status: "connecting" as InstanceStatus } : item
    );
    onInstancesChange(updated);

    const result = await connectInstance(config, instance.name);
    setQrLoading(false);

    if (result.error) {
      toast({ title: "Erro ao gerar QR", description: result.error, variant: "destructive" });
      return;
    }

    setQrCode(result.qrcode ?? null);
  };

  const handleDeleteInstance = async (instance: Instance) => {
    const result = await deleteInstance(config, instance.name);
    if (!result.success) {
      toast({ title: "Erro ao remover instância", description: result.error, variant: "destructive" });
      return;
    }

    const updated = instances.filter((item) => item.id !== instance.id);
    onInstancesChange(updated);
    if (selectedInstanceId === instance.id) onSelectInstanceId(updated[0]?.id ?? null);

    toast({ title: "Instância removida", description: instance.name });
  };

  const handleRefreshStatus = async (instance: Instance) => {
    try {
      const state = await checkConnection(config, instance.name);
      const updated = instances.map((item) =>
        item.id === instance.id ? { ...item, status: state as InstanceStatus } : item
      );
      onInstancesChange(updated);
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gerenciar Instâncias</CardTitle>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Nova instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar instância</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número WhatsApp (com DDI)</Label>
                  <Input
                    placeholder="5511999999999"
                    value={phoneNumber}
                    onChange={(event) => {
                      setPhoneNumber(event.target.value);
                      if (!customName.trim()) setCustomName(generateInstanceName(event.target.value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da instância</Label>
                  <Input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="instance_5511..." />
                </div>
                <Button className="w-full" disabled={creating || !phoneNumber.trim()} onClick={handleCreateInstance}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar e conectar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {instances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma instância criada.</p>
        ) : (
          <div className="space-y-2">
            {instances.map((instance) => {
              const status = statusConfig[instance.status];
              const selected = instance.id === selectedInstanceId;

              return (
                <div
                  key={instance.id}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-2 ${selected ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button type="button" className="font-medium text-sm hover:underline" onClick={() => onSelectInstanceId(instance.id)}>
                        {instance.name}
                      </button>
                      <Badge className={`${status.className} gap-1`}>{status.icon}{status.label}</Badge>
                      {selected && <Badge variant="outline">Ativa</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{instance.phoneNumber || "sem número"}</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleRefreshStatus(instance)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    {instance.status !== "open" && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleOpenQr(instance.id)}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void handleDeleteInstance(instance)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar via QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex flex-col items-center">
            {qrInstance && <p className="text-sm text-muted-foreground">Instância: {qrInstance.name}</p>}
            {qrLoading ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm text-muted-foreground">Gerando QR...</span>
              </div>
            ) : qrCode ? (
              <img
                className="w-64 h-64"
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code"
              />
            ) : (
              <p className="text-sm text-destructive py-8">Não foi possível carregar o QR code.</p>
            )}

            {qrInstance && (
              <Button variant="outline" onClick={() => void handleOpenQr(qrInstance.id)}>
                Gerar novo QR
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
