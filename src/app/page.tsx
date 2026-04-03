import { Suspense } from "react";

import { OperationsConsole } from "@/components/operations-console";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="empty-state">Carregando painel...</div>}>
      <OperationsConsole />
    </Suspense>
  );
}
