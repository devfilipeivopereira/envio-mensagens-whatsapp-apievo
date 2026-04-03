# Guia de Worker na VPS para Vercel Hobby

## Objetivo

Este fluxo usa a VPS para processar a fila de disparos a cada minuto, sem depender do cron nativo do Vercel.

## Como funciona

- o app web continua no Vercel
- a fila continua salva no Postgres
- a VPS executa `npm run worker:dispatch` a cada minuto
- o worker lê os jobs pendentes e envia respeitando o intervalo mínimo de 10 segundos

## Requisitos na VPS

- Node.js 20+
- `npm`
- `git`
- acesso de saída para a Evolution API e para o banco

## Variáveis mínimas para o worker

- `SUPABASE_DB_URL`
- `SUPABASE_DB_POOLER_URL` opcional
- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `DISPATCH_MIN_INTERVAL_MS`

## Comando manual

```bash
npm run worker:dispatch
```

## Cron recomendado

```bash
* * * * * cd /opt/envio-mensagens-whatsapp-apievo && /usr/bin/npm run worker:dispatch >> /var/log/whatsapp-dispatch-worker.log 2>&1
```

## Observações

- o lock no Postgres impede dois workers de processarem a fila ao mesmo tempo
- se o worker cair, a próxima execução continua dos jobs pendentes
- esse modelo é o mais indicado para Vercel Hobby
