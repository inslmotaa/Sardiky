# Fotos do corpo, fotos das refeições e perfil físico (Parte 7)

Tudo gratuito: nenhuma IA paga e nenhum serviço externo de imagem. As fotos são reduzidas no próprio celular e guardadas na pasta privada do servidor. A Parte 7 reaproveita o que já existia:

- fotos de evolução (`progress_photos`: frente, lado, costas);
- foto do diário (`diary_entries.photoFileId`);
- pesos (`measurements`, informados pelo cliente ou medidos pelo coach);
- nascimento, sexo e altura do cadastro.

## 1. Meu corpo (perfil físico)

- **Onde aparece:**
  - card **"Meu corpo"** no Início do app, com a página completa em **`/paciente/meu-corpo`**;
  - card **"Corpo"** no topo da ficha do cliente no painel (só para quem tem acesso clínico).
- **O que mostra:** peso atual (data e quem registrou), altura, idade, IMC com a faixa, variação desde o início (ex.: "−4,2 kg em 10 semanas") e a data da última foto do corpo.
- **Idade:**
  - sempre calculada da data de nascimento, no fuso do consultório (`America/Sao_Paulo`);
  - muda sozinha no dia do aniversário. Nenhuma idade fica gravada como número.
- **IMC:**
  - calculado na hora, com a altura **vigente em cada data**;
  - faixas da OMS para adultos e de Lipschitz a partir de 60 anos.
- **Peso:**
  - o cliente registra quando quiser (Início, Meu corpo ou Progresso);
  - cada registro fica no histórico como "informado pelo cliente" ou "medido pelo coach".
- **Altura:**
  - histórico na tabela `height_logs`, somada às alturas das avaliações;
  - o cliente atualiza em Meu corpo; o coach, no card da ficha ("Atualizar altura", com a data) ou no cadastro;
  - a anamnese também registra a altura.
- **Dados que faltam:**
  - sem data de nascimento, sexo ou altura, o card mostra **"Complete seus dados"**, que leva a um formulário curto;
  - a anamnese preenche esses campos sozinha.
- **Atualização automática:**
  - o lembrete semanal de pesagem abre direto o registro de peso (`/paciente/meu-corpo#peso`);
  - quem passa **14 dias sem registrar peso** aparece no **Acompanhamento** do painel, com botão de lembrete pelo WhatsApp.

## 2. Fotos do corpo

- **Onde enviar:**
  - "Enviar fotos do corpo" no card Meu corpo, em Progresso, em Mais → Fotos e exames e no check-in;
  - o check-in continua aceitando fotos no próprio formulário.
- **Autorização primeiro:**
  - o primeiro envio pede o consentimento específico (`consents`, tipo `fotos_corpo`, com versão e data);
  - sem ele, o servidor recusa o envio, tanto do cliente quanto do coach;
  - o cliente pode retirar a autorização quando quiser.
- **Captura guiada** (`/paciente/meu-corpo/fotos`):
  - câmera do celular com silhueta de referência;
  - dicas curtas: mesma luz, mesma distância, roupa justa, corpo inteiro;
  - **"Tirar em 5 s"** para quem fotografa sozinho;
  - "Escolher da galeria" também vale.
- **Peso do dia:** opcional no mesmo envio. Entra no histórico e fica ligado às fotos (tabela `photo_sets`).
- **Comparação (Progresso e ficha → Avaliações e evolução):**
  - linha do tempo das datas, com o peso de cada uma;
  - atalho **"Primeira × última"**;
  - modo **lado a lado** ou **sobrepor**, com controle deslizante entre as duas fotos do mesmo ângulo.
- **Comentário do coach:** em cada conjunto de fotos. O cliente vê no app e recebe um aviso.
- **Apagar:** o cliente pode apagar qualquer foto dele, inclusive as enviadas pelo coach.

## 3. Fotos das refeições

- **"Foto do prato"** em cada refeição da tela Hoje:
  - abre a câmera, envia e já cria o registro do diário daquela refeição;
  - sem registro anterior, entra como "segui o plano" e marca a refeição como feita; o cliente pode trocar a escolha no diário;
  - reenviar troca a foto do mesmo registro, sem duplicar, e apaga a foto antiga do disco.
- **"Foto avulsa: comi outra coisa"** (Início): foto com texto opcional, registrada como fora do plano.
- **Painel → ficha → Diário → "Pratos da semana":**
  - grade dos últimos 7 dias, por refeição, com a foto ao lado do que estava no plano em vigor naquele dia;
  - o coach reage (**Ótimo**, **Bom**, **Atenção**) e comenta, reaproveitando o comentário do diário;
  - o cliente vê os dois no diário.
