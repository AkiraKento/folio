# Releases — Weiss

Histórico de versões e builds de teste para Android.

---

## Versão 0.1.1 (Build 1) — Preview APK

- **Data:** 10 de outubro de 2026
- **Link do APK:** [Baixar APK no Expo](https://expo.dev/accounts/akiraweisss-team/projects/weiss/builds/d45384cc-faaa-4f94-b51f-684724164b81)
- **ID do Build:** `d45384cc-faaa-4f94-b51f-684724164b81`
- **Público:** Testadores iniciais (medicina, concursos, direito, psicologia)

### Novidades e Melhorias

#### 🎨 Nova Identidade: Weiss

- O aplicativo agora se chama **Weiss**, com nova identidade visual minimalista e calma.
- Ícone autoral com suporte a ícones temáticos do Android (Material You) e tela de abertura (splash) integrada aos temas claro (*Calmcoder*) e escuro (*Noctis Obscuro*).

#### 📖 Modo Consulta (Diferencial)

- Leitura contínua dos versos dos flashcards em texto corrido com tipografia serifada de alta legibilidade.
- Ferramenta de marcação com **5 cores de grifo**, sublinhado e anotações contextuais.
- Todos os grifos persistem e **reaparecem automaticamente** durante as revisões de cards!
- Painel lateral de anotações com filtro "Só com nota", atalho para ir direto ao trecho no texto e detecção de anotações órfãs.
- Busca instantânea sem distinção de acentos ou maiúsculas/minúsculas.
- Controles de tamanho de texto (A−/A+) e botão "Continuar lendo" que salva automaticamente a posição onde você parou.

#### 🧠 Revisão Inteligente com FSRS

- Agendamento de repetição espaçada de última geração baseado no algoritmo FSRS (Free Spaced Repetition Scheduler), superando o SM-2 tradicional do Anki.
- Fila diária inteligente que prioriza cards em aprendizado e atrasados, com enterro automático de cards irmãos no mesmo dia.
- Tela "Hoje" com estimativa realista de tempo de estudo, sequência de dias (streak) e botão rápido para revisar.

#### 🗂️ Gestão de Decks e Criação de Cards

- Navegação em árvore com suporte a subdecks hierárquicos (`Pai::Filho`) e contadores ao vivo de cards novos, em aprendizado e para revisão.
- Criar, renomear, mover e excluir decks com botão imediato de **Desfazer** (sem confirmações burocráticas).
- Editor de cards ágil com suporte aos modelos Básico, Invertido e Lacunas (Cloze `[...]`), além de adição de imagens locais da galeria.

#### 📥 Importação e Compatibilidade

- Importação completa de pacotes `.apkg` do Anki (incluindo imagens, notas e histórico de revisões) e arquivos `.csv`.
- Opção para manter os intervalos existentes do Anki ou começar como novos cards com agendamento FSRS.
- Reimportação idempotente segura: atualize seus decks sem duplicar cards.

#### 📊 Progresso, Rotina e Feedback

- Mapa de calor de consistência de estudos (estilo GitHub) nas telas Hoje e Estatísticas.
- Lembrete diário configurável com horário customizado para nunca perder a rotina.
- Painel "Estatísticas do teste" com validação de metas e botão para exportar relatório como texto.
- Canal direto de "Enviar feedback" em Ajustes para relatar dúvidas ou sugestões sem expor seus dados de estudo.
