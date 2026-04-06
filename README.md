# Evolution Sender Pro

Painel React + Vite para operacao de campanhas WhatsApp com Evolution API v2 e Supabase.

## Documentacao

A documentacao tecnica completa esta em:

- `docs/GUIA_TECNICO_COMPLETO.md`

Esse guia cobre:

- arquitetura da aplicacao
- modelagem Supabase (tabelas, policies e storage)
- fluxos de instancia, envio, grupos oficiais e grupos custom
- fila de envio em massa (10s) e envio para grupos (20s)
- upload de midia para Supabase e uso por URL
- checklist de deploy no Vercel
- testes, validacao e troubleshooting

## Setup rapido local

1. Copie `.env.example` para `.env`.
2. Preencha somente:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

3. Instale e rode:

```bash
npm install
npm run dev
```

## Deploy no Vercel

1. Importe o repositorio no Vercel.
2. Configure apenas as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy.

`vercel.json` ja esta pronto com build de Vite e rewrite SPA para `index.html`.
