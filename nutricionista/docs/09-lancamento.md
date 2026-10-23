# Lançamento — do sistema de demonstração ao site do André no ar

Este guia leva o sistema ao ar no domínio próprio e com os dados reais do André Farion. São três partes:

1. Juntar as informações do consultório.
2. Preencher o perfil.
3. Publicar no servidor.

Os detalhes técnicos de servidor, backups e monitoramento estão em [03-publicacao.md](03-publicacao.md).

## 1. Informações necessárias

Tudo isto vai aparecer no site e nos PDFs. Nada aqui é senha.

| Informação | Onde aparece | Exemplo |
|---|---|---|
| Número do CRN | Rodapé do site, PDFs, assinatura | CRN-8 12345 |
| WhatsApp (já preenchido: (41) 99155-1789) | Agendamento, contato, botão flutuante, cobranças | (41) 99155-1789 |
| Instagram | Rodapé e contato | @andrefarion |
| E-mail de contato | Contato e política de privacidade | contato@andrefarion.com.br |
| E-mail para pedidos da LGPD | Política de privacidade | pode ser o mesmo |
| Endereço do consultório, ou "somente on-line" | Contato e confirmações de consulta | Rua…, sala…, bairro, cidade/UF |
| Biografia curta (3 a 5 frases) | Seção "Sobre" | Formação, tempo de atuação, público, o que valoriza |
| Especialidades e diferenciais | Seção "Sobre" | Reeducação alimentar, nutrição esportiva… |
| Serviços e duração (preço opcional, não aparece no site) | Seção de serviços e financeiro | Primeira consulta, 60 min |
| Dias e horários de atendimento | Horários livres no agendamento | Seg a sex, 8h–12h e 13h30–18h |
| Foto profissional e logo (opcional) | Site, app e PDF | JPG ou PNG, boa luz, fundo neutro |
| Domínio desejado | Endereço do site | andrefarion.com.br |
| Hospedagem | Onde o sistema roda | VPS com Docker (recomendado) ou serviço gerenciado |

> **Nunca envie senhas, chaves ou códigos de acesso por chat ou e-mail.** Todas as senhas do sistema são geradas no próprio servidor (passo 3).

**Sobre a consultoria de treinos:** a prescrição de treino físico é atribuição do profissional de educação física (CREF). Se a consultoria incluir treino, informe no texto do serviço quem é o profissional responsável por essa parte.

## 2. Preencher o perfil

1. Copie o modelo:
   ```bash
   cp deploy/perfil.exemplo.json deploy/perfil.json
   ```
2. Troque todo texto que começa com `PREENCHER`. Os dias da semana vão escritos (`segunda`, `terca`, `quarta`…). O bloco `site` define se o "Agendar consulta" abre o WhatsApp (`"agendamento": "whatsapp"`, padrão) ou a agenda on-line (`"site"`), e se os valores aparecem (`"mostrarValores": false`, padrão). O preço de cada serviço é opcional (`"preco": 250`) e serve ao financeiro. Os blocos `planos` e `planosIncluem` já vêm com os planos do material de divulgação (Mensal, Trimestral, Semestral e Anual); `"mostrarValoresPlanos": true` mostra os valores deles no site.
3. Confira antes de gravar. Este comando não precisa de banco:
   ```bash
   node scripts/aplicar-perfil.mjs deploy/perfil.json --conferir
   ```
   O comando aponta, campo por campo, o que falta ou está em formato errado. Ele também recusa dados de exemplo esquecidos, como `example.com`, "Rua Exemplo" ou o WhatsApp `5500000000000`.

O arquivo `deploy/perfil.json` só contém informações públicas (as que já aparecem no site), então pode ficar no Git.

## 3. Publicar

No servidor (Ubuntu com Docker; veja o passo a passo do servidor em [03-publicacao.md](03-publicacao.md)), dentro da pasta `nutricionista/`:

```bash
# 3.1 Senhas e chaves novas, geradas no próprio servidor (cria deploy/.env com permissão 600)
docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gerar-segredos.mjs andrefarion.com.br contato@andrefarion.com.br

# 3.2 Subir tudo (banco, aplicação, HTTPS automático, lembretes e backup diário)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# 3.3 Conta do André (imprime um link para ele criar a senha; ou use deploy/criar-admin.sql, ver docs/11)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec app node scripts/create-admin.mjs "André Farion" andre@andrefarion.com.br

# 3.4 Dados reais do consultório (também desliga a faixa de demonstração)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T app node scripts/aplicar-perfil.mjs - < deploy/perfil.json
```

Depois, no painel (**Configurações**), o André:

- envia a foto, o logo e a assinatura;
- revisa os textos;
- cadastra os depoimentos, somente com autorização registrada;
- revisa a política de privacidade.

Para usar e-mail (recuperação de senha e confirmações):

1. Crie a chave em [resend.com](https://resend.com).
2. Confirme o domínio lá.
3. Cole a chave em `RESEND_API_KEY` no `deploy/.env`.
4. Repita o passo 3.2.

### Observações

- O banco de produção começa **vazio**: nenhum paciente, plano ou depoimento de demonstração vai para o ar. Os dados fictícios existem só no ambiente local (`npm run setup`).
- `aplicar-perfil.mjs` pode ser rodado de novo quando os dados mudarem. Ele:
  - atualiza os serviços pelo nome;
  - desativa os que saíram do arquivo, sem apagar o histórico de consultas;
  - substitui os horários de atendimento e as perguntas frequentes.

  Ajustes feitos depois pelo painel nesses mesmos campos são sobrescritos. Escolha um caminho e mantenha.
- **Não gere os segredos de novo depois de publicar.** Trocar `DB_PASSWORD` impede o acesso ao banco existente. Trocar as chaves VAPID desliga as notificações de todos os celulares. Guarde uma cópia do `deploy/.env` num cofre de senhas.

## Checklist antes de divulgar

- [ ] `aplicar-perfil.mjs --conferir` sem pendências e perfil aplicado
- [ ] Senha do André criada pelo link e login testado no celular
- [ ] Foto profissional, logo e assinatura enviados
- [ ] Site abre em `https://` com cadeado; `https://DOMINIO/api/health` responde `{"ok":true}`
- [ ] Agendamento de teste feito e cancelado
- [ ] App instalado no celular ("Adicionar à tela inicial") e notificação de teste recebida
- [ ] E-mail configurado e recuperação de senha testada
- [ ] Política de privacidade revisada por profissional jurídico
- [ ] Backup externo configurado e uma restauração testada ([03-publicacao.md](03-publicacao.md))
- [ ] Monitoramento de disponibilidade ativo (UptimeRobot ou similar)
