# Guia Tecnico Completo - Evolution Sender Pro

## 1. Objetivo do sistema

Evolution Sender Pro e um painel web para operacao de mensagens WhatsApp usando Evolution API v2 com persistencia em Supabase. O foco e suportar operacao diaria com:

- gerenciamento de multiplas instancias
- envio manual completo de mensagens
- campanhas em massa com controle de intervalo
- envio para grupos oficiais
- grupos custom para listas internas (nao oficiais)
- upload de midia para Supabase Storage

## 2. Stack principal

- Frontend: React 18 + TypeScript + Vite
- UI: shadcn/ui + Radix
- Estado remoto: TanStack Query
- Banco e storage: Supabase
- API de WhatsApp: Evolution API v2
- Testes: Vitest (unitario/integracao com mocks)
- Deploy: Vercel (SPA estatico)

## 3. Estrutura de alto nivel

- `src/pages/Index.tsx`: orquestra o painel e as 5 abas
- `src/components/InstanceManager.tsx`: cadastro/remocao/conexao de instancias
- `src/components/InstanceSelector.tsx`: seletor global da instancia ativa
- `src/components/SendMessagesTab.tsx`: envio manual com blocos combinados
- `src/components/OfficialGroupsTab.tsx`: leitura de grupos oficiais e participantes
- `src/components/MassSendTab.tsx`: envio em massa com intervalo de 10s
- `src/components/GroupBroadcastTab.tsx`: envio para grupos com intervalo de 20s
- `src/components/CustomGroupsManager.tsx`: CRUD de grupos custom + importacao CSV

## 4. Fluxos de interface

### 4.1 Aba Instancias

Permite criar, conectar e selecionar instancias Evolution. A instancia ativa fica disponivel globalmente para as outras abas.

### 4.2 Aba Envio

Composer por blocos sequenciais. O operador monta uma sequencia ordenada de conteudos e o sistema envia bloco a bloco na ordem definida.

Tipos suportados no fluxo estavel:

- texto
- imagem
- audio (audio normal e audio WhatsApp)
- video
- documento
- sticker
- localizacao
- contato
- reacao
- enquete
- status

### 4.3 Aba Grupos

Lista grupos oficiais da instancia e permite consultar participantes.

### 4.4 Aba Envio em Massa

Envia para destinatarios individuais com intervalo fixo de 10 segundos entre envios.

Comportamento de fila:

- processa item por item
- erro em um item nao interrompe os proximos
- status por item para auditoria operacional

### 4.5 Aba Envio para Grupos

Seleciona grupos oficiais e envia no chat de cada grupo com intervalo fixo de 20 segundos entre grupos.

## 5. Grupos custom (somente para massa)

Grupos custom sao listas internas salvas no Supabase e usadas apenas no fluxo de envio em massa.

### 5.1 Cadastro manual

Permite adicionar numeros diretamente em um grupo custom.

### 5.2 Importacao CSV

Regras aplicadas:

- uma coluna de numero
- cabecalho opcional
- delimitador `,` ou `;`
- normalizacao de numero
- deduplicacao
- descarte de invalidos
- relatorio final de processados, aceitos e rejeitados

## 6. Upload de midia com Supabase

A aplicacao suporta dois modos para midia:

- informar URL manual
- subir arquivo para Supabase Storage e usar URL publica gerada

Tipos cobertos no app:

- imagem
- audio
- video
- documento
- sticker
- midias para status

## 7. Camada Evolution API

Arquivo central:

- `src/lib/evolution-api.ts`

Responsabilidades:

- chamadas de envio por tipo de mensagem
- operacoes de grupos e participantes
- padronizacao de payloads
- tratamento de erros da API

Composer sequencial:

- `src/lib/message-blocks.ts`
- `src/lib/block-dispatch.ts`

## 8. Filas e agendamento

Implementacao principal:

- `src/lib/queue/dispatch.ts`

Defaults operacionais:

- massa individual: 10s entre destinatarios
- grupos oficiais: 20s entre grupos
- falha isolada por item (nao aborta fila inteira)

## 9. Supabase - esquema de dados

Arquivo de schema:

- `supabase/schema.sql`

Entidades principais:

- `app_instances`
- `app_settings`
- `app_media_assets`
- `app_custom_groups`
- `app_custom_group_members`

Storage:

- bucket publico `media-assets`
- policies para leitura publica e gravacao autenticada conforme schema

## 10. Variaveis de ambiente

### 10.1 Frontend (obrigatorias)

Usadas em runtime no browser e configuradas no Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### 10.2 Sensiveis (nao expor no frontend)

Nao devem ser usadas em codigo cliente nem configuradas como variaveis publicas no Vercel para este app SPA:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- credenciais SMTP
- credenciais VPS
- senha de banco e URL administrativa

## 11. Deploy no Vercel (import de repositorio)

Projeto pronto para importacao direta.

Checklist:

1. Importar repositorio no Vercel
2. Confirmar build command: `npm run build`
3. Confirmar output directory: `dist`
4. Adicionar apenas:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Realizar deploy

Configuracao aplicada:

- `vercel.json` com rewrite SPA:
  - `/(.*)` -> `/index.html`

Isso garante deep links com `BrowserRouter`.

## 12. Testes e validacao

### 12.1 Testes unitarios/integracao

Cobertura implementada para:

- parser CSV
- normalizacao de numero
- builder de payload por tipo
- scheduler de filas (10s e 20s)
- envio sequencial por blocos
- fluxo de upload + uso de URL

### 12.2 Gate de release

Executar localmente:

```bash
npm test
npm run build
```

Criterios de aceite:

- build sem erro
- rotas profundas funcionando com rewrite SPA
- app operando no Vercel com apenas as duas variaveis `VITE_*`

## 13. Operacao recomendada

- validar instancia ativa antes de qualquer envio
- testar payload em poucos contatos antes de campanhas grandes
- monitorar rejeicoes/invalidos em importacao CSV
- manter naming padrao para assets de midia
- revisar policies do Supabase em cada ambiente

## 14. Troubleshooting rapido

- Erro de envio em massa: validar formato dos numeros apos normalizacao
- Midia nao abre: validar URL publica do Storage e MIME do arquivo
- Falha em grupo: confirmar se a instancia ainda participa do grupo
- Deep link quebrado no deploy: revisar rewrite em `vercel.json`

## 15. Status de compatibilidade

Este projeto esta sem dependencias de tooling externo legado no codigo fonte e na documentacao. A base atual usa configuracoes padrao de Vite, Playwright e Vercel.

