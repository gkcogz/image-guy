// js/state.js

export let appState = {
    fileQueue: [], 
    cropper: null,
    currentCropFileId: null,
};

export function resetState() {
    if (appState.fileQueue.length > 0) {
        appState.fileQueue.forEach(f => { if (f.originalUrl) URL.revokeObjectURL(f.originalUrl) });
    }
    appState = { fileQueue: [], cropper: null, currentCropFileId: null };
}

export function findFileById(fileId) {
    return appState.fileQueue.find(f => f.uniqueId === fileId);
}