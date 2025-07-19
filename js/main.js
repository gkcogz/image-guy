let fileQueue = []; 

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');

uploadArea.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
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
    if (e.target.id === 'optimize-all-btn') {
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

// main.js içindeki processSingleFile fonksiyonunun son hali

async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
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

        // Adım 2: Dosyayı doğrudan S3'e yükle
        statusElement.textContent = 'Uploading...';
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
        });
        if (!uploadResponse.ok) throw new Error('S3 upload failed.');
        
        // Adım 3: Optimizasyon işlemini tetikle
        statusElement.innerHTML = `<div class="spinner-small"></div>`;
        const optimizeResponse = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key }),
        });
        if (!optimizeResponse.ok) {
             const errorData = await optimizeResponse.json().catch(() => ({ error: "Optimization failed." }));
             throw new Error(errorData.error);
        }
        const data = await optimizeResponse.json();

        // Sonuçları göster
        const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100).toFixed(0);
        
        // --- DEĞİŞİKLİK BURADA: target="_blank" kaldırıldı ---
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
        // YENİ EKLENEN BLOK
    if (e.target && e.target.id === 'download-all-btn') {
        handleZipDownload();
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
        actionArea.innerHTML = `<button class="btn" id="download-all-btn">Download All as .ZIP</button>`;
        const downloadAllBtn = document.getElementById('download-all-btn');
        downloadAllBtn.style.backgroundColor = '#28a745';
        downloadAllBtn.style.color = 'white';
        downloadAllBtn.style.width = '100%';
        downloadAllBtn.style.padding = '1rem 2rem';
        downloadAllBtn.style.fontSize = '1.2rem';
    }
}

// Bu yeni fonksiyonu main.js dosyasının en altına ekleyin

async function handleZipDownload() {
    const downloadAllBtn = document.getElementById('download-all-btn');
    if (!downloadAllBtn) return;

    console.log('Starting ZIP download process...');
    downloadAllBtn.textContent = 'Zipping...';
    downloadAllBtn.disabled = true;

    try {
        // 1. JSZip nesnesini başlat
        const zip = new JSZip();

        // 2. Sayfadaki tüm bireysel indirme linklerini bul
        const downloadLinks = document.querySelectorAll('a.btn-download-item');

        // 3. Her bir linkteki görseli S3'ten çekmek için bir promise dizisi oluştur
        const fetchPromises = Array.from(downloadLinks).map(link => 
            fetch(link.href)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${link.href}`);
                    }
                    return response.blob(); // Görsel verisini blob olarak al
                })
                .then(blob => ({
                    name: link.getAttribute('download'), // 'download' özelliğinden dosya adını al
                    blob: blob
                }))
        );

        // 4. Tüm görsellerin indirilmesini paralel olarak bekle
        const files = await Promise.all(fetchPromises);

        // 5. İndirilen her bir dosyayı ZIP arşivine ekle
        files.forEach(file => {
            zip.file(file.name, file.blob);
        });

        // 6. ZIP dosyasını oluştur
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // 7. Oluşturulan ZIP dosyasını indirmek için geçici bir link oluştur ve tıkla
        const tempUrl = URL.createObjectURL(zipBlob);
        const tempLink = document.createElement('a');
        tempLink.href = tempUrl;
        tempLink.setAttribute('download', 'image-guy-optimized.zip');
        document.body.appendChild(tempLink);
        tempLink.click();
        
        // 8. Geçici linki temizle
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(tempUrl);

        // Butonu eski haline getir
        downloadAllBtn.textContent = 'Download All as .ZIP';
        downloadAllBtn.disabled = false;

    } catch (error) {
        console.error('Failed to create ZIP file:', error);
        alert('An error occurred while creating the ZIP file. Please try downloading files individually.');
        downloadAllBtn.textContent = 'Download All as .ZIP';
        downloadAllBtn.disabled = false;
    }
}