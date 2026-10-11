import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TouchableOpacity, Text, TextInput } from 'react-native';
import { OnboardingView } from '../OnboardingView';
import { useOnboarding } from '@/onboarding/useOnboarding';
import { strings } from '../strings';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { SettingsRepository } from '@/db/repositories/settings';
import { DecksRepository } from '@/db/repositories/decks';

// Wrapper que expõe o hook useOnboarding para testes interativos
const OnboardingTestWrapper: React.FC<{
  db?: ReturnType<typeof createTestDatabase>['db'];
  onFinish?: () => void;
  onboardingRef?: { current: ReturnType<typeof useOnboarding> | null };
}> = ({ db, onFinish, onboardingRef }) => {
  const onboarding = useOnboarding('medicina', db);
  if (onboardingRef) {
    onboardingRef.current = onboarding;
  }
  return <OnboardingView onboarding={onboarding} onFinish={onFinish} />;
};

describe('<OnboardingView /> (PRD §6.1)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let settingsRepo: SettingsRepository;
  let decksRepo: DecksRepository;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    settingsRepo = new SettingsRepository(db);
    decksRepo = new DecksRepository(db);
  });

  test('renderiza Passo 1 com as 5 áreas de estudo e seleciona uma área', () => {
    const ref: { current: ReturnType<typeof useOnboarding> | null } = { current: null };
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<OnboardingTestWrapper db={db} onboardingRef={ref} />);
    });

    const root = renderer.root;

    // Título do passo 1
    const titleText = root.findAllByType(Text).find((t) =>
      t.props.children === strings.onboarding.step1.title
    );
    expect(titleText).toBeDefined();

    // Procura o botão para a área de Direito
    const direitoOption = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.step1.areas.direito.title
    );
    expect(direitoOption).toBeDefined();

    // Seleciona Direito
    act(() => {
      direitoOption?.props.onPress();
    });

    expect(ref.current?.area).toBe('direito');
  });

  test('navega para o Passo 2 e permite configurar minutos diários e data de prova', () => {
    const ref: { current: ReturnType<typeof useOnboarding> | null } = { current: null };
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<OnboardingTestWrapper db={db} onboardingRef={ref} />);
    });

    const root = renderer.root;

    // Avança para o Passo 2
    const continueBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.continueAction
    );
    expect(continueBtn).toBeDefined();

    act(() => {
      continueBtn?.props.onPress();
    });

    expect(ref.current?.step).toBe(2);

    // Seleciona ritmo de 45 min
    const pace45Btn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.step2.paceOptions.min45
    );
    expect(pace45Btn).toBeDefined();

    act(() => {
      pace45Btn?.props.onPress();
    });

    expect(ref.current?.dailyMinutes).toBe(45);

    // Habilita opção com data de prova
    const hasDateToggle = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.step2.examChoiceHasDate
    );
    expect(hasDateToggle).toBeDefined();

    act(() => {
      hasDateToggle?.props.onPress();
    });

    expect(ref.current?.hasExamDate).toBe(true);

    // Digita uma data futura válida (20/12/2026)
    const dateInput = root.findByType(TextInput);
    expect(dateInput).toBeDefined();

    act(() => {
      dateInput.props.onChangeText('20122026');
    });

    expect(ref.current?.examDateRaw).toBe('20/12/2026');
    expect(ref.current?.canProceed).toBe(true);
  });

  test('permite voltar do Passo 2 para o Passo 1', () => {
    const ref: { current: ReturnType<typeof useOnboarding> | null } = { current: null };
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<OnboardingTestWrapper db={db} onboardingRef={ref} />);
    });

    const root = renderer.root;

    // Passo 1 -> Passo 2
    const continueBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.continueAction
    );
    act(() => {
      continueBtn?.props.onPress();
    });
    expect(ref.current?.step).toBe(2);

    // Clica em Voltar
    const backBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.backAction
    );
    expect(backBtn).toBeDefined();

    act(() => {
      backBtn?.props.onPress();
    });
    expect(ref.current?.step).toBe(1);
  });

  test('navega até o Passo 3, escolhe tema e conclui o onboarding', () => {
    const ref: { current: ReturnType<typeof useOnboarding> | null } = { current: null };
    const finishCallback = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <OnboardingTestWrapper db={db} onboardingRef={ref} onFinish={finishCallback} />
      );
    });

    const root = renderer.root;

    // Passo 1: Seleciona Concursos
    const concursosBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.step1.areas.concursos.title
    );
    act(() => {
      concursosBtn?.props.onPress();
    });

    // Avança para Passo 2
    let continueBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.continueAction
    );
    act(() => {
      continueBtn?.props.onPress();
    });
    expect(ref.current?.step).toBe(2);

    // Avança para Passo 3 (sem data)
    continueBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.continueAction
    );
    act(() => {
      continueBtn?.props.onPress();
    });
    expect(ref.current?.step).toBe(3);

    // Escolhe tema Escuro (Noctis Obscuro)
    const darkThemeBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.step3.themeOptions.dark.title
    );
    expect(darkThemeBtn).toBeDefined();

    act(() => {
      darkThemeBtn?.props.onPress();
    });
    expect(ref.current?.theme).toBe('dark');

    // Botão final: Começar a estudar
    const finishBtn = root.findAllByType(TouchableOpacity).find((btn) =>
      btn.props.accessibilityLabel === strings.onboarding.finishAction
    );
    expect(finishBtn).toBeDefined();

    act(() => {
      finishBtn?.props.onPress();
    });

    expect(finishCallback).toHaveBeenCalled();
    expect(settingsRepo.get('onboardingCompleted')).toBe(true);
    expect(settingsRepo.get('userArea')).toBe('concursos');
    expect(decksRepo.listAll()).toHaveLength(1);
  });
});
