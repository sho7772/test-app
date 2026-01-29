import { auth, cloudinaryConfig } from "./config.js";

// 通知を表示
export const showNotify = (msg, type='success') => {
    const b = document.getElementById('notificationBanner');
    const t = document.getElementById('notificationText');
    const i = document.getElementById('notificationIcon');
    t.innerText = msg; b.className = ""; b.classList.add(type);
    i.className = type === 'success' ? "fas fa-check-circle" : "fas fa-exclamation-circle";
    b.style.top = "20px"; setTimeout(() => { b.style.top = "-100px"; }, 3000);
};

// 確認ダイアログ
export const showConfirmDialog = (msg, onOk, isDanger=false) => {
    const m = document.getElementById('confirmModal');
    document.getElementById('confirmMsg').innerText = msg;
    document.getElementById('confirmPassword').style.display = 'none';
    const sub = document.getElementById('confirmSubMsg');
    if(isDanger) { sub.innerText = "この操作は取り消せません。"; sub.style.display = 'block'; } 
    else { sub.style.display = 'none'; }

    const ok = document.getElementById('confirmOkBtn');
    const newOk = ok.cloneNode(true); ok.parentNode.replaceChild(newOk, ok);
    newOk.onclick = () => { onOk(); closeConfirm(); };
    
    if(isDanger) { newOk.style.background = "#e74c3c"; newOk.innerText = "削除する"; } 
    else { newOk.style.background = "#3498db"; newOk.innerText = "OK"; }
    m.style.display = 'flex';
};
export const closeConfirm = () => document.getElementById('confirmModal').style.display = 'none';

// タブ切り替え
export const switchTab = (tab) => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(tab === 'home') document.getElementById('navHome').classList.add('active');
    if(tab === 'feed') document.getElementById('navFeed').classList.add('active');

    document.querySelectorAll('.screen-container').forEach(e => e.style.display = 'none');
    document.getElementById('homeScreen').style.display = 'none';

    if (tab === 'home') {
        document.getElementById('homeScreen').style.display = 'block';
    } else if (tab === 'feed') {
        document.getElementById('feedScreen').style.display = 'block';
        if(window._loadFeed) window._loadFeed();
    }
};

// HTMLエスケープ
export function escapeHtml(unsafe) {
    if(!unsafe) return "";
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// 画像アップロード
export async function uploadToCloudinary(file, type='profile') {
    const user = auth.currentUser;
    if (!user) throw new Error("ログインしていません");

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.preset); 
    formData.append('public_id', `${type}_${user.uid}_${new Date().getTime()}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
        method: 'POST', body: formData
    });

    if (!response.ok) throw new Error("画像のアップロードに失敗しました");
    const data = await response.json();
    return data.secure_url;
}

// 画像拡大モーダル
export const openImageModal = (src) => {
    document.body.style.overflow = 'hidden'; // 背景スクロール禁止
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('expandedImg');
    modal.style.display = "flex";
    img.src = src;
};

export const closeImageModal = () => {
    document.body.style.overflow = ''; // スクロール解除
    const modal = document.getElementById('imageModal');
    modal.style.display = "none";
    document.getElementById('expandedImg').src = "";
};

// グローバル公開
window.showNotify = showNotify;
window.showConfirmDialog = showConfirmDialog;
window.closeConfirm = closeConfirm;
window.switchTab = switchTab;
window.goBack = () => switchTab('home');
window.openAuthModal = (mode) => { if(window._openAuthModal) window._openAuthModal(mode); };
window.closeAuthModal = () => document.getElementById('authModal').style.display = 'none';
window.toggleHeaderMenu = () => document.getElementById('headerMenu').classList.toggle('active');
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
// ダークモード切り替え機能
export const toggleDarkMode = () => {
    const body = document.body;
    const checkbox = document.getElementById('darkModeToggle');
    body.classList.toggle('dark-mode');
    
    // スイッチの表示を同期
    const isDark = body.classList.contains('dark-mode');
    if(checkbox) checkbox.checked = isDark;
    
    // 設定を保存
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// 起動時にテーマを適用
export const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const checkbox = document.getElementById('darkModeToggle');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if(checkbox) checkbox.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        if(checkbox) checkbox.checked = false;
    }
};

// グローバル公開
window.toggleDarkMode = toggleDarkMode;

