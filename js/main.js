let fileQueue = []; 

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');
const initialUploadAreaHTML = uploadArea.innerHTML; // Save the initial state for the reset button

// Main event listener for dynamic buttons inside the upload area
uploadArea.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
    if (e.target.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
    if (e.target.id === 'download-all-btn') {
        handleZipDownload();
    }
    if (e.target.id === 'clear-all-btn') {
        resetUI();
    }
});

// Event listener for file selection via the input
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) { handleFiles(files); }
});

// Event listeners for Drag & Drop functionality
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) { handleFiles(files); }
});

// Event listener for the dynamically created "Compare" modal and Crop buttons
document.body.addEventListener('click', (e) => {
    // Compare Modal
    if (e.target.classList.contains('btn-compare')) {
        const originalUrl = e.target.dataset.originalUrl;
        const optimizedUrl = e.target.dataset.optimizedUrl;
        showComparisonModal(originalUrl, optimizedUrl);
    }
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
    // Crop Modal (from previous implementation)
    if (e.target.classList.contains('btn-crop')) {
        currentCropTarget = e.target.closest('.result-buttons');
        const optimizedUrl = e.target.dataset.optimizedUrl;
        showCropModal(optimizedUrl);
    }
    if (e.target.id === 'apply-crop-btn') {
        // ... Crop logic would go here if re-implemented
    }
});

// ===============================================
// FUNCTIONS
// ===============================================

// Handles newly added files and updates the UI
function handleFiles(files) {
    fileQueue = [];
    for (const file of files) { fileQueue.push(file); }
    updateUIForFileList();
}

// Creates the UI for the file list and format options
function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';
    fileQueue.forEach(file => {
        const formattedSize = formatFileSize(file.size);
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        listItem.innerHTML = `<div class="file-info"><span class="file-icon">📄</span><div class="file-details"><span class="file-name">${file.name}</span><span class="file-size">${formattedSize}</span></div></div><div class="file-item-status">Ready</div>`;
        fileListElement.appendChild(listItem);
    });
    
    const formatOptionsHTML = `
        <div class="format-options-header">
            <span class="format-label">Output Format:</span>
            <div class="tooltip-container">
                <span class="info-icon">?</span>
                <div class="tooltip-content">
                    <h4>JPEG (.jpg)</h4><p>Best for photographs.</p><hr>
                    <h4>PNG</h4><p>Best for graphics with transparency.</p><hr>
                    <h4>WebP</h4><p>Modern format for web use.</p><hr>
                    <h4>AVIF</h4><p>Newest format with highest compression.</p><hr>
                    <h4>Favicon (PNG/ICO)</h4><p>Converts your image to a website icon. PNG is modern, ICO is for maximum compatibility.</p>
                </div>
            </div>
        </div>
        <div class="format-options">
            <div class="radio-group"><input type="radio" id="jpeg" name="format" value="jpeg" checked><label for="jpeg">JPG</label></div>
            <div class="radio-group"><input type="radio" id="png" name="format" value="png"><label for="png">PNG</label></div>
            <div class="radio-group"><input type="radio" id="webp" name="format" value="webp"><label for="webp">WebP</label></div>
            <div class="radio-group"><input type="radio" id="avif" name="format" value="avif"><label for="avif">AVIF</label></div>
            <div class="radio-group"><input type="radio" id="favicon-png" name="format" value="favicon-png"><label for="favicon-png">Favicon (PNG)</label></div>
            <div class="radio-group"><input type="radio" id="favicon-ico" name="format" value="favicon-ico"><label for="favicon-ico">Favicon (ICO)</label></div>
        </div>
    `;

    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = formatOptionsHTML + `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>`;
    
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add('file-selected');
}

// Helper function to format file size into KB/MB
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to upload a file with progress tracking using XMLHttpRequest
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
            if (xhr.status >= 200 && xhr.status < 300) { resolve(xhr.response); }
            else { reject(new Error(`S3 upload failed: ${xhr.statusText}`)); }
        };
        xhr.onerror = () => reject(new Error('S3 upload failed due to a network error.'));
        xhr.send(file);
    });
}

