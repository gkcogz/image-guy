// Dosya Adı: js/main.js (Pre-Signed URL Mimarisi ile Çalışan Nihai Hali)

let fileQueue = []; 

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');

// Event Listeners (olay dinleyicileri) aynı kalabilir.
// ... (Önceki main.js'deki tüm event listener kodları buraya gelecek)
uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
});
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
uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
});


function handleFiles(files) {
    fileQueue = [];
    for (const file of files) { fileQueue.push(file); }
    updateUIForFileList();
}

function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';
    fileQueue.forEach(file => {
        const formattedSize = formatFileSize(file.size);
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        listItem.innerHTML = `<div class="file-info"><span class="file-icon">📄</span><div class="file-details"><span class="file-name">${file.name}</span><span class="file-size">${formattedSize}</span></div></div><div class="file-item-status">Waiting...</div>`;
        fileListElement.appendChild(listItem);
    });
    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>`;
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add('file-selected');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Please replace the existing processSingleFile function with this one

async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
    try {
        statusElement.innerHTML = `<div class="spinner-small"></div>`;

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log('Backend response with S3 URL:', data);

        const savings = ((file.size - data.optimizedSize) / file.size * 100).toFixed(0);
        
        // --- CHANGE IS ON THE LINE BELOW ---
        // We added the 'download' attribute to the <a> tag.
        const successHTML = `
            <span class="savings">✓ ${savings}% Saved</span>
            <a href="${data.downloadUrl}" download="optimized-${file.name}" target="_blank" rel="noopener noreferrer" class="btn btn-download-item">Download</a>
        `;
        statusElement.innerHTML = successHTML;

    } catch (error) {
        console.error('Optimization failed for', file.name, ':', error);
        statusElement.innerHTML = `<span style="color: red;">Failed!</span>`;
    }
}

async function startBatchOptimization() {
    console.log(`Starting optimization for ${fileQueue.length} files...`);
    const optimizeBtn = document.getElementById('optimize-all-btn');
    if (optimizeBtn) {
        optimizeBtn.textContent = 'Processing...';
        optimizeBtn.disabled = true;
    }

    const listItems = document.querySelectorAll('.file-list-item');
    
    // İstekleri artık sıralı yapıyoruz ki S3 ve fonksiyonlar üzerinde ani yük oluşturmayalım.
    for (const [index, file] of fileQueue.entries()) {
        const listItem = listItems[index];
        await processSingleFile(file, listItem);
    }

    updateMainButtonAfterCompletion();
}

function updateMainButtonAfterCompletion() {
    const actionArea = document.querySelector('.action-area');
    if (actionArea) {
        actionArea.innerHTML = `<button class="btn" id="download-all-btn">Download All as .ZIP</button>`;
        const downloadAllBtn = document.getElementById('download-all-btn');
        downloadAllBtn.style.backgroundColor = '#28a745';
        downloadAllBtn.style.color = 'white';
        downloadAllBtn.style.width = '100%';
        downloadAllBtn.style.padding = '1rem 2rem';
        downloadAllBtn.style.fontSize = '1.2rem';
    }
}