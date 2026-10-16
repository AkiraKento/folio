# Screenshots de Referência Visual do Reviewer (AnkiDroid / Desktop)

Este diretório contém os screenshots oficiais de referência do **AnkiDroid** (ou Anki Desktop), utilizados para auditoria visual comparativa do renderizador de cards do Weiss (M10 Passo 10).

---

## 1. Screenshots Solicitados ao Akira (8 arquivos)

Para garantir paridade pixel-a-pixel com o AnkiDroid nos modelos mais utilizados (Avicena e AnKing), precisamos dos seguintes 8 arquivos salvos exatamente com os nomes abaixo nesta pasta:

| Arquivo de Imagem | Modelo | Lado | Tema | Descrição / Elementos Críticos |
|---|---|---|---|---|
| `avicena-frente-claro.png` | Avicena (Cloze / Básico) | Frente | Claro (Light) | Card elevado, tipografia Lato 400/700, prompt de cloze/pergunta, pílula de tags. |
| `avicena-verso-claro.png` | Avicena (Cloze / Básico) | Verso | Claro (Light) | Card elevado, linha divisória (`<hr id="answer">`), resposta expandida, seção Referência, imagem (se houver), tags em pílulas com ciclo de cores. |
| `avicena-frente-escuro.png` | Avicena (Cloze / Básico) | Frente | Escuro (Dark) | Fundo noturno (`#031417` / `#062e32`), contraste do texto em Lato, contraste da pílula de tags. |
| `avicena-verso-escuro.png` | Avicena (Cloze / Básico) | Verso | Escuro (Dark) | Fundo noturno, linha divisória, resposta, seção Referência, cores de tag adaptadas ao tema escuro. |
| `anking-frente-claro.png` | AnKing (Overhaul Cloze) | Frente | Claro (Light) | Prompt cloze em azul/verde AnKing, tags formatadas como `<kbd>`, barra de botões ("One by one" / "Toggle All" se aplicável). |
| `anking-verso-claro.png` | AnKing (Overhaul Cloze) | Verso | Claro (Light) | Resposta cloze destacada, botões de acordeão de dicas (Text, Extra, First Aid, etc.), Bloco de Notas / Personal Notes, tags. |
| `anking-frente-escuro.png` | AnKing (Overhaul Cloze) | Frente | Escuro (Dark) | Cloze no modo escuro, `<kbd>` com fundo escuro, remoção de cor preta fixa inline. |
| `anking-verso-escuro.png` | AnKing (Overhaul Cloze) | Verso | Escuro (Dark) | Extra no modo escuro, remoção de cores fixas inline (< 0.25) com preservação de cores semânticas (azul/amarelo), acordeões de dicas. |

---

## 2. Como Gerar os Screenshots de Referência

1. **Dados dos Cards:**
   - Para o **Avicena**: Utilize a nota de exemplo sintética versionada em `docs/referencia/modelos/avicena/exemplo.json` (ou um card equivalente do seu deck real Avicena).
   - Para o **AnKing**: Utilize a nota de exemplo sintética versionada em `docs/referencia/modelos/anking/exemplo.json` (ou um card equivalente da sua coleção AnKing).
2. **Ambiente Recomendado:**
   - **AnkiDroid no smartphone Android** (ou emulador com resolução de tela intermediária padrão, ex.: 1080x2400 ou 1080x1920, escala 2.75x ou 3x).
   - Alternativamente, **Anki Desktop** ajustado para janela proporcional a smartphone vertical.
3. **Configurações no AnkiDroid:**
   - Modo Claro: tema padrão ou claro nativo.
   - Modo Noturno: modo escuro nativo ativado.
   - Captura completa da tela do reviewer (sem cortar a barra de resposta/ações do AnkiDroid, para comparação da área útil).
4. **Armazenamento:**
   - Salve as imagens em PNG diretamente em `docs/referencia/visual/<nome-do-arquivo>.png`.

---

## 3. Screenshots Gerados pelo Weiss (Maestro)

O fluxo automatizado Maestro (`.maestro/reviewer-visual.yaml`) gera os screenshots correspondentes do Weiss no emulador, salvando com o prefixo `weiss-`:

- `weiss-avicena-frente-claro.png`
- `weiss-avicena-verso-claro.png`
- `weiss-avicena-frente-escuro.png`
- `weiss-avicena-verso-escuro.png`
- `weiss-anking-frente-claro.png`
- `weiss-anking-verso-claro.png`
- `weiss-anking-frente-escuro.png`
- `weiss-anking-verso-escuro.png`

As comparações e análise de discrepâncias ficam registradas em `docs/referencia/visual/DIFERENCAS.md`.
