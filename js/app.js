import { auth, db } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { loadTheme } from "./ui.js"; // テーマの読み込み
import "./ui.js";     // 共通機能の読み込み
import "./auth.js";   // 認証機能の読み込み
import "./feed.js";   // フィード機能の読み込み
import "./profile.js";// プロフィール機能の読み込み

// アプリ起動時にテーマを読み込む
loadTheme(); 

// グローバル変数
window.currentUserData = null;

// ヘッダー更新 (auth.jsやprofile.jsからも呼ぶためwindowへ)
window.updateHeader = function() {
    if(!window.currentUserData) return;
    const h = document.getElementById('headerUserIcon');
    const u = window.currentUserData;
    if(u.photoURL) {
        h.innerHTML = `<img src="${u.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        h.style.background = 'transparent';
    } else {
        h.innerHTML = `<i class="fas ${u.iconClass||'fa-user'}"></i>`;
        h.style.background = u.iconColor || '#555';
        h.style.color = 'white';
    }
    const name = u.publicName || "ゲスト";
    document.getElementById('greetingText').innerHTML = `こんにちは、<br>${name}様`;
};

// 認証監視
onAuthStateChanged(auth, async (u) => {
    if(u) {
        const d = await getDoc(doc(db,"users",u.uid));
        window.currentUserData = d.exists() ? d.data() : {};
        window.updateHeader();
        document.getElementById('loginArea').style.display='none';
        document.getElementById('userArea').style.display='block';
    } else {
        window.currentUserData=null;
        document.getElementById('greetingText').innerHTML=`ようこそ<br>ゲスト様`;
        document.getElementById('loginArea').style.display='block';
        document.getElementById('userArea').style.display='none';
        window.switchTab('home');
    }
});

// アプリ起動時の初期クリックイベント登録（ヘッダーメニューの背景クリックなど）
document.addEventListener('click', (e) => {
    const m = document.getElementById('headerMenu');
    const i = document.getElementById('headerUserIcon');
    if (m.classList.contains('active') && !m.contains(e.target) && !i.contains(e.target)) m.classList.remove('active');
});
