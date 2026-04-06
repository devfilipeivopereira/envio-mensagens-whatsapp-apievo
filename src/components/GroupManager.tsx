import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ContactGroup, generateId } from "@/lib/groups";
import { Plus, Trash2, Edit2, Save, X, Users } from "lucide-react";

interface Props {
  groups: ContactGroup[];
  onSave: (groups: ContactGroup[]) => void;
}

export default function GroupManager({ groups, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [numbers, setNumbers] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) return;
    const nums = numbers.split("\n").map((n) => n.trim()).filter(Boolean);
    const newGroup: ContactGroup = { id: generateId(), name: name.trim(), numbers: nums };
    onSave([...groups, newGroup]);
    setName("");
    setNumbers("");
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    onSave(groups.filter((g) => g.id !== id));
  };

  const handleStartEdit = (group: ContactGroup) => {
    setEditingId(group.id);
    setName(group.name);
    setNumbers(group.numbers.join("\n"));
  };

  const handleSaveEdit = () => {
    if (!editingId || !name.trim()) return;
    const nums = numbers.split("\n").map((n) => n.trim()).filter(Boolean);
    onSave(groups.map((g) => (g.id === editingId ? { ...g, name: name.trim(), numbers: nums } : g)));
    setEditingId(null);
    setName("");
    setNumbers("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setNumbers("");
    setCreating(false);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Grupos de Contatos
          </CardTitle>
          {!creating && !editingId && (
            <Button size="sm" onClick={() => setCreating(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Novo Grupo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(creating || editingId) && (
          <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input placeholder="Ex: Clientes VIP" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Números (um por linha)</Label>
              <Textarea
                placeholder={"5511999999999\n5521888888888"}
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={editingId ? handleSaveEdit : handleCreate} disabled={!name.trim()} className="gap-1">
                <Save className="h-4 w-4" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="gap-1">
                <X className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {groups.length === 0 && !creating && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum grupo cadastrado</p>
        )}

        {groups.map((group) =>
          editingId === group.id ? null : (
            <div key={group.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{group.name}</span>
                <Badge variant="secondary" className="text-xs">{group.numbers.length} contatos</Badge>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleStartEdit(group)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
