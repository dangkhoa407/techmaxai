/**
 * Captcha OCR Service - Express Server
 * Nhận diện captcha từ base64 image hoặc URL
 */

import express from 'express';
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as ort from "onnxruntime-node";
import https from "https";
import http from "http";

// ─── Constants ──────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = join(__dirname, "model.onnx");
const PORT = 2108;

/** Character set: 0-9 a-z A-Z (sorted) — matches the training data */
const CHARSET = [];
for (let i = 0; i < 10; i++) CHARSET.push(String(i));
for (let i = 97; i <= 122; i++) CHARSET.push(String.fromCharCode(i));
for (let i = 65; i <= 90; i++) CHARSET.push(String.fromCharCode(i));
CHARSET.sort();

// ─── ONNX Session ───────────────────────────────────────────────────────────

let session = null;

async function checkModelExists() {
  if (!existsSync(MODEL_PATH)) {
    throw new Error(`OCR model not found at ${MODEL_PATH}. Please provide model.onnx manually.`);
  }
}

async function getSession() {
  if (session) return session;
  await checkModelExists();
  session = await ort.InferenceSession.create(MODEL_PATH);
  return session;
}

// ─── Helper: Tải ảnh từ URL ─────────────────────────────────────────────────

async function downloadImageFromUrl(imageUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(imageUrl);
    const protocol = url.protocol === "https:" ? https : http;
    
    const request = protocol.get(imageUrl, (response) => {
      // Xử lý redirect
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          downloadImageFromUrl(response.headers.location)
            .then(resolve)
            .catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    
    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Download timeout"));
    });
  });
}

// ─── Core Recognition ───────────────────────────────────────────────────────

/**
 * Recognize captcha text from an image buffer.
 * Returns the recognized text (6 chars), or null if recognition fails.
 */
export async function recognizeCaptcha(imageBuffer) {
  const sess = await getSession();

  // Preprocess: grayscale → resize to 160×50 → normalize to [0, 1]
  const raw = await sharp(imageBuffer)
    .grayscale()
    .resize(160, 50)
    .raw()
    .toBuffer();

  const pixels = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    pixels[i] = raw[i] / 255.0;
  }

  // Input shape: [batch=1, channels=1, height=50, width=160]
  const tensor = new ort.Tensor("float32", pixels, [1, 1, 50, 160]);
  const inputName = sess.inputNames[0];
  const results = await sess.run({ [inputName]: tensor });

  // Decode: argmax per timestep → map to CHARSET
  const output = Object.values(results)[0];
  const data = output.data;
  const dims = output.dims;
  const seqLen = dims[1];
  const numClasses = dims[2];

  let text = "";
  for (let s = 0; s < seqLen; s++) {
    let maxIdx = 0;
    let maxVal = data[s * numClasses];
    for (let c = 1; c < numClasses; c++) {
      const val = data[s * numClasses + c];
      if (val > maxVal) {
        maxVal = val;
        maxIdx = c;
      }
    }
    if (maxIdx >= 0 && maxIdx < CHARSET.length) {
      text += CHARSET[maxIdx];
    }
  }

  // Core Bank captcha is always 6 characters
  if (text.length !== 6) return null;
  return text;
}

/**
 * Recognize captcha text from base64 image string.
 * Supports formats: data:image/png;base64,xxxxx or just the base64 string
 */
export async function recognizeCaptchaFromBase64(base64String) {
  try {
    // Remove data URL prefix if present
    let base64Data = base64String;
    if (base64String.includes('base64,')) {
      base64Data = base64String.split('base64,')[1];
    }
    
    const imageBuffer = Buffer.from(base64Data, 'base64');
    return await recognizeCaptcha(imageBuffer);
  } catch (error) {
    console.error("Error recognizing captcha from base64:", error);
    return null;
  }
}

/**
 * Recognize captcha text from an image URL.
 * Returns the recognized text (6 chars), or null if recognition fails.
 */
