# Guia Detalhado de Deploy no Vercel

## Objetivo

Este guia descreve o checklist completo para publicar o painel no Vercel com estabilidade para campanhas, fila persistida, integração com Supabase e Evolution API.

## 1. Pré-requisitos

Você precisa ter:

- repositório importado no Vercel
- acesso ao projeto Supabase
- acesso ao domínio ou endpoint da Evolution API
- um `CRON_SECRET` configurado
- um banco Postgres acessível a partir do ambiente serverless

## 2. Variáveis de ambiente

Cadastre no Vercel as mesmas variáveis usadas localmente. Priorize estas:

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

O app usa Postgres diretamente por `pg`. Em Vercel, prefira um endereço com pooler se o host direto não responder bem. A aplicação faz fallback automático:

1. usa `SUPABASE_DB_POOLER_URL` quando existir
2. usa `SUPABASE_DB_URL` quando o pooler não estiver definido

## 4. Fila e processamento

A fila de disparos fica persistida no banco. Isso significa:

- não depende de memória da instância serverless
- suporta retomada após timeout ou novo deploy
- mantém pausa mínima de 10 segundos entre mensagens

No seu cenário, a melhor opção é rodar o worker na VPS.

Worker recomendado:

```bash
npm run worker:dispatch
```

A rota HTTP de processamento continua disponível como alternativa:

- `/api/cron/process-dispatches`

Ela aceita autenticação por:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`
- `?secret=<CRON_SECRET>`

## 5. Plano Hobby no Vercel

No plano Hobby, o Vercel não permite cron por minuto no `vercel.json`. Por isso, este projeto foi ajustado para deploy sem `crons` nativos do Vercel.

Se você estiver no Hobby, use preferencialmente a VPS para rodar o worker por cron Linux em intervalos de 1 minuto.

Cron recomendado na VPS:

```bash
* * * * * cd /opt/envio-mensagens-whatsapp-apievo && /usr/bin/npm run worker:dispatch >> /var/log/whatsapp-dispatch-worker.log 2>&1
```

Se quiser usar HTTP em vez de worker local, use um scheduler externo para chamar a rota de processamento.

Exemplo:

```text
https://seu-dominio.com/api/cron/process-dispatches?secret=SEU_CRON_SECRET
```

## 6. Healthcheck

Use `/api/health` após cada deploy para validar:

- se as chaves do Supabase estão presentes
- se a configuração padrão da Evolution existe
- se o `CRON_SECRET` foi configurado
- se o banco responde

## 7. Checklist pós-deploy

- login funcionando
- instância padrão carregada
- `/api/health` retornando `ok` ou `degraded` com diagnóstico claro
- criação de listas funcionando
- agendamento de campanha funcionando
- scheduler externo ou Vercel Pro acionando a fila

## 8. Riscos conhecidos

Se o host Postgres direto não aceitar conexões vindas do Vercel, o app pode autenticar normalmente no Supabase mas falhar nas funções de banco. Nesse caso, configure `SUPABASE_DB_POOLER_URL` com um endpoint externo apropriado.
