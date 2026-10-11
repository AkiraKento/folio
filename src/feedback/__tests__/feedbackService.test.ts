import {
  DEFAULT_FEEDBACK_EMAIL,
  DEFAULT_FEEDBACK_FORM_URL,
  buildFeedbackEmail,
  formatPlatformInfo,
  sendFeedbackEmail,
  openFeedbackForm,
  getAppVersionInfo,
} from '../feedbackService';

describe('src/feedback/feedbackService.ts', () => {
  it('DEFAULT_FEEDBACK_EMAIL está definido com endereço de contato válido', () => {
    expect(DEFAULT_FEEDBACK_EMAIL).toBe('akiraidehara@outlook.com');
  });

  it('formatPlatformInfo formata corretamente o sistema operacional e versão', () => {
    expect(formatPlatformInfo('android', '34')).toBe('Android 34');
    expect(formatPlatformInfo('ios', '17.2')).toBe('iOS 17.2');
    expect(formatPlatformInfo('web')).toBe('Web');
  });

  it('buildFeedbackEmail cria URL mailto contendo versão e plataforma, sem dados de estudo', () => {
    const emailData = buildFeedbackEmail({
      appVersion: '0.1.0',
      osName: 'android',
      osVersion: '34',
    });

    expect(emailData.recipient).toBe(DEFAULT_FEEDBACK_EMAIL);
    expect(emailData.subject).toContain('Weiss');
    expect(emailData.subject).toContain('0.1.0');
    expect(emailData.body).toContain('App: Weiss v0.1.0');
    expect(emailData.body).toContain('Plataforma: Android 34');
    expect(emailData.body).toContain('Nenhum dado de estudo ou card foi incluído');

    // Confirma que NÃO há nenhum dado de estudo nos dados gerados
    expect(emailData.body).not.toContain('deck_id');
    expect(emailData.body).not.toContain('card_id');
    expect(emailData.body).not.toContain('stability');
    expect(emailData.body).not.toContain('difficulty');
    expect(emailData.body).not.toContain('review_logs');

    // Verifica montagem da URL mailto
    expect(emailData.mailtoUrl).toMatch(/^mailto:akiraidehara%40outlook\.com\?|^mailto:akiraidehara@outlook\.com\?/);
    expect(emailData.mailtoUrl).toContain(encodeURIComponent(emailData.subject));
  });

  it('permite sobrescrever o e-mail de destino no buildFeedbackEmail', () => {
    const customRecipient = 'contato@folioapp.com';
    const emailData = buildFeedbackEmail({
      appVersion: '0.1.0',
      recipient: customRecipient,
    });

    expect(emailData.recipient).toBe(customRecipient);
    expect(emailData.mailtoUrl).toContain(encodeURIComponent(customRecipient));
  });

  it('sendFeedbackEmail chama a função openUrl com a URL mailto gerada', async () => {
    const openUrlMock = jest.fn().mockResolvedValue(true);

    const result = await sendFeedbackEmail({
      appVersion: '0.1.0',
      osName: 'android',
      osVersion: '34',
      openUrl: openUrlMock,
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('email');
    expect(openUrlMock).toHaveBeenCalledTimes(1);
    expect(openUrlMock).toHaveBeenCalledWith(expect.stringMatching(/^mailto:/));
  });

  it('sendFeedbackEmail retorna erro amigável se openUrl falhar', async () => {
    const openUrlMock = jest.fn().mockRejectedValue(new Error('No email client installed'));

    const result = await sendFeedbackEmail({
      appVersion: '0.1.0',
      openUrl: openUrlMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No email client installed');
    expect(result.emailData).toBeDefined();
    expect(result.emailData?.recipient).toBe(DEFAULT_FEEDBACK_EMAIL);
  });

  it('openFeedbackForm abre a URL do formulário web via openUrl', async () => {
    const openUrlMock = jest.fn().mockResolvedValue(true);

    const result = await openFeedbackForm({
      url: DEFAULT_FEEDBACK_FORM_URL,
      openUrl: openUrlMock,
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('form');
    expect(openUrlMock).toHaveBeenCalledWith(DEFAULT_FEEDBACK_FORM_URL);
  });

  it('getAppVersionInfo retorna dados coerentes de versão e SO', () => {
    const info = getAppVersionInfo();
    expect(info.appVersion).toBeDefined();
    expect(typeof info.appVersion).toBe('string');
    expect(info.osName).toBeDefined();
    expect(info.formattedPlatform).toBeDefined();
  });
});
