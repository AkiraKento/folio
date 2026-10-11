---
description: Pega a próxima tarefa não marcada do ROADMAP, implementa, testa e marca como feita.
---

1. Leia `AGENTS.md` e `docs/ROADMAP.md`. Encontre a primeira linha `- [ ]`.
2. Se a tarefa for do M4 ou tocar em anotação, renderização ou revisão, leia `docs/MODO_CONSULTA.md` inteiro.
3. Escreva um plano curto: arquivos que vai criar ou alterar, testes que vai escrever e qualquer dúvida de produto. Se houver dúvida de produto, pare e pergunte.
4. Escreva os testes primeiro quando a tarefa for lógica pura (scheduler, render, âncora, import).
5. Implemente.
6. Rode `npm run check` (tsc + eslint + jest). Corrija até passar.
7. Se a tarefa mexe em UI, rode no emulador ou aparelho Android e descreva o que viu.
8. Marque `[x]` no ROADMAP e anote numa linha qualquer decisão tomada.
9. Faça o commit das alterações com mensagem descritiva em português do Brasil.
10. Termine com um walkthrough: o que mudou, como testar e o que ficou pendente.
