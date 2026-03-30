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

// Detect Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Load images
const backgroundImage = new Image();
backgroundImage.src = 'Background Layer.jpeg';

const overlayImage = new Image();
overlayImage.src = 'Forground Layer_UpdatedV4.png';

// Upload triggers
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

function handleFiles(files) {
    if (files.length === 0) return;

    selectedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (selectedFiles.length === 0) {
        uploadStatus.textContent = "STATUS: Invalid file type";
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
            dropZoneThumbnails.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

// 🔥 SAFE BLUR FUNCTION (Safari-proof)
function applyBlur(ctx, canvas, img, w, h) {
    ctx.drawImage(img, 0, 0, w, h);

    if (!isSafari && 'filter' in ctx) {
        ctx.filter = 'blur(10px) grayscale(70%)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
    } else {
        // StackBlur fallback
        if (window.StackBlur) {
            StackBlur.canvasRGBA(canvas, 0, 0, w, h, 10);
        } else {
            // fallback fallback (manual)
            ctx.globalAlpha = 0.15;
            for (let i = -5; i <= 5; i++) {
                for (let j = -5; j <= 5; j++) {
                    ctx.drawImage(canvas, i, j);
                }
            }
            ctx.globalAlpha = 1;
        }
    }
}

// Process Image
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

                // Background
                offCtx.drawImage(backgroundImage, 0, 0, 1080, 1080);

                // Clip area
                offCtx.save();
                offCtx.beginPath();
                offCtx.rect(0, 0, 1080, 900);
                offCtx.clip();

                const scale = Math.min(1080 / userImage.width, 900 / userImage.height);
                const drawWidth = userImage.width * scale;
                const drawHeight = userImage.height * scale;
                const x = (1080 - drawWidth) / 2;
                const y = (900 - drawHeight) / 2;

                // temp canvas
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = drawWidth;
                tempCanvas.height = drawHeight;
                const tempCtx = tempCanvas.getContext('2d');

                applyBlur(tempCtx, tempCanvas, userImage, drawWidth, drawHeight);

                offCtx.drawImage(tempCanvas, x, y);
                offCtx.restore();

                // Overlay
                offCtx.drawImage(overlayImage, 0, 0, 1080, 1080);

                const name = file.name.split('.')[0];

                offCanvas.toBlob((blob) => {
                    resolve({
                        blob,
                        dataUrl: offCanvas.toDataURL(),
                        filename: `${name} With filter.png`
                    });
                });
            };

            userImage.src = event.target.result;
        };

        reader.readAsDataURL(file);
    });
}

// Preview
function showMainPreview(file) {
    const reader = new FileReader();

    reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
            ctx.clearRect(0, 0, 1080, 1080);

            ctx.drawImage(backgroundImage, 0, 0, 1080, 1080);

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, 1080, 900);
            ctx.clip();

            const scale = Math.min(1080 / img.width, 900 / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (1080 - w) / 2;
            const y = (900 - h) / 2;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');

            applyBlur(tempCtx, tempCanvas, img, w, h);

            ctx.drawImage(tempCanvas, x, y);
            ctx.restore();

            ctx.drawImage(overlayImage, 0, 0, 1080, 1080);
        };

        img.src = event.target.result;
    };

    reader.readAsDataURL(file);
}

// Buttons
createBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    loadingIndicator.style.display = 'block';

    if (selectedFiles.length === 1) {
        const result = await processSingleImage(selectedFiles[0]);

        downloadAction = () => {
            const a = document.createElement('a');
            a.href = result.dataUrl;
            a.download = result.filename;
            a.click();
        };

    } else {
        const zip = new JSZip();

        for (let file of selectedFiles) {
            const result = await processSingleImage(file);
            zip.file(result.filename, result.blob);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);

        downloadAction = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'images.zip';
            a.click();
        };
    }

    showMainPreview(selectedFiles[0]);

    loadingIndicator.style.display = 'none';
    previewSection.style.display = 'block';
});

downloadBtn.addEventListener('click', () => {
    if (downloadAction) downloadAction();
});