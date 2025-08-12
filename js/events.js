// js/events.js

import { appState, resetState, findFileById } from './state.js';
import { renderApp, updateQualitySlider, removeModalIfPresent, showComparisonModal, showCropModal } from './ui.js';
import { processSingleFile, handleZipDownload } from './api.js'; // handleZipDownload buraya import edildi.

async function getCroppedSectionFromUrl(imageUrl, cropData) {
    return new Promise((resolve, reject) => {
        const image = new Image();
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

function handleFiles(files) {
    resetState();
    renderApp();
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
}

export function initializeEventListeners() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('file-input');

    document.body.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button');
        
        if (e.target.classList.contains('modal-overlay') || (targetButton && targetButton.classList.contains('modal-close-btn'))) {
            removeModalIfPresent();
        }
        
        if (!targetButton) return;

        const listItem = e.target.closest('.file-list-item');
        const fileId = listItem?.dataset.fileId;
        const fileState = fileId ? findFileById(fileId) : null;
        
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
        }
        else if (targetButton.id === 'clear-all-btn') {
            resetState();
            renderApp();
        }
        else if (targetButton.id === 'optimize-all-btn') {
            const filesToProcess = appState.fileQueue.filter(f => f.status === 'ready');
            await Promise.all(filesToProcess.map(fs => processSingleFile(fs, fs.fileObject)));
        }
        else if (targetButton.id === 'download-all-btn') {
            // Yorum satırı kaldırıldı ve fonksiyon çağrısı eklendi.
            handleZipDownload();
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
                const currentFileState = findFileById(appState.currentCropFileId);
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
                    cropData.x, cropData.y,      
                    cropData.width, cropData.height, 
                    0, 0,               
                    cropData.width, cropData.height  
                );
                
                finalCanvas.toBlob(blob => {
                    if (!blob) return alert('Cropping failed.');
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