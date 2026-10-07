package com.nuocleo.devicesmtp;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * SMTP Gmail từ thiết bị Android (Y700) — lưu App Password trên máy, không cần Mac.
 */
@CapacitorPlugin(name = "DeviceSmtp")
public class DeviceSmtpPlugin extends Plugin {
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());
  private SecureSmtpStore store;

  private SecureSmtpStore store() throws Exception {
    if (store == null) {
      store = new SecureSmtpStore(getContext());
    }
    return store;
  }

  @PluginMethod
  public void isConfigured(PluginCall call) {
    try {
      SecureSmtpStore s = store();
      JSObject ret = new JSObject();
      ret.put("configured", s.isConfigured());
      String email = s.loadEmail();
      if (email != null) ret.put("email", email);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() != null ? e.getMessage() : "Không đọc được cấu hình SMTP");
    }
  }

  @PluginMethod
  public void saveCredentials(PluginCall call) {
    String email = call.getString("email", "").trim();
    String appPassword = call.getString("appPassword", "").replace(" ", "");
    if (email.isEmpty() || appPassword.length() < 16) {
      call.reject("Cần email Gmail và App Password 16 ký tự");
      return;
    }
    try {
      store().save(email, appPassword);
      JSObject ret = new JSObject();
      ret.put("ok", true);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() != null ? e.getMessage() : "Lưu SMTP thất bại");
    }
  }

  @PluginMethod
  public void clearCredentials(PluginCall call) {
    try {
      store().clear();
      JSObject ret = new JSObject();
      ret.put("ok", true);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() != null ? e.getMessage() : "Xóa SMTP thất bại");
    }
  }

  @PluginMethod
  public void verify(PluginCall call) {
    io.execute(
        () -> {
          try {
            SecureSmtpStore s = store();
            String email = s.loadEmail();
            String pass = s.loadPassword();
            if (email == null || pass == null) {
              rejectOnMain(call, "Chưa cấu hình SMTP trên máy");
              return;
            }
            new SmtpGmailSender()
                .send(
                    email,
                    pass,
                    email,
                    "Nước Lèo",
                    email,
                    "Kiểm tra gửi email — Nước Lèo CRM",
                    "<p>SMTP Gmail trên Android (Y700) hoạt động.</p>");
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("message", "Đã gửi email thử tới " + email);
            resolveOnMain(call, ret);
          } catch (Exception e) {
            rejectOnMain(call, e.getMessage() != null ? e.getMessage() : "Gửi thử thất bại");
          }
        });
  }

  @PluginMethod
  public void sendMail(PluginCall call) {
    String to = call.getString("to", "").trim();
    String subject = call.getString("subject");
    String html = call.getString("html");
    if (to.isEmpty() || subject == null || html == null) {
      call.reject("Thiếu to / subject / html");
      return;
    }
    String fromName = call.getString("fromName", "Nước Lèo");
    io.execute(
        () -> {
          try {
            SecureSmtpStore s = store();
            String email = s.loadEmail();
            String pass = s.loadPassword();
            if (email == null || pass == null) {
              JSObject ret = new JSObject();
              ret.put("sent", false);
              ret.put("error", "Chưa cấu hình SMTP trên máy");
              resolveOnMain(call, ret);
              return;
            }
            new SmtpGmailSender().send(email, pass, email, fromName, to, subject, html);
            JSObject ret = new JSObject();
            ret.put("sent", true);
            ret.put("to", to);
            resolveOnMain(call, ret);
          } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("sent", false);
            ret.put("error", formatError(e));
            resolveOnMain(call, ret);
          }
        });
  }

  private void resolveOnMain(PluginCall call, JSObject ret) {
    main.post(() -> call.resolve(ret));
  }

  private void rejectOnMain(PluginCall call, String message) {
    main.post(() -> call.reject(message));
  }

  private static String formatError(Throwable e) {
    StringBuilder sb = new StringBuilder();
    Throwable cur = e;
    int depth = 0;
    while (cur != null && depth < 4) {
      if (depth > 0) sb.append(" | ");
      sb.append(cur.getClass().getSimpleName());
      if (cur.getMessage() != null && !cur.getMessage().isEmpty()) {
        sb.append(": ").append(cur.getMessage());
      }
      cur = cur.getCause();
      depth++;
    }
    return sb.length() > 0 ? sb.toString() : "Gửi email thất bại";
  }
}
