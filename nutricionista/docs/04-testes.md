# Etapa 4 — Segurança e testes

## Como rodar

```bash
npm run typecheck   # tipos
npm test            # testes de unidade (Vitest)
npm run test:e2e    # testes no navegador (Playwright); sobe um servidor próprio com banco temporário
```

Os testes de ponta a ponta usam um banco PGlite descartável na pasta temporária do sistema, recriado com os dados fictícios a cada execução. Se o Chromium do Playwright não estiver instalado, rode `npx playwright install chromium` (ou aponte `PW_CHROMIUM` para um Chromium existente).

## O que é verificado

### Unidade (`tests/unit`)

| Área | Casos |
|---|---|
| Agenda | horários cabem inteiros no expediente; dias sem atendimento; conflito com consultas e bloqueios; folga entre consultas; antecedência mínima; limite de dias; intervalos encostados não conflitam |
| Fuso horário | Brasília → UTC; ida e volta; fuso com horário de verão; virada de mês/ano; semana começando na segunda; datas inválidas; idade |
| Senhas e tokens | hash scrypt com sal aleatório, verificação, regra mínima; tokens guardados só como hash; códigos sem caracteres ambíguos |
| Permissões | administrador pode tudo; equipe só o liberado e nunca configurações; paciente sem permissões de equipe |
| Arquivos e exportação | tipo detectado pelo conteúdo (HTML disfarçado é recusado); CSV protegido contra fórmulas |
| Cálculos nutricionais | Mifflin F 70 kg/165 cm/30 anos = 1.420,25 kcal e ×1,55 = 2.201,4; IMC 70/1,65 = 25,7 (sobrepeso; Lipschitz a partir de 60 anos); faixa de peso saudável; Harris-Benedict, Katch-McArdle, Cunningham; macros por % e g/kg; água por ml/kg; 150 g de alimento com 128 kcal/100 g = 192 kcal; medida caseira ↔ gramas; cru ↔ cozido; substituições sugeridas dentro de ±10% e no mesmo grupo; busca tolerante a acentos e erros de digitação; plural de medidas |
| Composição corporal | Siri; Jackson-Pollock 3 dobras (homem e mulher, dobras certas por sexo); Jackson-Pollock 7 dobras; Durnin-Womersley com coeficiente por faixa etária; dobra faltando não calcula; massa magra |
| Lista de compras, restrições, feriados | soma semanal por dia da semana, cozido → cru pelo fator de cocção, unidades; alertas de lactose/glúten/vegetariano/ovo (com exceções “sem lactose” e “pão de queijo”); Páscoa 2025–2027, Carnaval, Sexta-feira Santa, Corpus Christi; nome da sala do Jitsi |
| Adesão ao plano | feita = 1, parcial = ½; dias antes do plano não contam; dias da semana com números diferentes de refeições; limites configuráveis; sequência de dias; adesão semanal |
| Validação | formulários configuráveis (obrigatórios, opções inválidas, campos desconhecidos descartados); plano alimentar v2 (dias, opções, itens calculados) e conversão de planos antigos; valores em reais; telefones |

### Ponta a ponta (`tests/e2e`)

