import Foundation
import Capacitor

@objc(DeviceSmtpPlugin)
public class DeviceSmtpPlugin: CAPPlugin {
    @objc func isConfigured(_ call: CAPPluginCall) {
        let email = KeychainHelper.loadEmail()
        call.resolve([
            "configured": KeychainHelper.isConfigured,
            "email": email ?? NSNull()
        ])
    }

    @objc func saveCredentials(_ call: CAPPluginCall) {
        guard let email = call.getString("email")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !email.isEmpty,
              let appPassword = call.getString("appPassword")?.replacingOccurrences(of: " ", with: ""),
              appPassword.count >= 16 else {
            call.reject("Cần email Gmail và App Password 16 ký tự")
            return
        }
        do {
            try KeychainHelper.save(email: email, appPassword: appPassword)
            call.resolve(["ok": true])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func clearCredentials(_ call: CAPPluginCall) {
        KeychainHelper.clear()
        call.resolve(["ok": true])
    }

    @objc func verify(_ call: CAPPluginCall) {
        guard let email = KeychainHelper.loadEmail(),
              let pass = KeychainHelper.loadPassword() else {
            call.reject("Chưa cấu hình SMTP trên máy")
            return
        }
        Task {
            do {
                let sender = SmtpGmailSender()
                try await sender.send(
                    user: email,
                    pass: pass,
                    fromEmail: email,
                    fromName: "Nước Lèo",
                    to: email,
                    subject: "Kiểm tra gửi email — Nước Lèo CRM",
                    html: "<p>SMTP Gmail trên iPhone hoạt động.</p>"
                )
                await MainActor.run {
                    call.resolve(["ok": true, "message": "Đã gửi email thử tới \(email)"])
                }
            } catch {
                await MainActor.run {
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func sendMail(_ call: CAPPluginCall) {
        guard let to = call.getString("to")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !to.isEmpty,
              let subject = call.getString("subject"),
              let html = call.getString("html") else {
            call.reject("Thiếu to / subject / html")
            return
        }
        guard let email = KeychainHelper.loadEmail(),
              let pass = KeychainHelper.loadPassword() else {
            call.reject("Chưa cấu hình SMTP trên máy")
            return
        }
        let fromName = call.getString("fromName") ?? "Nước Lèo"
        Task {
            do {
                let sender = SmtpGmailSender()
                try await sender.send(
                    user: email,
                    pass: pass,
                    fromEmail: email,
                    fromName: fromName,
                    to: to,
                    subject: subject,
                    html: html
                )
                await MainActor.run {
                    call.resolve(["sent": true, "to": to])
                }
            } catch {
                await MainActor.run {
                    call.resolve(["sent": false, "error": error.localizedDescription])
                }
            }
        }
    }
}
