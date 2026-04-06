import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Instance } from "@/lib/instances";

interface Props {
  instances: Instance[];
  selectedInstanceId: string | null;
  onSelect: (id: string | null) => void;
}

export default function InstanceSelector({ instances, selectedInstanceId, onSelect }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Instância ativa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedInstanceId ?? "none"} onValueChange={(value) => onSelect(value === "none" ? null : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a instância" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedInstanceId && (
          <div className="text-sm">
            {(() => {
              const current = instances.find((item) => item.id === selectedInstanceId);
              if (!current) return null;

              return (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{current.name}</span>
                  <Badge variant={current.status === "open" ? "default" : "secondary"}>{current.status}</Badge>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
