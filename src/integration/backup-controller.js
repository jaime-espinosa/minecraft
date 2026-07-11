export function createBackupController({ document, libraryBackups, confirm, urlApi, reload }) {
  const exportButton = document.querySelector('#export-library-backup');
  const importInput = document.querySelector('#import-library-backup-file');
  const importButton = document.querySelector('#import-library-backup');
  const download = document.querySelector('#download-library-backup');
  const status = document.querySelector('#library-backup-status');
  let downloadUrl = null;

  const announce = (message) => { status.textContent = message; };
  const exportBackup = async () => {
    const result = await libraryBackups.export();
    if (!result.ok) { announce(result.fault.message); return; }
    if (downloadUrl) urlApi.revokeObjectURL(downloadUrl);
    downloadUrl = urlApi.createObjectURL(new Blob([result.value.bytes], { type: 'application/json' }));
    download.href = downloadUrl;
    download.download = result.value.filename;
    download.hidden = false;
    announce('Photo-free library backup is ready to download.');
  };
  const chooseImport = () => { importButton.disabled = !importInput.files?.[0]; };
  const importBackup = async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    if (!confirm('Replace this local library with the selected backup? Saved looks will be replaced and all retained photos will be deleted.')) return;
    const input = await file.text();
    let result = await libraryBackups.import(input, { confirmed: true });
    if (!result.ok && result.fault.kind === 'foreign-library') {
      if (!confirm('This backup belongs to a different local library. Restore it as a new person and delete this entire local library? This disaster recovery action cannot be undone.')) {
        announce('Disaster recovery was canceled. This local library was not changed.');
        return;
      }
      result = await libraryBackups.restoreAsNewPerson(input, { confirmed: true });
    }
    if (!result.ok) { announce(result.fault.message); return; }
    announce('Library backup imported. Reloading the local studio.');
    reload();
  };

  exportButton.addEventListener('click', exportBackup);
  importInput.addEventListener('change', chooseImport);
  importButton.addEventListener('click', importBackup);
  return Object.freeze({
    dispose() {
      exportButton.removeEventListener('click', exportBackup);
      importInput.removeEventListener('change', chooseImport);
      importButton.removeEventListener('click', importBackup);
      if (downloadUrl) urlApi.revokeObjectURL(downloadUrl);
    },
  });
}
