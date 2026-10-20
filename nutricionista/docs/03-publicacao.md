# Etapa 5 — Publicação

## Caminho recomendado: um servidor (VPS) com Docker

Simples de manter, custo previsível, dados num só lugar e uploads em disco persistente. Prefira um provedor com data center no Brasil (São Paulo).

### Passo a passo

1. **Domínio** — registre em [registro.br](https://registro.br) (ex.: `andrefarion.com.br`) e crie um registro DNS `A` apontando para o IP do servidor.
2. **Servidor** — Ubuntu 24.04, 2 GB de RAM, 1–2 vCPU, 40 GB de disco. Instale o Docker (`curl -fsSL https://get.docker.com | sh`). Libere apenas as portas 22, 80 e 443 no firewall; acesso SSH só por chave.
3. **Código** — `git clone` do repositório e entre em `nutricionista/`.
4. **Configuração** — `cp deploy/.env.example deploy/.env` e preencha:
   - `DOMAIN`: o domínio do site
   - `DB_PASSWORD` e `CRON_SECRET`: valores longos e aleatórios (`openssl rand -base64 32`)
   - `RESEND_API_KEY` e `EMAIL_FROM`: para e-mails (opcional, mas necessário para lembretes e recuperação de senha por e-mail)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`: notificações push no celular (gere com `npx web-push generate-vapid-keys`; guarde a chave privada em segredo e não troque depois, ou os aparelhos precisam ativar de novo)
5. **Subir** — `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`
   - O Caddy emite o certificado HTTPS automaticamente.
   - As migrações do banco rodam a cada início da aplicação.
6. **Primeiro acesso do nutricionista** — o banco de produção começa vazio. Crie o administrador e as configurações iniciais com:
   ```bash
   docker compose -f deploy/docker-compose.yml exec app node scripts/create-admin.mjs "André Farion" email@dominio.com.br
   ```
   O comando imprime um link de primeiro acesso para criar a senha. Depois, complete **Configurações** (CRN, foto, serviços, horários, WhatsApp) e desmarque a faixa de demonstração.
7. **Checklist antes de divulgar**
   - [ ] Política de privacidade revisada por profissional jurídico
   - [ ] CRN, endereço, contatos e serviços reais em Configurações
   - [ ] Faixa “versão de demonstração” desativada
   - [ ] Depoimentos somente com autorização registrada
   - [ ] E-mail configurado e testado (recuperação de senha)
   - [ ] Backup externo funcionando e restauração testada
   - [ ] Monitoramento ativo

### Backups e recuperação

- O serviço `backup` faz uma cópia diária do banco (`pg_dump`) e dos arquivos enviados em `deploy/backups/`, mantendo 14 dias.
- **Copie para fora do servidor** (ex.: `rclone sync deploy/backups r2:backups-consultorio` diário via cron do sistema) — um backup no mesmo disco não protege contra perda do servidor. Criptografe o destino (bucket privado + criptografia do provedor ou `rclone crypt`).
- Restauração:
  ```bash
  docker compose -f deploy/docker-compose.yml exec -T db pg_restore -U nutri -d nutri --clean < deploy/backups/db-AAAAMMDD-HHMM.dump
  docker compose -f deploy/docker-compose.yml cp uploads.tgz app:/tmp && \
  docker compose -f deploy/docker-compose.yml exec app sh -c 'tar -xzf /tmp/uploads.tgz -C /data/uploads'
  ```
- Teste a restauração uma vez por mês em um ambiente separado.

### Monitoramento

- Endereço de verificação: `https://SEU_DOMINIO/api/health` (retorna `{ "ok": true }`). Cadastre em um serviço de uptime (UptimeRobot, Better Stack) com alerta por e-mail/WhatsApp.
- Logs: `docker compose -f deploy/docker-compose.yml logs -f app`.
- Atualizações: `git pull` + o mesmo comando do passo 5. Atualize a imagem do sistema operacional mensalmente.

## Alternativa gerenciada (sem administrar servidor)

| Peça | Opção | Observação |
|---|---|---|
| Aplicação | Render, Railway ou Fly.io | Exige disco persistente para uploads, ou trocar `src/lib/storage.ts` por um driver S3 (Cloudflare R2, Supabase Storage). |
| Banco | Neon, Supabase ou RDS | Planos gratuitos servem para teste; em produção use plano com backup automático. |
| Tarefas | Cron do provedor | Chamar `/api/cron` a cada 5 minutos (lembretes de refeição e água) com o cabeçalho `Authorization: Bearer CRON_SECRET`. |

Na Vercel o plano gratuito é para uso não comercial e não há disco persistente; só use com armazenamento S3 e plano pago.

## Serviços, integrações e custos estimados

Valores de referência (out/2026), aproximados — confira os preços atuais de cada fornecedor.

| Item | Para quê | Custo aproximado |
|---|---|---|
| Domínio `.com.br` | Endereço do site | ~R$ 40/ano |
| VPS 2 GB (São Paulo) | Aplicação + banco + HTTPS | R$ 30–90/mês |
| Armazenamento externo de backup (ex.: Cloudflare R2, Backblaze B2) | Cópias fora do servidor | Gratuito a poucos reais/mês para o volume de um consultório |
| E-mail transacional (Resend) | Confirmações, lembretes, senhas | Plano gratuito (~3.000 e-mails/mês); pago a partir de ~US$ 20/mês |
| Monitoramento (UptimeRobot) | Alerta se o site cair | Gratuito no plano básico |
| Certificado HTTPS | Criptografia | Gratuito (Let's Encrypt via Caddy) |
| **Total para começar** | | **≈ R$ 40–120/mês + domínio** |

Integrações futuras (custos variáveis, somente se forem implementadas):

| Integração | Observação de custo |
|---|---|
| WhatsApp Business API (via Meta ou parceiro) | Cobrança por mensagem/conversa de modelo, mais mensalidade do parceiro, se houver. |
| Pagamentos on-line (Mercado Pago, Asaas, Stripe) | Sem mensalidade em geral; taxa por transação (Pix com taxa menor, cartão maior). |
| Videoconferência | Google Meet/Jitsi gratuitos com link manual; integração automática pode exigir conta paga. |
| Assistente de IA | Cobrança por uso do provedor de IA; exige avaliação de impacto e contrato adequado à LGPD. |

## Desenvolvimento local

```bash
cd nutricionista
npm install
npm run setup   # cria o banco local (PGlite) com dados fictícios
npm run dev     # http://localhost:3000
```

Acessos de demonstração (dados fictícios): `nutri@example.com` / `Nutri#Demo2026`, `recepcao@example.com` / `Equipe#Demo2026`, `paciente@example.com` / `Paciente#Demo2026`.
