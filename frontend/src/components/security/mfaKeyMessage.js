const NAME = 'MFA_ENCRYPTION_KEY';

/** Explains in Vietnamese why the server cannot use its 2FA key. It only ever sees a category, a length and variable names. */
export function mfaKeyMessage(status) {
  const names = Array.isArray(status?.keyNames) ? status.keyNames : [];
  switch (status?.keyProblem) {
    case 'missing':
      return names.length
        ? `Máy chủ không thấy biến ${NAME}, nhưng có biến tên gần giống: ${names.map((name) => JSON.stringify(name)).join(', ')}. Hãy đặt đúng tên ${NAME}, lưu rồi triển khai lại.`
        : `Máy chủ chưa có biến ${NAME}. Hãy thêm biến này trên Hostinger, lưu rồi triển khai lại.`;
    case 'not_hex':
      return `Biến ${NAME} có ký tự không hợp lệ: chỉ được dùng 0-9 và a-f. Hãy dán lại khóa, lưu rồi triển khai lại.`;
    case 'length':
      return `Biến ${NAME} có ${status.keyLength} ký tự, cần đúng 64. Hãy dán lại khóa, lưu rồi triển khai lại.`;
    default:
      return 'Máy chủ chưa cấu hình khóa mã hóa 2FA.';
  }
}
