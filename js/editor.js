function showEditorModal(file, listItem, index) {
    const originalObjectUrl = URL.createObjectURL(file);

    const editorModalHTML = `
        <div class="modal-overlay editor-overlay">
            <div class="modal-content editor-modal-content">
                <div class="editor-header">
                    <h2 data-i18n-key="editor_title">Image Editor</h2>
                    <div>
                        <button class="btn btn-secondary" id="editor-cancel-btn" data-i18n-key="cancel">Cancel</button>
                        <button class="btn btn-primary" id="editor-save-btn" data-i18n-key="save">Save</button>
                    </div>
                </div>
                <div class="editor-main">
                    <div class="editor-canvas-container">
                        <canvas id="editor-canvas"></canvas>
                    </div>
                    <div class="editor-toolbar">
                        
                        <div id="main-toolbar">
                            <div class="toolbar-section">
                                <h4 class="toolbar-title" data-i18n-key="zoom">Zoom</h4>
                                <div class="toolbar-buttons">
                                    <button class="icon-btn" id="zoom-in-btn" title="Zoom In"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                                    <button class="icon-btn" id="zoom-out-btn" title="Zoom Out"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                                    <button class="icon-btn" id="fit-canvas-btn" title="Fit to Screen"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg></button>
                                </div>
                            </div>
                            <div class="toolbar-section">
                                <h4 class="toolbar-title" data-i18n-key="tools">Tools</h4>
                                <div class="toolbar-buttons">
                                    <button class="icon-btn" id="filter-btn" title="Filters"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87L8.91 8.26 12 2z"></path></svg></button>
                                    <button class="icon-btn" id="text-btn" title="Add Text"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg></button>
                                    <button class="icon-btn" id="shape-btn" title="Add Shape"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
                                    <button class="icon-btn" id="eraser-btn" title="Eraser"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l-8.4 8.4a5 5 0 0 1-7 0L2.1 13a1 1 0 0 0-1.4 0l-.7.7a5 5 0 0 1 7 0l8.4-8.4a1 1 0 0 0 0-1.4z"></path><path d="M21 21l-5-5"></path></svg></button>
                                </div>
                            </div>
                             <div class="toolbar-section">
                                <h4 class="toolbar-title" data-i18n-key="actions">Actions</h4>
                                <div class="toolbar-buttons">
                                    <button class="icon-btn" id="undo-btn" title="Undo"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M21 16V8a4 4 0 0 0-4-4H7l-3 4 3 4h10a4 4 0 0 0 4 4z"></path></svg></button>
                                    <button class="icon-btn" id="redo-btn" title="Redo"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M3 8v8a4 4 0 0 0 4 4h10l3-4-3-4H7a4 4 0 0 0-4-4z"></path></svg></button>
                                    <button class="icon-btn" id="delete-btn" title="Delete Selected" disabled><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                </div>
                            </div>
                        </div>

                        <div id="filter-toolbar" class="toolbar-submenu" style="display: none;">
                            <div class="toolbar-section">
                                <div class="toolbar-header">
                                    <button class="icon-btn back-btn" title="Back"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg></button>
                                    <h4 class="toolbar-title" data-i18n-key="filters">Filters</h4>
                                </div>
                                <div class="filter-buttons">
                                    <button class="filter-btn" data-filter="Grayscale">Grayscale</button>
                                    <button class="filter-btn" data-filter="Sepia">Sepia</button>
                                    <button class="filter-btn" data-filter="Invert">Invert</button>
                                    <button class="filter-btn" data-filter="Vintage">Vintage</button>
                                    <button class="filter-btn" data-filter="BlackWhite">Black & White</button>
                                    <button class="filter-btn" id="remove-filters-btn">None</button>
                                </div>
                            </div>
                        </div>

                        <div id="text-toolbar" class="toolbar-submenu" style="display: none;">
                            <div class="toolbar-section">
                                <div class="toolbar-header">
                                    <button class="icon-btn back-btn" title="Back"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg></button>
                                    <h4 class="toolbar-title" data-i18n-key="add_text">Add Text</h4>
                                </div>
                                <div class="toolbar-form">
                                    <div class="form-group">
                                        <label for="text-input">Text</label>
                                        <input type="text" id="text-input" class="toolbar-input" value="Your Text">
                                    </div>
                                    <div class="form-group">
                                        <label for="text-color-input">Color</label>
                                        <input type="color" id="text-color-input" class="toolbar-color-picker" value="#343a40">
                                    </div>
                                    <div class="form-group style-group">
                                        <button class="style-btn" id="text-bold-btn" title="Bold"><b>B</b></button>
                                        <button class="style-btn" id="text-italic-btn" title="Italic"><i>I</i></button>
                                    </div>
                                    <button class="btn btn-primary btn-full-width" id="add-text-to-canvas-btn">Add Text</button>
                                </div>
                            </div>
                        </div>

                        <div id="shape-toolbar" class="toolbar-submenu" style="display: none;">
                            <div class="toolbar-section">
                                <div class="toolbar-header">
                                    <button class="icon-btn back-btn" title="Back"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg></button>
                                    <h4 class="toolbar-title" data-i18n-key="add_shape">Add Shape</h4>
                                </div>
                                <div class="toolbar-buttons shape-buttons">
                                     <button class="icon-btn add-shape-btn" data-shape="Rect" title="Rectangle"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
                                    <button class="icon-btn add-shape-btn" data-shape="Circle" title="Circle"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><circle cx="12" cy="12" r="9"></circle></svg></button>
                                    <button class="icon-btn add-shape-btn" data-shape="Triangle" title="Triangle"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M12 2L2 22h20L12 2z"></path></svg></button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', editorModalHTML);
    translatePage();

    const canvasElement = document.getElementById('editor-canvas');
    const canvasContainer = document.querySelector('.editor-canvas-container');
    canvasElement.width = canvasContainer.offsetWidth;
    canvasElement.height = canvasContainer.offsetHeight;

    const canvas = new fabric.Canvas('editor-canvas');

    // --- TÜM EVENT LISTENER VE YARDIMCI FONKSİYONLAR ---

    const fitCanvasToScreen = () => {
        const image = canvas.getObjects()[0];
        if (!image) return;
        const scale = Math.min((canvas.width / image.width) * 0.9, (canvas.height / image.height) * 0.9);
        canvas.setZoom(scale);
        canvas.centerObject(image);
        canvas.viewportTransform[4] = (canvas.width - image.width * scale) / 2;
        canvas.viewportTransform[5] = (canvas.height - image.height * scale) / 2;
        canvas.renderAll();
    };
    
    fabric.Image.fromURL(originalObjectUrl, (img) => {
        canvas.add(img);
        fitCanvasToScreen();
        saveCanvasState();
    }, { crossOrigin: 'anonymous' });
    
    const history = [];
    let historyStep = 0;
    const saveCanvasState = () => {
        history.length = historyStep;
        history.push(JSON.stringify(canvas.toJSON()));
        historyStep++;
    };
    const undo = () => {
        if (historyStep > 1) {
            historyStep--;
            canvas.loadFromJSON(history[historyStep - 1], canvas.renderAll.bind(canvas));
        }
    };
    const redo = () => {
        if (historyStep < history.length) {
            historyStep++;
            canvas.loadFromJSON(history[historyStep - 1], canvas.renderAll.bind(canvas));
        }
    };
    canvas.on({ 'object:modified': saveCanvasState, 'object:added': saveCanvasState, 'object:removed': saveCanvasState });

    const deleteSelectedObjects = () => {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
            activeObjects.forEach(object => canvas.remove(object));
            canvas.discardActiveObject().renderAll();
            saveCanvasState();
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedObjects();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const mainToolbar = document.getElementById('main-toolbar');
    const filterToolbar = document.getElementById('filter-toolbar');
    const textToolbar = document.getElementById('text-toolbar');
    const shapeToolbar = document.getElementById('shape-toolbar');
    const modal = document.querySelector('.editor-overlay');

    const cleanup = () => {
        modal.remove();
        window.removeEventListener('keydown', handleKeyDown);
    };

    document.getElementById('editor-save-btn').addEventListener('click', () => {
        canvasElement.toBlob((blob) => {
            const editedFile = new File([blob], file.name, { type: blob.type });
            fileQueue[index] = editedFile;
            const fileNameElement = listItem.querySelector('.file-name');
            if (fileNameElement) {
                fileNameElement.innerHTML = `${file.name} <span class="edited-badge">Edited</span>`;
            }
            cleanup();
        });
    });
    document.getElementById('editor-cancel-btn').addEventListener('click', cleanup);
    
    document.getElementById('zoom-in-btn').addEventListener('click', () => canvas.setZoom(canvas.getZoom() * 1.1));
    document.getElementById('zoom-out-btn').addEventListener('click', () => canvas.setZoom(canvas.getZoom() / 1.1));
    document.getElementById('fit-canvas-btn').addEventListener('click', fitCanvasToScreen);

    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);
    document.getElementById('delete-btn').addEventListener('click', deleteSelectedObjects);
    
    document.getElementById('filter-btn').addEventListener('click', () => { mainToolbar.style.display = 'none'; filterToolbar.style.display = 'block'; });
    document.getElementById('text-btn').addEventListener('click', () => { mainToolbar.style.display = 'none'; textToolbar.style.display = 'block'; });
    document.getElementById('shape-btn').addEventListener('click', () => { mainToolbar.style.display = 'none'; shapeToolbar.style.display = 'block'; });
    
    document.getElementById('eraser-btn').addEventListener('click', (e) => {
        canvas.isDrawingMode = !canvas.isDrawingMode;
        e.currentTarget.classList.toggle('active', canvas.isDrawingMode);
        if(canvas.isDrawingMode){
            canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
            canvas.freeDrawingBrush.width = 15;
        }
    });
    
    filterToolbar.querySelector('.back-btn').addEventListener('click', () => { filterToolbar.style.display = 'none'; mainToolbar.style.display = 'block'; });
    textToolbar.querySelector('.back-btn').addEventListener('click', () => { textToolbar.style.display = 'none'; mainToolbar.style.display = 'block'; });
    shapeToolbar.querySelector('.back-btn').addEventListener('click', () => { shapeToolbar.style.display = 'none'; mainToolbar.style.display = 'block'; });

    filterToolbar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterToolbar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const image = canvas.getObjects()[0];
            if (!image) return;
            image.filters = [];
            const filterType = btn.dataset.filter;
            if (filterType && fabric.Image.filters[filterType]) {
                image.filters.push(new fabric.Image.filters[filterType]());
            }
            image.applyFilters();
            canvas.renderAll();
            saveCanvasState();
        });
    });

    document.getElementById('text-bold-btn').addEventListener('click', (e) => e.currentTarget.classList.toggle('active'));
    document.getElementById('text-italic-btn').addEventListener('click', (e) => e.currentTarget.classList.toggle('active'));
    document.getElementById('add-text-to-canvas-btn').addEventListener('click', () => {
        const textInput = document.getElementById('text-input');
        const colorInput = document.getElementById('text-color-input');
        const boldBtn = document.getElementById('text-bold-btn');
        const italicBtn = document.getElementById('text-italic-btn');
        const text = new fabric.IText(textInput.value || 'Your Text', {
            left: 50, top: 50, fontFamily: 'Poppins', fill: colorInput.value,
            fontWeight: boldBtn.classList.contains('active') ? 'bold' : 'normal',
            fontStyle: italicBtn.classList.contains('active') ? 'italic' : 'normal'
        });
        canvas.add(text);
        canvas.centerObject(text);
        canvas.setActiveObject(text);
        textToolbar.style.display = 'none';
        mainToolbar.style.display = 'block';
    });

    shapeToolbar.querySelectorAll('.add-shape-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const shapeType = btn.dataset.shape;
            let shape;
            const commonProps = { left: 100, top: 100, fill: 'rgba(0, 123, 255, 0.7)', stroke: '#0056b3', strokeWidth: 2 };
            if (shapeType === 'Rect') {
                shape = new fabric.Rect({ ...commonProps, width: 80, height: 80 });
            } else if (shapeType === 'Circle') {
                shape = new fabric.Circle({ ...commonProps, radius: 40 });
            } else if (shapeType === 'Triangle') {
                shape = new fabric.Triangle({ ...commonProps, width: 90, height: 90 });
            }
            if (shape) {
                canvas.add(shape);
                canvas.centerObject(shape);
                canvas.setActiveObject(shape);
            }
            shapeToolbar.style.display = 'none';
            mainToolbar.style.display = 'block';
        });
    });

    canvas.on({
        'selection:created': () => deleteBtn.disabled = false,
        'selection:updated': () => deleteBtn.disabled = false,
        'selection:cleared': () => deleteBtn.disabled = true
    });
}