import Foundation
import Security

enum KeychainHelper {
    private static let service = "com.nuocleo.crm.device-smtp"
    private static let accountEmail = "smtp_email"
    private static let accountPassword = "smtp_app_password"

    static func save(email: String, appPassword: String) throws {
        try saveItem(account: accountEmail, value: email)
        try saveItem(account: accountPassword, value: appPassword)
    }

    static func clear() {
        deleteItem(account: accountEmail)
        deleteItem(account: accountPassword)
    }

    static func loadEmail() -> String? {
        loadItem(account: accountEmail)
    }

    static func loadPassword() -> String? {
        loadItem(account: accountPassword)
    }

    static var isConfigured: Bool {
        guard let email = loadEmail(), !email.isEmpty,
              let pass = loadPassword(), !pass.isEmpty else {
            return false
        }
        return true
    }

    private static func saveItem(account: String, value: String) throws {
        deleteItem(account: account)
        guard let data = value.data(using: .utf8) else {
            throw NSError(domain: "KeychainHelper", code: 1, userInfo: [NSLocalizedDescriptionKey: "UTF-8 encode failed"])
        }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "KeychainHelper", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain save failed (\(status))"])
        }
    }

    private static func loadItem(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func deleteItem(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
