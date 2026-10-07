# Como usar este pacote no Antigravity

1. Crie uma pasta vazia para o projeto (ex.: `C:\Users\akira\Projetos\folio`) e copie para dentro dela **todo o conteúdo desta pasta**, incluindo a pasta oculta `.agents/`.
2. Abra essa pasta no Antigravity (File → Open Folder).
3. No painel do agente, cole o primeiro prompt:

> Leia AGENTS.md, docs/PRD.md, docs/MODO_CONSULTA.md e docs/ROADMAP.md. Antes de escrever código, me devolva: (1) um resumo de 10 linhas do que entendeu, (2) as dúvidas de produto que encontrou e (3) o plano do M0. Depois que eu aprovar, execute o M0 com o workflow /proxima-tarefa.

4. Daí em diante, use `/proxima-tarefa` para avançar uma tarefa por vez, e `/gerar-apk` quando o M8 terminar.

## O que tem aqui

| arquivo | para quê |
|---|---|
| `AGENTS.md` | regras permanentes que o agente lê sempre: stack, convenções, segurança, design |
| `docs/PRD.md` | o produto: problema, hipóteses, funcionalidades, telas, dados, critérios de pronto |
| `docs/MODO_CONSULTA.md` | especificação da funcionalidade central |
| `docs/ROADMAP.md` | tarefas em ordem (M0 → M8), com caixas de marcar |
| `docs/referencia/anchor.js` | o código de âncora do seu add-on ConsultaCards, para ser portado |
| `.agents/workflows/` | os comandos `/proxima-tarefa` e `/gerar-apk` |

## Onde ele vai te perguntar coisas (de propósito)

- Regra de agendamento do "Revisar estes" a partir da Consulta (MODO_CONSULTA §3).
- O `.apkg` de teste com 5.000+ cards. Use decks **seus** (pode exportar vários ShadowCards juntos para chegar ao volume), nunca o da Osler: o arquivo de teste pode acabar versionado no repositório.
- Qualquer dependência fora da lista do `AGENTS.md`.
