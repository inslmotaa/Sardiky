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
| Portabilidade | exportação JSON do próprio paciente sem notas clínicas internas |

## Revisão manual recomendada antes da produção

- Navegar com leitor de tela (NVDA/VoiceOver) nas telas de agendamento e plano alimentar.
- Testar em um celular Android e um iPhone reais (câmera no envio de foto do diário).
- Rodar uma varredura de vulnerabilidades (ex.: OWASP ZAP) contra o ambiente de homologação.
- `npm audit` periodicamente e atualização de dependências.
