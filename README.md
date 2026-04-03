# Painel Evolution API

Painel full-stack em Next.js para operar inst?ncias da Evolution API com login via Supabase, filas com pausa m?nima de 10 segundos, listas personalizadas, campanhas agendadas e suporte multi-inst?ncia com schema dedicado por inst?ncia.

## Vis?o geral

O projeto foi desenhado como um cockpit operacional para WhatsApp em cima da Evolution API. A interface combina modo guiado para tarefas do dia a dia com um explorer t?cnico para cobrir endpoints menos frequentes.

## Recursos principais

- Login com Supabase Auth
- Cadastro e gest?o de m?ltiplas inst?ncias Evolution
- Contatos sincronizados, contatos locais e grupos
- Disparo unit?rio e campanhas em massa
- Listas personalizadas para envio agendado
- Importa??o de n?meros via CSV
- Fila persistida em banco com pausa m?nima de 10 segundos
- Processamento por cron no Vercel
- Explorer para chamadas manuais da Evolution API

## Stack

- Next.js 15
- React 19
- Supabase Auth
- Postgres via `pg`
- Vercel Cron

## Organiza??o para Vercel

O projeto foi ajustado para o modelo serverless com estes pontos:

- `next.config.ts` usando `serverExternalPackages: ["pg"]`
- handlers em runtime Node.js
- `preferredRegion = "gru1"` nas rotas principais
- `maxDuration` expl?cito para rotas sens?veis
- pool do Postgres reduzido em Vercel para evitar excesso de conex?es
- suporte a `SUPABASE_DB_POOLER_URL` como fallback recomendado
- healthcheck em `/api/health`

## Vari?veis de ambiente

Configure no Vercel em `Project Settings > Environment Variables`.

Obrigat?rias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `CRON_SECRET`
- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

Recomendada para produ??o serverless:

- `SUPABASE_DB_POOLER_URL`

## Deploy

1. Importe o reposit?rio no Vercel.
2. Cadastre todas as vari?veis de ambiente.
3. Defina um `CRON_SECRET` forte.
4. Fa?a o primeiro deploy.
5. Abra `/api/health` para validar autentica??o, cron e banco.
6. Confirme se a cron `/api/cron/process-dispatches` est? habilitada.

## Comandos locais

```bash
npm run dev
npm run build
npm run typecheck
```

## Documenta??o adicional

- [Guia detalhado de deploy no Vercel](./docs/vercel-deploy.md)
