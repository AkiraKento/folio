import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TouchableOpacity, Switch } from 'react-native';
import { lightTheme, darkTheme } from '../theme';
import { strings } from '../strings';
import { DeckTreeItem } from '../DeckTreeItem';
import { DeckActionButtons } from '../DeckActionButtons';
import { ConsultaSearchBar } from '../ConsultaSearchBar';
import { Snackbar } from '../Snackbar';
import type { DeckTreeNodeWithCounts } from '@/db/repositories/decks';
import type { Deck } from '@/db/schema';

/**
 * Função utilitária para calcular a luminância relativa conforme WCAG 2.1 §1.4.3
 */
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calcula a razão de contraste entre duas cores hexadecimais (L1 + 0.05) / (L2 + 0.05)
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('Passada de Performance e Acessibilidade (Folio)', () => {
  const sampleDeck: Deck = {
    id: 'deck-cardio',
    name: 'Medicina::Cardiologia',
    area: 'Medicina',
    description: 'Estudo de cardiologia',
    source_id: null,
    created_at: 1000,
    updated_at: 1000,
    deleted_at: null,
  };

  const sampleNode: DeckTreeNodeWithCounts = {
    id: sampleDeck.id,
    name: sampleDeck.name,
    shortName: 'Cardiologia',
    deck: sampleDeck,
    directCounts: { new: 5, learning: 2, review: 8, total: 15 },
    totalCounts: { new: 5, learning: 2, review: 8, total: 15 },
    children: [],
  };

  describe('1. Contraste de Cores (WCAG AA)', () => {
    it('tema claro (Calmcoder): texto principal possui contraste >= 7:1 contra o fundo (nível AAA)', () => {
      const contrastFgCanvas = getContrastRatio(lightTheme.fg, lightTheme.canvas);
      const contrastFgElevated = getContrastRatio(lightTheme.fg, lightTheme.elevated);

      expect(contrastFgCanvas).toBeGreaterThanOrEqual(7.0);
      expect(contrastFgElevated).toBeGreaterThanOrEqual(7.0);
    });

    it('tema escuro (Noctis Obscuro): texto principal possui contraste >= 7:1 contra o fundo (nível AAA)', () => {
      const contrastFgCanvas = getContrastRatio(darkTheme.fg, darkTheme.canvas);
      const contrastFgElevated = getContrastRatio(darkTheme.fg, darkTheme.elevated);

      expect(contrastFgCanvas).toBeGreaterThanOrEqual(7.0);
      expect(contrastFgElevated).toBeGreaterThanOrEqual(7.0);
    });

    it('elementos de destaque (accent) e aprendizado (learn) possuem contraste gráfico >= 3:1', () => {
      const darkAccentContrast = getContrastRatio(darkTheme.accent, darkTheme.canvas);
      expect(darkAccentContrast).toBeGreaterThanOrEqual(3.0);

      const darkLearnContrast = getContrastRatio(darkTheme.learn, darkTheme.canvas);
      expect(darkLearnContrast).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('2. Alvos de Toque Mínimos (>= 44 px)', () => {
    it('DeckActionButtons possui 3 botões com minHeight >= 44 px', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckActionButtons onStudy={jest.fn()} onConsult={jest.fn()} onAddCard={jest.fn()} />
        );
      });

      const touchables = renderer.root.findAllByType(TouchableOpacity);
      expect(touchables.length).toBe(3);

      touchables.forEach((btn) => {
        const style = Array.isArray(btn.props.style)
          ? Object.assign({}, ...btn.props.style.filter(Boolean))
          : btn.props.style;
        const effectiveHeight = style.minHeight ?? style.height;
        expect(effectiveHeight).toBeGreaterThanOrEqual(44);
      });
    });

    it('DeckTreeItem possui botão de expansão e opções com largura e altura >= 44 px', () => {
      const nodeWithChild: DeckTreeNodeWithCounts = {
        ...sampleNode,
        children: [sampleNode],
      };

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckTreeItem
            node={nodeWithChild}
            depth={0}
            isExpanded={true}
            onToggleExpand={jest.fn()}
            onSelectDeck={jest.fn()}
            onOptionsPress={jest.fn()}
          />
        );
      });

      const expandBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.collapseSubdecks,
      });
      const expandStyle = expandBtn.props.style;
      expect(expandStyle.width).toBeGreaterThanOrEqual(44);
      expect(expandStyle.height).toBeGreaterThanOrEqual(44);

      const optionsBtn = renderer.root.findByProps({
        accessibilityLabel: `${strings.decks.moreOptions}: ${sampleNode.name}`,
      });
      const optionsStyle = optionsBtn.props.style;
      expect(optionsStyle.minWidth).toBeGreaterThanOrEqual(44);
      expect(optionsStyle.minHeight).toBeGreaterThanOrEqual(44);
    });

    it('ConsultaSearchBar possui botão de revisão com minHeight >= 44 px', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConsultaSearchBar
            visible={true}
            query="cardio"
            onlyWithNotes={false}
            matchingCount={3}
            onQueryChange={jest.fn()}
            onToggleOnlyWithNotes={jest.fn()}
            onReviewFiltered={jest.fn()}
            onClose={jest.fn()}
          />
        );
      });

      const reviewBtn = renderer.root.findByProps({
        testID: 'consulta-search-bar-review',
      });
      const style = Array.isArray(reviewBtn.props.style)
        ? Object.assign({}, ...reviewBtn.props.style.filter(Boolean))
        : reviewBtn.props.style;

      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe('3. Acessibilidade TalkBack (Roles, Labels e Estados)', () => {
    it('DeckTreeItem fornece rótulo detalhado com contadores para TalkBack', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckTreeItem
            node={sampleNode}
            depth={0}
            isExpanded={false}
            onToggleExpand={jest.fn()}
            onSelectDeck={jest.fn()}
          />
        );
      });

      const deckBtn = renderer.root.findByProps({
        accessibilityRole: 'button',
        accessibilityLabel: strings.decks.deckWithCountsLabel(
          sampleNode.name,
          sampleNode.totalCounts.new,
          sampleNode.totalCounts.learning,
          sampleNode.totalCounts.review
        ),
      });

      expect(deckBtn).toBeDefined();
      expect(deckBtn.props.accessibilityHint).toBeDefined();
    });

    it('ConsultaSearchBar possui interruptor acessível com papel switch', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConsultaSearchBar
            visible={true}
            query=""
            onlyWithNotes={true}
            matchingCount={1}
            onQueryChange={jest.fn()}
            onToggleOnlyWithNotes={jest.fn()}
            onReviewFiltered={jest.fn()}
            onClose={jest.fn()}
          />
        );
      });

      const switchComp = renderer.root.findByType(Switch);
      expect(switchComp.props.accessibilityLabel).toBe(strings.consulta.onlyWithNotes);
      expect(switchComp.props.value).toBe(true);
    });

    it('Snackbar implementa accessibilityRole="alert" e accessibilityLiveRegion="polite"', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Snackbar
            visible={true}
            message="Item apagado"
            actionText="Desfazer"
            onAction={jest.fn()}
          />
        );
      });

      const alertContainer = renderer.root.findByProps({
        accessibilityRole: 'alert',
        accessibilityLiveRegion: 'polite',
      });
      expect(alertContainer).toBeDefined();

      const undoBtn = renderer.root.findByProps({
        accessibilityRole: 'button',
        accessibilityLabel: 'Desfazer',
      });
      expect(undoBtn).toBeDefined();
    });
  });

  describe('4. Performance e Memoização', () => {
    it('DeckTreeItem é um componente memoizado para evitar re-renderizações desnecessárias da árvore', () => {
      expect(DeckTreeItem).toBeDefined();
      // Em React, componentes memoizados possuem $$typeof correspondente a react.memo
      expect(
        typeof DeckTreeItem === 'object' &&
          ((DeckTreeItem as unknown as { $$typeof?: symbol }).$$typeof?.toString().includes('react.memo') ||
            (DeckTreeItem as unknown as { type?: unknown }).type !== undefined)
      ).toBe(true);
    });
  });
});
