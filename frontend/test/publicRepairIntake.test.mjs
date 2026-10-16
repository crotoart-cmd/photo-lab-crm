import test from 'node:test';
import assert from 'node:assert/strict';
import { composeRepairSymptom, repairStepIssue, toggleRepairSymptom, updateRepairModel } from '../src/lib/publicRepairIntake.js';
import { MOBILE_REPAIR_COPY } from '../src/lib/publicI18nRepair.js';

test('repair symptoms toggle immutably and uncertainty is exclusive', () => {
  const previous = ['shutter'];
  assert.deepEqual(toggleRepairSymptom(previous, 'power'), ['shutter', 'power']);
  assert.deepEqual(previous, ['shutter']);
  assert.deepEqual(toggleRepairSymptom(previous, 'shutter'), []);
  assert.deepEqual(toggleRepairSymptom(previous, 'unsure'), ['unsure']);
  assert.deepEqual(toggleRepairSymptom(['unsure'], 'lens'), ['lens']);
  assert.deepEqual(toggleRepairSymptom(previous, 'unknown'), previous);
});

test('symptoms serialize to the existing text field without duplicates or unknown IDs', () => {
  assert.equal(composeRepairSymptom(['power', 'shutter', 'shutter', 'unknown'], '  At 1/60  ', (id) => id), 'shutter, power\nAt 1/60');
  assert.equal(composeRepairSymptom([], ' Custom fault ', (id) => id), 'Custom fault');
  assert.equal(composeRepairSymptom([], '  ', (id) => id), '');
});

test('each repair step rejects whitespace and over-limit descriptions', () => {
  assert.equal(repairStepIssue({ model_name: ' ' }, 'shutter', 1), 'model_name');
  assert.equal(repairStepIssue({ model_name: 'Custom camera' }, '', 1), 'symptom');
  assert.equal(repairStepIssue({ model_name: 'Custom camera' }, 'a'.repeat(801), 1), 'symptom');
  assert.equal(repairStepIssue({ model_name: 'Not in catalog' }, 'unknown fault', 1), null);
  assert.equal(repairStepIssue({ firstName: 'A', lastName: 'B', email: ' ', phone: '1' }, '', 2), 'email');
});

test('catalog models update the brand while custom models remain allowed', () => {
  const catalog = [{ model: 'Canon AE-1', brand: 'Canon' }, { model: 'Nikon F3', brand: 'Nikon' }];
  const canon = updateRepairModel({ model_name: '', brand: '' }, 'canon ae-1', catalog);
  assert.equal(canon.brand, 'Canon');
  assert.equal(updateRepairModel(canon, 'Nikon F3', catalog).brand, 'Nikon');
  assert.equal(updateRepairModel(canon, 'My camera', catalog).brand, '');
  assert.equal(updateRepairModel({ model_name: 'Custom', brand: 'Other' }, 'Custom II', catalog).brand, 'Other');
});

test('all four repair locales are complete and fit the backend symptom limit', () => {
  for (const copy of Object.values(MOBILE_REPAIR_COPY)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(MOBILE_REPAIR_COPY.en).sort());
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim()));
    const symptom = composeRepairSymptom(['shutter', 'transport', 'power', 'lens', 'light'], 'a'.repeat(600), (id) => copy[`rp.symptom.${id}`]);
    assert.ok(symptom.length <= 800);
  }
});
