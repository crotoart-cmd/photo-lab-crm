export interface DeviceSmtpPlugin {
  isConfigured(): Promise<{ configured: boolean; email?: string }>;
  saveCredentials(options: { email: string; appPassword: string }): Promise<{ ok: boolean }>;
  clearCredentials(): Promise<{ ok: boolean }>;
  verify(): Promise<{ ok: boolean; message: string }>;
  sendMail(options: {
    to: string;
    subject: string;
    html: string;
    fromName?: string;
  }): Promise<{ sent: boolean; error?: string }>;
}

export const DeviceSmtp: DeviceSmtpPlugin;
