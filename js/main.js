// File: js/main.js (Test Version)

let fileQueue = []; 

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');

// All event listeners can stay the same...
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
    for (const file of files) { fileQueue.push(file); }
    updateUIForFileList();
}

function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';
    fileQueue.forEach(file => {
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        listItem.innerHTML = `<div class="file-info"><span class="file-icon">📄</span><div class="file-details"><span class="file-name">${file.name}</span></div></div><div class="file-item-status">Ready to test...</div>`;
        fileListElement.appendChild(listItem);
    });
    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = `<button class="btn btn-primary" id="optimize-all-btn">Run Dependency Test</button>`;
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add('file-selected');
}

// The test function
async function startBatchOptimization() {
    const optimizeBtn = document.getElementById('optimize-all-btn');
    if (optimizeBtn) {
        optimizeBtn.textContent = 'Testing...';
        optimizeBtn.disabled = true;
    }

    try {
        const response = await fetch('/.netlify/functions/optimize', { method: 'POST' }); // Sending a simple POST request
        if (!response.ok) { throw new Error(`Server error: ${response.statusText}`); }
        const data = await response.json();
        console.log('Backend test response:', data);
        uploadArea.innerHTML = `<div class="success-message"><h3>✅ Test Successful!</h3><p>${data.message}</p></div>`;
    } catch (error) {
        console.error('Test failed:', error);
        uploadArea.innerHTML = `<div class="success-message"><h3 style="color: red;">❌ Test Failed!</h3><p>Check the browser console and Netlify deploy logs.</p></div>`;
    }
}