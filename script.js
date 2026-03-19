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
const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: Disables canvas transparency overhead
const thumbnailGallery = document.getElementById('thumbnailGallery');

const downloadBtn = document.getElementById('downloadBtn');
const downloadTitle = document.getElementById('downloadTitle');
const downloadSub = document.getElementById('downloadSub');

// Global state
let selectedFiles = [];
let downloadAction = null;

// --- Load Static Layers (Z-index 1 & 3) ---
const backgroundImage = new Image();
backgroundImage.src = 'Background Layer.jpeg'; 

const overlayImage = new Image();
// CRITICAL: This file MUST be a PNG with a transparent background!
// If it is a JPG, it will completely hide the user's uploaded image.
overlayImage.src = 'Forground Layer.png'; 

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

    // Small timeout allows the UI to update and show the loading spinner before freezing
    setTimeout(async () => {
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
                downloadSub.textContent = "(generated Images.zip)";
                
                downloadAction = () => {
                    const a = document.createElement('a');
                    a.href = zipUrl;
                    a.download = 'generated Images.zip';
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
            loadingIndicator.querySelector('p').textContent = "An error occurred. Please try a smaller image.";
            createBtn.disabled = false;
            uploadBtn.disabled = false;
        }
    }, 50);
});

downloadBtn.addEventListener('click', () => {
    if (downloadAction) downloadAction();
});

// --- Core Rendering Logic ---

function drawStack(context, canvasWidth, canvasHeight, userImg) {
    // 1. Z-Index 1: Draw Background
    context.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);

    // 2. Z-Index 2: Draw User Image (Fitted to the top 75% of the canvas)
    const visibleHeight = canvasHeight * 0.75; 
    
    // Math.min ensures the image is "fitted" (contained) and not cut off
    const scale = Math.min(canvasWidth / userImg.width, visibleHeight / userImg.height);
    const scaledWidth = userImg.width * scale;
    const scaledHeight = userImg.height * scale;
    
    const x = (canvasWidth / 2) - (scaledWidth / 2);
    const y = (visibleHeight / 2) - (scaledHeight / 2);

    // Apply a lighter, faster blur (3px instead of 8px)
    context.filter = 'blur(3px)'; 
    context.drawImage(userImg, x, y, scaledWidth, scaledHeight);
    context.filter = 'none'; // CRITICAL: Turn off blur immediately

    // 3. Z-Index 3: Draw Overlay (MUST BE A PNG!)
    context.drawImage(overlayImage, 0, 0, canvasWidth, canvasHeight);
}

function processSingleImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const userImage = new Image();
            userImage.onload = () => {
                const offCanvas = document.createElement('canvas');
                offCanvas.width = 800; 
                offCanvas.height = 800;
                // Optimization: alpha: false speeds up rendering when we have a solid background
                const offCtx = offCanvas.getContext('2d', { alpha: false });

                drawStack(offCtx, offCanvas.width, offCanvas.height, userImage);

                const originalName = file.name;
                const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                
                offCanvas.toBlob((blob) => {
                    resolve({
                        blob: blob,
                        dataUrl: offCanvas.toDataURL('image/jpeg', 0.85), // Changed to JPEG export for much faster processing
                        filename: `${nameWithoutExt} Filtered.jpg`
                    });
                }, 'image/jpeg', 0.85); 
            };
            userImage.onerror = reject;
            userImage.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showMainPreview(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            drawStack(ctx, canvas.width, canvas.height, img);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

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