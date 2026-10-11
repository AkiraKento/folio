import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ReminderTimePickerModal } from '../ReminderTimePickerModal';
import { strings } from '../strings';

describe('ReminderTimePickerModal', () => {
  it('renderiza quando visível com o horário atual', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReminderTimePickerModal
          visible={true}
          currentTime="20:00"
          onSave={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text' as unknown as React.ComponentType);
    const allTexts = textNodes.map((n) => n.props.children).flat().join(' ');

    expect(allTexts).toContain(strings.reminder.modalTitle);
    expect(allTexts).toContain('20');
    expect(allTexts).toContain('00');
    expect(allTexts).toContain(strings.reminder.saveTime);
    expect(allTexts).toContain(strings.reminder.cancel);
  });

  it('permite ajustar a hora pelos botões de incremento e decremento', () => {
    const onSave = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ReminderTimePickerModal
          visible={true}
          currentTime="20:00"
          onSave={onSave}
          onClose={jest.fn()}
        />
      );
    });

    const root = renderer.root;
    const incHour = root.findByProps({ accessibilityLabel: 'Aumentar hora' });

    act(() => {
      incHour.props.onPress();
    });

    const saveButton = root.findByProps({ accessibilityLabel: strings.reminder.saveTime });
    act(() => {
      saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith('21:00');
  });

  it('permite aplicar um horário sugerido (preset)', () => {
    const onSave = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ReminderTimePickerModal
          visible={true}
          currentTime="20:00"
          onSave={onSave}
          onClose={jest.fn()}
        />
      );
    });

    const root = renderer.root;
    const presetBadge = root.findByProps({ accessibilityLabel: 'Selecionar horário 07:00' });

    act(() => {
      presetBadge.props.onPress();
    });

    const saveButton = root.findByProps({ accessibilityLabel: strings.reminder.saveTime });
    act(() => {
      saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith('07:00');
  });

  it('chama onClose ao cancelar sem salvar', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ReminderTimePickerModal
          visible={true}
          currentTime="20:00"
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    const cancelButton = renderer.root.findByProps({ accessibilityLabel: strings.reminder.cancel });
    act(() => {
      cancelButton.props.onPress();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
