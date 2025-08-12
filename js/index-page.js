// ==========================================================
// index-page.js (THE FINAL, TRULY COMPLETE & ROBUST VERSION)
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeUploader();
});

function initializeUploader() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('file-input');
    if (!uploadArea || !fileInput) return;

    // ===============================================
    // APPLICATION STATE (SINGLE SOURCE OF TRUTH)
    // ===============================================
    let appState = {
        fileQueue: [], 
        cropper: null,
        currentCropFileId: null,
        isBatchProcessing: false,
    };

    const DEFAULT_QUALITY_SETTINGS = {
        jpeg: { default: 85, min: 50, max: 95 },
        png: { default: 90, min: 60, max: 100 },
        webp: { default: 80, min: 50, max: 95 },
        avif: { default: 60, min: 30, max: 80 },
        heic: { default: 80, min: 50, max: 95 }
    };

    const initialUploadAreaHTML = uploadArea.innerHTML;

    // ===============================================
    // DYNAMIC LOADING HELPERS
    // ===============================================
    const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src; script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Script load error for ${src}`));
        document.head.appendChild(script);
    });

    const loadStyle = (href) => new Promise((resolve, reject) => {
        if (document.querySelector(`link[href="${href}"]`)) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Style load error for ${href}`));
        document.head.appendChild(link);
    });

    // ===============================================
    // UTILITIES
    // ===============================================
    function sanitizeFilename(filename) {
        const extension = filename.slice(filename.lastIndexOf('.'));
        let baseName = filename.slice(0, filename.lastIndexOf('.'));
        baseName = baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/[^a-z0-9-]/g, '');
        return (baseName || `file-${Date.now()}`) + extension;
    }

    function formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024; const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // ===============================================
    // MAIN RENDER FUNCTION
    // ===============================================
    function renderApp() {
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
                            ${hasBeenCropped ? `<button class="icon-btn btn-revert" title="Undo Crop" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a10 10 0 1 1-10-10 10.2 10.2 0 0 1 3.4.6"></path><path d="M12 2v4h4"></path></svg></button>` : ''}
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
            
            const optimizeButtonHTML = appState.isBatchProcessing 
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
    
    // ===============================================
    // STATE MODIFICATION & LOGIC
    // ===============================================
    
    function handleFiles(files) {
        resetUI();
        const MAX_FILE_SIZE = 30 * 1024 * 1024;
        
        const validFiles = Array.from(files).filter(file => file.size <= MAX_FILE_SIZE);
        if (validFiles.length < files.length) {
            alert(`Some files were too large (Max 30 MB) and were not added.`);
        }
        if (validFiles.length === 0) return;

        appState.fileQueue = validFiles.map(file => ({
            fileObject: file,
            uniqueId: `file-${Date.now()}-${Math.random()}`,
            status: 'ready',
            originalUrl: URL.createObjectURL(file),
            initialOptimizedUrl: null,
            currentOptimizedUrl: null,
            initialSavings: 0,
            savings: 0,
            downloadName: null,
            progressText: '',
            errorMessage: '',
            cropData: null,
        }));

        renderApp();
        fileInput.value = null;
    }

    function resetUI() {
        if (appState.fileQueue.length > 0) {
            appState.fileQueue.forEach(f => { if (f.originalUrl) URL.revokeObjectURL(f.originalUrl) });
        }
        appState = { fileQueue: [], cropper: null, currentCropFileId: null, isBatchProcessing: false };
        renderApp();
    }
    
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

    async function processSingleFile(fileState, fileObjectToProcess, overrideFormat = null) {
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
    
    // ===============================================
    // MODALS & UI HELPERS
    // ===============================================

    async function getCroppedSectionFromUrl(imageUrl, cropData) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            // Yerel blob: URL'ler için crossOrigin'e gerek yoktur.
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = cropData.width;
                canvas.height = cropData.height;
                context.drawImage(
                    image,
                    cropData.x, cropData.y,
                    cropData.width, cropData.height,
                    0, 0,
                    cropData.width, cropData.height
                );
                resolve(canvas.toDataURL());
            };
            image.onerror = () => reject(new Error('Karşılaştırma için yerel resim yüklenemedi.'));
            image.src = imageUrl;
        });
    }

    function updateQualitySlider() {
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

    function removeModalIfPresent() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            if (appState.cropper) {
                try { appState.cropper.destroy(); } catch (e) { /* ignore */ }
                appState.cropper = null;
            }
            modal.remove();
        }
    }

    function showComparisonModal(beforeUrl, afterUrl) {
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
    
    async function showCropModal(imageUrl) {
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
    
    function showBase64Modal(base64String) {
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content base64-modal-content">
                    <button class="modal-close-btn" type="button">&times;</button>
                    <h2>Base64 Code</h2>
                    <p>You can use this code directly in your CSS or HTML.</p>
                    <div class="base64-container">
                        <textarea class="base64-textarea" readonly>${base64String}</textarea>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="check-base64-btn" type="button"><span>Check Code</span></button>
                        <div class="modal-actions-group-right">
                            <button class="btn btn-primary" id="copy-base64-btn" type="button">
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                <span>Copy to Clipboard</span>
                            </button>
                            <span class="copy-success-msg">Copied!</span>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const textarea = document.querySelector('.base64-textarea');
        if (textarea) textarea.select();

        const copyBtn = document.getElementById('copy-base64-btn');
        const checkBtn = document.getElementById('check-base64-btn');
        const successMsg = document.querySelector('.copy-success-msg');

        if (copyBtn && successMsg) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(base64String).then(() => {
                    successMsg.classList.add('visible');
                    setTimeout(() => { successMsg.classList.remove('visible'); }, 2000);
                });
            });
        }

        if (checkBtn) {
            checkBtn.addEventListener('click', () => {
                const newWindow = window.open();
                if (newWindow) {
                    newWindow.document.write(`<html><head><title>Base64 Image Preview</title></head><body style="margin:0; display:flex; justify-content:center; align-items:center; background-color:#2e2e2e;"><img src="${base64String}" alt="Base64 Preview"></body></html>`);
                    newWindow.document.close();
                } else {
                    alert("Please allow pop-ups to preview the image.");
                }
            });
        }
    }
    
    async function handleZipDownload() {
        const downloadAllBtn = document.getElementById('download-all-btn');
        if (!downloadAllBtn || downloadAllBtn.disabled) return;
        try {
            downloadAllBtn.textContent = 'Loading Assets...';
            downloadAllBtn.disabled = true;
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
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

    // ===============================================
    // EVENT LISTENERS
    // ===============================================
    document.body.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button');
        
        if (e.target.classList.contains('modal-overlay') || (targetButton && targetButton.classList.contains('modal-close-btn'))) {
            removeModalIfPresent();
        }
        
        if (!targetButton) return;

        const listItem = e.target.closest('.file-list-item');
        const fileId = listItem?.dataset.fileId;
        const fileState = fileId ? appState.fileQueue.find(f => f.uniqueId === fileId) : null;
        
        // --- Actions on a specific file ---
        if (fileState) {
            if (targetButton.classList.contains('btn-delete-item')) {
                appState.fileQueue = appState.fileQueue.filter(f => f.uniqueId !== fileId);
                URL.revokeObjectURL(fileState.originalUrl);
                renderApp();
            }
            else if (targetButton.classList.contains('btn-revert')) {
                fileState.currentOptimizedUrl = fileState.initialOptimizedUrl;
                fileState.savings = fileState.initialSavings;
                fileState.cropData = null;
                renderApp();
            }
            else if (targetButton.classList.contains('btn-retry')) {
                processSingleFile(fileState, fileState.fileObject);
            }
            else if (targetButton.classList.contains('btn-crop')) {
                appState.currentCropFileId = fileId;
                showCropModal(fileState.currentOptimizedUrl);
            }
            else if (targetButton.classList.contains('btn-compare')) {
                const afterUrl = fileState.currentOptimizedUrl;
                let beforeUrl = fileState.originalUrl; 

                if (fileState.cropData) {
                    try {
                        beforeUrl = await getCroppedSectionFromUrl(fileState.originalUrl, fileState.cropData);
                    } catch (err) {
                        console.error("Orijinal resimden 'öncesi' görüntüsü oluşturulamadı:", err);
                        beforeUrl = fileState.originalUrl; 
                    }
                }
                
                showComparisonModal(beforeUrl, afterUrl);
            }
            else if (targetButton.classList.contains('btn-copy')) {
                targetButton.innerHTML = '...';
                try {
                    const response = await fetch(fileState.currentOptimizedUrl);
                    const blob = await response.blob();
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = await createImageBitmap(blob);
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(async (pngBlob) => {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                        targetButton.innerHTML = '✓';
                        targetButton.classList.add('copied');
                        setTimeout(() => {
                           if (document.body.contains(targetButton)) {
                                targetButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                                targetButton.classList.remove('copied');
                           }
                        }, 2000);
                    }, 'image/png');
                } catch (err) { 
                    console.error('Copy failed:', err);
                    targetButton.innerHTML = `X`;
                }
            }
            else if (targetButton.classList.contains('btn-base64')) {
                try {
                    const response = await fetch(fileState.currentOptimizedUrl);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => { if (reader.result) showBase64Modal(reader.result); };
                    reader.readAsDataURL(blob);
                } catch (err) { console.error('Base64 generation failed:', err); }
            }
        }
        else if (targetButton.id === 'clear-all-btn') {
            resetUI();
        }
        else if (targetButton.id === 'optimize-all-btn' || targetButton.id === 'download-all-btn') {
            e.stopPropagation();
            if (targetButton.id === 'optimize-all-btn') {
                appState.isBatchProcessing = true;
                renderApp();

                const filesToProcess = appState.fileQueue.filter(f => f.status === 'ready');
                await Promise.all(filesToProcess.map(fs => processSingleFile(fs, fs.fileObject)));
                
                appState.isBatchProcessing = false;
                if (appState.fileQueue.length > 0) {
                    renderApp();
                }
            }
            if (targetButton.id === 'download-all-btn') {
                handleZipDownload();
            }
        }
        else if (targetButton.id === 'advanced-options-btn') {
            const slider = document.querySelector('.advanced-slider');
            if (slider) slider.style.display = slider.style.display === 'none' ? 'flex' : 'none';
        }
        else if (targetButton.closest('.upload-area') && !fileId) {
            fileInput.click();
        }
        
        if (targetButton.closest('.crop-modal-content')) {
             if (targetButton.classList.contains('crop-shape-btn')) {
                if (!appState.cropper) return;
                const shape = targetButton.dataset.shape;
                const isCircle = shape === 'circle';
                appState.cropper.setAspectRatio(isCircle ? 1 / 1 : NaN);
                const cropBox = document.querySelector('.cropper-view-box');
                const cropFace = document.querySelector('.cropper-face');
                if (cropBox) cropBox.style.borderRadius = isCircle ? '50%' : '0';
                if (cropFace) cropFace.style.borderRadius = isCircle ? '50%' : '0';
                document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
                targetButton.classList.add('active');
            }

            if (targetButton.id === 'apply-crop-btn') {
                if (!appState.cropper || !appState.currentCropFileId) return;
                const currentFileState = appState.fileQueue.find(f => f.uniqueId === appState.currentCropFileId);
                if (!currentFileState) return;

                const cropData = appState.cropper.getData(true); 
                const originalImage = appState.cropper.image;
                const finalCanvas = document.createElement('canvas');
                const context = finalCanvas.getContext('2d');
                finalCanvas.width = cropData.width;
                finalCanvas.height = cropData.height;

                const isCircleCrop = document.querySelector('.crop-shape-btn[data-shape="circle"].active');
                let outputMimeType = 'image/jpeg';
                let formatOverride = null;

                if (isCircleCrop) {
                    context.beginPath();
                    context.arc(cropData.width / 2, cropData.height / 2, cropData.width / 2, 0, 2 * Math.PI);
                    context.closePath();
                    context.clip();
                    outputMimeType = 'image/png';
                    formatOverride = 'png';
                } else if (currentFileState.fileObject.type === 'image/png') {
                    outputMimeType = 'image/png';
                    formatOverride = 'png';
                }

                context.drawImage(
                    originalImage,   
                    cropData.x,      
                    cropData.y,      
                    cropData.width,  
                    cropData.height, 
                    0,               
                    0,               
                    cropData.width,  
                    cropData.height  
                );
                
                finalCanvas.toBlob(blob => {
                    if (!blob) {
                        alert('Cropping failed: could not create blob.');
                        return;
                    }
                    currentFileState.cropData = cropData;
                    const croppedFile = new File([blob], `cropped-${currentFileState.fileObject.name}`, { type: blob.type });
                    removeModalIfPresent();
                    processSingleFile(currentFileState, croppedFile, formatOverride);
                }, outputMimeType);
            }
        }
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.name === 'format') updateQualitySlider();
        if (e.target.id === 'quality-slider') {
            const qualityOutput = document.getElementById('quality-output');
            if (qualityOutput) qualityOutput.textContent = e.target.value;
        }
    });

    fileInput.addEventListener('change', (event) => handleFiles(event.target.files));
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
}