// Processes a single file from the queue (gets link, uploads, triggers optimization)
async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    const originalObjectUrl = URL.createObjectURL(file);

    try {
        // Step 1: Get secure upload link
        statusElement.textContent = 'Getting link...';
        const linkResponse = await fetch('/.netlify/functions/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, fileType: file.type }),
        });
        if (!linkResponse.ok) throw new Error('Could not get upload link.');
        const { uploadUrl, key } = await linkResponse.json();

        // Step 2: Upload file to S3 with progress bar
        const progressBarContainer = `<div class="progress-bar-container"><div class="progress-bar-fill" style="width: 0%;"></div><span class="progress-bar-text">Uploading 0%</span></div>`;
        statusElement.innerHTML = progressBarContainer;
        const progressBarFill = listItem.querySelector('.progress-bar-fill');
        const progressBarText = listItem.querySelector('.progress-bar-text');
        
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        await uploadWithProgress(uploadUrl, file, (percent) => {
            progressBarFill.style.width = `${percent.toFixed(0)}%`;
            progressBarText.textContent = `Uploading ${percent.toFixed(0)}%`;
        });
        
        await new Promise(resolve => setTimeout(resolve, 400)); 
        
        // Step 3: Trigger optimization
        statusElement.innerHTML = `<div class="spinner-small"></div>`;
        const optimizeResponse = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key, outputFormat: selectedFormat }),
        });
        if (!optimizeResponse.ok) {
             const errorData = await optimizeResponse.json().catch(() => ({ error: "Optimization failed." }));
             throw new Error(errorData.error);
        }
        const data = await optimizeResponse.json();

        // Step 4: Show results
        let successHTML;
        const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100);
        
        const resultActions = `
            <div class="result-buttons">
                <button class="btn-compare" data-original-url="${originalObjectUrl}" data-optimized-url="${data.downloadUrl}">Compare</button>
                <a href="${data.downloadUrl}" download="optimized-${data.originalFilename}" class="btn btn-download-item">Download</a>
            </div>
        `;

        if (savings >= 0) {
            successHTML = `<span class="savings">✓ ${savings.toFixed(0)}% Saved</span> ${resultActions}`;
        } else {
            const increase = Math.abs(savings);
            successHTML = `<span class="savings-increase">⚠️ +${increase.toFixed(0)}% Increased</span> ${resultActions}`;
        }
        statusElement.innerHTML = successHTML;

    } catch (error) {
        console.error('Processing failed for', file.name, ':', error);
        statusElement.innerHTML = `<span style="color: red;">Failed! ${error.message}</span>`;
        URL.revokeObjectURL(originalObjectUrl);
    }
}

// Starts the batch optimization process
async function startBatchOptimization() {
    console.log(`Starting optimization for ${fileQueue.length} files...`);
    const optimizeBtn = document.getElementById('optimize-all-btn');
    if (optimizeBtn) {
        optimizeBtn.textContent = 'Processing...';
        optimizeBtn.disabled = true;
    }
    const listItems = document.querySelectorAll('.file-list-item');
    const optimizationPromises = fileQueue.map((file, index) => {
        const listItem = listItems[index];
        return processSingleFile(file, listItem);
    });
    await Promise.all(optimizationPromises);
    updateMainButtonAfterCompletion();
}

// Updates the main action buttons after the process is complete
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

// Handles the "Download All as .ZIP" functionality
async function handleZipDownload() {
    const downloadAllBtn = document.getElementById('download-all-btn');
    if (!downloadAllBtn) return;
    console.log('Starting ZIP download process...');
    downloadAllBtn.textContent = 'Zipping...';
    downloadAllBtn.disabled = true;
    try {
        const zip = new JSZip();
        const downloadLinks = document.querySelectorAll('a.btn-download-item');
        const fetchPromises = Array.from(downloadLinks).map(link => 
            fetch(link.href)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch ${link.href}`);
                    return response.blob();
                })
                .then(blob => ({ name: link.getAttribute('download'), blob: blob }))
        );
        const files = await Promise.all(fetchPromises);
        files.forEach(file => { zip.file(file.name, file.blob); });
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
        alert('An error occurred while creating the ZIP file. Please try downloading files individually.');
        downloadAllBtn.textContent = 'Download All as .ZIP';
        downloadAllBtn.disabled = false;
    }
}

// Resets the UI to its initial state
function resetUI() {
    console.log('Resetting UI to initial state.');
    fileQueue = [];
    uploadArea.innerHTML = initialUploadAreaHTML;
    uploadArea.classList.remove('file-selected');
}

// Shows the Before/After comparison modal
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