| Fluxo | Verificação |
|---|---|
| Site público | storytelling, nome do profissional, serviços, depoimento sem autorização **não** aparece |
| Interessados | consentimento obrigatório; dados digitados não se perdem no erro; contato salvo |
| Agendamento | 5 passos até a confirmação com código; **o mesmo horário deixa de ser oferecido** |
| Responsividade | sem rolagem horizontal a 360 px no site, no app do paciente e no painel |
| Acesso | áreas privadas exigem login; exportação e CSV recusam anônimos; senha errada com mensagem genérica; cookie `httpOnly` e `SameSite=Lax` |
| Isolamento | paciente não abre formulário nem foto de outro paciente (404) e é redirecionado ao tentar o painel; anônimo não baixa fotos |
| Equipe | recepção sem permissão clínica não vê planos, notas clínicas nem mensagens |
| Tarefas | `/api/cron` recusa chamada sem segredo |
| Plano alimentar | publicação bloqueada sem confirmação de revisão; após publicar, paciente vê o plano com substituições |
| Agenda | confirmação de pedido pendente |
| Cadastro e convite | paciente criado, link de primeiro acesso gera senha, login funciona e o link não pode ser reutilizado |
| Área do paciente | medida informada, mensagem enviada, formulário com validação e envio |
| Editor com cálculo | 150 g de arroz = 192 kcal; trocar para 3 colheres de sopa recalcula (75 g, 96 kcal); sugestões dentro de ±10%; aprovar substituição; salvar rascunho |
| Tela Hoje | água +250 ml persiste; refeição marcada como feita persiste; peso registrado |
| Calculadoras | IMC 25,7 (sobrepeso) e Mifflin 1.420,25 / 2.201,4 kcal na tela |
| Recursos por paciente | ao desligar calorias e macros, nenhum valor em kcal aparece no plano do paciente |
| Site | ordem dos botões da abertura, link da anamnese, seção de planos, atalhos `/entrar`, `/app`, `/painel` |
| Acompanhamento | Beatriz “em dia”, Helena “com dificuldade”, Lucas “sem progresso”; mudar os limites reclassifica |
| Diário | “comi outra coisa” com alimento da base (150 g = 192 kcal), humor; nutricionista responde no chat citando o registro |
| Avaliação | dobras de Jackson-Pollock 3 calculadas no servidor: 25,4% (mulher, 35 anos, soma 63 mm) |
| Fotos de evolução | paciente envia; nutricionista vê; outro paciente recebe 404 |
| Chat ao vivo | mensagem do nutricionista aparece sem recarregar; o nutricionista vê “lida” |
| Plano em até 5 s | ao ativar uma nova versão, a tela aberta do paciente mostra o novo plano em menos de 5 segundos, sem recarregar |
| Sem internet | depois do primeiro acesso, o plano abre com o aparelho off-line |
| PDF e metas | PDF do plano (paciente só o próprio); paciente marca meta como concluída |
| Tarefa agendada | `/api/cron` roda os lembretes com o segredo |
| Restrições no editor | ficha com lactose → aviso no topo do editor, ⚠ nos alimentos e alerta ao adicionar queijo |
| Anamnese nativa | seções, exige consentimento para dados de saúde, restrições marcadas vão para a ficha |
| Receitas | cadastro com cálculo (150 g de arroz = 192 kcal), uso no editor como “Receita: …”, biblioteca do paciente |
| Lista de compras | itens da semana agrupados, cozidos em peso cru, marcação persiste |
| Prescrições | registro no painel aparece no plano do paciente |
| Agenda | paciente confirma presença, vê o link do Jitsi, pede remarcação e avalia a consulta |
| Feriados | 10 feriados nacionais de 2027 bloqueados; repetir não duplica |
| Equipe | nutricionista com pacientes próprios não vê a ficha de outros (404), nem no acompanhamento e nas mensagens |
| Materiais | material para todos × para pacientes escolhidos |
| Financeiro | pendente vencido aparece como “Atrasado”, com link de cobrança pelo WhatsApp |
| Webhook | sem segredo → 401; com segredo cria paciente e leva restrições à ficha |
| Portabilidade | exportação JSON do próprio paciente sem notas clínicas internas |

## Revisão manual recomendada antes da produção

- Navegar com leitor de tela (NVDA/VoiceOver) nas telas de agendamento e plano alimentar.
- Testar em um celular Android e um iPhone reais (câmera no envio de foto do diário, gravação de áudio no chat, instalação na tela inicial).
- Notificações push: ativar em um Android (Chrome) e em um iPhone com o app instalado (iOS 16.4+) e conferir lembretes de refeição e água com a tarefa agendada rodando a cada 5 minutos. O envio real depende dos serviços de push dos navegadores e não roda nos testes automáticos.
- Rodar uma varredura de vulnerabilidades (ex.: OWASP ZAP) contra o ambiente de homologação.
- `npm audit` periodicamente e atualização de dependências.