export async function recognizeCaptchaFromUrl(imageUrl) {
  try {
    const imageBuffer = await downloadImageFromUrl(imageUrl);
    return await recognizeCaptcha(imageBuffer);
  } catch (error) {
    console.error("Error downloading or recognizing captcha:", error);
    return null;
  }
}

/** Pre-download the model and initialize ONNX runtime */
export async function warmupOCR() {
  await getSession();
}

// ─── Express Server ─────────────────────────────────────────────────────────

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    modelLoaded: session !== null,
    port: PORT
  });
});

/**
 * POST /recognize - Recognize captcha from base64 image
 * Request body: { image: "base64_string" } or { image: "data:image/png;base64,xxxxx" }
 * Response: { success: true, text: "ABC123" } or { success: false, error: "message" }
 */
app.post('/recognize', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { image, url } = req.body;
    
    // Validate input
    if (!image && !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "image" (base64) or "url"'
      });
    }
    
    let result = null;
    let source = '';
    
    // Recognize from base64
    if (image) {
      source = 'base64';
      result = await recognizeCaptchaFromBase64(image);
    }
    
    // Recognize from URL
    if (url) {
      source = 'url';
      result = await recognizeCaptchaFromUrl(url);
    }
    
    const processingTime = Date.now() - startTime;
    
    if (result) {
      res.json({
        success: true,
        text: result,
        processingTimeMs: processingTime,
        source: source
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to recognize captcha. Image may be invalid or captcha not detected.',
        processingTimeMs: processingTime
      });
    }
    
  } catch (error) {
    console.error('Error in /recognize:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /recognize/base64 - Recognize captcha from base64 (simplified endpoint)
 * Request body: raw base64 string or { base64: "xxxx" }
 */
app.post('/recognize/base64', async (req, res) => {
  const startTime = Date.now();
  
  try {
    let base64Data = '';
    
    if (typeof req.body === 'string') {
      base64Data = req.body;
    } else if (req.body.base64) {
      base64Data = req.body.base64;
    } else if (req.body.image) {
      base64Data = req.body.image;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Missing base64 data in request body'
      });
    }
    
    const result = await recognizeCaptchaFromBase64(base64Data);
    const processingTime = Date.now() - startTime;
    
    if (result) {
      res.json({
        success: true,
        text: result,
        processingTimeMs: processingTime
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to recognize captcha',
        processingTimeMs: processingTime
      });
    }
    
  } catch (error) {
    console.error('Error in /recognize/base64:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /recognize/url - Recognize captcha from URL (GET request)
 * Query param: ?url=https://example.com/captcha.png
 */
app.get('/recognize/url', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing "url" query parameter'
      });
    }
    
    const result = await recognizeCaptchaFromUrl(url);
    const processingTime = Date.now() - startTime;
    
    if (result) {
      res.json({
        success: true,
        text: result,
        processingTimeMs: processingTime
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to recognize captcha',
        processingTimeMs: processingTime
      });
    }
    
  } catch (error) {
    console.error('Error in /recognize/url:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────

async function startServer() {
  try {
    // Warmup OCR model
    console.log('🚀 Initializing OCR model...');
    await warmupOCR();
    console.log('✅ OCR model loaded successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Captcha OCR Service - Running Successfully              ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                  ║
║  Health Check: http://localhost:${PORT}/health                ║
║                                                              ║
║  Endpoints:                                                  ║
║  POST   /recognize          - Base64 or URL in body         ║
║  POST   /recognize/base64   - Base64 only                   ║
║  GET    /recognize/url      - URL query param               ║
║                                                              ║
║  Examples:                                                   ║
║  curl -X POST http://localhost:${PORT}/recognize -H "Content-Type: application/json" -d '{"image":"base64_string"}' ║
║  curl -X POST http://localhost:${PORT}/recognize -H "Content-Type: application/json" -d '{"url":"https://example.com/captcha.png"}' ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();