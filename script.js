// Get DOM Elements
const dropZone = document.getElementById('dropZone');
const imageUpload = document.getElementById('imageUpload');
const browseLink = document.getElementById('browseLink');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const createBtn = document.getElementById('createBtn');
const dropZoneThumbnails = document.getElementById('dropZoneThumbnails');

const loadingIndicator = document.getElementById('loadingIndicator');
const previewSection = document.getElementById('previewSection');
const canvas = document.getElementById('resultCanvas');
const ctx = canvas.getContext('2d');
const thumbnailGallery = document.getElementById('thumbnailGallery');

const downloadBtn = document.getElementById('downloadBtn');
const downloadTitle = document.getElementById('downloadTitle');
const downloadSub = document.getElementById('downloadSub');

// Global state
let selectedFiles = [];
let downloadAction = null;

// --- Load Static Layers (Z-index 1 & 3) ---
const backgroundImage = new Image();
backgroundImage.src = 'Background Layer.jpeg'; // Ensure this matches your folder filename

const overlayImage = new Image();
// NOTE: For the layers underneath to show, this MUST be a PNG with transparency.
overlayImage.src = 'Forground Layer_UpdatedV4.png'; 

// --- Upload & Drag/Drop Logic ---
const triggerUpload = () => imageUpload.click();
browseLink.addEventListener('click', triggerUpload);
uploadBtn.addEventListener('click', triggerUpload);

imageUpload.addEventListener('change', (e) => handleFiles(e.target.files));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

