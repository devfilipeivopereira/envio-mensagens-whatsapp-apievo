import "dotenv/config";

import { ensureDefaultInstanceFromEnv } from "../src/lib/instance-store";
import { processDueDispatchJobs } from "../src/lib/send-queue";

async function main() {
  await ensureDefaultInstanceFromEnv();
  const result = await processDueDispatchJobs();
  console.log(
    JSON.stringify(
      {
        worker: "dispatch",
        ranAt: new Date().toISOString(),
        result,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        worker: "dispatch",
        ranAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Erro inesperado.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
