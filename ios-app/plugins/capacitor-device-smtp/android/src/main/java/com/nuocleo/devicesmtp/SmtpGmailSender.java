package com.nuocleo.devicesmtp;

import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * Gửi HTML qua Gmail SMTP SSL :465 — bám quy trình iOS (GCDAsyncSocket).
 */
final class SmtpGmailSender {
  private static final String TAG = "NuocLeoSmtp";
  private static final String HOST = "smtp.gmail.com";
  private static final int PORT = 465;
  private static final int CONNECT_TIMEOUT_MS = 20000;
  private static final int IO_TIMEOUT_MS = 45000;

  void send(
      String user,
      String pass,
      String fromEmail,
      String fromName,
      String to,
      String subject,
      String html)
      throws Exception {
    Exception last = null;

    // 1) Hostname trực tiếp (DNS hệ thống) — giống iOS
    try {
      sendViaHost(HOST, user, pass, fromEmail, fromName, to, subject, html);
      return;
    } catch (Exception e) {
      Log.w(TAG, "hostname path failed", e);
      last = e;
    }

    // 2) Fallback IP (DNS custom) + SNI
    InetAddress[] addrs = DnsResolver.resolve(HOST);
    for (InetAddress a : ipv4First(addrs)) {
      try {
        sendViaAddress(a, user, pass, fromEmail, fromName, to, subject, html);
        return;
      } catch (Exception e) {
        Log.w(TAG, "ip path failed " + a, e);
        last = e;
      }
    }
    throw last != null ? last : new Exception("SMTP thất bại");
  }

  private void sendViaHost(
      String host,
      String user,
      String pass,
      String fromEmail,
      String fromName,
      String to,
      String subject,
      String html)
      throws Exception {
    InetAddress[] addrs = InetAddress.getAllByName(host);
    List<InetAddress> ordered = ipv4First(addrs);
    if (ordered.isEmpty()) throw new Exception("Không resolve IPv4 cho " + host);
    Exception last = null;
    for (InetAddress a : ordered) {
      if (!(a instanceof java.net.Inet4Address)) continue;
      try {
        sendViaAddress(a, user, pass, fromEmail, fromName, to, subject, html);
        return;
      } catch (Exception e) {
        Log.w(TAG, "host/ipv4 failed " + a.getHostAddress(), e);
        last = e;
      }
    }
    throw last != null ? last : new Exception("SMTP hostname/IPv4 thất bại");
  }

  private void sendViaAddress(
      InetAddress address,
      String user,
      String pass,
      String fromEmail,
      String fromName,
      String to,
      String subject,
      String html)
      throws Exception {
    Socket raw = new Socket();
    raw.connect(new InetSocketAddress(address, PORT), CONNECT_TIMEOUT_MS);
    raw.setSoTimeout(IO_TIMEOUT_MS);
    SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
    SSLSocket ssl = (SSLSocket) factory.createSocket(raw, HOST, PORT, true);
    applySni(ssl);
    ssl.setUseClientMode(true);
    ssl.startHandshake();
    try {
      runSmtp(ssl, user, pass, fromEmail, fromName, to, subject, html);
    } finally {
      try {
        ssl.close();
      } catch (Exception ignored) {
      }
    }
  }

  private static void applySni(SSLSocket socket) {
    if (android.os.Build.VERSION.SDK_INT >= 24) {
      javax.net.ssl.SSLParameters params = socket.getSSLParameters();
      params.setServerNames(
          java.util.Collections.singletonList(new javax.net.ssl.SNIHostName(HOST)));
      socket.setSSLParameters(params);
    }
  }

  private void runSmtp(
      SSLSocket socket,
      String user,
      String pass,
      String fromEmail,
      String fromName,
      String to,
      String subject,
      String html)
      throws Exception {
    InputStream in = socket.getInputStream();
    OutputStream out = socket.getOutputStream();
    String step = "banner";
    try {
      expectCode(in, 220, step);
      step = "ehlo";
      writeLine(out, "EHLO nuocleo.local");
      expectCode(in, 250, step);
      step = "auth-login";
      writeLine(out, "AUTH LOGIN");
      expectCode(in, 334, step);
      step = "auth-user";
      writeLine(out, Base64.getEncoder().encodeToString(user.getBytes(StandardCharsets.UTF_8)));
      expectCode(in, 334, step);
      step = "auth-pass";
      writeLine(out, Base64.getEncoder().encodeToString(pass.getBytes(StandardCharsets.UTF_8)));
      expectCode(in, 235, step);
      step = "mail-from";
      writeLine(out, "MAIL FROM:<" + fromEmail + ">");
      expectCode(in, 250, step);
      step = "rcpt-to";
      writeLine(out, "RCPT TO:<" + to + ">");
      expectCode(in, 250, step);
      if (!fromEmail.equalsIgnoreCase(to)) {
        step = "rcpt-bcc";
        writeLine(out, "RCPT TO:<" + fromEmail + ">");
        expectCode(in, 250, step);
      }
      step = "data";
      writeLine(out, "DATA");
      expectCode(in, 354, step);
      step = "body";
      writeRaw(out, buildMime(fromEmail, fromName, to, subject, html));
      writeLine(out, ".");
      expectCode(in, 250, step);
      step = "quit";
      writeLine(out, "QUIT");
      try {
        expectCode(in, 221, step);
      } catch (Exception ignored) {
      }
    } catch (Exception e) {
      throw new Exception(step + " — " + e.getMessage(), e);
    }
  }

