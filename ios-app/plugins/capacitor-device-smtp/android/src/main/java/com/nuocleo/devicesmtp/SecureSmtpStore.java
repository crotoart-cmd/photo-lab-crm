package com.nuocleo.devicesmtp;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKeys;

/**
 * Lưu Gmail + App Password trên máy — tương đương Keychain iOS.
 */
final class SecureSmtpStore {
  private static final String PREFS = "nuocleo_device_smtp";
  private static final String KEY_EMAIL = "smtp_email";
  private static final String KEY_PASSWORD = "smtp_app_password";

  private final SharedPreferences prefs;

  SecureSmtpStore(Context context) throws Exception {
    String masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC);
    prefs =
        EncryptedSharedPreferences.create(
            PREFS,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
  }

  void save(String email, String appPassword) {
    prefs.edit().putString(KEY_EMAIL, email).putString(KEY_PASSWORD, appPassword).apply();
  }

  void clear() {
    prefs.edit().remove(KEY_EMAIL).remove(KEY_PASSWORD).apply();
  }

  String loadEmail() {
    return prefs.getString(KEY_EMAIL, null);
  }

  String loadPassword() {
    return prefs.getString(KEY_PASSWORD, null);
  }

  boolean isConfigured() {
    String email = loadEmail();
    String pass = loadPassword();
    return email != null && !email.isEmpty() && pass != null && !pass.isEmpty();
  }
}
