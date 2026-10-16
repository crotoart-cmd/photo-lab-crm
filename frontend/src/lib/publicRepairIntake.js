export const REPAIR_SYMPTOMS = [
  { id: 'shutter', icon: 'camera' },
  { id: 'transport', icon: 'movie' },
  { id: 'power', icon: 'battery_alert' },
  { id: 'lens', icon: 'camera_alt' },
  { id: 'light', icon: 'light_mode' },
  { id: 'unsure', icon: 'help_outline' },
];

export function toggleRepairSymptom(selected, id) {
  if (!REPAIR_SYMPTOMS.some((item) => item.id === id)) return selected;
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  return id === 'unsure' ? ['unsure'] : [...selected.filter((value) => value !== 'unsure'), id];
}

export function composeRepairSymptom(selected, detail, label) {
  const symptoms = REPAIR_SYMPTOMS.filter((item) => selected.includes(item.id)).map((item) => label(item.id));
  return [symptoms.join(', '), String(detail || '').trim()].filter(Boolean).join('\n');
}

export function repairStepIssue(form, symptom, step) {
  const fields = step === 1 ? ['model_name'] : step === 2 ? ['firstName', 'lastName', 'email', 'phone'] : [];
  const missing = fields.find((key) => !String(form[key] || '').trim());
  if (missing) return missing;
  if (step === 1 && (!symptom.trim() || symptom.length > 800)) return 'symptom';
  return null;
}

export function updateRepairModel(form, value, catalog) {
  const match = (name) => catalog.find((item) => item.model.toLowerCase() === name.trim().toLowerCase());
  const current = match(form.model_name || '');
  const next = match(value);
  return { ...form, model_name: value, brand: next?.brand || (current?.brand === form.brand ? '' : form.brand) };
}
