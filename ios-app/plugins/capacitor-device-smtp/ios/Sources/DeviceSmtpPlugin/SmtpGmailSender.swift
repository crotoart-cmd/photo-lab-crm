import Foundation
import Security
import CocoaAsyncSocket

enum SmtpError: LocalizedError {
    case connectFailed(String)
    case timeout(String)
    case commandFailed(String)
    case tlsFailed(String)

    var errorDescription: String? {
        switch self {
        case .connectFailed(let m): return m
        case .timeout(let m): return m
        case .commandFailed(let m): return m
        case .tlsFailed(let m): return m
        }
    }
}

final class SmtpGmailSender: NSObject, GCDAsyncSocketDelegate {
    private var socket: GCDAsyncSocket!
    private var buffer = ""
    private let queue = DispatchQueue(label: "com.nuocleo.smtp")
    private var done: CheckedContinuation<Void, Error>?

    private var user = ""
    private var pass = ""
    private var fromEmail = ""
    private var fromName = "Nước Lèo"
    private var toEmail = ""
    private var bccEmail = ""
    private var subject = ""
    private var htmlBody = ""

    private enum Phase: CustomStringConvertible {
        case waitTls
        case waitGreeting
        case waitEhlo
        case waitAuthLogin
        case waitAuthUser
        case waitAuthPass
        case waitMailFrom
        case waitRcpt
        case waitRcptBcc
        case waitData
        case waitDataEnd
        case waitQuit
        case finished

        var description: String {
            switch self {
            case .waitTls: return "TLS"
            case .waitGreeting: return "greeting"
            case .waitEhlo: return "EHLO"
            case .waitAuthLogin: return "AUTH"
            case .waitAuthUser: return "user"
            case .waitAuthPass: return "password"
            case .waitMailFrom: return "MAIL FROM"
            case .waitRcpt: return "RCPT TO"
            case .waitRcptBcc: return "RCPT BCC"
            case .waitData: return "DATA"
            case .waitDataEnd: return "body"
            case .waitQuit: return "QUIT"
            case .finished: return "done"
            }
        }
    }

    private var phase = Phase.waitTls

    private var readTimeout: TimeInterval {
        switch phase {
        case .waitDataEnd: return 60
        default: return 30
        }
    }

