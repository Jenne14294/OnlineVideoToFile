/**
 * 切換選項顯示 (影片畫質 vs 音訊格式)
 */
function toggleOptions() {
    const type = document.getElementById('type').value;
    const vidSec = document.getElementById('videoSection');
    const audSec = document.getElementById('audioSection');
    
    if (type === 'audio') {
        vidSec.classList.add('hidden');
        audSec.classList.remove('hidden');
        // 強制設定為 flex 佈局以保持並排
        audSec.style.display = 'flex'; 
    } else {
        vidSec.classList.remove('hidden');
        audSec.classList.add('hidden');
        audSec.style.display = 'none';
    }
}

/**
 * 鎖定或解鎖介面 (除了回首頁按鈕)
 * @param {boolean} isLocked - true 為鎖定, false 為解鎖
 */
function toggleInterface(isLocked) {
    // 選取所有互動元件：輸入框、選單、按鈕
    const elements = document.querySelectorAll('input, select, button');
    
    elements.forEach(el => {
        // 如果該元件是回首頁按鈕，則跳過 (不鎖定)
        if (el.classList.contains('home-btn')) return;
        
        el.disabled = isLocked;
        
        // 視覺上的回饋 (選擇性，讓使用者知道被鎖定了)
        if (isLocked) {
            el.style.opacity = '0.7';
            el.style.cursor = 'not-allowed';
        } else {
            el.style.opacity = '1';
            el.style.cursor = ''; // 恢復預設
        }
    });
}

async function startDownload() {
    const url = document.getElementById('url').value;
    const type = document.getElementById('type').value;
    const btn = document.getElementById('btn');
    const status = document.getElementById('status');
    const btnIcon = btn.querySelector('i');
    const btnText = btn.querySelector('.btn-text');

    if(!url) {
        status.innerHTML = '<span style="color:#ef4444"><i class="fa-solid fa-circle-exclamation"></i> 請輸入網址！</span>';
        return;
    }

    // 收集參數
    let payload = { url, type };

    if (type === 'video') {
        payload.quality = document.getElementById('videoQuality').value;
    } else {
        payload.quality = document.getElementById('audioFormat').value;
        payload.bitrate = document.getElementById('audioBitrate').value;
    }

    // --- 1. UI 鎖定 & 載入動畫 ---
    toggleInterface(true); // 鎖定所有按鈕
    
    btnText.innerText = "處理中...";
    btnIcon.className = "fa-solid fa-circle-notch fa-spin"; // 轉圈圈圖示
    status.innerHTML = "⏳ 伺服器正在努力下載並轉檔...<br><span style='font-size:0.8em; color:#666'>(高畫質影片可能需要數分鐘)</span>";

    try {
        const response = await fetch('/StreamToFile/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error || '轉換失敗');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;

        // --- 2. 處理檔名 ---
        // 預設標題名稱 (如果後端沒給檔名，就用這個)
        let filename = "StreamToFile_Download"; 
        
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.indexOf('filename=') !== -1) {
            // 優化正則表達式，支援有引號和沒引號的檔名
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        
        // 確保有副檔名
        if (!filename.includes('.')) {
            if (type === 'audio') filename += `.${payload.quality}`; // mp3 或 m4a
            else filename += '.mp4';
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        status.innerHTML = `<span style="color:#10b981"><i class="fa-solid fa-circle-check"></i> 下載完成：${filename}</span>`;
    } catch (err) {
        console.error(err);
        status.innerHTML = `<span style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> 錯誤: ${err.message}</span>`;
    } finally {
        // --- 3. 恢復 UI ---
        toggleInterface(false); // 解鎖所有按鈕
        
        btnText.innerText = "開始轉換並下載";
        btnIcon.className = "fa-solid fa-cloud-arrow-down";
    }
}


// 初始化
document.addEventListener('DOMContentLoaded', () => {
    toggleOptions();
});