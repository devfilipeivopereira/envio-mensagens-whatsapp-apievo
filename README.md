# Painel Evolution API

Painel full-stack em Next.js para operar instâncias da Evolution API com login via Supabase, filas com pausa mínima de 10 segundos, listas personalizadas, campanhas agendadas e suporte multi-instância com schema dedicado por instância.

## Visão geral

O projeto foi desenhado como um cockpit operacional para WhatsApp em cima da Evolution API. A interface combina modo guiado para tarefas do dia a dia com um explorer técnico para cobrir endpoints menos frequentes.

## Recursos principais

- Login com Supabase Auth
- Cadastro e gestão de múltiplas instâncias Evolution
- Contatos sincronizados, contatos locais e grupos
- Disparo unitário e campanhas em massa
- Listas personalizadas para envio agendado
- Importação de números via CSV
- Fila persistida em banco com pausa mínima de 10 segundos
- Worker de processamento para VPS com cron Linux
- Processamento da fila por scheduler externo, VPS ou Vercel Pro
- Explorer para chamadas manuais da Evolution API

## Stack

- Next.js 15
- React 19
- Supabase Auth
- Postgres via `pg`
- Vercel

## Organização para Vercel

O projeto foi ajustado para o modelo serverless com estes pontos:

- `next.config.ts` usando `serverExternalPackages: ["pg"]`
- handlers em runtime Node.js
- `preferredRegion = "gru1"` nas rotas principais
- `maxDuration` explícito para rotas sensíveis
- pool do Postgres reduzido em Vercel para evitar excesso de conexões
- suporte a `SUPABASE_DB_POOLER_URL` como fallback recomendado
- healthcheck em `/api/health`
- compatibilidade com plano Hobby sem depender de cron por minuto no `vercel.json`

## Variáveis de ambiente

Configure no Vercel em `Project Settings > Environment Variables`.

Obrigatórias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `CRON_SECRET`
- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

Recomendada para produção serverless:

- `SUPABASE_DB_POOLER_URL`

## Deploy

1. Importe o repositório no Vercel.
2. Cadastre todas as variáveis de ambiente.
3. Defina um `CRON_SECRET` forte.
4. Faça o primeiro deploy.
5. Abra `/api/health` para validar autenticação, cron e banco.
6. Se estiver no plano Hobby, use o worker na VPS ou um scheduler externo.

## Vercel Hobby

Em contas Hobby, o Vercel não aceita cron por minuto no `vercel.json`. Por isso o projeto foi adaptado para:

- fazer deploy sem `crons` configurados no Vercel
- aceitar processamento externo da fila
- aceitar um worker próprio rodando na sua VPS
- manter a mesma pausa mínima de 10 segundos entre mensagens

Você pode processar a fila de duas formas:

1. Worker local na VPS:

```bash
npm run worker:dispatch
```

2. Chamada HTTP para a rota:

- `Authorization: Bearer SEU_CRON_SECRET`
- `x-cron-secret: SEU_CRON_SECRET`
- `?secret=SEU_CRON_SECRET`

Exemplo:

```text
https://seu-dominio.com/api/cron/process-dispatches?secret=SEU_CRON_SECRET
```

## Comandos locais

```bash
npm run dev
npm run build
npm run typecheck
```

## Documentação adicional

- [Guia detalhado de deploy no Vercel](./docs/vercel-deploy.md)
- [Guia de scheduler externo para plano Hobby](./docs/hobby-cron-setup.md)