// Process selected files
function handleFiles(files) {
    if (files.length === 0) return;
    
    selectedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (selectedFiles.length === 0) {
        uploadStatus.textContent = "STATUS: Invalid file type";
        dropZoneThumbnails.innerHTML = ''; 
        return;
    }

    uploadStatus.textContent = `STATUS: ${selectedFiles.length} image(s) uploaded`;
    createBtn.disabled = false; 
    
    previewSection.style.display = 'none';
    thumbnailGallery.innerHTML = ''; 
    dropZoneThumbnails.innerHTML = ''; 
    
    selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'drop-zone-thumb';
            img.title = file.name; 
            dropZoneThumbnails.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

// --- Image Creation Logic ---
createBtn.addEventListener('click', async function() {
    if (selectedFiles.length === 0) return;

    createBtn.disabled = true;
    uploadBtn.disabled = true;
    loadingIndicator.style.display = 'block';
    previewSection.style.display = 'none';

    try {
        if (selectedFiles.length === 1) {
            const result = await processSingleImage(selectedFiles[0]);
            
            downloadTitle.textContent = "DOWNLOAD IMAGE";
            downloadSub.textContent = `(${result.filename})`;
            
            downloadAction = () => {
                const a = document.createElement('a');
                a.href = result.dataUrl;
                a.download = result.filename;
                a.click();
            };
            
        } else {
            const zip = new JSZip();
            
            for (let i = 0; i < selectedFiles.length; i++) {
                const result = await processSingleImage(selectedFiles[i]);
                zip.file(result.filename, result.blob); 
                createThumbnail(selectedFiles[i], i === 0);
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(zipBlob);

            downloadTitle.textContent = "DOWNLOAD ZIP ARCHIVE";
            downloadSub.textContent = "(generated Images with LinkedIn filter.zip)";
            
            downloadAction = () => {
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = 'generated Images with LinkedIn filter.zip';
                a.click();
            };
        }

        showMainPreview(selectedFiles[0]);

        loadingIndicator.style.display = 'none';
        previewSection.style.display = 'block';
        
        createBtn.disabled = false;
        uploadBtn.disabled = false;

    } catch (error) {
        console.error("Error:", error);
        loadingIndicator.querySelector('p').textContent = "An error occurred. Please refresh and try again.";
        createBtn.disabled = false;
        uploadBtn.disabled = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (downloadAction) downloadAction();
});

// --- Helper Functions ---

// Processes the image in the background, returns Blob and DataURL
function processSingleImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const userImage = new Image();
            userImage.onload = () => {
                const offCanvas = document.createElement('canvas');
                offCanvas.width = 1080; 
                offCanvas.height = 1080;
                const offCtx = offCanvas.getContext('2d');

                // Z-Index 1: Background Layer
                offCtx.drawImage(backgroundImage, 0, 0, offCanvas.width, offCanvas.height);

                // Z-Index 2: User Image
                offCtx.save(); 
                offCtx.beginPath();
                offCtx.rect(0, 0, 1080, 900); 
                offCtx.clip(); 

                const targetWidth = 1080;
                const targetHeight = 900; 
                const scale = Math.min(targetWidth / userImage.width, targetHeight / userImage.height);
                
                const drawWidth = Math.floor(userImage.width * scale);
                const drawHeight = Math.floor(userImage.height * scale);
                const x = Math.floor((targetWidth / 2) - (drawWidth / 2));
                const y = Math.floor((targetHeight / 2) - (drawHeight / 2));

                // --- PURE MATH APPLE FIX ---
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = drawWidth;
                tempCanvas.height = drawHeight;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(userImage, 0, 0, drawWidth, drawHeight);

                // Applies Math Grayscale (70%) and Box Blur (10px) to Pixels
                applyManualFilter(tempCtx, drawWidth, drawHeight, 10);

                offCtx.drawImage(tempCanvas, x, y);
                offCtx.restore(); 
                // ---------------------------

                // Z-Index 3: Foreground / Overlay (Full Size)
                offCtx.drawImage(overlayImage, 0, 0, offCanvas.width, offCanvas.height);

                const originalName = file.name;
                const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                const newFileName = `${nameWithoutExt} With filter.png`; 

                offCanvas.toBlob((blob) => {
                    resolve({
                        blob: blob,
                        dataUrl: offCanvas.toDataURL('image/png', 0.9), 
                        filename: newFileName
                    });
                }, 'image/png');
            };
            userImage.onerror = reject;
            userImage.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Renders an image to the visible preview canvas
function showMainPreview(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Z-Index 1: Background
            ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
            
            // Z-Index 2: User Image
            ctx.save(); 
            ctx.beginPath();
            ctx.rect(0, 0, 1080, 900); 
            ctx.clip();

            const targetWidth = 1080;
            const targetHeight = 900; 
            const imgScale = Math.min(targetWidth / img.width, targetHeight / img.height);
            
            const drawWidth = Math.floor(img.width * imgScale);
            const drawHeight = Math.floor(img.height * imgScale);
            const x = Math.floor((targetWidth / 2) - (drawWidth / 2));
            const y = Math.floor((targetHeight / 2) - (drawHeight / 2));
            
            // --- PURE MATH APPLE FIX ---
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = drawWidth;
            tempCanvas.height = drawHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0, drawWidth, drawHeight);

            // Applies Math Grayscale (70%) and Box Blur (10px) to Pixels
            applyManualFilter(tempCtx, drawWidth, drawHeight, 10);

            ctx.drawImage(tempCanvas, x, y);
            ctx.restore(); 
            // ---------------------------
            
            // Z-Index 3: Foreground Overlay (Full Size)
            ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Creates small clickable thumbnails for the gallery
function createThumbnail(file, isActive) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.className = 'thumb' + (isActive ? ' active' : '');
        
        img.onclick = () => {
            document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            img.classList.add('active');
            showMainPreview(file);
        };
        
        thumbnailGallery.appendChild(img);
    };
    reader.readAsDataURL(file);
}


// ==========================================
// PURE JAVASCRIPT BLUR & GRAYSCALE ALGORITHM
// Bypasses all Apple/Safari canvas rendering bugs
// ==========================================
function applyManualFilter(canvasCtx, width, height, radius) {
    const imgData = canvasCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // STEP 1: Apply 70% Grayscale mathematically
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const luma = r * 0.299 + g * 0.587 + b * 0.114; // Standard Luma formula
        data[i]   = r * 0.3 + luma * 0.7; // 70% Gray Red
        data[i+1] = g * 0.3 + luma * 0.7; // 70% Gray Green
        data[i+2] = b * 0.3 + luma * 0.7; // 70% Gray Blue
    }

    // STEP 2: Horizontal Box Blur
    const temp = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = -radius; i <= radius; i++) {
                const px = x + i;
                if (px >= 0 && px < width) {
                    const idx = (y * width + px) * 4;
                    r += data[idx];
                    g += data[idx+1];
                    b += data[idx+2];
                    count++;
                }
            }
            const outIdx = (y * width + x) * 4;
            temp[outIdx] = r / count;
            temp[outIdx+1] = g / count;
            temp[outIdx+2] = b / count;
            temp[outIdx+3] = data[outIdx+3]; // Keep alpha
        }
    }

    // STEP 3: Vertical Box Blur
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = -radius; i <= radius; i++) {
                const py = y + i;
                if (py >= 0 && py < height) {
                    const idx = (py * width + x) * 4;
                    r += temp[idx];
                    g += temp[idx+1];
                    b += temp[idx+2];
                    count++;
                }
            }
            const outIdx = (y * width + x) * 4;
            data[outIdx] = r / count;
            data[outIdx+1] = g / count;
            data[outIdx+2] = b / count;
        }
    }

    // Commit pixels back to canvas
    canvasCtx.putImageData(imgData, 0, 0);
}