- **Calorias:** não há estimativa automática pela foto, porque exigiria IA paga. Continuam vindo do plano ou da busca na base de alimentos.

## 4. Evolução em um só lugar

- **App → Progresso** e **ficha → Avaliações e evolução** reúnem:
  - **resumo**: desde o início, últimos 30 dias, peso atual e IMC atual;
  - **gráficos de peso e IMC**, com a linha da meta. A meta de IMC vem da meta de peso e da altura atual;
  - **linha do tempo por data**: peso, IMC (com a altura usada), medidas, mudanças de altura, fotos do corpo (miniaturas e comentário) e check-ins.
- **"Relatório de evolução (PDF)"**, gerado com `pdf-lib`:
  - traz dados, gráficos e linha do tempo;
  - **as fotos (primeira e última data) só entram se o cliente marcar a autorização** em Progresso (consentimento `fotos_relatorio`). Sem ela, o PDF diz que as fotos não foram incluídas;
  - o cliente baixa em Progresso; o coach, na ficha (para mandar pelo WhatsApp).

## 5. Privacidade e armazenamento (sem custo)

- **No celular:**
  - antes do envio, a foto é redesenhada num canvas com **no máximo 1600 px** no maior lado, em JPEG com qualidade 0,8;
  - isso economiza disco e dados móveis e remove os metadados EXIF, inclusive a localização.
- **No servidor (segunda barreira):**
  - confere o tipo real do arquivo (`storage-sniff.ts`) e recusa o que não for JPEG, PNG ou WebP;
  - recusa fotos acima de **8 MB**;
  - remove de novo EXIF, XMP, IPTC e textos (`src/lib/image-meta.ts`), sem recomprimir. Isso vale para fotos que chegam sem passar pela compressão.
- **Acesso:**
  - as fotos ficam na pasta privada e só abrem para o próprio cliente e para o coach responsável (`/arquivos/[id]` confere a cada pedido);
  - um coach de outra carteira recebe 404;
  - nunca aparecem no site, em depoimentos (que têm autorização própria) ou no relatório sem autorização.
- **Exportação de dados (LGPD):**
  - **"Baixar meus dados"** (JSON) agora traz também o histórico de peso, o histórico de altura e os conjuntos de fotos;
  - **"Baixar com as fotos (ZIP)"** leva o JSON e todas as fotos (corpo, pratos, check-ins) e arquivos do cliente.
- **Espaço em disco:**
  - **Configurações → Armazenamento** mostra o espaço das fotos e dos demais arquivos, e o espaço livre no disco do servidor;
  - a partir de 85% de uso, aparece um aviso.

## 6. Banco de dados

Migração `drizzle/0023_fotos_e_perfil_fisico.sql`:

- tabela `height_logs` (data, altura, origem);
- tabela `photo_sets` (data, peso ligado às fotos, comentário do coach);
- coluna `diary_entries.professional_reaction` (ótimo, bom, atenção).

Os consentimentos novos usam a tabela `consents`, com os tipos `fotos_corpo` e `fotos_relatorio`.

## 7. Testes

- **Unitários** (`tests/unit/parte7.test.ts`):
  - a idade muda no aniversário no fuso de Brasília (23h30 ainda não, 00h30 sim) e no 29 de fevereiro;
  - IMC com a altura vigente em cada data, e as faixas;
  - texto da variação de peso e dados que faltam;
  - remoção de EXIF, XMP e textos em JPEG, PNG e WebP;
  - arquivo que não é imagem recusado pelo tipo real;
  - ZIP da exportação (CRC-32 e estrutura).
- **Ponta a ponta** (`tests/e2e/parte7.spec.ts`):
  - Meu corpo (idade, IMC, faixa, variação, altura com histórico, Complete seus dados), card na ficha e 14 dias sem peso;
  - sem consentimento, o envio é bloqueado no servidor (cliente e coach);
  - fotos com peso do dia, primeira × última, sobreposição e comentário do coach;
  - a foto chega sem EXIF e abaixo de 8 MB;
  - outro cliente e coach de outra carteira recebem 404; o cliente apaga a foto enviada pelo coach;
  - relatório em PDF sem fotos sem autorização e com fotos depois dela;
  - foto do prato cria o registro da refeição certa e não duplica ao reenviar;
  - foto avulsa; arquivo que não é imagem recusado; Pratos da semana com reação e comentário vistos pelo cliente;
  - exportação com histórico e ZIP com as fotos; espaço em Configurações.
- **Parte 6 repetida depois da Parte 7:** suíte completa de ponta a ponta (inclusive `qualidade.spec.ts`) e Lighthouse no build de produção.
