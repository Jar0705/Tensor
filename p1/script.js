const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusDisplay = document.getElementById('status');
const dataPanel = document.getElementById('data-panel');

let model;

// --- 1. Setup (Sama seperti sebelumnya) ---

async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            'video': { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadeddata = () => { resolve(video); };
        });
    } catch (error) {
        statusDisplay.innerText = "Error mengakses webcam. " + error.message;
    }
}

async function loadModel() {
    statusDisplay.innerText = "Memuat model COCO-SSD...";
    model = await cocoSsd.load(); 
    statusDisplay.innerText = "Model berhasil dimuat. Mulai deteksi.";
}


// --- 2. Deteksi Warna & Simulasi Jarak (Sama seperti sebelumnya) ---

function getDominantColor(bbox) {
    // [x, y, width, height]
    const [x, y, width, height] = bbox;
    const boxData = ctx.getImageData(x, y, width, height).data;
    
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;

    for (let i = 0; i < boxData.length; i += 4) {
        rSum += boxData[i];
        gSum += boxData[i + 1];
        bSum += boxData[i + 2];
        pixelCount++;
    }

    if (pixelCount === 0) return "Unknown";

    const rAvg = rSum / pixelCount;
    const gAvg = gSum / pixelCount;
    const bAvg = bSum / pixelCount;

    if (rAvg > gAvg * 1.2 && rAvg > bAvg * 1.2 && rAvg > 120) return "MERAH";
    if (gAvg > rAvg * 1.2 && gAvg > bAvg * 1.2 && gAvg > 120) return "HIJAU";
    if (bAvg > rAvg * 1.2 && bAvg > gAvg * 1.2 && bAvg > 120) return "BIRU";
    
    if (rAvg + gAvg + bAvg > 650) return "PUTIH";
    if (rAvg + gAvg + bSum < 150) return "HITAM";
    
    return "CAMPURAN/ABU-ABU";
}

function getSimulatedDistance(bbox) {
    const [x, y, width, height] = bbox;
    const area = width * height;
    
    const MAX_AREA = canvas.width * canvas.height;
    const areaRatio = area / MAX_AREA;
    
    const MAX_DISTANCE = 300; 
    const MIN_DISTANCE = 30;
    const RANGE = MAX_DISTANCE - MIN_DISTANCE;

    let simulatedDist = MAX_DISTANCE - (Math.sqrt(areaRatio) * RANGE);
    simulatedDist = Math.max(simulatedDist, MIN_DISTANCE); 

    return simulatedDist.toFixed(1);
}

// --- 3. Loop Deteksi dan Rendering Data ---

async function detectFrame() {
    const predictions = await model.detect(video); 
    
    // 1. Bersihkan Canvas dan Panel Data
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Gambar video (di-mirror)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // Bersihkan data panel kecuali judul
    dataPanel.innerHTML = '<h2>DETECTION LOG</h2>';

    // 2. Proses hasil prediksi
    predictions.forEach((prediction, index) => {
        const [x, y, width, height] = prediction.bbox; 
        
        // Penyesuaian koordinat karena video di-mirror
        const mirroredX = canvas.width - x - width; 
        const bbox = [mirroredX, y, width, height];

        // Hitung Data
        const dominantColor = getDominantColor(bbox);
        const simulatedDistance = getSimulatedDistance(bbox);
        const label = prediction.class.toUpperCase();
        
        // === RENDERING VISUAL (CANVAS) ===
        
        // Garis Bounding Box (Glow Effect)
        ctx.strokeStyle = '#00FFD1'; // var(--primary-color)
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00FFD1';
        ctx.shadowBlur = 5;
        ctx.strokeRect(mirroredX, y, width, height);
        ctx.shadowBlur = 0; // Matikan shadow setelah BBox digambar
        
        // Label Objek di atas BBox
        ctx.fillStyle = 'rgba(0, 255, 209, 0.9)'; // Background label semi-transparan
        ctx.font = 'bold 14px Consolas';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(mirroredX, y - 20, textWidth + 10, 20); 
        
        ctx.fillStyle = '#0A0A0E'; // Warna teks gelap
        ctx.fillText(label, mirroredX + 5, y - 5);
        
        // === RENDERING DATA (PANEL) ===

        const dataHtml = `
            <div class="detection-item">
                <h3>[TARGET ${index + 1}] ${label}</h3>
                <p>Confidence: ${(prediction.score * 100).toFixed(1)}%</p>
                <p>Warna Dominan: ${dominantColor}</p>
                <p>Jarak Estimasi: <span class="distance-value">${simulatedDistance} cm</span></p>
            </div>
        `;
        dataPanel.insertAdjacentHTML('beforeend', dataHtml);
    });

    // Ulangi proses
    requestAnimationFrame(detectFrame);
}

// --- 4. Inisialisasi Aplikasi ---
async function init() {
    await loadModel();
    await setupWebcam();
    video.play();
    detectFrame();
}

init();
