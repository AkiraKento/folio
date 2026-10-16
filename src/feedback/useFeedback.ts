import { useState, useCallback, useMemo } from 'react';
import {
  getAppVersionInfo,
  buildFeedbackEmail,
  sendFeedbackEmail,
  openFeedbackForm,
  type AppVersionInfo,
  type FeedbackEmailData,
  type SendFeedbackEmailOptions,
  type OpenFeedbackFormOptions,
} from './feedbackService';
import { strings } from '@/ui/strings';
import { logError } from '@/logging';

export interface UseFeedbackOptions {
  recipient?: string;
  formUrl?: string;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  openUrl?: (url: string) => Promise<unknown>;
}

export interface UseFeedbackResult {
  versionInfo: AppVersionInfo;
  emailData: FeedbackEmailData;
  isOpening: boolean;
  sendEmail: (options?: SendFeedbackEmailOptions) => Promise<boolean>;
  openForm: (options?: OpenFeedbackFormOptions) => Promise<boolean>;
}

export function useFeedback(options: UseFeedbackOptions = {}): UseFeedbackResult {
  const [isOpening, setIsOpening] = useState(false);

  const versionInfo = useMemo(() => getAppVersionInfo(), []);

  const emailData = useMemo(
    () =>
      buildFeedbackEmail({
        recipient: options.recipient,
        appVersion: versionInfo.appVersion,
        osName: versionInfo.osName,
        osVersion: versionInfo.osVersion,
      }),
    [options.recipient, versionInfo]
  );

  const sendEmail = useCallback(
    async (sendOptions: SendFeedbackEmailOptions = {}): Promise<boolean> => {
      setIsOpening(true);
      try {
        const result = await sendFeedbackEmail({
          recipient: sendOptions.recipient ?? options.recipient,
          openUrl: sendOptions.openUrl ?? options.openUrl,
          appVersion: versionInfo.appVersion,
          osName: versionInfo.osName,
          osVersion: versionInfo.osVersion,
        });

        if (result.success) {
          options.onSuccess?.(strings.feedback.emailSuccessSnackbar);
          return true;
        } else {
          options.onError?.(strings.feedback.emailAppNotFound);
          return false;
        }
      } catch (err) {
        logError('UseFeedback', err, 'Falha ao abrir cliente de e-mail');
        options.onError?.(strings.feedback.errorOpening);
        return false;
      } finally {
        setIsOpening(false);
      }
    },
    [options, versionInfo]
  );

  const openForm = useCallback(
    async (formOptions: OpenFeedbackFormOptions = {}): Promise<boolean> => {
      setIsOpening(true);
      try {
        const result = await openFeedbackForm({
          url: formOptions.url ?? options.formUrl,
          openUrl: formOptions.openUrl ?? options.openUrl,
        });

        if (result.success) {
          options.onSuccess?.(strings.feedback.formSuccessSnackbar);
          return true;
        } else {
          options.onError?.(strings.feedback.errorOpening);
          return false;
        }
      } catch (err) {
        logError('UseFeedback', err, 'Falha ao abrir formulário web de feedback');
        options.onError?.(strings.feedback.errorOpening);
        return false;
      } finally {
        setIsOpening(false);
      }
    },
    [options]
  );

  return {
    versionInfo,
    emailData,
    isOpening,
    sendEmail,
    openForm,
  };
}
