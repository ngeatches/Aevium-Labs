// Phone normalization for sign-in. The first live version serves North American Numbering Plan
// numbers (+1: United States, Canada and other NANP regions) only, which keeps SMS cost and
// toll-fraud exposure bounded. Extend deliberately (with Twilio geo permissions) if other
// countries are approved.
export function normalizePhone(input) {
  if (typeof input !== 'string' || input.length > 32) return null;
  const trimmed = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, '');
  if (!trimmed.startsWith('+') && digits.length === 10) digits = '1' + digits;
  if (digits.length !== 11 || digits[0] !== '1') return null;
  const area = digits.slice(1, 4), exchange = digits.slice(4, 7);
  // NANP: area code and exchange begin with 2-9; N11 service codes are not subscriber numbers.
  if (!/^[2-9]/.test(area) || !/^[2-9]/.test(exchange) || /^[2-9]11$/.test(area) || /^[2-9]11$/.test(exchange)) return null;
  return '+' + digits;
}

export function parsePhoneList(value) {
  if (!value) return [];
  const list = String(value).split(',').map(item => item.trim()).filter(Boolean);
  const normalized = list.map(normalizePhone);
  if (normalized.some(phone => !phone)) throw new Error('A configured phone list contains an invalid +1 number.');
  return [...new Set(normalized)];
}

export const maskPhone = phone => phone ? phone.slice(0, 2) + '•••••' + phone.slice(-4) : '';