  private static List<InetAddress> ipv4First(InetAddress[] addrs) {
    List<InetAddress> ordered = new ArrayList<>();
    for (InetAddress a : addrs) {
      if (a instanceof java.net.Inet4Address) ordered.add(a);
    }
    for (InetAddress a : addrs) {
      if (!(a instanceof java.net.Inet4Address)) ordered.add(a);
    }
    return ordered;
  }

  private static String buildMime(
      String fromEmail, String fromName, String to, String subject, String html) {
    String safeName = fromName == null || fromName.isEmpty() ? "Nước Lèo" : fromName;
    StringBuilder sb = new StringBuilder();
    sb.append("From: ").append(encodeHeader(safeName)).append(" <").append(fromEmail).append(">\r\n");
    sb.append("To: <").append(to).append(">\r\n");
    if (!fromEmail.equalsIgnoreCase(to)) {
      sb.append("Bcc: <").append(fromEmail).append(">\r\n");
    }
    sb.append("Subject: ").append(encodeHeader(subject)).append("\r\n");
    sb.append("MIME-Version: 1.0\r\n");
    sb.append("Content-Type: text/html; charset=UTF-8\r\n");
    sb.append("Content-Transfer-Encoding: base64\r\n");
    sb.append("\r\n");
    String b64 =
        Base64.getMimeEncoder(76, "\r\n".getBytes(StandardCharsets.UTF_8))
            .encodeToString(html.getBytes(StandardCharsets.UTF_8));
    sb.append(b64).append("\r\n");
    return sb.toString();
  }

  private static String encodeHeader(String value) {
    boolean ascii = true;
    for (int i = 0; i < value.length(); i++) {
      if (value.charAt(i) > 127) {
        ascii = false;
        break;
      }
    }
    if (ascii) return value;
    return "=?UTF-8?B?"
        + Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8))
        + "?=";
  }

  private static void writeLine(OutputStream out, String line) throws Exception {
    Log.d(TAG, ">> " + (line.startsWith("AUTH") || line.length() > 80 ? line.substring(0, Math.min(12, line.length())) + "…" : line));
    out.write((line + "\r\n").getBytes(StandardCharsets.UTF_8));
    out.flush();
  }

  private static void writeRaw(OutputStream out, String data) throws Exception {
    String[] lines = data.split("\r\n", -1);
    StringBuilder stuffed = new StringBuilder();
    for (int i = 0; i < lines.length; i++) {
      String line = lines[i];
      if (line.startsWith(".")) stuffed.append('.').append(line);
      else stuffed.append(line);
      if (i < lines.length - 1) stuffed.append("\r\n");
    }
    if (!data.endsWith("\r\n")) stuffed.append("\r\n");
    out.write(stuffed.toString().getBytes(StandardCharsets.UTF_8));
    out.flush();
  }

  /** Đọc đủ response SMTP (kể cả multi-line 250-...). */
  private static void expectCode(InputStream in, int code, String step) throws Exception {
    String last = null;
    while (true) {
      String line = readLine(in);
      if (line == null) throw new Exception("SMTP đóng kết nối ở " + step + " (chờ " + code + ")");
      Log.d(TAG, "<< " + line);
      last = line;
      if (line.length() < 3) continue;
      int got;
      try {
        got = Integer.parseInt(line.substring(0, 3));
      } catch (NumberFormatException e) {
        continue;
      }
      boolean cont = line.length() >= 4 && line.charAt(3) == '-';
      if (!cont) {
        if (got != code) throw new Exception(line);
        return;
      }
      // multi-line: tiếp tục đọc đến dòng kết thúc
      if (got != code) throw new Exception(line);
    }
  }

  private static String readLine(InputStream in) throws Exception {
    ByteArrayOutputStream buf = new ByteArrayOutputStream();
    int prev = -1;
    while (true) {
      int b = in.read();
      if (b < 0) {
        if (buf.size() == 0) return null;
        break;
      }
      if (prev == '\r' && b == '\n') break;
      if (b != '\r') buf.write(b);
      prev = b;
      if (buf.size() > 8192) throw new Exception("SMTP line quá dài");
    }
    return buf.toString(StandardCharsets.UTF_8.name());
  }
}
