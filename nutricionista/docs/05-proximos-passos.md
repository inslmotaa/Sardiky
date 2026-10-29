# Próximos passos

Registro do que foi combinado para a continuação do projeto. O sistema atual (site, agendamento, área do paciente e painel) já funciona com dados fictícios; os passos abaixo transformam-no na plataforma de consultoria do André Farion.

## 1. Informações reais do André Farion

Tudo pode ser preenchido em **Painel → Configurações**, sem mexer no código. A lista abaixo serve de roteiro para reunir o material.

**Quem é o André**
- [ ] Nome profissional como deve aparecer no site
- [ ] Número do CRN (ex.: CRN-3 12345)
- [ ] Foto profissional (de preferência vertical, fundo neutro, boa resolução)
- [ ] Logotipo, se existir, e a cor principal da marca
- [ ] Biografia curta (3 a 5 frases): formação, tempo de atuação, como trabalha
- [ ] Formação e especializações (graduação, pós-graduação, cursos relevantes)
- [ ] Especialidades e públicos atendidos (ex.: emagrecimento, hipertrofia, esportistas, saúde da mulher)
- [ ] Método de trabalho e diferenciais
- [ ] Como funciona o acompanhamento (etapas)
- [ ] Depoimentos reais **com autorização por escrito** de cada paciente

**Contatos e atendimento**
- [ ] WhatsApp (com DDD), por exemplo 55 + DDD + número
- [ ] Instagram (link do perfil)
- [ ] E-mail de contato e e-mail para assuntos de privacidade (LGPD)
- [ ] Dias e horários de atendimento

**Serviços**
- [ ] Lista de serviços com duração e valor (consulta, retorno, planos de consultoria)
- [ ] Pacotes (mensal, trimestral, semestral) com preço e o que inclui

## 2. Consultoria de dieta e treino

Objetivo: o André lança a consultoria para cada cliente, que acessa uma área própria com **dieta e treino** e acompanha tudo.

> **Ponto de atenção regulatório:** no Brasil, a prescrição de treinos é atribuição do profissional de Educação Física (registro no CREF). Se o André tiver também o CREF, ele mesmo pode prescrever; se não, a parte de treino deve ser assinada por um profissional de Educação Física parceiro. O sistema pode ter os dois perfis (nutricionista e educador físico), cada um responsável pela sua parte.

**O que já existe e será reaproveitado**
- Área do cliente com login, plano alimentar, diário, evolução, metas, mensagens e formulários
- Editor de plano alimentar com revisão, publicação e versões
- Pacotes e financeiro, agenda, permissões de equipe, LGPD

**O que será construído**
- [ ] **Módulo de treinos**: biblioteca de exercícios (nome, grupo muscular, vídeo ou imagem demonstrativa, instruções); fichas de treino (A/B/C…) com séries, repetições, carga, descanso e observações; periodização por semanas; mesma lógica de rascunho → revisão → publicação e histórico de versões
- [ ] **Registro do cliente**: marcar treino feito, carga usada, esforço percebido e comentários; gráfico de evolução de cargas
- [ ] **Planos de consultoria**: produto “Consultoria” (só dieta, só treino ou completa) com duração; ao contratar, a área do cliente é liberada automaticamente; aviso de renovação perto do vencimento
- [ ] **Check-ins periódicos**: questionário + fotos de evolução (opcionais, privadas) + medidas, com prazo e lembrete
- [ ] **Página de vendas da consultoria** no site, com planos e botão de contratação
- [ ] **Pagamento on-line** (Pix e cartão, por exemplo Mercado Pago ou Asaas) com liberação automática do acesso após confirmação do pagamento
- [ ] **Perfis profissionais**: nutricionista e educador físico, cada um vendo e editando apenas a sua parte

## 3. De site para aplicativo

| Fase | O que é | Esforço |
|---|---|---|
| 1. Aplicativo instalável (PWA) | O cliente “instala” pelo navegador do celular, com ícone na tela inicial, tela cheia e notificações. Usa o mesmo sistema atual. | Baixo — a base (manifest) já existe |
| 2. Notificações | Lembretes de treino, refeição, check-in e mensagens (push no celular, e-mail e, depois, WhatsApp) | Médio |
| 3. Apps nas lojas (Google Play e App Store) | Empacotar o mesmo sistema como app nativo (Capacitor) ou criar app dedicado (React Native/Expo) consumindo uma API | Médio a alto; contas de desenvolvedor: Google ~US$ 25 (única vez), Apple ~US$ 99/ano |

Recomendação: publicar primeiro o site + PWA, validar com clientes reais e só então ir para as lojas.

## 4. Ordem sugerida

1. Preencher as informações reais do André (seção 1) e publicar o site
2. Módulo de treinos e planos de consultoria (seção 2)
3. Pagamento on-line com liberação automática
4. PWA com notificações
5. Apps nas lojas
