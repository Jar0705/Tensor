const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusDisplay = document.getElementById('status');

let model;

// --- 1. Fungsi Utama ---
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 'video': true });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadeddata = () => {
                resolve(video);
            };
        });
    } catch (error) {
        statusDisplay.innerText = "Error mengakses webcam: " + error.message;
    }
}

async function loadModel() {
    statusDisplay.innerText = "Memuat model COCO-SSD...";
    // Ganti 'cocoSsd.load()' dengan 'tf.loadGraphModel(URL_MODEL_ANDA)' jika menggunakan model kustom
    model = await cocoSsd.load(); 
    statusDisplay.innerText = "Model berhasil dimuat. Mulai deteksi.";
}

// --- 2. Deteksi Warna (Sederhana tanpa OpenCV.js) ---
function getDominantColor(imageData, bbox) {
    // Ambil data piksel di dalam bounding box
    const [x, y, width, height] = bbox;
    const boxData = ctx.getImageData(x, y, width, height).data;
    
    let colorCounts = {}; // { 'R': 0, 'G': 0, 'B': 0 }
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;

    // Iterasi setiap piksel (data dalam format [R, G, B, A])
    for (let i = 0; i < boxData.length; i += 4) {
        rSum += boxData[i];
        gSum += boxData[i + 1];
        bSum += boxData[i + 2];
        pixelCount++;
    }

    if (pixelCount === 0) return "Unknown";

    // Hitung rata-rata RGB
    const rAvg = rSum / pixelCount;
    const gAvg = gSum / pixelCount;
    const bAvg = bSum / pixelCount;

    // Sederhanakan klasifikasi warna berdasarkan komponen dominan (Hanya untuk demo)
    if (rAvg > gAvg && rAvg > bAvg && rAvg > 100) return "Merah";
    if (gAvg > rAvg && gAvg > bAvg && gAvg > 100) return "Hijau";
    if (bAvg > rAvg && bAvg > gAvg && bAvg > 100) return "Biru";
    
    // Jika semua nilai tinggi, anggap Putih/Terang. Jika semua rendah, anggap Hitam/Gelap.
    if (rAvg + gAvg + bAvg > 500) return "Putih";
    if (rAvg + gAvg + bAvg < 100) return "Hitam";
    
    return "Campuran";
}


// --- 3. Simulasi Jarak ---
function getSimulatedDistance(bbox) {
    // Jarak disimulasikan berdasarkan ukuran objek di layar.
    // Asumsi: Objek yang lebih besar/lebih dekat menempati persentase layar yang lebih besar.
    const [x, y, width, height] = bbox;
    const area = width * height;
    
    // Normalisasi area terhadap total area canvas
    const maxArea = canvas.width * canvas.height;
    const areaRatio = area / maxArea;
    
    // Balikkan rasio untuk mendapatkan jarak (rasio besar = jarak kecil)
    // Jarak (cm) = MAX_DISTANCE - (areaRatio * RANGE)
    
    const MAX_DISTANCE = 300; // 3 meter
    const MIN_DISTANCE = 50;  // 0.5 meter

    // Kita gunakan formula sederhana: 300 - (areaRatio * 250)
    let simulatedDist = MAX_DISTANCE - (areaRatio * (MAX_DISTANCE - MIN_DISTANCE));
    
    // Pastikan tidak di bawah batas minimum
    simulatedDist = Math.max(simulatedDist, MIN_DISTANCE); 

    return simulatedDist.toFixed(1);
}

// --- 4. Loop Deteksi ---
async function detectFrame() {
    // Prediksi objek pada frame video saat ini
    const predictions = await model.detect(video); 

    // Bersihkan canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // Gambar frame video ke canvas

    predictions.forEach(prediction => {
        const [y, x, height, width] = prediction.bbox; 
        const bbox = [x, y, width, height]; // Ubah ke format [x, y, w, h]

        // Dapatkan Warna dan Jarak
        const dominantColor = getDominantColor(ctx.getImageData(0, 0, canvas.width, canvas.height), bbox);
        const simulatedDistance = getSimulatedDistance(bbox);
        
        // Gabungkan Label
        const label = `${prediction.class} (${dominantColor}) | Jarak: ${simulatedDistance} cm`;
        
        // Gambar Bounding Box
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, height);

        // Gambar Label
        ctx.fillStyle = '#00FFFF';
        ctx.font = '18px Arial';
        ctx.fillText(label, x, y > 10 ? y - 5 : 10);
    });

    // Ulangi proses
    requestAnimationFrame(detectFrame);
}

// --- 5. Inisialisasi ---
async function init() {
    await loadModel();
    await setupWebcam();
    video.play();
    detectFrame();
}

init();
