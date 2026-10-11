import React, { act, useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useFeedback, type UseFeedbackOptions, type UseFeedbackResult } from '../useFeedback';
import * as feedbackService from '../feedbackService';
import { strings } from '@/ui/strings';

describe('src/feedback/useFeedback.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderHookHelper(
    options: UseFeedbackOptions,
    callback: (res: UseFeedbackResult) => void
  ) {
    function HookConsumer() {
      const res = useFeedback(options);
      useEffect(() => {
        callback(res);
      }, [res]);
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<HookConsumer />);
    });
    return renderer;
  }

  it('retorna informações de versão do aplicativo', () => {
    let hookResult!: UseFeedbackResult;
    renderHookHelper({}, (res) => {
      hookResult = res;
    });

    expect(hookResult.versionInfo).toBeDefined();
    expect(hookResult.versionInfo.appVersion).toBe('0.1.0');
    expect(hookResult.emailData.recipient).toBe(feedbackService.DEFAULT_FEEDBACK_EMAIL);
  });

  it('sendEmail aciona sendFeedbackEmail e notifica sucesso', async () => {
    const sendSpy = jest.spyOn(feedbackService, 'sendFeedbackEmail').mockResolvedValue({
      success: true,
      method: 'email',
    });
    const onSuccessMock = jest.fn();

    let hookResult!: UseFeedbackResult;
    renderHookHelper(
      {
        onSuccess: onSuccessMock,
      },
      (res) => {
        hookResult = res;
      }
    );

    let ok = false;
    await act(async () => {
      ok = await hookResult.sendEmail();
    });

    expect(ok).toBe(true);
    expect(sendSpy).toHaveBeenCalled();
    expect(onSuccessMock).toHaveBeenCalledWith(strings.feedback.emailSuccessSnackbar);

    sendSpy.mockRestore();
  });

  it('sendEmail trata erro quando o cliente de email falha e notifica erro/fallback', async () => {
    const sendSpy = jest.spyOn(feedbackService, 'sendFeedbackEmail').mockResolvedValue({
      success: false,
      method: 'email',
      error: 'No application can handle this request',
    });
    const onErrorMock = jest.fn();

    let hookResult!: UseFeedbackResult;
    renderHookHelper(
      {
        onError: onErrorMock,
      },
      (res) => {
        hookResult = res;
      }
    );

    let ok = true;
    await act(async () => {
      ok = await hookResult.sendEmail();
    });

    expect(ok).toBe(false);
    expect(sendSpy).toHaveBeenCalled();
    expect(onErrorMock).toHaveBeenCalledWith(strings.feedback.emailAppNotFound);

    sendSpy.mockRestore();
  });

  it('openForm aciona openFeedbackForm e notifica sucesso', async () => {
    const formSpy = jest.spyOn(feedbackService, 'openFeedbackForm').mockResolvedValue({
      success: true,
      method: 'form',
    });
    const onSuccessMock = jest.fn();

    let hookResult!: UseFeedbackResult;
    renderHookHelper(
      {
        onSuccess: onSuccessMock,
      },
      (res) => {
        hookResult = res;
      }
    );

    let ok = false;
    await act(async () => {
      ok = await hookResult.openForm();
    });

    expect(ok).toBe(true);
    expect(formSpy).toHaveBeenCalled();
    expect(onSuccessMock).toHaveBeenCalledWith(strings.feedback.formSuccessSnackbar);

    formSpy.mockRestore();
  });
});
