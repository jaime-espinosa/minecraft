import { err, ok } from '../domain/result.js';
import { validateProposedIdentityChangeV1 } from '../domain/contracts.js';
import { canonicalJson } from '../domain/canonical-json.js';

export function createCaptureProposalFlow({ kernel, library, analyzer }) {
  let currentProposal = null;
  const commit = async (frame, operations) => {
    const result = kernel.transact({ frame, baseRevision: frame.recipe.revision, operations });
    if (!result.ok) return result;
    const saved = await library.saveIdentity(result.value.identity, { baseRevision: frame.identity.revision });
    if (!saved.ok) return saved;
    return ok(result.value);
  };
  return Object.freeze({
    async preview({ frame, analysisInput }) {
      currentProposal = null;
      let result;
      try { result = await analyzer.analyze({ ...analysisInput, baseIdentityRevision: frame.identity.revision }); }
      catch (error) { return err({ kind: 'analysis-failed', message: error.message }); }
      if (!result.ok) return result;
      try { validateProposedIdentityChangeV1(result.value); } catch (error) { return err({ kind: 'invalid-proposal', message: error.message }); }
      currentProposal = structuredClone(result.value);
      const preselectedFields = currentProposal.confidence === 'high' ? currentProposal.operations.map(({ field }) => field) : [];
      return ok({ proposal: structuredClone(currentProposal), preselectedFields });
    },
    async reject() { currentProposal = null; return ok(null); },
    async acceptSelected({ frame, proposalId, proposal, selectedFields }) {
      if (!currentProposal) return err({ kind: 'proposal-unavailable', message: 'Preview a proposal before accepting it.' });
      if ((proposalId ?? proposal?.id) !== currentProposal.id) return err({ kind: 'proposal-mismatch', message: 'That proposal is not the current preview.' });
      if (proposal) {
        try { if (canonicalJson(proposal) !== canonicalJson(currentProposal)) return err({ kind: 'proposal-mismatch', message: 'The proposal content was changed.' }); }
        catch { return err({ kind: 'proposal-mismatch', message: 'The proposal content is invalid.' }); }
      }
      if (currentProposal.baseIdentityRevision !== frame.identity.revision) return err({ kind: 'stale-proposal', message: 'The proposal is stale.' });
      if (!Array.isArray(selectedFields) || new Set(selectedFields).size !== selectedFields.length) return err({ kind: 'invalid-selection', message: 'Selected fields must be unique.' });
      const available = new Set(currentProposal.operations.map(({ field }) => field));
      if (selectedFields.some((field) => !available.has(field))) return err({ kind: 'invalid-selection', message: 'A selected field is not in the proposal.' });
      const selected = new Set(selectedFields); const operations = currentProposal.operations.filter(({ field }) => selected.has(field));
      if (!operations.length) return err({ kind: 'empty-selection', message: 'Choose at least one proposed field.' });
      const result = await commit(frame, operations); if (result.ok) currentProposal = null; return result;
    },
    async applyManual({ frame, field, value }) {
      if (!['complexion', 'hair', 'top', 'bottom', 'footwear'].includes(field)) return err({ kind: 'invalid-manual-field', message: 'That manual field is unsupported.' });
      return commit(frame, [{ op: 'set-palette', field, value: structuredClone(value), provenance: { source: 'manual', sourcePhotoIds: [], evidenceState: 'not-applicable' } }]);
    },
    getPreview() { return currentProposal ? structuredClone(currentProposal) : null; },
  });
}