    func send(
        user: String,
        pass: String,
        fromEmail: String,
        fromName: String,
        to: String,
        subject: String,
        html: String
    ) async throws {
        self.user = user
        self.pass = pass
        self.fromEmail = fromEmail
        self.fromName = fromName.isEmpty ? "Nước Lèo" : fromName
        self.toEmail = to
        self.bccEmail = fromEmail.lowercased() != to.lowercased() ? fromEmail : ""
        self.subject = subject
        self.htmlBody = html
        self.phase = .waitTls
        self.buffer = ""

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.done = cont
            self.socket = GCDAsyncSocket(delegate: self, delegateQueue: self.queue)
            do {
                // Gmail SSL — ổn định hơn STARTTLS 587 trên mạng di động
                try self.socket.connect(toHost: "smtp.gmail.com", onPort: 465, withTimeout: 15)
            } catch {
                cont.resume(throwing: SmtpError.connectFailed(error.localizedDescription))
                self.done = nil
            }
        }
    }

    private func succeed() {
        done?.resume()
        done = nil
    }

    private func fail(_ error: Error) {
        done?.resume(throwing: error)
        done = nil
        socket?.disconnect()
    }

    private func scheduleRead() {
        socket.readData(withTimeout: readTimeout, tag: 0)
    }

    private func sendLine(_ line: String) {
        guard let data = line.data(using: .utf8) else { return }
        socket.write(data, withTimeout: readTimeout, tag: 0)
    }

    private func drainResponses() {
        while let range = buffer.range(of: "\r\n") {
            let line = String(buffer[..<range.lowerBound])
            buffer = String(buffer[range.upperBound...])
            guard line.count >= 3, let code = Int(line.prefix(3)) else { continue }
            if line.count > 3 && line[line.index(line.startIndex, offsetBy: 3)] == "-" {
                continue
            }
            onSmtpLine(code: code, line: line)
            return
        }
    }

    private func onSmtpLine(code: Int, line: String) {
        guard done != nil else { return }

        switch phase {
        case .waitGreeting:
            guard code == 220 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitEhlo
            sendLine("EHLO nuocleo.local\r\n")

        case .waitEhlo:
            guard code == 250 else { fail(SmtpError.commandFailed(line)); return }
            if line.count > 3 && line[line.index(line.startIndex, offsetBy: 3)] == "-" { return }
            phase = .waitAuthLogin
            sendLine("AUTH LOGIN\r\n")

        case .waitAuthLogin:
            guard code == 334 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitAuthUser
            sendLine("\(Data(user.utf8).base64EncodedString())\r\n")

        case .waitAuthUser:
            guard code == 334 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitAuthPass
            sendLine("\(Data(pass.utf8).base64EncodedString())\r\n")

        case .waitAuthPass:
            guard code == 235 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitMailFrom
            sendLine("MAIL FROM:<\(fromEmail)>\r\n")

        case .waitMailFrom:
            guard code == 250 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitRcpt
            sendLine("RCPT TO:<\(toEmail)>\r\n")

        case .waitRcpt:
            guard code == 250 else { fail(SmtpError.commandFailed(line)); return }
            if !bccEmail.isEmpty {
                phase = .waitRcptBcc
                sendLine("RCPT TO:<\(bccEmail)>\r\n")
            } else {
                phase = .waitData
                sendLine("DATA\r\n")
            }

        case .waitRcptBcc:
            guard code == 250 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitData
            sendLine("DATA\r\n")

        case .waitData:
            guard code == 354 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitDataEnd
            sendLine(buildMessage())

        case .waitDataEnd:
            guard code == 250 else { fail(SmtpError.commandFailed(line)); return }
            phase = .waitQuit
            sendLine("QUIT\r\n")

        case .waitQuit:
            guard code == 221 else { fail(SmtpError.commandFailed(line)); return }
            phase = .finished
            succeed()
            socket.disconnect()

        case .waitTls, .finished:
            break
        }
    }

    private func buildMessage() -> String {
        let encodedSubject = mimeEncodedWord(subject)
        let htmlB64 = Data(htmlBody.utf8)
            .base64EncodedString()
            .chunked(every: 76)
            .joined(separator: "\r\n")

        let fromHeader: String
        if fromName.allSatisfy({ $0.isASCII }) && !fromName.contains("\"") {
            fromHeader = "From: \(fromName) <\(fromEmail)>"
        } else {
            fromHeader = "From: =?UTF-8?B?\(Data(fromName.utf8).base64EncodedString())?= <\(fromEmail)>"
        }

        var headers = [
            fromHeader,
            "To: <\(toEmail)>",
        ]
        if !bccEmail.isEmpty {
            headers.append("Bcc: <\(bccEmail)>")
        }
        headers += [
            "Subject: \(encodedSubject)",
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "",
            htmlB64,
        ]
        let lines = headers
        let body = dotStuffLines(lines.joined(separator: "\r\n"))
        return body + "\r\n.\r\n"
    }

    private func dotStuffLines(_ text: String) -> String {
        text
            .components(separatedBy: "\r\n")
            .map { line in (line.hasPrefix(".") ? ".\(line)" : line) }
            .joined(separator: "\r\n")
    }

    private func mimeEncodedWord(_ text: String) -> String {
        guard let data = text.data(using: .utf8) else { return text }
        if text.allSatisfy({ $0.isASCII }) { return text }
        return "=?UTF-8?B?\(data.base64EncodedString())?="
    }

    // MARK: - GCDAsyncSocketDelegate

    func socket(_ sock: GCDAsyncSocket, didConnectToHost host: String, port: UInt16) {
        let settings: [String: NSObject] = [
            kCFStreamSSLPeerName as String: "smtp.gmail.com" as NSObject
        ]
        do {
            try sock.startTLS(settings)
        } catch {
            fail(SmtpError.tlsFailed(error.localizedDescription))
        }
    }

    func socket(_ sock: GCDAsyncSocket, didRead data: Data, withTag tag: Int) {
        if let chunk = String(data: data, encoding: .utf8) {
            buffer += chunk
            drainResponses()
        }
        if done != nil {
            scheduleRead()
        }
    }

    func socketDidSecure(_ sock: GCDAsyncSocket) {
        phase = .waitGreeting
        scheduleRead()
    }

    func socket(_ sock: GCDAsyncSocket, didReceive trust: SecTrust, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(SecTrustEvaluateWithError(trust, nil))
    }

    func socket(_ sock: GCDAsyncSocket, shouldTimeoutReadWithTag tag: Int, elapsed: TimeInterval, bytesDone: UInt) -> TimeInterval {
        fail(SmtpError.timeout("Gmail không phản hồi ở bước \(phase.description)"))
        return 0
    }

    func socket(_ sock: GCDAsyncSocket, shouldTimeoutWriteWithTag tag: Int, elapsed: TimeInterval, bytesDone: UInt) -> TimeInterval {
        fail(SmtpError.timeout("Gửi SMTP quá lâu ở bước \(phase.description)"))
        return 0
    }

    func socketDidDisconnect(_ sock: GCDAsyncSocket, withError err: Error?) {
        guard let cont = done else { return }
        if phase == .finished { return }
        if let err = err {
            let msg = err.localizedDescription
            if msg.localizedCaseInsensitiveContains("timed out") {
                cont.resume(throwing: SmtpError.timeout("Gmail không phản hồi — kiểm tra 4G/Wi‑Fi"))
            } else {
                cont.resume(throwing: SmtpError.connectFailed(msg))
            }
        } else {
            cont.resume(throwing: SmtpError.connectFailed("Mất kết nối SMTP"))
        }
        done = nil
    }
}

private extension String {
    func chunked(every size: Int) -> [String] {
        guard size > 0, !isEmpty else { return isEmpty ? [] : [self] }
        var result: [String] = []
        var start = startIndex
        while start < endIndex {
            let end = index(start, offsetBy: size, limitedBy: endIndex) ?? endIndex
            result.append(String(self[start..<end]))
            start = end
        }
        return result
    }
}
