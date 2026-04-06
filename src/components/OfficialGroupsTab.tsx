import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvolutionGroup } from "@/types/messaging";
import { Loader2, RefreshCw, Users } from "lucide-react";

interface Props {
  groups: EvolutionGroup[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export default function OfficialGroupsTab({ groups, loading, onRefresh }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Grupos oficiais (WhatsApp)
          </CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void onRefresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum grupo encontrado para a instância ativa.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{group.subject}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{group.id}</p>
                  </div>
                  <Badge variant="secondary">{group.size ?? group.participants?.length ?? 0} contatos</Badge>
                </div>

                {group.participants && group.participants.length > 0 ? (
                  <div className="max-h-40 overflow-auto rounded border">
                    {group.participants.map((participant) => (
                      <div key={`${group.id}-${participant.id}`} className="flex items-center justify-between text-xs px-2 py-1 border-b last:border-b-0">
                        <span className="font-mono truncate">{participant.id}</span>
                        <span className="text-muted-foreground">{participant.admin || "membro"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Participantes indisponíveis.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
