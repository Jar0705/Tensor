const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusDisplay = document.getElementById('status');

let model;

// --- 1. Fungsi Setup Webcam dan Model ---

async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            'video': { 
                facingMode: 'environment' // Coba gunakan kamera belakang di perangkat mobile
            } 
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadeddata = () => {
                resolve(video);
            };
        });
    } catch (error) {
        statusDisplay.innerText = "Error mengakses webcam. Pastikan Anda mengizinkan akses. " + error.message;
    }
}

async function loadModel() {
    statusDisplay.innerText = "Memuat model COCO-SSD...";
    // Menggunakan COCO-SSD untuk demo cepat. Ganti dengan tf.loadGraphModel() untuk model kustom.
    model = await cocoSsd.load(); 
    statusDisplay.innerText = "Model berhasil dimuat. Mulai deteksi.";
}


// --- 2. Deteksi Warna (Sederhana, berbasis RGB Rata-rata) ---

function getDominantColor(bbox) {
    const [x, y, width, height] = bbox;
    
    // Ambil data piksel di dalam bounding box
    // Batasi ukuran area yang diambil agar tidak terlalu membebani
    const boxData = ctx.getImageData(x, y, width, height).data;
    
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;

    // Iterasi setiap piksel (data dalam format [R, G, B, A])
    // Kita bisa melakukan sampling, tetapi untuk demo kita iterasi semua
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

    // Klasifikasi warna sederhana:
    if (rAvg > gAvg * 1.2 && rAvg > bAvg * 1.2 && rAvg > 120) return "Merah";
    if (gAvg > rAvg * 1.2 && gAvg > bAvg * 1.2 && gAvg > 120) return "Hijau";
    if (bAvg > rAvg * 1.2 && bAvg > gAvg * 1.2 && bAvg > 120) return "Biru";
    
    if (rAvg + gAvg + bAvg > 650) return "Putih"; // Rata-rata tinggi (max 765)
    if (rAvg + gAvg + bSum < 150) return "Hitam"; // Rata-rata rendah (min 0)
    
    return "Campuran/Abu-abu";
}


// --- 3. Simulasi Jarak (Berdasarkan Ukuran Bounding Box) ---

function getSimulatedDistance(bbox) {
    const [x, y, width, height] = bbox;
    const area = width * height;
    
    // Normalisasi area terhadap total area canvas (area 640*480 = 307200)
    const MAX_AREA = canvas.width * canvas.height;
    const areaRatio = area / MAX_AREA;
    
    const MAX_DISTANCE = 300; // Jarak maksimum simulasi (3 meter)
    const MIN_DISTANCE = 30;  // Jarak minimum simulasi (30 cm)
    const RANGE = MAX_DISTANCE - MIN_DISTANCE;

    // Formula: Jarak = MAX_DISTANCE - (areaRatio ^ (pangkat) * RANGE)
    // Pangkat 0.5 membuat kurva jarak lebih realistis/sensitif
    let simulatedDist = MAX_DISTANCE - (Math.sqrt(areaRatio) * RANGE);
    
    // Pastikan tidak di bawah batas minimum
    simulatedDist = Math.max(simulatedDist, MIN_DISTANCE); 

    return simulatedDist.toFixed(1);
}


// --- 4. Loop Deteksi dan Rendering ---

async function detectFrame() {
    // Jalankan inferensi pada frame video saat ini
    const predictions = await model.detect(video); 

    // 1. Bersihkan canvas dan gambar ulang frame video
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Kita gambar dengan transform mirrored agar BBox sesuai dengan video yang di-mirror
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // 2. Proses hasil prediksi
    predictions.forEach(prediction => {
        // COCO-SSD memberikan bbox dalam format [x, y, width, height]
        const [x, y, width, height] = prediction.bbox; 

        // Karena video di-mirror, kita harus menyesuaikan posisi x untuk BBox agar tetap di tempat yang benar
        const mirroredX = canvas.width - x - width; 
        const bbox = [mirroredX, y, width, height];

        // Dapatkan Warna dan Jarak
        const dominantColor = getDominantColor(bbox);
        const simulatedDistance = getSimulatedDistance(bbox);
        
        // Gabungkan Label
        const label = `${prediction.class.toUpperCase()} (${dominantColor}) | Jarak: ${simulatedDistance} cm`;
        
        // 3. Gambar Bounding Box (Menggunakan CSS variable --primary-color)
        ctx.strokeStyle = '#00FFFF'; // Sama dengan var(--primary-color)
        ctx.lineWidth = 4;
        ctx.strokeRect(mirroredX, y, width, height);

        // 4. Gambar Label
        ctx.fillStyle = '#00FFFF';
        ctx.font = 'bold 16px Arial';
        
        // Kotak Latar Belakang Label
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(mirroredX, y - 22, textWidth + 10, 25); 

        // Teks Label
        ctx.fillStyle = '#1e1e1e'; // Warna teks gelap
        ctx.fillText(label, mirroredX + 5, y - 5);
    });

    // Ulangi proses pada frame berikutnya
    requestAnimationFrame(detectFrame);
}

// --- 5. Inisialisasi Aplikasi ---
async function init() {
    await loadModel();
    await setupWebcam();
    video.play();
    detectFrame();
}

init();
