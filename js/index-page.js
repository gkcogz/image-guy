document.addEventListener('DOMContentLoaded', () => {

    // To be completed...
    // Bu script'in sadece ana sayfada (upload alanı olan sayfada) çalışmasını sağla
    if (!document.querySelector('.upload-area')) {
        return; 
    }

    let fileQueue = [];
    const DEFAULT_QUALITY_SETTINGS = {
        jpeg: { default: 85, min: 50, max: 95 },
        png: { default: 90, min: 60, max: 100 },
        webp: { default: 80, min: 50, max: 95 },
        avif: { default: 60, min: 30, max: 80 },
        heic: { default: 80, min: 50, max: 95 }
    };
    let cropper = null;
    let currentCropTarget = null;
    let cropHistory = [];
    let ultimateOriginalUrl = null;

    const fileInput = document.getElementById('file-input');
    const uploadArea = document.querySelector('.upload-area');
    const initialUploadAreaHTML = uploadArea.innerHTML;

    // ===============================================
    // ANA SAYFA OLAY DİNLEYİCİLERİ
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

        if (targetButton && targetButton.id === 'advanced-options-btn') {
            e.preventDefault();
            const slider = document.querySelector('.advanced-slider');
            const isHidden = slider.style.display === 'none';
            slider.style.display = isHidden ? 'flex' : 'none';
            return;
        }

        if (!targetButton && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('modal-close-btn')) {
            return;
        }

        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
                modal.remove();
            }
            return;
        }

        if (targetButton && targetButton.id === 'choose-file-btn') {
            e.preventDefault();
            fileInput.click();
        }
        if (targetButton && targetButton.id === 'optimize-all-btn') {
            startBatchOptimization();
        }
        if (targetButton && targetButton.id === 'download-all-btn') {
            handleZipDownload();
        }
        if (targetButton && targetButton.id === 'clear-all-btn') {
            resetUI();
        }
        if (targetButton && targetButton.classList.contains('btn-retry')) {
            const indexToRetry = parseInt(targetButton.dataset.fileIndex, 10);
            const formatToRetry = targetButton.dataset.format;
            const fileToRetry = fileQueue[indexToRetry];
            const listItemToRetry = document.querySelectorAll('.file-list-item')[indexToRetry];

            if (fileToRetry && listItemToRetry) {
                console.log(`Retrying file: ${fileToRetry.name} with format ${formatToRetry}`);
                processSingleFile(fileToRetry, listItemToRetry, indexToRetry, formatToRetry);
            }
        }

        if (targetButton && targetButton.id === 'crop-undo-btn') {
            if (!cropper || cropHistory.length === 0) return;
            const lastState = cropHistory.pop();
            const compareButton = currentCropTarget.querySelector('.btn-compare');
            const cropButton = currentCropTarget.querySelector('.btn-crop');
            const imageInModal = document.getElementById('image-to-crop');

            if (compareButton) {
                compareButton.dataset.optimizedUrl = lastState.optimized;
                compareButton.dataset.originalUrl = lastState.original;
            }
            if (cropButton) {
                cropButton.dataset.optimizedUrl = lastState.optimized;
            }

            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            imageInModal.src = '';
            setTimeout(() => {
                imageInModal.onload = () => {
                    cropper = new Cropper(imageInModal, {
                        viewMode: 1,
                        background: false,
                        autoCropArea: 0.8,
                        ready: function () {
                            document.querySelector('.crop-modal-content').classList.add('ready');
                            document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
                        }
                    });
                };
                imageInModal.src = lastState.optimized;
            }, 10);
            if (cropHistory.length === 0) {
                targetButton.disabled = true;
            }
        }

        if (targetButton && targetButton.classList.contains('btn-delete-item')) {
            const indexToRemove = parseInt(targetButton.dataset.fileIndex, 10);
            fileQueue.splice(indexToRemove, 1);
            if (fileQueue.length === 0) {
                resetUI();
            } else {
                updateUIForFileList();
            }
            return;
        }

        if (targetButton && targetButton.classList.contains('btn-copy')) {
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
                    copyBtn.innerHTML = `✓`;
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }, 'image/png');
            } catch (error) {
                console.error('Failed to copy image:', error);
                alert('Failed to copy image. Your browser might not fully support this action.');
            }
        }

        if (targetButton && targetButton.classList.contains('btn-compare')) {
            const originalUrl = targetButton.dataset.originalUrl;
            const optimizedUrl = targetButton.dataset.optimizedUrl;
            showComparisonModal(originalUrl, optimizedUrl);
        }

        if (targetButton && targetButton.classList.contains('btn-crop')) {
            currentCropTarget = targetButton.closest('.action-icon-group');
            const originalUrl = targetButton.dataset.originalUrl;
            const optimizedUrl = targetButton.dataset.optimizedUrl;
            showCropModal(originalUrl, optimizedUrl);
        }

        if (targetButton && targetButton.id === 'apply-crop-btn') {
            if (!cropper) return;
            const currentState = {
                optimized: currentCropTarget.querySelector('.btn-crop').dataset.optimizedUrl,
                original: currentCropTarget.querySelector('.btn-compare').dataset.originalUrl
            };
            cropHistory.push(currentState);
            const undoBtn = document.getElementById('crop-undo-btn');
            if (undoBtn) undoBtn.disabled = false;
            let isCircle = document.querySelector('.crop-shape-btn[data-shape="circle"]').classList.contains('active');
            let croppedCanvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
            if (isCircle) {
                const circleCanvas = document.createElement('canvas');
                const context = circleCanvas.getContext('2d');
                const size = Math.min(croppedCanvas.width, croppedCanvas.height);
                circleCanvas.width = size;
                circleCanvas.height = size;
                context.beginPath();
                context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
                context.closePath();
                context.clip();
                context.drawImage(croppedCanvas, 0, 0);
                croppedCanvas = circleCanvas;
            }
            const optimizedCroppedBlob = await new Promise(resolve => croppedCanvas.toBlob(resolve, 'image/png'));
            const sourceForOriginalCrop = currentCropTarget.querySelector('.btn-compare').dataset.originalUrl;
            const originalCroppedBlob = await new Promise((resolve, reject) => {
                const originalImage = new Image();
                originalImage.crossOrigin = "anonymous";
                originalImage.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const cropBoxData = cropper.getData(true);
                    const scaleX = originalImage.naturalWidth / cropper.getImageData().naturalWidth;
                    const scaleY = originalImage.naturalHeight / cropper.getImageData().naturalHeight;
                    canvas.width = cropBoxData.width * scaleX;
                    canvas.height = cropBoxData.height * scaleY;
                    ctx.drawImage(originalImage, cropBoxData.x * scaleX, cropBoxData.y * scaleY, cropBoxData.width * scaleX, cropBoxData.height * scaleY, 0, 0, canvas.width, canvas.height);
                    if (isCircle) {
                        const circleCanvas = document.createElement('canvas');
                        const context = circleCanvas.getContext('2d');
                        const size = Math.min(canvas.width, canvas.height);
                        circleCanvas.width = size;
                        circleCanvas.height = size;
                        context.beginPath();
                        context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
                        context.closePath();
                        context.clip();
                        context.drawImage(canvas, 0, 0);
                        circleCanvas.toBlob(resolve, 'image/png');
                    } else {
                        canvas.toBlob(resolve, 'image/png');
                    }
                };
                originalImage.onerror = reject;
                originalImage.src = sourceForOriginalCrop;
            });
            const newOptimizedUrl = URL.createObjectURL(optimizedCroppedBlob);
            const newOriginalUrl = URL.createObjectURL(originalCroppedBlob);
            const downloadLink = currentCropTarget.querySelector('.btn-download-item');
            const compareButton = currentCropTarget.querySelector('.btn-compare');
            const cropButton = currentCropTarget.querySelector('.btn-crop');
            const copyButton = currentCropTarget.querySelector('.btn-copy');
            const base64Button = currentCropTarget.querySelector('.btn-base64');
            if (downloadLink) downloadLink.href = newOptimizedUrl;
            if (compareButton) {
                compareButton.dataset.optimizedUrl = newOptimizedUrl;
                compareButton.dataset.originalUrl = newOriginalUrl;
            }
            if (cropButton) {
                cropButton.dataset.optimizedUrl = newOptimizedUrl;
            }
            if (copyButton) {
                copyButton.dataset.optimizedUrl = newOptimizedUrl;
            }
            if (base64Button) {
                base64Button.dataset.optimizedUrl = newOptimizedUrl;
            }
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                cropper.destroy();
                cropper = null;
                modal.remove();
            }
        }
        if (targetButton && targetButton.classList.contains('crop-shape-btn')) {
            if (!cropper) return;
            const shape = targetButton.dataset.shape;
            const cropBox = document.querySelector('.cropper-view-box');
            const cropFace = document.querySelector('.cropper-face');
            if (shape === 'circle') {
                cropper.setAspectRatio(1 / 1);
                if (cropBox) cropBox.style.borderRadius = '50%';
                if (cropFace) cropFace.style.borderRadius = '50%';
            } else {
                cropper.setAspectRatio(NaN);
                if (cropBox) cropBox.style.borderRadius = '0';
                if (cropFace) cropFace.style.borderRadius = '0';
            }
            document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
            targetButton.classList.add('active');
        }
        if (targetButton && targetButton.classList.contains('btn-base64')) {
            const imageUrl = targetButton.dataset.optimizedUrl;
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    showBase64Modal(reader.result);
                };
                reader.readAsDataURL(blob);
            } catch (error) {
                console.error('Failed to get Base64 data:', error);
                alert('Could not generate Base64 code.');
            }
        }
        if (targetButton && targetButton.id === 'crop-reset-btn') {
            if (!cropper) return;
            if (currentCropTarget) {
                const cropButton = currentCropTarget.querySelector('.btn-crop');
                const compareButton = currentCropTarget.querySelector('.btn-compare');
                const copyButton = currentCropTarget.querySelector('.btn-copy');
                const base64Button = currentCropTarget.querySelector('.btn-base64');
                const downloadLink = currentCropTarget.querySelector('.btn-download-item');
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
            const undoBtn = document.getElementById('crop-undo-btn');
            if (undoBtn) {
                undoBtn.disabled = true;
                cropHistory = [];
            }
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                cropper.destroy();
                cropper = null;
                modal.remove();
            }
        }
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.name === 'format') {
            updateQualitySlider();
        }
        if (e.target.id === 'quality-slider') {
            document.getElementById('quality-output').textContent = e.target.value;
        }
    });

    // ===============================================
    // ANA SAYFA YARDIMCI FONKSİYONLAR
    // ===============================================
    function sanitizeFilename(filename) {
        const extension = filename.slice(filename.lastIndexOf('.'));
        let baseName = filename.slice(0, filename.lastIndexOf('.'));
        baseName = baseName.toLowerCase();
        baseName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        baseName = baseName.replace(/\s+/g, '-').replace(/-+/g, '-');
        baseName = baseName.replace(/[^a-z0-9-]/g, '');
        if (!baseName) {
            baseName = `file-${Date.now()}`;
        }
        return baseName + extension;
    }

    function handleFiles(files) {
        fileQueue = [];
        cropHistory = [];
        for (const file of files) {
            fileQueue.push(file);
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

    const createProgressBarHTML = (text) => `
    <div class="progress-bar-container">
        <div class="progress-bar-fill progress-bar-fill-indeterminate"></div>
        <span class="progress-bar-text">${text}</span>
    </div>
    `;

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
                    reject(new Error(`Upload failed with status: ${xhr.status}`));
                }
            };
            xhr.onerror = () => {
                reject(new Error('Network error during upload.'));
            };
            xhr.send(file);
        });
    }

    function updateUIForFileList() {
        uploadArea.innerHTML = '';
        const fileListElement = document.createElement('ul');
        fileListElement.className = 'file-list';
        let containsPng = false;
        fileQueue.forEach((file, index) => {
            if (file.name.toLowerCase().endsWith('.png')) {
                containsPng = true;
            }
            const formattedSize = formatFileSize(file.size);
            const listItem = document.createElement('li');
            listItem.className = 'file-list-item';
            listItem.dataset.originalFilename = file.name;
            listItem.innerHTML = `
            <div class="file-info">
                <span class="file-icon">📄</span>
                <div class="file-details">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formattedSize}</span>
                </div>
            </div>
            <div class="file-item-status">
                <span>Ready</span>
                <button class="icon-btn btn-delete-item" data-file-index="${index}" title="Remove file">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>`;
            fileListElement.appendChild(listItem);
        });
        const formatOptionsHTML = `...`; // Bu kısım uzun olduğu için kestim, ama kodda tam hali var
        const advancedSliderHTML = `...`;
        let smartTipHTML = '';
        if (containsPng) {
            smartTipHTML = `<div class="smart-tip">💡 <strong>Pro Tip:</strong> For photos or images without transparency, choosing the <strong>JPG</strong> format often provides the smallest file size.</div>`;
        }
        const actionArea = document.createElement('div');
        actionArea.className = 'action-area';
        actionArea.innerHTML = `...`; // Uzun HTML
        uploadArea.appendChild(fileListElement);
        uploadArea.appendChild(actionArea);
        uploadArea.classList.add("file-selected");
        updateQualitySlider();
    }

    function updateQualitySlider() {
        const selectedFormatElement = document.querySelector('input[name="format"]:checked');
        if (!selectedFormatElement) return;

        const selectedFormat = selectedFormatElement.value;
        const advancedContainer = document.querySelector('.advanced-slider');
        if (!advancedContainer) return;

        if (DEFAULT_QUALITY_SETTINGS[selectedFormat]) {
            const settings = DEFAULT_QUALITY_SETTINGS[selectedFormat];
            const qualitySlider = document.getElementById('quality-slider');
            const qualityOutput = document.getElementById('quality-output');
            if(qualitySlider && qualityOutput){
                qualitySlider.min = settings.min;
                qualitySlider.max = settings.max;
                qualitySlider.value = settings.default;
                qualityOutput.textContent = settings.default;
                advancedContainer.style.visibility = 'visible';
            }
        } else {
            advancedContainer.style.visibility = 'hidden';
        }
    }

    async function processSingleFile(file, listItem, index, retryFormat = null) {
        // ... Fonksiyonun geri kalanı ...
    }
    async function startBatchOptimization() {
        // ... Fonksiyonun geri kalanı ...
    }
    function updateMainButtonAfterCompletion() {
        // ... Fonksiyonun geri kalanı ...
    }
    async function handleZipDownload() {
        // ... Fonksiyonun geri kalanı ...
    }
    function resetUI() {
        // ... Fonksiyonun geri kalanı ...
    }
    function showComparisonModal(originalUrl, optimizedUrl) {
        // ... Fonksiyonun geri kalanı ...
    }
    function showCropModal(originalUrl, optimizedUrl) {
        // ... Fonksiyonun geri kalanı ...
    }
    function showBase64Modal(base64String) {
        // ... Fonksiyonun geri kalanı ...
    }
});