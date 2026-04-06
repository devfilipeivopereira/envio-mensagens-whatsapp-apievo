import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import ConnectionSettings from "@/components/ConnectionSettings";
import GroupBroadcastTab from "@/components/GroupBroadcastTab";
import InstanceManager from "@/components/InstanceManager";
import InstanceSelector from "@/components/InstanceSelector";
import MassSendTab from "@/components/MassSendTab";
import OfficialGroupsTab from "@/components/OfficialGroupsTab";
import SendMessagesTab from "@/components/SendMessagesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCustomGroups } from "@/lib/custom-groups";
import { EvolutionConfig, fetchAllGroups, findGroupParticipants, loadConfig } from "@/lib/evolution-api";
import { loadInstances, saveInstances, Instance } from "@/lib/instances";
import { CustomGroup, EvolutionGroup } from "@/types/messaging";

const Index = () => {
  const [config, setConfig] = useState<EvolutionConfig>({ baseUrl: "", apiToken: "" });
  const [connected, setConnected] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [officialGroups, setOfficialGroups] = useState<EvolutionGroup[]>([]);
  const [officialGroupsLoading, setOfficialGroupsLoading] = useState(false);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);

  const activeInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? null,
    [instances, selectedInstanceId]
  );

  const persistInstances = useCallback((updated: Instance[]) => {
    setInstances(updated);
    void saveInstances(updated);
  }, []);

  const refreshCustomGroups = useCallback(async () => {
    const groups = await listCustomGroups();
    setCustomGroups(groups);
  }, []);

  const refreshOfficialGroups = useCallback(async () => {
    if (!activeInstance || activeInstance.status !== "open") {
      setOfficialGroups([]);
      return;
    }

    setOfficialGroupsLoading(true);

    const groupsResult = await fetchAllGroups(config, activeInstance.name, true);
    if (!groupsResult.success) {
      setOfficialGroups([]);
      setOfficialGroupsLoading(false);
      return;
    }

    const fallbackGroups = await Promise.all(
      groupsResult.groups.map(async (group) => {
        if (group.participants && group.participants.length > 0) return group;

        const participantsResult = await findGroupParticipants(config, activeInstance.name, group.id);
        if (!participantsResult.success) return group;

        return { ...group, participants: participantsResult.participants };
      })
    );

    setOfficialGroups(fallbackGroups);
    setOfficialGroupsLoading(false);
  }, [activeInstance, config]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const [savedConfig, savedInstances] = await Promise.all([loadConfig(), loadInstances()]);
      const custom = await listCustomGroups();

      if (!mounted) return;

      if (savedConfig) {
        setConfig(savedConfig);
        setConnected(true);
      }

      setInstances(savedInstances);
      setSelectedInstanceId(savedInstances[0]?.id ?? null);
      setCustomGroups(custom);
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeInstance || activeInstance.status !== "open") {
      setOfficialGroups([]);
      return;
    }

    void refreshOfficialGroups();
  }, [activeInstance, refreshOfficialGroups]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container max-w-6xl mx-auto py-4 px-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Evolution Sender Pro</h1>
            <p className="text-sm text-muted-foreground">Instâncias, envios avançados, grupos oficiais e grupos custom com Supabase</p>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-6 px-4 space-y-6">
        <ConnectionSettings config={config} setConfig={setConfig} connected={connected} setConnected={setConnected} />

        {connected && (
          <>
            <InstanceSelector instances={instances} selectedInstanceId={selectedInstanceId} onSelect={setSelectedInstanceId} />

            <Tabs defaultValue="instances" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="instances">Instâncias</TabsTrigger>
                <TabsTrigger value="send">Envio</TabsTrigger>
                <TabsTrigger value="groups">Grupos</TabsTrigger>
                <TabsTrigger value="mass">Envio em Massa</TabsTrigger>
                <TabsTrigger value="group-broadcast">Envio para Grupos</TabsTrigger>
              </TabsList>

              <TabsContent value="instances">
                <InstanceManager
                  config={config}
                  instances={instances}
                  selectedInstanceId={selectedInstanceId}
                  onInstancesChange={persistInstances}
                  onSelectInstanceId={setSelectedInstanceId}
                />
              </TabsContent>

              <TabsContent value="send">
                {activeInstance && activeInstance.status === "open" ? (
                  <SendMessagesTab config={config} instance={activeInstance} />
                ) : (
                  <InfoBlocked />
                )}
              </TabsContent>

              <TabsContent value="groups">
                {activeInstance && activeInstance.status === "open" ? (
                  <OfficialGroupsTab groups={officialGroups} loading={officialGroupsLoading} onRefresh={refreshOfficialGroups} />
                ) : (
                  <InfoBlocked />
                )}
              </TabsContent>

              <TabsContent value="mass">
                {activeInstance && activeInstance.status === "open" ? (
                  <MassSendTab
                    config={config}
                    instance={activeInstance}
                    customGroups={customGroups}
                    onRefreshCustomGroups={refreshCustomGroups}
                  />
                ) : (
                  <InfoBlocked />
                )}
              </TabsContent>

              <TabsContent value="group-broadcast">
                {activeInstance && activeInstance.status === "open" ? (
                  <GroupBroadcastTab
                    config={config}
                    instance={activeInstance}
                    groups={officialGroups}
                    onRefreshGroups={refreshOfficialGroups}
                  />
                ) : (
                  <InfoBlocked />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

function InfoBlocked() {
  return (
    <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground bg-card">
      Selecione uma instância ativa e conectada para usar esta aba.
    </div>
  );
}

export default Index;
