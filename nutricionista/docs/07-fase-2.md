# Fase 2 — Acompanhamento: entregue e pendente

Construída sobre as fases anteriores. Dados fictícios. Acessos de demonstração no README (inclui a paciente Helena, “com dificuldade”).

## Entregue

| Item da especificação | Onde está |
|---|---|
| Diário alimentar com foto: “segui o plano / segui em parte / comi outra coisa”, busca na base com quantidade, fome, saciedade e humor (1 a 5 com emojis), histórico por dia com calorias | App → Diário · Painel → ficha → Diário |
| Comentário do nutricionista em cada registro e resposta direto no chat citando o registro | Painel → ficha → Diário |
| Painel de Acompanhamento: em dia (≥ 80%), com dificuldade (40–79%), sem progresso (< 40% ou sem registro), limites configuráveis, último registro, variação de peso, mensagem rápida | Painel → Acompanhamento · alerta no Início para quem está 3+ dias sem registrar |
| Gráficos de progresso: peso com linha de meta, medidas, adesão semanal, sequência de dias registrando | App → Progresso · Painel → Avaliações e evolução |
| Fotos de evolução (frente, lado, costas) com comparação lado a lado entre duas datas, privadas | App → Progresso · Painel → Avaliações e evolução |
| Avaliações antropométricas: circunferências (cintura, quadril, abdômen, braço, coxa, panturrilha, tórax), dobras com Jackson-Pollock 3 e 7 e Durnin-Womersley (densidade → Siri), bioimpedância, massa magra, RCQ, IMC, cálculo ao vivo e gráficos | Painel → ficha → Avaliações e evolução |
| Metas com prazo e “concluída” (o paciente também marca) | App → Progresso · Painel → Metas |
| Chat ao vivo com texto, foto, PDF e áudio curto, indicador de lida, respostas rápidas, horário de atendimento e resposta automática fora dele | App → Mensagens · Painel → ficha → Mensagens · Configurações → Chat |
| Notificações push: horário das refeições, água a cada N horas, plano novo (push + e-mail), mensagens, consultas em 24 h e 2 h, 3 dias sem registrar (paciente e nutricionista), pesagem semanal, anamnese recebida; preferências por tipo e horário de silêncio | App → Mais → Notificações · tarefa `/api/cron` a cada 5 min |
| App instalável (PWA): ícone na tela inicial, plano do dia sem internet depois do primeiro acesso | `public/sw.js`, `manifest` |
| Plano aparece em até 5 segundos e paciente recebe notificação ao ativar | Atualização ao vivo (`/api/live`) + push |
| PDF do plano com marca, nome e registro profissional | App → Plano → “Baixar PDF” · Painel → plano → “Baixar PDF” |
| Modelos de plano: salvar plano como modelo; novos modelos (vegetariano, emagrecimento) | Painel → plano → “Salvar como modelo” |

## Lighthouse (app do paciente)

Medido no build de produção local, com emulação de celular (Lighthouse 12):

| Tela | Desempenho | Acessibilidade | Boas práticas |
|---|---|---|---|
| Hoje | 92 | 100 | 96 |
| Plano | 96 | 98 | 96 |
| Diário | 96 | 98 | 96 |

Critério da especificação (≥ 90 em desempenho e acessibilidade) atendido. Vale medir de novo no ambiente publicado (HTTPS, servidor real).

## Decisões e diferenças em relação à especificação

- **Tempo real** por consulta leve a cada 4 segundos (só com a tela aberta), em vez de Supabase Realtime: funciona com o banco atual e cumpre o critério de 5 segundos.
- **Adesão** contada sobre os **7 dias completos até ontem**: as refeições de hoje ainda podem acontecer.
- **Lembretes** dependem da tarefa agendada a cada 5 minutos (o `docker-compose` já faz isso) e, em produção, das chaves VAPID.

## Ainda não feito

- **CRN do André** e conferência dos valores TACO (pendentes desde a Fase 1).
- Notificações push testadas apenas no navegador de testes; falta conferir em um Android e um iPhone reais (no iPhone, só com o app instalado, iOS 16.4+).
- Fotos de evolução e anexos ficam em pasta privada do servidor; **URLs assinadas com validade** (como no Supabase Storage) ainda não — o acesso é conferido a cada pedido.
- Recordatório e fotos no diário de **dias passados** além do registro rápido; edição de registros antigos pelo paciente é limitada aos últimos 30 dias.
- Modo escuro, login com Google e link mágico (fora desta fase).
- **Fase 3**: agenda pública com lembretes e videochamada, anamnese nativa com construtor, receitas, materiais educativos, lista de compras, prescrições, financeiro, equipe e configurações de marca completas.
