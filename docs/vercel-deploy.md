# Guia Detalhado de Deploy no Vercel

## Objetivo

Este guia descreve o checklist completo para publicar o painel no Vercel com estabilidade para campanhas, cron e integra??o com Supabase e Evolution API.

## 1. Pr?-requisitos

Voc? precisa ter:

- reposit?rio importado no Vercel
- acesso ao projeto Supabase
- acesso ao dom?nio ou endpoint da Evolution API
- um `CRON_SECRET` configurado
- um banco Postgres acess?vel a partir do ambiente serverless

## 2. Vari?veis de ambiente

Cadastre no Vercel as mesmas vari?veis usadas localmente. Priorize estas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_DB_URL`
- `SUPABASE_DB_POOLER_URL`
- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `DISPATCH_MIN_INTERVAL_MS`
- `CRON_SECRET`

## 3. Banco de dados

O app usa Postgres diretamente por `pg`. Em Vercel, prefira um endere?o com pooler se o host direto n?o responder bem. A aplica??o faz fallback autom?tico:

1. usa `SUPABASE_DB_POOLER_URL` quando existir
2. usa `SUPABASE_DB_URL` quando o pooler n?o estiver definido

## 4. Cron e fila

A fila de disparos fica persistida no banco. Isso significa:

- n?o depende de mem?ria da inst?ncia serverless
- suporta retomada ap?s timeout ou novo deploy
- mant?m pausa m?nima de 10 segundos entre mensagens

A rota usada pelo cron ?:

- `/api/cron/process-dispatches`

O `vercel.json` agenda essa rota a cada minuto.

## 5. Healthcheck

Use `/api/health` ap?s cada deploy para validar:

- se as chaves do Supabase est?o presentes
- se a configura??o padr?o da Evolution existe
- se o `CRON_SECRET` foi configurado
- se o banco responde

## 6. Checklist p?s-deploy

- login funcionando
- inst?ncia padr?o carregada
- `/api/health` retornando `ok` ou `degraded` com diagn?stico claro
- cria??o de listas funcionando
- agendamento de campanha funcionando
- cron processando a fila

## 7. Riscos conhecidos

Se o host Postgres direto n?o aceitar conex?es vindas do Vercel, o app pode autenticar normalmente no Supabase mas falhar nas fun??es de banco. Nesse caso, configure `SUPABASE_DB_POOLER_URL` com um endpoint externo apropriado.
