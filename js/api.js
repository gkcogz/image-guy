// js/api.js

import { sanitizeFilename } from './utils.js';
import { renderApp } from './ui.js';
import { appState } from './state.js';

function uploadWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(xhr.response) : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(file);
    });
}

export async function processSingleFile(fileState, fileObjectToProcess, overrideFormat = null) {
    fileState.status = 'processing';
    fileState.progressText = 'Preparing...';
    renderApp();

    try {
        const safeFilename = sanitizeFilename(fileObjectToProcess.name);
        const linkResponse = await fetch('/.netlify/functions/get-upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: safeFilename, fileType: fileObjectToProcess.type }) });
        if (!linkResponse.ok) throw new Error('Could not get upload link.');
        const { uploadUrl, key } = await linkResponse.json();
        
        fileState.progressText = 'Uploading...';
        renderApp();
        await uploadWithProgress(uploadUrl, fileObjectToProcess, () => {});
        
        fileState.progressText = 'Optimizing...';
        renderApp();
        
        const selectedFormat = overrideFormat || (document.querySelector('input[name="format"]:checked')?.value || 'jpeg');
        const qualityValue = document.getElementById('quality-slider')?.value || null;
        const optimizePayload = { key, outputFormat: selectedFormat, quality: qualityValue };
        
        const optimizeResponse = await fetch('/.netlify/functions/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(optimizePayload) });
        if (!optimizeResponse.ok) {
            const errorData = await optimizeResponse.json().catch(() => ({ error: "Optimization failed." }));
            throw new Error(errorData.error || 'Optimization failed.');
        }
        const data = await optimizeResponse.json();

        fileState.status = 'success';
        fileState.currentOptimizedUrl = data.downloadUrl;
        const currentSavings = ((fileState.fileObject.size - data.optimizedSize) / fileState.fileObject.size * 100);
        fileState.savings = currentSavings;

        if (!fileState.initialOptimizedUrl) {
            fileState.initialOptimizedUrl = data.downloadUrl;
            fileState.initialSavings = currentSavings;
        }
        
        const newExtension = data.newFilename.slice(data.newFilename.lastIndexOf('.'));
        fileState.downloadName = sanitizeFilename(fileState.fileObject.name).replace(/\.[^/.]+$/, "") + newExtension;

    } catch (error) {
        fileState.status = 'error';
        fileState.errorMessage = error.message;
    }
    
    renderApp();
}

// Bu kodu js/api.js dosyasının en altına ekleyin.
import { loadScript } from './utils.js'; // Bu import'u dosyanın en üstüne eklemeyi unutmayın.
import { appState } from './state.js'; // Bu import'u da ekleyin.

export async function handleZipDownload() {
    const downloadAllBtn = document.getElementById('download-all-btn');
    if (!downloadAllBtn || downloadAllBtn.disabled) return;
    try {
        downloadAllBtn.textContent = 'Loading Assets...';
        downloadAllBtn.disabled = true;
        // JSZip kütüphanesini yükle
        if (!window.JSZip) {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
        }
        downloadAllBtn.textContent = 'Zipping...';
        const zip = new JSZip();
        const filesToZip = appState.fileQueue.filter(f => f.status === 'success');
        
        const fetchPromises = filesToZip.map(fileState => 
            fetch(fileState.currentOptimizedUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch '${fileState.downloadName}'`);
                    return response.blob();
                })
                .then(blob => ({ name: fileState.downloadName, blob: blob }))
        );

        const files = await Promise.all(fetchPromises);
        files.forEach(file => zip.file(file.name, file.blob));
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const tempUrl = URL.createObjectURL(zipBlob);
        const tempLink = document.createElement('a');
        tempLink.href = tempUrl;
        tempLink.setAttribute('download', 'image-guy-optimized.zip');
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(tempUrl);
    } catch (error) {
        console.error('Failed to create ZIP file:', error);
        alert('An error occurred while creating the ZIP file.');
    } finally {
        if (downloadAllBtn) {
            downloadAllBtn.textContent = 'Download All (.ZIP)';
            downloadAllBtn.disabled = false;
        }
    }
}