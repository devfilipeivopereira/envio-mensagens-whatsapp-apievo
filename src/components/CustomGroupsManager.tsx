import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createCustomGroup,
  deleteCustomGroup,
  importNumbersFromCsv,
  importNumbersFromManualInput,
  updateCustomGroup,
} from "@/lib/custom-groups";
import { CsvImportResult, CustomGroup } from "@/types/messaging";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Loader2, Plus, Trash2, Upload } from "lucide-react";

interface Props {
  groups: CustomGroup[];
  onRefresh: () => Promise<void>;
}

const EMPTY_IMPORT: CsvImportResult = { imported: [], duplicates: [], invalid: [] };

export default function CustomGroupsManager({ groups, onRefresh }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [csvResult, setCsvResult] = useState<CsvImportResult>(EMPTY_IMPORT);
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedNumbers = useMemo(() => {
    const byManual = importNumbersFromManualInput(manualInput);
    const source = mode === "manual" ? byManual : csvResult;
    return source;
  }, [csvResult, manualInput, mode]);

  const resetForm = () => {
    setName("");
    setManualInput("");
    setCsvResult(EMPTY_IMPORT);
    setEditingId(null);
    setMode("manual");
  };

  const readCsv = async (file?: File | null) => {
    if (!file) return;
    const content = await file.text();
    const result = importNumbersFromCsv(content);
    setCsvResult(result);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Informe o nome do grupo", variant: "destructive" });
      return;
    }

    if (!selectedNumbers.imported.length) {
      toast({ title: "Nenhum número válido", description: "Adicione contatos manualmente ou via CSV.", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editingId) {
      const result = await updateCustomGroup(editingId, name.trim(), selectedNumbers.imported);
      if (!result.success) {
        setSaving(false);
        toast({ title: "Erro ao atualizar grupo", description: result.error, variant: "destructive" });
        return;
      }
    } else {
      const result = await createCustomGroup(name.trim(), selectedNumbers.imported);
      if (!result.success) {
        setSaving(false);
        toast({ title: "Erro ao criar grupo", description: result.error, variant: "destructive" });
        return;
      }
    }

    setSaving(false);
    resetForm();
    await onRefresh();

    toast({
      title: editingId ? "Grupo atualizado" : "Grupo criado",
      description: `${selectedNumbers.imported.length} contatos válidos salvos`,
    });
  };

  const handleEdit = (group: CustomGroup) => {
    setEditingId(group.id);
    setName(group.name);
    setManualInput(group.members.join("\n"));
    setCsvResult(EMPTY_IMPORT);
    setMode("manual");
  };

  const handleDelete = async (group: CustomGroup) => {
    const result = await deleteCustomGroup(group.id);
    if (!result.success) {
      toast({ title: "Erro ao remover grupo", description: result.error, variant: "destructive" });
      return;
    }

    await onRefresh();
    if (editingId === group.id) resetForm();
    toast({ title: "Grupo removido", description: group.name });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grupos personalizados (Supabase)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do grupo</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Leads Março" />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Manual</Button>
          <Button size="sm" variant={mode === "csv" ? "default" : "outline"} onClick={() => setMode("csv")}>CSV</Button>
        </div>

        {mode === "manual" ? (
          <div className="space-y-2">
            <Label>Números (1 por linha)</Label>
            <Textarea value={manualInput} onChange={(event) => setManualInput(event.target.value)} rows={5} placeholder="5511999999999" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Arquivo CSV (1 coluna de número)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(event.target.files?.[0])} />
              <Upload className="h-4 w-4" />
            </div>
          </div>
        )}

        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p>Válidos: <strong>{selectedNumbers.imported.length}</strong></p>
          <p>Duplicados descartados: <strong>{selectedNumbers.duplicates.length}</strong></p>
          <p>Inválidos descartados: <strong>{selectedNumbers.invalid.length}</strong></p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Atualizar grupo" : "Criar grupo"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              Cancelar edição
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum grupo personalizado cadastrado.</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{group.name}</p>
                  <Badge variant="secondary">{group.members.length} contatos</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(group)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(group)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
