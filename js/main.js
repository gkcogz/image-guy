let fileQueue = []; 

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');
const initialUploadAreaHTML = uploadArea.innerHTML; // Arayüzün başlangıç halini kaydediyoruz

uploadArea.addEventListener('click', (e) => {
    // "Choose File" butonunu dinle
    if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
    // "Optimize All" butonunu dinle
    if (e.target.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
    // "Download All as .ZIP" butonunu dinle
    if (e.target.id === 'download-all-btn') {
        handleZipDownload();
    }
    // YENİ EKLENEN KONTROL: "Start Over" butonunu dinle
    if (e.target.id === 'clear-all-btn') {
        resetUI();
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


function handleFiles(files) {
    fileQueue = [];
    for (const file of files) { fileQueue.push(file); }
    updateUIForFileList();
}

// main.js içindeki bu fonksiyonu mevcut olanla değiştirin

// Lütfen main.js dosyanızdaki mevcut updateUIForFileList fonksiyonunu bununla değiştirin

// main.js içindeki updateUIForFileList fonksiyonunu bununla değiştirin

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
                    <h4>JPEG (.jpg)</h4>
                    <p><strong>Best for:</strong> Photographs. Provides the smallest file size with a tiny, often unnoticeable, loss in quality.</p>
                    <hr>
                    <h4>PNG</h4>
                    <p><strong>Best for:</strong> Graphics & logos with transparency. Preserves perfect quality but results in larger files.</p>
                    <hr>
                    <h4>WebP</h4>
                    <p><strong>Best for:</strong> Web use. A modern format that creates smaller files than both JPG and PNG at the same quality.</p>
                    <hr>
                    <h4>AVIF</h4>
                    <p><strong>Best for:</strong> Modern web. The newest format with the highest compression, creating the smallest possible file sizes.</p>
                </div>
            </div>
        </div>
        <div class="format-options">
            <div class="radio-group">
                <input type="radio" id="jpeg" name="format" value="jpeg" checked>
                <label for="jpeg">JPG</label>
            </div>
            <div class="radio-group">
                <input type="radio" id="png" name="format" value="png">
                <label for="png">PNG</label>
            </div>
            <div class="radio-group">
                <input type="radio" id="webp" name="format" value="webp">
                <label for="webp">WebP</label>
            </div>
            <div class="radio-group">
                <input type="radio" id="avif" name="format" value="avif">
                <label for="avif">AVIF</label>
            </div>
        </div>
    `;

    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = formatOptionsHTML + `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>`;
    
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

// main.js dosyasındaki mevcut processSingleFile fonksiyonunu silin
// ve yerine aşağıdaki İKİ YENİ fonksiyonu ekleyin.

// Dosyayı S3'e yükleyen ve ilerlemeyi raporlayan yeni yardımcı fonksiyon
function uploadWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);

        // Yükleme ilerlemesini dinleyen olay
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        // Yükleme tamamlandığında
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(new Error(`S3 upload failed: ${xhr.statusText}`));
            }
        };

        // Ağ hatası olduğunda
        xhr.onerror = () => reject(new Error('S3 upload failed due to a network error.'));

        xhr.send(file);
    });
}

// Ana işlem fonksiyonumuzun XHR kullanan yeni hali
async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;

    try {
        // Adım 1: Güvenli yükleme linki iste
        statusElement.textContent = 'Getting link...';
        const linkResponse = await fetch('/.netlify/functions/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, fileType: file.type }),
        });
        if (!linkResponse.ok) throw new Error('Could not get upload link.');
        const { uploadUrl, key } = await linkResponse.json();

        // Adım 2: Dosyayı doğrudan S3'e yükle (ilerleme çubuğu ile)
        // Arayüze progress bar'ı ekleyelim
        statusElement.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: 0%;"></div>
                <span class="progress-bar-text">Uploading 0%</span>
            </div>
        `;
        const progressBarFill = listItem.querySelector('.progress-bar-fill');
        const progressBarText = listItem.querySelector('.progress-bar-text');
        
        // uploadWithProgress fonksiyonunu çağırıyoruz
        await uploadWithProgress(uploadUrl, file, (percent) => {
            progressBarFill.style.width = `${percent.toFixed(0)}%`;
            progressBarText.textContent = `Uploading ${percent.toFixed(0)}%`;
        });
        
        // Adım 3: Optimizasyon işlemini tetikle
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

        // Sonuçları göster
        const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100).toFixed(0);
        const successHTML = `<span class="savings">✓ ${savings}% Saved</span><a href="${data.downloadUrl}" download="optimized-${data.originalFilename}" class="btn btn-download-item">Download</a>`;
        statusElement.innerHTML = successHTML;

    } catch (error) {
        console.error('Processing failed for', file.name, ':', error);
        statusElement.innerHTML = `<span style="color: red;">Failed! ${error.message}</span>`;
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
    for (const [index, file] of fileQueue.entries()) {
        const listItem = listItems[index];
        await processSingleFile(file, listItem);
    }
    updateMainButtonAfterCompletion();
}

function updateMainButtonAfterCompletion() {
    const actionArea = document.querySelector('.action-area');
    if (actionArea) {
        // Artık iki butonu birden oluşturuyoruz
        actionArea.innerHTML = `
            <div class="action-buttons-container">
                <button class="btn" id="download-all-btn">Download All as .ZIP</button>
                <button class="btn btn-secondary" id="clear-all-btn">Start Over</button>
            </div>
        `;
        const downloadAllBtn = document.getElementById('download-all-btn');
        downloadAllBtn.style.backgroundColor = '#28a745';
        downloadAllBtn.style.color = 'white';
        // Butonların genişliklerini konteyner yönetecek
        // downloadAllBtn.style.width = '100%'; 
        downloadAllBtn.style.padding = '1rem 2rem';
        downloadAllBtn.style.fontSize = '1.2rem';
    }
}

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
                .then(blob => ({
                    name: link.getAttribute('download'),
                    blob: blob
                }))
        );
        const files = await Promise.all(fetchPromises);
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
        alert('An error occurred while creating the ZIP file. Please try downloading files individually.');
        downloadAllBtn.textContent = 'Download All as .ZIP';
        downloadAllBtn.disabled = false;
    }
}

// main.js dosyasının en altına eklenecek yeni fonksiyon
function resetUI() {
    console.log('Resetting UI to initial state.');
    fileQueue = []; // Dosya kuyruğunu sıfırla
    uploadArea.innerHTML = initialUploadAreaHTML; // Arayüzü kaydettiğimiz başlangıç haline döndür
    uploadArea.classList.remove('file-selected'); // Kenarlık stilini kaldır
}