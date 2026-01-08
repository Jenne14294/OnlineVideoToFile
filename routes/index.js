import express from 'express';
import { v4 as uuidv4 } from 'uuid';
// 👇 補上這些缺少的引入，否則程式無法運作
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// 👇 補上路徑定義，否則 DOWNLOAD_DIR 會報錯
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.join(__dirname, '..', 'downloads');

// 確保暫存目錄存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render('index', { title: '影音轉換器' });
});

router.post('/convert', (req, res) => {
  // 1. 接收前端傳來的參數
  const { url, type, quality, bitrate } = req.body;

  if (!url) {
    return res.status(400).json({ error: '請輸入網址' });
  }

  const jobId = uuidv4();
  // 設定輸出模板，讓 yt-dlp 自動判斷副檔名 (%(ext)s)
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);

  let args = [];

  // --- 2. 建構 yt-dlp 指令 ---
  args.push(url);
  args.push('-o', outputTemplate);
  args.push('--no-playlist');
  // 加入 User-Agent 防止部分網站 (如 B站) 擋爬蟲
  args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  if (type === 'audio') {
    // === 音樂模式 ===
    console.log(`[${jobId}] 音訊下載: 格式 ${quality}, 音質 ${bitrate}k`);
    
    args.push('-x'); // 提取音訊
    args.push('--audio-format', quality); // mp3, vorbis(ogg), m4a
    
    // 如果有指定 bitrate，使用 ffmpeg 參數強制轉換
    const audioBitrate = bitrate ? `${bitrate}k` : '192k';
    args.push('--audio-quality', '0'); 
    args.push('--postprocessor-args', `AudioConvertor:-b:a ${audioBitrate}`);

  } else {
    // === 影片模式 ===
    console.log(`[${jobId}] 影片下載: 畫質限制 ${quality}p`);
    
    // 邏輯：下載 <= 指定解析度的最佳影片 + 最佳音訊
    args.push('-f', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`);
    args.push('--merge-output-format', 'mp4');
  }

  // --- 3. 執行下載 ---
  const ytDlp = spawn('yt-dlp', args);


  // 收集錯誤日誌以便除錯
  let errorLog = '';
  ytDlp.stderr.on('data', (data) => {
    errorLog += data.toString();
    // console.log(data.toString()); 
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      console.error(`[${jobId}] 錯誤: ${errorLog}`);
      return res.status(500).json({ error: '轉檔失敗，請檢查網址是否有效', details: errorLog });
    }

    // --- 4. 尋找與傳送檔案 ---
    fs.readdir(DOWNLOAD_DIR, (err, files) => {
      if (err) return res.status(500).json({ error: '系統錯誤：無法讀取檔案' });

      // 找到開頭符合 jobId 的檔案
      const file = files.find(f => f.startsWith(jobId));

      if (!file) {
        return res.status(500).json({ error: '找不到轉檔後的檔案' });
      }

      const filePath = path.join(DOWNLOAD_DIR, file);
      
      // 設定下載給使用者的檔名
      const ext = path.extname(file);
      const userFilename = `download_${Date.now()}${ext}`;

      res.download(filePath, userFilename, (err) => {
        if (err) {
            console.error('傳送中斷:', err);
        }
        
        // 傳送完成 (或失敗) 後，刪除伺服器上的暫存檔
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('刪除暫存失敗:', unlinkErr);
            else console.log(`[${jobId}] 暫存已清理: ${file}`);
        });
      });
    });
  });
});

export default router;