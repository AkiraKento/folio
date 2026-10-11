import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { strings } from '@/ui/strings';

export const DEFAULT_FEEDBACK_EMAIL = 'akiraidehara@outlook.com';
export const DEFAULT_FEEDBACK_FORM_URL = 'https://forms.gle/FolioFeedback';

export interface AppVersionInfo {
  appVersion: string;
  osName: string;
  osVersion: string;
  formattedPlatform: string;
}

export function formatPlatformInfo(osName?: string, osVersion?: string | number): string {
  const os = osName ?? Platform.OS;
  const version = osVersion !== undefined ? String(osVersion) : String(Platform.Version ?? '');

  if (os === 'android') {
    return version ? `Android ${version}` : 'Android';
  }
  if (os === 'ios') {
    return version ? `iOS ${version}` : 'iOS';
  }
  if (os === 'web') {
    return 'Web';
  }
  return version ? `${os} ${version}` : os;
}

export function getAppVersionInfo(): AppVersionInfo {
  const appVersion =
    Constants.expoConfig?.version ??
    (Constants as { nativeAppVersion?: string }).nativeAppVersion ??
    '0.1.0';
  const osName = Platform.OS;
  const osVersion = String(Platform.Version ?? '');
  const formattedPlatform = formatPlatformInfo(osName, osVersion);

  return {
    appVersion,
    osName,
    osVersion,
    formattedPlatform,
  };
}

export interface BuildFeedbackEmailOptions {
  appVersion?: string;
  osName?: string;
  osVersion?: string | number;
  recipient?: string;
}

export interface FeedbackEmailData {
  recipient: string;
  subject: string;
  body: string;
  mailtoUrl: string;
}

export function buildFeedbackEmail(options: BuildFeedbackEmailOptions = {}): FeedbackEmailData {
  const versionInfo = getAppVersionInfo();
  const appVersion = options.appVersion ?? versionInfo.appVersion;
  const formattedPlatform = formatPlatformInfo(
    options.osName ?? versionInfo.osName,
    options.osVersion ?? versionInfo.osVersion
  );
  const recipient = options.recipient ?? DEFAULT_FEEDBACK_EMAIL;

  const subject = strings.feedback.emailSubject(appVersion);
  const body = strings.feedback.emailBodyTemplate(appVersion, formattedPlatform);

  const queryParams = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`,
  ].join('&');

  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?${queryParams}`;

  return {
    recipient,
    subject,
    body,
    mailtoUrl,
  };
}

export interface SendFeedbackEmailOptions extends BuildFeedbackEmailOptions {
  openUrl?: (url: string) => Promise<unknown>;
}

export interface FeedbackActionResult {
  success: boolean;
  method: 'email' | 'form';
  emailData?: FeedbackEmailData;
  error?: string;
}

export async function sendFeedbackEmail(
  options: SendFeedbackEmailOptions = {}
): Promise<FeedbackActionResult> {
  const emailData = buildFeedbackEmail(options);
  const openUrlFn = options.openUrl ?? ((url: string) => Linking.openURL(url));

  try {
    await openUrlFn(emailData.mailtoUrl);
    return {
      success: true,
      method: 'email',
      emailData,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      method: 'email',
      emailData,
      error: errorMessage,
    };
  }
}

export interface OpenFeedbackFormOptions {
  url?: string;
  openUrl?: (url: string) => Promise<unknown>;
}

export async function openFeedbackForm(
  options: OpenFeedbackFormOptions = {}
): Promise<FeedbackActionResult> {
  const url = options.url ?? DEFAULT_FEEDBACK_FORM_URL;
  const openUrlFn = options.openUrl ?? ((u: string) => Linking.openURL(u));

  try {
    await openUrlFn(url);
    return {
      success: true,
      method: 'form',
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      method: 'form',
      error: errorMessage,
    };
  }
}
