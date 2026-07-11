const focusRegion = (document) => ({
  centerX: Number(document.querySelector('#focus-x').value),
  centerY: Number(document.querySelector('#focus-y').value),
  size: Number(document.querySelector('#focus-size').value),
});

const palette = (document, title, value) => {
  const group = document.createElement('span');
  group.className = 'palette-readout';
  group.append(`${title}: `);
  for (const [name, color] of Object.entries(value)) {
    const item = document.createElement('span');
    item.className = 'palette-value';
    item.textContent = `${name} ${color}`;
    item.style.setProperty('--swatch', color);
    group.append(item);
  }
  return group;
};

export function createCaptureController({ document, session, localPhotos, urlApi = URL, onManualCorrection = () => {} }) {
  let state = null;
  let selectedFile = null;
  let normalized = null;
  let normalizedPersisted = false;
  let previewUrl = null;
  let routeToken = 0;
  let abortController = null;
  const panel = document.querySelector('#capture-panel');
  const fileInput = document.querySelector('#capture-file');
  const confirmButton = document.querySelector('#confirm-capture');
  const cancelButton = document.querySelector('#cancel-capture');
  const preview = document.querySelector('#capture-preview');
  const analyze = document.querySelector('#analyze-photo');
  const retainedPhoto = document.querySelector('#retained-photo');
  const loadRetained = document.querySelector('#load-retained-photo');
  const recovery = document.querySelector('#photo-storage-recovery');
  const showError = (message) => {
    document.querySelector('#status').textContent = message;
  };

  const clearTransient = () => {
    abortController?.abort();
    abortController = null;
    routeToken += 1;
    selectedFile = null;
    normalized = null;
    normalizedPersisted = false;
    fileInput.value = '';
    if (previewUrl) urlApi.revokeObjectURL(previewUrl);
    previewUrl = null;
    preview.removeAttribute('src');
    preview.hidden = true;
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    analyze.disabled = true;
    recovery.hidden = true;
  };
  const load = async () => {
    if (state) return state;
    const [{ createPaletteAnalyzerV1 }, { createBrowserPhotoAdapter }] = await Promise.all([
      import('../identity-analyzer/palette-analyzer-v1.js'),
      import('./browser-photo-adapter.js'),
    ]);
    const repository = {
      storeNormalizedPhoto: (envelope) => session.dispatch({ type: 'add-photo', envelope }),
      deletePhoto: (id) => session.dispatch({ type: 'delete-photo', id }),
    };
    state = { analyzer: createPaletteAnalyzerV1(), adapter: createBrowserPhotoAdapter({ repository }) };
    return state;
  };
  const selectFile = (event) => {
    const file = event.target.files?.[0] ?? null;
    clearTransient();
    selectedFile = file;
    confirmButton.disabled = !selectedFile;
    cancelButton.disabled = !selectedFile;
  };
  const confirmFile = async () => {
    if (!selectedFile) return;
    const file = selectedFile;
    const token = ++routeToken;
    abortController = new AbortController();
    let result;
    try {
      const current = await load();
      result = await current.adapter.normalizeFile({
        file,
        confirmed: true,
        role: document.querySelector('#capture-role').value,
        focusRegion: focusRegion(document),
        signal: abortController.signal,
      });
    } catch (error) {
      if (token === routeToken) showError(error.message || 'Local photo normalization failed.');
      if (selectedFile === file) clearTransient();
      return;
    }
    if (token !== routeToken) {
      if (selectedFile === file) clearTransient();
      return;
    }
    if (!result.ok) {
      if (result.fault.kind === 'quota-exceeded' && result.recoverableEnvelope) {
        normalized = result.recoverableEnvelope;
        normalizedPersisted = false;
        selectedFile = null;
        fileInput.value = '';
        previewUrl = urlApi.createObjectURL(normalized.blob);
        preview.src = previewUrl;
        preview.hidden = false;
        confirmButton.disabled = true;
        cancelButton.disabled = true;
        analyze.disabled = true;
        recovery.hidden = false;
        showError('This normalized photo is still available in memory. Choose how to continue.');
        return;
      }
      showError(result.fault.message);
      clearTransient();
      return;
    }
    normalized = result.value;
    normalizedPersisted = true;
    selectedFile = null;
    previewUrl = urlApi.createObjectURL(normalized.blob);
    preview.src = previewUrl;
    preview.hidden = false;
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    analyze.disabled = false;
  };
  const loadRetainedPhoto = async () => {
    const result = await localPhotos.get(retainedPhoto.value);
    if (!result.ok) { showError(result.fault.message); return; }
    clearTransient();
    normalized = result.value;
    normalizedPersisted = true;
    previewUrl = urlApi.createObjectURL(normalized.blob);
    preview.src = previewUrl;
    preview.hidden = false;
    analyze.disabled = false;
    document.querySelector('#capture-role').value = normalized.metadata.role;
    showError('Retained local source photo loaded for analysis.');
  };
  const retryPhotoSave = async () => {
    if (!normalized || normalizedPersisted) return;
    const result = await session.dispatch({ type: 'add-photo', envelope: normalized });
    if (!result.ok) { showError(result.fault.message); return; }
    normalizedPersisted = true;
    recovery.hidden = true;
    analyze.disabled = false;
    showError('Local source photo saved.');
  };
  const cleanupAndRetry = async (type) => {
    const result = await session.dispatch({ type });
    if (result.ok) await retryPhotoSave();
  };
  const continueWithoutSaving = async () => {
    recovery.hidden = true;
    await session.dispatch({ type: 'dismiss-fault' });
    analyze.disabled = false;
    showError('Continuing with this photo in memory only. It will be discarded when you leave capture.');
  };
  const analyzePhoto = async () => {
    if (!normalized) return;
    const token = routeToken;
    let decoded = null;
    try {
      const current = await load();
      decoded = await current.adapter.decodeNormalized(normalized);
      if (token !== routeToken) return;
      const result = await session.dispatch({ type: 'analyze', analyzer: current.analyzer, transientEvidence: !normalizedPersisted, analysisInput: {
        ...decoded,
        role: normalized.metadata.role,
        photoId: normalized.metadata.id,
        focusRegion: normalized.metadata.focusRegion,
        faceDetectorAvailable: false,
      } });
      if (!result.ok && result.fault.kind !== 'stale-analysis') showError(result.fault.message);
    } catch (error) {
      if (token === routeToken) showError(error.message || 'Local photo analysis failed.');
    } finally {
      decoded?.rgba?.fill(0);
    }
  };
  const render = (model) => {
    if (normalized && normalizedPersisted && !model.library.photos.some(({ id }) => id === normalized.metadata.id)) clearTransient();
    const selected = retainedPhoto.value;
    retainedPhoto.replaceChildren(...model.library.photos.map((photo) => Object.assign(document.createElement('option'), {
      value: photo.id,
      textContent: `${photo.role} · ${photo.width} × ${photo.height}`,
    })));
    if (model.library.photos.some(({ id }) => id === selected)) retainedPhoto.value = selected;
    loadRetained.disabled = !model.library.photos.length;
    const proposal = model.proposal;
    document.querySelector('#proposal-confidence').textContent = proposal ? `Confidence: ${proposal.confidence}. Evidence: ${proposal.evidenceRoles.join(', ')}.` : '';
    document.querySelector('#proposal-warnings').replaceChildren(...(proposal?.warnings ?? []).map((warning) => Object.assign(document.createElement('li'), { textContent: warning })));
    const fields = document.querySelector('#proposal-fields');
    fields.querySelectorAll('label').forEach((element) => element.remove());
    for (const operation of proposal?.operations ?? []) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = operation.field;
      input.checked = proposal.preselectedFields.includes(operation.field);
      const label = document.createElement('label');
      label.append(
        input,
        ` ${operation.field} `,
        palette(document, 'Accepted', operation.accepted),
        palette(document, 'Proposed', operation.proposed),
      );
      fields.append(label);
    }
    document.querySelector('#accept-proposal').disabled = !proposal;
    document.querySelector('#reject-proposal').disabled = !proposal;
  };
  fileInput.addEventListener('change', selectFile);
  confirmButton.addEventListener('click', confirmFile);
  cancelButton.addEventListener('click', clearTransient);
  analyze.addEventListener('click', analyzePhoto);
  loadRetained.addEventListener('click', loadRetainedPhoto);
  document.querySelector('#retry-photo-save').addEventListener('click', retryPhotoSave);
  document.querySelector('#delete-unused-photos-and-retry').addEventListener('click', () => cleanupAndRetry('delete-unused-photos'));
  document.querySelector('#continue-without-saving-photo').addEventListener('click', continueWithoutSaving);
  document.querySelector('#accept-proposal').addEventListener('click', () => {
    const proposal = session.getViewModel().proposal;
    if (!proposal) return;
    const selectedFields = [...document.querySelectorAll('#proposal-fields input:checked')].map(({ value }) => value);
    session.dispatch({ type: 'accept-proposal', proposalId: proposal.id, selectedFields });
  });
  document.querySelector('#reject-proposal').addEventListener('click', () => session.dispatch({ type: 'reject-proposal' }));
  document.querySelector('#manual-correction').addEventListener('click', async () => {
    await session.dispatch({ type: 'reject-proposal' });
    onManualCorrection();
  });
  const unsubscribe = session.subscribe(render);
  return Object.freeze({
    async setRoute(route) {
      panel.hidden = route !== '#/experimental/capture';
      if (route === '#/experimental/capture') await load();
      else {
        clearTransient();
        await session.dispatch({ type: 'reject-proposal' });
      }
    },
    dispose() {
      unsubscribe();
      clearTransient();
    },
  });
}
