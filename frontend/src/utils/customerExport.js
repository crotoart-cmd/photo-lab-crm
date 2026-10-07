export function customersToCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = c.value(row);
        const text = String(raw ?? '').replace(/"/g, '""');
        return `"${text}"`;
      })
      .join(',')
  );
  return `\uFEFF${[header, ...lines].join('\n')}`;
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCareListCsv(careTasks) {
  const rows = [
    ...(careTasks?.inactive30d || []).map((c) => ({
      group: '30 ngày chưa quay lại',
      name: c.name,
      phone: c.phone,
      email: c.email,
      detail: `${c.daysSinceVisit || '?'} ngày`,
      code: c.customerCode || '',
    })),
    ...(careTasks?.readyPickup || []).map((c) => ({
      group: 'Film sẵn trả chưa lấy',
      name: c.name,
      phone: c.phone,
      email: c.email,
      detail: `${c.readyCount} phiếu`,
      code: c.customerCode || '',
    })),
  ];

  const csv = customersToCsv(rows, [
    { label: 'Nhóm', value: (r) => r.group },
    { label: 'Họ tên', value: (r) => r.name },
    { label: 'SĐT', value: (r) => r.phone },
    { label: 'Email', value: (r) => r.email },
    { label: 'Chi tiết', value: (r) => r.detail },
    { label: 'Mã KH', value: (r) => r.code },
  ]);

  downloadCsv(`cham-soc-khach-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
