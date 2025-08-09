// ==========================================================
// UPLOADER INITIALIZATION
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeUploader();
});

function initializeUploader() {
    // Güvenlik Kontrolü (Guard Clause):
    // Eğer uploader alanı sayfada yoksa, bu sayfada uploader mantığının
    // çalışmasına gerek yoktur, bu yüzden fonksiyondan çıkılır.
    if (!document.querySelector('.upload-area')) {
        return;
    }

    // ===============================================
    // APPLICATION STATE & CONSTANTS
    // ===============================================

    const appState = {
        fileQueue: [],
        cropper: null,
        currentCropTarget: null,
        currentCropIndex: -1,
        cropHistory: [],
        ultimateOriginalUrl: null,
    };

    const DEFAULT_QUALITY_SETTINGS = {
        jpeg: { default: 85, min: 50, max: 95 },
        png: { default: 90, min: 60, max: 100 },
        webp: { default: 80, min: 50, max: 95 },
        avif: { default: 60, min: 30, max: 80 },
        heic: { default: 80, min: 50, max: 95 }
    };

    // ===============================================
    // DOM ELEMENT DEFINITIONS
    // ===============================================

    const fileInput = document.getElementById('file-input');
    const uploadArea = document.querySelector('.upload-area');
    const initialUploadAreaHTML = uploadArea.innerHTML;

    // ===============================================
    // HELPER FUNCTIONS (Dynamic Loading)
    // ===============================================

    const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Script load error for ${src}`));
        document.head.appendChild(script);
    });

    const loadStyle = (href) => new Promise((resolve, reject) => {
        if (document.querySelector(`link[href="${href}"]`)) {
            return resolve();
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Style load error for ${href}`));
        document.head.appendChild(link);
    });
    
    // ===============================================
    // UPLOADER-SPECIFIC HELPER FUNCTIONS
    // ===============================================

    function sanitizeFilename(filename) {
        const extension = filename.slice(filename.lastIndexOf('.'));
        let baseName = filename.slice(0, filename.lastIndexOf('.'));
        baseName = baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!baseName) {
            baseName = `file-${Date.now()}`;
        }
        return baseName + extension;
    }

    function handleFiles(files) {
        appState.fileQueue = [];
        appState.cropHistory = [];
        for (const file of files) {
            appState.fileQueue.push(file);
        }
        updateUIForFileList();
        fileInput.value = null;
    }

    function formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function resetUI() {
        appState.fileQueue = [];
        appState.cropHistory = [];
        uploadArea.innerHTML = initialUploadAreaHTML;
        uploadArea.classList.remove('file-selected');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===============================================
    // UI & MODAL FUNCTIONS
    // ===============================================

    const createProgressBarHTML = (text) => `
        <div class="progress-bar-container">
            <div class="progress-bar-fill progress-bar-fill-indeterminate"></div>
            <span class="progress-bar-text">${text}</span>
        </div>
    `;

    function updateUIForFileList() {
        uploadArea.innerHTML = '';
        const fileListElement = document.createElement('ul');
        fileListElement.className = 'file-list';
        let containsPng = false;

        appState.fileQueue.forEach((file, index) => {
            if (file.name.toLowerCase().endsWith('.png')) {
                containsPng = true;
            }
            const formattedSize = formatFileSize(file.size);
            const listItem = document.createElement('li');
            listItem.className = 'file-list-item';
            listItem.dataset.originalFilename = file.name;

            const fileInfoDiv = document.createElement('div');
            fileInfoDiv.className = 'file-info';
            const fileIconSpan = document.createElement('span');
            fileIconSpan.className = 'file-icon';
            fileIconSpan.textContent = '📄';
            const fileDetailsDiv = document.createElement('div');
            fileDetailsDiv.className = 'file-details';
            const fileNameSpan = document.createElement('span');
            fileNameSpan.className = 'file-name';
            fileNameSpan.textContent = file.name;
            const fileSizeSpan = document.createElement('span');
            fileSizeSpan.className = 'file-size';
            fileSizeSpan.textContent = formattedSize;
            fileDetailsDiv.append(fileNameSpan, fileSizeSpan);
            fileInfoDiv.append(fileIconSpan, fileDetailsDiv);
            const fileItemStatusDiv = document.createElement('div');
            fileItemStatusDiv.className = 'file-item-status';
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Ready';
            const deleteButton = document.createElement('button');
            deleteButton.className = 'icon-btn btn-delete-item';
            deleteButton.dataset.fileIndex = index;
            deleteButton.title = 'Remove file';
            deleteButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            fileItemStatusDiv.append(statusSpan, deleteButton);
            listItem.append(fileInfoDiv, fileItemStatusDiv);
            fileListElement.appendChild(listItem);
        });

        const actionArea = document.createElement('div');
        actionArea.className = 'action-area';

        const formatOptionsHTML = `
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
        </div>`;

        const advancedSliderHTML = `
            <div class="advanced-slider" style="display: none;">
                <div class="quality-label-container">
                    <label for="quality-slider">Quality:</label>
                </div>
                <input type="range" id="quality-slider" name="quality" min="50" max="95" value="85">
                <output for="quality-slider" id="quality-output">85</output>
            </div>`;

        let smartTipHTML = containsPng ? `<div class="smart-tip">💡 <strong>Pro Tip:</strong> For photos or images without transparency, choosing the <strong>JPG</strong> format often provides the smallest file size.</div>` : '';

        const actionButtonsHTML = `
            <div class="action-buttons-container initial-actions">
                <button class="btn btn-secondary" id="clear-all-btn">Start Over</button>
                <button class="btn btn-primary" id="optimize-all-btn">Optimize All (${appState.fileQueue.length} files)</button>
                <button class="icon-btn" id="advanced-options-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    <span class="icon-tooltip">Advanced Settings</span>
                </button>
            </div>`;

        actionArea.innerHTML = formatOptionsHTML + advancedSliderHTML + actionButtonsHTML + smartTipHTML;

        uploadArea.append(fileListElement, actionArea);
        uploadArea.classList.add("file-selected");
        updateQualitySlider();
    }

    function updateQualitySlider() {
        const selectedFormat = document.querySelector('input[name="format"]:checked').value;
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
            if (advancedButton) {
                advancedButton.style.display = 'inline-flex';
            }
        } else {
            advancedContainer.style.display = 'none';
            if (advancedButton) {
                advancedButton.style.display = 'none';
            }
        }
    }
    
    function showComparisonModal(originalUrl, optimizedUrl) {
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <button class="modal-close-btn">&times;</button>
                    <img-comparison-slider>
                        <img slot="first" src="${originalUrl}" />
                        <img slot="second" src="${optimizedUrl}" />
                    </img-comparison-slider>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async function showCropModal(originalUrl, optimizedUrl) {
        try {
            if (!window.Cropper) {
                await Promise.all([
                    loadScript('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js'),
                    loadStyle('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css')
                ]);
            }
        } catch (error) {
            console.error("Failed to load Cropper.js assets:", error);
            alert("An error occurred while loading the image editor. Please try again.");
            return;
        }

        appState.cropHistory = [];
        appState.ultimateOriginalUrl = originalUrl;

        const modalHTML = `
            <div class="modal-overlay">
                <div class="crop-modal-content">
                    <button class="modal-close-btn">&times;</button>
                    <h2>Edit & Crop Image</h2>
                    <div class="crop-image-container">
                        <img id="image-to-crop" src="${optimizedUrl}" data-original-url="${originalUrl}">
                    </div>
                    <div class="crop-actions">
                        <button class="btn btn-secondary crop-shape-btn" data-shape="rectangle">Rectangle</button>
                        <button class="btn btn-secondary crop-shape-btn" data-shape="circle">Circle</button>
                        
                        <div class="tooltip-wrapper">
                            <button class="btn btn-secondary" id="crop-reset-btn">Reset All</button>
                            <span class="tooltip-text">Warning: All changes will be reset.</span>
                        </div>

                        <button class="btn btn-primary" id="apply-crop-btn">Apply Crop</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const image = document.getElementById('image-to-crop');
        const modalContent = document.querySelector('.crop-modal-content');
        image.crossOrigin = "anonymous";

        image.onload = () => {
             if (appState.cropper) {
                appState.cropper.destroy();
             }
             appState.cropper = new Cropper(image, {
                viewMode: 1,
                background: false,
                autoCropArea: 0.8,
                ready: function () {
                    modalContent.classList.add('ready');
                    document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
                }
            });
        };
        if (image.complete) {
            image.onload();
        }
    }

    function showBase64Modal(base64String) {
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content base64-modal-content">
                    <button class="modal-close-btn">&times;</button>
                    <h2>Base64 Code</h2>
                    <p>You can use this code directly in your CSS or HTML.</p>
                    <div class="base64-container">
                        <textarea class="base64-textarea" readonly>${base64String}</textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="check-base64-btn">
                            <span>Check Code</span>
                        </button>
                        <div class="modal-actions-group-right">
                            <button class="btn btn-primary" id="copy-base64-btn">
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                <span>Copy to Clipboard</span>
                            </button>
                            <span class="copy-success-msg">Copied!</span>
                        </div>
                    </div>
                    </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const textarea = document.querySelector('.base64-textarea');
        textarea.select();

        const copyBtn = document.getElementById('copy-base64-btn');
        const checkBtn = document.getElementById('check-base64-btn');
        const successMsg = document.querySelector('.copy-success-msg');

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(base64String).then(() => {
                successMsg.classList.add('visible');
                setTimeout(() => {
                    successMsg.classList.remove('visible');
                }, 2000);
            });
        });

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

    // ===============================================
    // CORE PROCESSING LOGIC
    // ===============================================

    function uploadWithProgress(url, file, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };
            xhr.onerror = () => reject(new Error('Network error during upload.'));
            xhr.send(file);
        });
    }
    
    async function processSingleFile(file, listItem, index, retryFormat = null) {
        const statusElement = listItem.querySelector('.file-item-status');
        const selectedFormat = retryFormat !== null ? retryFormat : document.querySelector('input[name="format"]:checked').value;
        const qualitySlider = document.getElementById('quality-slider');
        const qualityValue = qualitySlider ? qualitySlider.value : null;
        const originalObjectUrl = URL.createObjectURL(file);

        try {
            statusElement.innerHTML = createProgressBarHTML('Preparing...');
            const safeFilename = sanitizeFilename(file.name);
            
            const linkResponse = await fetch('/.netlify/functions/get-upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: safeFilename, fileType: file.type }),
            });
            if (!linkResponse.ok) throw new Error('Could not get upload link.');
            const { uploadUrl, key } = await linkResponse.json();
            
            if (!uploadUrl || !key) {
                throw new Error("API response missing 'uploadUrl' or 'key'.");
            }

            const uploadProgressBarContainer = `<div class="progress-bar-container"><div class="progress-bar-fill" style="width: 0%;"></div><span class="progress-bar-text">Uploading 0%</span></div>`;
            statusElement.innerHTML = uploadProgressBarContainer;
            const progressBarFill = listItem.querySelector('.progress-bar-fill');
            const progressBarText = listItem.querySelector('.progress-bar-text');
            
            await new Promise(resolve => setTimeout(resolve, 50));
            await uploadWithProgress(uploadUrl, file, (percent) => {
                progressBarFill.style.width = `${percent.toFixed(0)}%`;
                progressBarText.textContent = `Uploading ${percent.toFixed(0)}%`;
            });
            await new Promise(resolve => setTimeout(resolve, 400));
            
            statusElement.innerHTML = createProgressBarHTML('Optimizing...');
            const optimizePayload = { key: key, outputFormat: selectedFormat, quality: qualityValue };
            
            const optimizeResponse = await fetch('/.netlify/functions/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(optimizePayload),
            });
            if (!optimizeResponse.ok) {
                 const errorData = await optimizeResponse.json().catch(() => ({ error: "Optimization failed." }));
                 throw new Error(errorData.error);
            }
            const data = await optimizeResponse.json();
            
            if (!data.downloadUrl || !data.newFilename || data.originalSize === undefined || data.optimizedSize === undefined) {
                throw new Error('Optimization API response is incomplete or invalid.');
            }

            const originalFullName = listItem.dataset.originalFilename || file.name;
            const originalBaseName = originalFullName.slice(0, originalFullName.lastIndexOf('.'));
            const newExtension = data.newFilename.slice(data.newFilename.lastIndexOf('.'));
            const finalDownloadName = originalBaseName + newExtension;

            statusElement.innerHTML = '';
            const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100);
            
            let statusTextSpan;
            if (savings >= 1) {
                statusTextSpan = document.createElement('span');
                statusTextSpan.className = 'savings';
                statusTextSpan.textContent = `✓ ${savings.toFixed(0)}% Saved`;
            } else {
                statusTextSpan = document.createElement('span');
                statusTextSpan.className = 'savings-info';
                statusTextSpan.textContent = `✓ Already Optimized`;
            }
            
            const actionGroup = document.createElement('div');
            actionGroup.className = 'action-icon-group';
            
            const compareBtn = document.createElement('button');
            compareBtn.className = 'icon-btn btn-compare';
            compareBtn.title = 'Compare';
            compareBtn.dataset.originalUrl = originalObjectUrl;
            compareBtn.dataset.optimizedUrl = data.downloadUrl;
            compareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3m-6 18v-5"></path><path d="M6 3h12"></path></svg>`;

            const cropBtn = document.createElement('button');
            cropBtn.className = 'icon-btn btn-crop';
            cropBtn.title = 'Edit & Crop';
            cropBtn.dataset.originalUrl = originalObjectUrl;
            cropBtn.dataset.optimizedUrl = data.downloadUrl;
            cropBtn.dataset.initialOptimizedUrl = data.downloadUrl;
            cropBtn.dataset.fileIndex = index;
            cropBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>`;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'icon-btn btn-copy';
            copyBtn.title = 'Copy Image';
            copyBtn.dataset.optimizedUrl = data.downloadUrl;
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

            const base64Btn = document.createElement('button');
            base64Btn.className = 'icon-btn btn-base64';
            base64Btn.title = 'Get Base64 Code';
            base64Btn.dataset.optimizedUrl = data.downloadUrl;
            base64Btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;

            const downloadLink = document.createElement('a');
            downloadLink.className = 'btn btn-download-item';
            downloadLink.href = data.downloadUrl;
            downloadLink.textContent = 'Download';
            downloadLink.setAttribute('download', finalDownloadName);

            actionGroup.append(compareBtn, cropBtn, copyBtn, base64Btn, downloadLink);
            statusElement.append(statusTextSpan, actionGroup);

        } catch (error) {
            console.error(`Processing failed for '${file.name}':`, error);
            
            statusElement.innerHTML = '';
            const errorSpan = document.createElement('span');
            errorSpan.className = 'status-failed';
            errorSpan.textContent = `Failed! ${error.message}`;

            const retryButton = document.createElement('button');
            retryButton.className = 'icon-btn btn-retry';
            retryButton.dataset.fileIndex = index;
            retryButton.dataset.format = selectedFormat;
            retryButton.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span class="icon-tooltip">Retry</span>`;
            
            statusElement.append(errorSpan, retryButton);
        }
    }

    async function startBatchOptimization() {
        console.log(`Starting optimization for ${appState.fileQueue.length} files...`);
        const optimizeBtn = document.getElementById('optimize-all-btn');
        const clearBtn = document.getElementById('clear-all-btn');
        if (optimizeBtn) { optimizeBtn.textContent = 'Processing...'; optimizeBtn.disabled = true; }
        if (clearBtn) { clearBtn.disabled = true; }

        const listItems = document.querySelectorAll('.file-list-item');
        const batchSize = 5;

        for (let i = 0; i < appState.fileQueue.length; i += batchSize) {
            const batch = appState.fileQueue.slice(i, i + batchSize);
            const batchListItems = Array.from(listItems).slice(i, i + batchSize);
            
            const optimizationPromises = batch.map((file, index) => {
                const globalIndex = i + index;
                return processSingleFile(file, batchListItems[index], globalIndex);
            });
            await Promise.all(optimizationPromises);
        }
        updateMainButtonAfterCompletion();
    }

    function updateMainButtonAfterCompletion() {
        const actionArea = document.querySelector('.action-area');
        if (actionArea) {
            actionArea.innerHTML = `
                <div class="action-buttons-container">
                    <button class="btn btn-primary" id="download-all-btn">Download All as .ZIP</button>
                    <button class="btn btn-secondary" id="clear-all-btn">Start Over</button>
                </div>
            `;
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
            const listItems = document.querySelectorAll('.file-list-item');

            const fetchPromises = Array.from(listItems).map(item => {
                const downloadLink = item.querySelector('a.btn-download-item');
                if (!downloadLink) return Promise.resolve(null);

                const fileUrl = downloadLink.href;
                const fileName = downloadLink.getAttribute('download');

                return fetch(fileUrl)
                    .then(response => {
                        if (!response.ok) throw new Error(`Failed to fetch '${fileUrl}'`);
                        return response.blob();
                    })
                    .then(blob => ({ name: fileName, blob: blob }));
            });

            const files = (await Promise.all(fetchPromises)).filter(f => f !== null);
            files.forEach(file => {
                zip.file(file.name, file.blob);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const tempUrl = URL.createObjectURL(zipBlob);
            const tempLink = document.createElement('a');
            tempLink.href = tempUrl;
            tempLink.setAttribute('download', 'image-guy-optimized.zip');
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            URL.revokeObjectURL(tempUrl);

            downloadAllBtn.textContent = 'Download All as .ZIP';
            downloadAllBtn.disabled = false;
        } catch (error) {
            console.error('Failed to create ZIP file:', error);
            alert('An error occurred while creating the ZIP file. Please try again.');
            downloadAllBtn.textContent = 'Download All as .ZIP';
            downloadAllBtn.disabled = false;
        }
    }
    
    // ===============================================
    // EVENT LISTENERS
    // ===============================================

    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) { handleFiles(files); }
    });

    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.classList.remove('drag-over'); });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) { handleFiles(files); }
    });

    document.body.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button');

        if (!targetButton && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('modal-close-btn')) {
            return;
        }

        if (targetButton && targetButton.id === 'advanced-options-btn') {
            e.preventDefault();
            const slider = document.querySelector('.advanced-slider');
            if (slider) {
                const isHidden = slider.style.display === 'none';
                slider.style.display = isHidden ? 'flex' : 'none';
            }
            return; 
        }

        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                if (appState.cropper) {
                    appState.cropper.destroy();
                    appState.cropper = null;
                }
                modal.remove();
            }
            return;
        }
        
        if (targetButton) {
            if (targetButton.id === 'choose-file-btn') {
                e.preventDefault();
                fileInput.click();
            }
            if (targetButton.id === 'optimize-all-btn') {
                startBatchOptimization();
            }
            if (targetButton.id === 'download-all-btn') {
                handleZipDownload();
            }
            if (targetButton.id === 'clear-all-btn') {
                resetUI();
            }
            if (targetButton.classList.contains('btn-retry')) {
                const indexToRetry = parseInt(targetButton.dataset.fileIndex, 10);
                const formatToRetry = targetButton.dataset.format; 
                const fileToRetry = appState.fileQueue[indexToRetry];
                const listItemToRetry = document.querySelectorAll('.file-list-item')[indexToRetry];
                if (fileToRetry && listItemToRetry) {
                    processSingleFile(fileToRetry, listItemToRetry, indexToRetry, formatToRetry);
                }
            }
            if (targetButton.classList.contains('btn-delete-item')) {
                const indexToRemove = parseInt(targetButton.dataset.fileIndex, 10);
                appState.fileQueue.splice(indexToRemove, 1);
                if (appState.fileQueue.length === 0) {
                    resetUI();
                } else {
                    updateUIForFileList();
                }
            }
            if (targetButton.classList.contains('btn-copy')) {
                const copyBtn = targetButton;
                const imageUrl = copyBtn.dataset.optimizedUrl;
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = await createImageBitmap(blob);
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(async (pngBlob) => {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                        const originalHTML = copyBtn.innerHTML;
                        copyBtn.innerHTML = '✓';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.innerHTML = originalHTML;
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    }, 'image/png');
                } catch (error) {
                    console.error('Could not copy image:', error);
                    alert('Could not copy image. Your browser may not fully support this action.');
                }
            }
            if (targetButton.classList.contains('btn-compare')) {
                const originalUrl = targetButton.dataset.originalUrl;
                const optimizedUrl = targetButton.dataset.optimizedUrl;
                showComparisonModal(originalUrl, optimizedUrl);
            }
            if (targetButton.classList.contains('btn-crop')) {
                appState.currentCropTarget = targetButton.closest('.action-icon-group');
                appState.currentCropIndex = parseInt(targetButton.dataset.fileIndex, 10);
                const originalUrl = targetButton.dataset.originalUrl;
                const optimizedUrl = targetButton.dataset.optimizedUrl;
                await showCropModal(originalUrl, optimizedUrl);
            }

            // GÜNCELLENMİŞ VE DÜZELTİLMİŞ apply-crop-btn KOD BLOĞU
            if (targetButton && targetButton.id === 'apply-crop-btn') {
                if (!appState.cropper || appState.currentCropIndex < 0) return;
            
                async function processBlob(blob, format) {
                    if (!blob) {
                        console.error("Cropping failed to produce a blob.");
                        alert("An error occurred during cropping. Please try again.");
                        return;
                    }
            
                    const fileIndex = appState.currentCropIndex;
                    const listItem = document.querySelectorAll('.file-list-item')[fileIndex];
                    if (!listItem) return;
            
                    const originalFullName = listItem.dataset.originalFilename || `cropped-image.${format}`;
                    const originalBaseName = originalFullName.slice(0, originalFullName.lastIndexOf('.'));
                    const newCroppedFile = new File([blob], `${originalBaseName}-cropped.${format}`, { type: `image/${format}` });
            
                    if (appState.fileQueue[fileIndex]) {
                        appState.fileQueue[fileIndex] = newCroppedFile;
                    } else {
                        return;
                    }
            
                    const modal = document.querySelector('.modal-overlay');
                    if (modal) {
                        appState.cropper.destroy();
                        appState.cropper = null;
                        modal.remove();
                    }
            
                    console.log(`Re-optimizing cropped file at index ${fileIndex} to format ${format}...`);
                    await processSingleFile(newCroppedFile, listItem, fileIndex, format);
                }

                const isCircleCrop = document.querySelector('.crop-shape-btn[data-shape="circle"].active');
            
                const selectedFormat = isCircleCrop ? 'png' : (document.querySelector('input[name="format"]:checked') ? document.querySelector('input[name="format"]:checked').value : 'jpeg');
                
                let exportMimeType = 'image/jpeg';
                if (selectedFormat === 'png') exportMimeType = 'image/png';
                else if (selectedFormat === 'webp') exportMimeType = 'image/webp';
                
                const croppedCanvas = appState.cropper.getCroppedCanvas({
                    imageSmoothingQuality: 'high'
                });
            
                if (!isCircleCrop) {
                    croppedCanvas.toBlob((blob) => {
                        processBlob(blob, selectedFormat);
                    }, exportMimeType, 0.9);
                    return;
                }
                
                const circularCanvas = document.createElement('canvas');
                const context = circularCanvas.getContext('2d');
            
                circularCanvas.width = croppedCanvas.width;
                circularCanvas.height = croppedCanvas.height;
            
                context.beginPath();
                context.arc(
                    croppedCanvas.width / 2,
                    croppedCanvas.height / 2,
                    croppedCanvas.width / 2,
                    0,
                    2 * Math.PI
                );
                context.closePath();
                context.clip();
            
                context.drawImage(croppedCanvas, 0, 0);
            
                circularCanvas.toBlob((blob) => {
                    processBlob(blob, 'png');
                }, 'image/png');
            }

            if (targetButton.classList.contains('crop-shape-btn')) {
                if (!appState.cropper) return;
                const shape = targetButton.dataset.shape;
                const cropBox = document.querySelector('.cropper-view-box');
                const cropFace = document.querySelector('.cropper-face');
                
                if (shape === 'circle') {
                    appState.cropper.setAspectRatio(1/1);
                    if (cropBox) cropBox.style.borderRadius = '50%';
                    if (cropFace) cropFace.style.borderRadius = '50%';
                } else {
                    appState.cropper.setAspectRatio(NaN);
                    if (cropBox) cropBox.style.borderRadius = '0';
                    if (cropFace) cropFace.style.borderRadius = '0';
                }
                
                document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
                targetButton.classList.add('active');
            }
            if (targetButton.classList.contains('btn-base64')) {
                const imageUrl = targetButton.dataset.optimizedUrl;
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => { showBase64Modal(reader.result); };
                    reader.readAsDataURL(blob);
                } catch (error) {
                    console.error('Could not get Base64 data:', error);
                    alert('Could not generate Base64 code.');
                }
            }
            if (targetButton.id === 'crop-reset-btn') {
                if (!appState.cropper) return;
                if (appState.currentCropTarget) {
                    const cropButton = appState.currentCropTarget.querySelector('.btn-crop');
                    const compareButton = appState.currentCropTarget.querySelector('.btn-compare');
                    const copyButton = appState.currentCropTarget.querySelector('.btn-copy');
                    const base64Button = appState.currentCropTarget.querySelector('.btn-base64');
                    const downloadLink = appState.currentCropTarget.querySelector('.btn-download-item');
        
                    const initialOriginalUrl = cropButton.dataset.originalUrl;
                    const initialOptimizedUrl = cropButton.dataset.initialOptimizedUrl;
        
                    if (cropButton) cropButton.dataset.optimizedUrl = initialOptimizedUrl;
                    if (compareButton) {
                        compareButton.dataset.originalUrl = initialOriginalUrl;
                        compareButton.dataset.optimizedUrl = initialOptimizedUrl;
                    }
                    if (copyButton) copyButton.dataset.optimizedUrl = initialOptimizedUrl;
                    if (base64Button) base64Button.dataset.optimizedUrl = initialOptimizedUrl;
                    if (downloadLink) downloadLink.href = initialOptimizedUrl;
                }
        
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    appState.cropper.destroy();
                    appState.cropper = null;
                    modal.remove();
                }
            }
        }
    });
    
    document.body.addEventListener('change', (e) => {
        if (e.target.name === 'format') {
            updateQualitySlider();
        }
        if (e.target.id === 'quality-slider') {
            const qualityOutput = document.getElementById('quality-output');
            if(qualityOutput) {
                qualityOutput.textContent = e.target.value;
            }
        }
    });
}