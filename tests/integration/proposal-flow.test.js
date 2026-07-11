import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createCaptureProposalFlow } from '../../src/experimental/capture-route.js';

const palette = { primary: '#785848', shadow: '#563f34', highlight: '#906c59' };
const proposal = (confidence = 'high', baseIdentityRevision = 1) => ({
  id: 'proposal-1', baseIdentityRevision,
  operations: [{ op: 'set-palette', field: 'hair', value: palette, provenance: { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'available' } }],
  evidencePhotoIds: ['photo-1'], analyzerVersion: 'palette-v1', confidence, warnings: [],
});

const setup = (analysis = { ok: true, value: proposal() }) => {
  const kernel = createAvatarKernel(), saves = [];
  const library = { async saveIdentity(identity, options) { saves.push({ identity, options }); return { ok: true, value: identity }; } };
  return { flow: createCaptureProposalFlow({ kernel, library, analyzer: { analyze: () => analysis } }), kernel, saves };
};

test('preview and reject do not mutate accepted state; low confidence preselects nothing', async () => {
  const { flow, kernel, saves } = setup({ ok: true, value: proposal('low') }); const frame = kernel.start().value;
  const preview = await flow.preview({ frame, analysisInput: {} });
  assert.deepEqual(preview.value.preselectedFields, []); assert.deepEqual(frame, kernel.start().value); assert.equal(saves.length, 0);
  assert.equal((await flow.reject()).ok, true); assert.equal(saves.length, 0);
});

test('selected acceptance and manual correction commit only through kernel and library', async () => {
  const { flow, kernel, saves } = setup(); const frame = kernel.start().value;
  const preview = await flow.preview({ frame, analysisInput: {} });
  const accepted = await flow.acceptSelected({ frame, proposalId: preview.value.proposal.id, selectedFields: ['hair'] });
  assert.equal(accepted.ok, true); assert.deepEqual(accepted.value.identity.hair.palette, palette); assert.equal(saves.length, 1);
  const manualPalette = { primary: '#385878', shadow: '#283f56', highlight: '#5c7890' };
  const manual = await flow.applyManual({ frame: accepted.value, field: 'top', value: manualPalette });
  assert.equal(manual.ok, true); assert.deepEqual(manual.value.identity.outfit.top, manualPalette); assert.equal(saves.length, 2);
});

test('stale proposal and analyzer failure leave identity and library unchanged', async () => {
  const staleSetup = setup(); const frame = staleSetup.kernel.start().value;
  await staleSetup.flow.preview({ frame, analysisInput: {} });
  const changedFrame = structuredClone(frame); changedFrame.identity.revision = 2; changedFrame.recipe.identityRevision = 2;
  const stale = await staleSetup.flow.acceptSelected({ frame: changedFrame, proposalId: 'proposal-1', selectedFields: ['hair'] });
  assert.equal(stale.fault.kind, 'stale-proposal'); assert.equal(staleSetup.saves.length, 0);
  const failed = setup({ ok: false, fault: { kind: 'analysis-failed', message: 'nope' } });
  assert.equal((await failed.flow.preview({ frame, analysisInput: {} })).fault.kind, 'analysis-failed'); assert.equal(failed.saves.length, 0);
});

test('acceptance rejects missing, forged, duplicate, unknown, and mutated proposal authority', async () => {
  const { flow, kernel, saves } = setup(); const frame = kernel.start().value;
  assert.equal((await flow.acceptSelected({ frame, proposalId: 'proposal-1', selectedFields: ['hair'] })).fault.kind, 'proposal-unavailable');
  const preview = await flow.preview({ frame, analysisInput: {} });
  assert.equal((await flow.acceptSelected({ frame, proposalId: 'forged', selectedFields: ['hair'] })).fault.kind, 'proposal-mismatch');
  assert.equal((await flow.acceptSelected({ frame, proposalId: preview.value.proposal.id, selectedFields: ['hair', 'hair'] })).fault.kind, 'invalid-selection');
  assert.equal((await flow.acceptSelected({ frame, proposalId: preview.value.proposal.id, selectedFields: ['top'] })).fault.kind, 'invalid-selection');
  const mutated = structuredClone(preview.value.proposal); mutated.operations[0].value.primary = '#000000';
  assert.equal((await flow.acceptSelected({ frame, proposal: mutated, selectedFields: ['hair'] })).fault.kind, 'proposal-mismatch');
  assert.equal(saves.length, 0);
});
