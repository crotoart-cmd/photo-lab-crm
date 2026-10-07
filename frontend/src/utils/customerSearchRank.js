/**
 * Xếp hạng kết quả tìm khách — mục đầu là khớp chính xác nhất.
 */
export function rankCustomers(query, customers) {
  const q = query.trim().toLowerCase();
  const qUpper = query.trim().toUpperCase();
  const qDigits = q.replace(/\D/g, '');

  if (!q || !customers?.length) {
    return customers.map((c) => ({ ...c, _matchScore: 0 }));
  }

  const scoreCustomer = (c) => {
    let score = 0;
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').replace(/\D/g, '');
    const code = (c.customerCode || '').toUpperCase();
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().trim();

    if (email === q) score += 1000;
    else if (email.startsWith(q)) score += 400;
    else if (email.includes(q)) score += 120;

    if (qDigits.length >= 3) {
      if (phone === qDigits) score += 1000;
      else if (phone.endsWith(qDigits)) score += 500;
      else if (phone.startsWith(qDigits)) score += 450;
      else if (phone.includes(qDigits)) score += 200;
    }

    if (code && code === qUpper) score += 1000;
    else if (code && code.includes(qUpper.replace(/[^A-Z0-9-]/g, ''))) score += 350;

    if (name === q) score += 800;
    else if (name.startsWith(q)) score += 300;
    else if (name.includes(q)) score += 150;

    return score;
  };

  return [...customers]
    .map((c) => ({ customer: c, score: scoreCustomer(c) }))
    .sort((a, b) => b.score - a.score)
    .map(({ customer, score }) => ({ ...customer, _matchScore: score }));
}

export function isStrongMatch(customer) {
  return (customer?._matchScore ?? 0) >= 200;
}
