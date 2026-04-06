import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EvolutionConfig, saveConfig, clearConfig } from "@/lib/evolution-api";
import { Loader2, Wifi, WifiOff, Trash2, Server } from "lucide-react";

interface Props {
  config: EvolutionConfig;
  setConfig: (c: EvolutionConfig) => void;
  connected: boolean;
  setConnected: (v: boolean) => void;
}

export default function ConnectionSettings({ config, setConfig, connected, setConnected }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConnect = async () => {
    setError("");
    if (!config.baseUrl || !config.apiToken) {
      setError("Preencha a URL e o Token da API.");
      return;
    }

    setSaving(true);
    await saveConfig(config);
    setConnected(true);
    setSaving(false);
  };

  const handleDisconnect = async () => {
    setSaving(true);
    await clearConfig();
    setConnected(false);
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5" /> Servidor Evolution API
          </CardTitle>
          {connected ? (
            <Badge className="bg-success text-success-foreground gap-1">
              <Wifi className="h-3 w-3" /> Conectado
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="h-3 w-3" /> Desconectado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL da API</Label>
          <Input
            placeholder="https://sua-api.com"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            disabled={connected || saving}
          />
        </div>
        <div className="space-y-2">
          <Label>API Token (Global)</Label>
          <Input
            type="password"
            placeholder="seu-token-global"
            value={config.apiToken}
            onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            disabled={connected || saving}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          {!connected ? (
            <Button onClick={handleConnect} disabled={saving || !config.baseUrl || !config.apiToken} className="flex-1 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar e Conectar
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleDisconnect} className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
