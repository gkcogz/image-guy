// js/ui.js

import { appState } from './state.js';
import { formatFileSize, loadScript, loadStyle } from './utils.js';
import { DEFAULT_QUALITY_SETTINGS } from './constants.js';

const uploadArea = document.querySelector('.upload-area');
const initialUploadAreaHTML = uploadArea.innerHTML;

export function renderApp() {
    uploadArea.innerHTML = '';

    if (appState.fileQueue.length === 0) {
        uploadArea.innerHTML = initialUploadAreaHTML;
        uploadArea.classList.remove('file-selected');
        return;
    }

    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';

    appState.fileQueue.forEach((fileState) => {
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        listItem.dataset.fileId = fileState.uniqueId;

        const fileInfoDiv = document.createElement('div');
        fileInfoDiv.className = 'file-info';
        fileInfoDiv.innerHTML = `
            <span class="file-icon">📄</span>
            <div class="file-details">
                <span class="file-name">${fileState.fileObject.name}</span>
                <span class="file-size">${formatFileSize(fileState.fileObject.size)}</span>
            </div>`;

        const fileStatusDiv = document.createElement('div');
        fileStatusDiv.className = 'file-item-status';
        
        switch (fileState.status) {
            case 'ready':
                fileStatusDiv.innerHTML = `<span>Ready</span><button class="icon-btn btn-delete-item" title="Remove file" type="button"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
                break;
            case 'processing':
                fileStatusDiv.innerHTML = `<div class="progress-bar-container"><div class="progress-bar-fill progress-bar-fill-indeterminate"></div><span class="progress-bar-text">${fileState.progressText || 'Processing...'}</span></div>`;
                break;
            case 'success':
                const savingsText = fileState.savings >= 1 ? `✓ ${fileState.savings.toFixed(0)}% Saved` : `✓ Already Optimized`;
                const hasBeenCropped = fileState.initialOptimizedUrl && (fileState.initialOptimizedUrl !== fileState.currentOptimizedUrl);
                fileStatusDiv.innerHTML = `
                    <span class="${fileState.savings >= 1 ? 'savings' : 'savings-info'}">${savingsText}</span>
                    <div class="action-icon-group">
                        <button class="icon-btn btn-compare" title="Compare" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3m-6 18v-5"></path><path d="M6 3h12"></path></svg></button>
                        ${hasBeenCropped ? `<button class="icon-btn btn-revert" title="Undo Crop" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a10 10 0 1 1-10-10 10.2 10.2 0 0 1 3.4.6"></path><path d="M12 2v4h4"></path></svg></button>` : ''}
                        <button class="icon-btn btn-crop" title="Edit & Crop" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg></button>
                        <button class="icon-btn btn-copy" title="Copy Image" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                        <button class="icon-btn btn-base64" title="Get Base64 Code" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></button>
                        <a class="btn btn-download-item" href="${fileState.currentOptimizedUrl}" download="${fileState.downloadName}">Download</a>
                    </div>`;
                break;
            case 'error':
                fileStatusDiv.innerHTML = `<span class="status-failed">Failed! ${fileState.errorMessage}</span><button class="icon-btn btn-retry" type="button"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>`;
                break;
        }
        listItem.append(fileInfoDiv, fileStatusDiv);
        fileListElement.appendChild(listItem);
    });

    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    
    const allDone = appState.fileQueue.every(f => f.status === 'success' || f.status === 'error');
    if (allDone && appState.fileQueue.length > 0) {
         actionArea.innerHTML = `
            <div class="action-buttons-container">
                <button class="btn btn-secondary" id="clear-all-btn" type="button">Start Over</button>
                <button class="btn btn-primary" id="download-all-btn" type="button">Download All (.ZIP)</button>
            </div>`;
    } else if (appState.fileQueue.length > 0) {
        const containsPng = appState.fileQueue.some(f => f.fileObject.name.toLowerCase().endsWith('.png'));
        const filesReadyCount = appState.fileQueue.filter(f => f.status === 'ready').length;
        
        const isAnyFileProcessing = appState.fileQueue.some(f => f.status === 'processing');

        const optimizeButtonHTML = isAnyFileProcessing
            ? `<button class="btn btn-primary" id="optimize-all-btn" type="button" disabled>Processing...</button>`
            : `<button class="btn btn-primary" id="optimize-all-btn" type="button">Optimize All (${filesReadyCount} files)</button>`;
        
        actionArea.innerHTML = `
        <div class="format-options-header">
            <span class="format-label">Output Format:</span>
            <div class="tooltip-container">
                <span class="info-icon">?</span>
                <div class="tooltip-content">
                    <div class="tooltip-grid-item"><h4>JPEG (.jpg)</h4><p>Best for photographs.</p></div>
                    <div class="tooltip-grid-item"><h4>PNG</h4><p>Best for graphics with transparency.</p></div>
                    <div class="tooltip-grid-item"><h4>WebP</h4><p>Modern format for web use.</p></div>
                    <div class="tooltip-grid-item"><h4>AVIF</h4><p>Newest format with highest compression.</p></div>
                    <div class="tooltip-grid-item"><h4>HEIC</h4><p>Modern format by Apple, great for photos.</p></div>
                    <div class="tooltip-grid-item"><h4>Favicon (PNG/ICO)</h4><p>Converts your image to a website icon.</p></div>
                </div>
            </div>
        </div>
        <div class="format-options">
            <div class="radio-group"><input type="radio" id="jpeg" name="format" value="jpeg" checked><label for="jpeg">JPG</label></div>
            <div class="radio-group"><input type="radio" id="png" name="format" value="png"><label for="png">PNG</label></div>
            <div class="radio-group"><input type="radio" id="webp" name="format" value="webp"><label for="webp">WebP</label></div>
            <div class="radio-group"><input type="radio" id="avif" name="format" value="avif"><label for="avif">AVIF</label></div>
            <div class="radio-group"><input type="radio" id="heic" name="format" value="heic"><label for="heic">HEIC</label></div>
            <div class="radio-group"><input type="radio" id="favicon-png" name="format" value="favicon-png"><label for="favicon-png">Favicon (PNG)</label></div>
            <div class="radio-group"><input type="radio" id="favicon-ico" name="format" value="favicon-ico"><label for="favicon-ico">Favicon (ICO)</label></div>
        </div>
        <div class="advanced-slider" style="display: none;">
            <div class="quality-label-container"><label for="quality-slider">Quality:</label></div>
            <input type="range" id="quality-slider" name="quality" min="50" max="95" value="85">
            <output for="quality-slider" id="quality-output">85</output>
        </div>
        <div class="action-buttons-container initial-actions">
            <button class="btn btn-secondary" id="clear-all-btn" type="button">Start Over</button>
            ${optimizeButtonHTML}
            <button class="icon-btn" id="advanced-options-btn" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span class="icon-tooltip">Advanced Settings</span>
            </button>
        </div>
        ${containsPng ? `<div class="smart-tip">💡 <strong>Pro Tip:</strong> For photos or images without transparency, choosing <strong>JPG</strong> often provides the smallest file size.</div>` : ''}
        `;
    }

    uploadArea.append(fileListElement, actionArea);
    uploadArea.classList.add("file-selected");
    updateQualitySlider();
}

export function updateQualitySlider() {
    const selectedFormatRadio = document.querySelector('input[name="format"]:checked');
    if (!selectedFormatRadio) return;
    const selectedFormat = selectedFormatRadio.value;
    const advancedContainer = document.querySelector('.advanced-slider');
    if (!advancedContainer) return;
    const qualitySlider = document.getElementById('quality-slider');
    const qualityOutput = document.getElementById('quality-output');
    const advancedButton = document.getElementById('advanced-options-btn');
    if (DEFAULT_QUALITY_SETTINGS[selectedFormat]) {
        const settings = DEFAULT_QUALITY_SETTINGS[selectedFormat];
        if (qualitySlider && qualityOutput) {
            qualitySlider.min = settings.min;
            qualitySlider.max = settings.max;
            qualitySlider.value = settings.default;
            qualityOutput.textContent = settings.default;
        }
        if (advancedButton) advancedButton.style.display = 'inline-flex';
    } else {
        if (advancedContainer) advancedContainer.style.display = 'none';
        if (advancedButton) advancedButton.style.display = 'none';
    }
}

export function removeModalIfPresent() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        if (appState.cropper) {
            try { appState.cropper.destroy(); } catch (e) { /* ignore */ }
            appState.cropper = null;
        }
        modal.remove();
    }
}

export function showComparisonModal(beforeUrl, afterUrl) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <button class="modal-close-btn" type="button">&times;</button>
                <img-comparison-slider>
                    <img slot="first" src="${beforeUrl}" />
                    <img slot="second" src="${afterUrl}" />
                </img-comparison-slider>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

export async function showCropModal(imageUrl) {
    try {
        if (!window.Cropper) {
            await Promise.all([
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js'),
                loadStyle('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css')
            ]);
        }
    } catch (error) {
        alert("An error occurred while loading the image editor.");
        return;
    }

    const modalHTML = `
        <div class="modal-overlay">
            <div class="crop-modal-content">
                <button class="modal-close-btn" type="button">&times;</button>
                <h2>Edit & Crop Image</h2>
                <div class="crop-image-container">
                    <img id="image-to-crop" src="${imageUrl}">
                </div>
                <div class="crop-actions">
                    <button class="btn btn-secondary crop-shape-btn" data-shape="rectangle" type="button">Rectangle</button>
                    <button class="btn btn-secondary crop-shape-btn" data-shape="circle" type="button">Circle</button>
                    <button class="btn btn-primary" id="apply-crop-btn" type="button">Apply Crop</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const image = document.getElementById('image-to-crop');
    const modalContent = document.querySelector('.crop-modal-content');
    image.crossOrigin = "anonymous";

    image.onload = () => {
        if (appState.cropper) { try { appState.cropper.destroy(); } catch (e) {} }
        appState.cropper = new Cropper(image, {
            viewMode: 1, background: false, autoCropArea: 0.8,
            ready: () => {
                if (modalContent) modalContent.classList.add('ready');
                const rectBtn = document.querySelector('.crop-shape-btn[data-shape="rectangle"]');
                if (rectBtn) rectBtn.classList.add('active');
            }
        });
    };
    if (image.complete) image.onload();
}