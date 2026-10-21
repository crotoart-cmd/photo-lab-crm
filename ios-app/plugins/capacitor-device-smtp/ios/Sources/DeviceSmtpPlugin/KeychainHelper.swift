import Foundation
import Security

enum KeychainHelper {
    private static let service = "com.hdtlabx.crm.device-smtp"
    private static let legacyService = "com.nuocleo.crm.device-smtp"
    private static let accountEmail = "smtp_email"
    private static let accountPassword = "smtp_app_password"

    static func save(email: String, appPassword: String) throws {
        try saveItem(service: service, account: accountEmail, value: email)
        try saveItem(service: service, account: accountPassword, value: appPassword)
        deleteItem(service: legacyService, account: accountEmail)
        deleteItem(service: legacyService, account: accountPassword)
    }

    static func clear() {
        deleteItem(service: service, account: accountEmail)
        deleteItem(service: service, account: accountPassword)
        deleteItem(service: legacyService, account: accountEmail)
        deleteItem(service: legacyService, account: accountPassword)
    }

    static func loadEmail() -> String? {
        if let value = loadItem(service: service, account: accountEmail) {
            return value
        }
        guard let legacy = loadItem(service: legacyService, account: accountEmail) else {
            return nil
        }
        if let pass = loadItem(service: legacyService, account: accountPassword) {
            try? save(email: legacy, appPassword: pass)
        }
        return legacy
    }

    static func loadPassword() -> String? {
        if let value = loadItem(service: service, account: accountPassword) {
            return value
        }
        guard let legacy = loadItem(service: legacyService, account: accountPassword) else {
            return nil
        }
        if let email = loadItem(service: legacyService, account: accountEmail) {
            try? save(email: email, appPassword: legacy)
        }
        return legacy
    }

    static var isConfigured: Bool {
        guard let email = loadEmail(), !email.isEmpty,
              let pass = loadPassword(), !pass.isEmpty else {
            return false
        }
        return true
    }

    private static func saveItem(service: String, account: String, value: String) throws {
        deleteItem(service: service, account: account)
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

    private static func loadItem(service: String, account: String) -> String? {
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

    private static func deleteItem(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
