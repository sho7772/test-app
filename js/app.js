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
        if (d.exists()) {
            const data = d.data();

            // ★追加: BANチェック
            if (data.isBanned) {
                alert("このアカウントは利用停止されています。");
                await auth.signOut();
                return;
            }

            window.currentUserData = data;
            window.updateHeader();

            // ★追加: 管理者の場合、メニューにリンクを追加するフラグを立てる、または直接DOM操作
            if (data.isAdmin) {
                addAdminLink();
            }

            document.getElementById('loginArea').style.display='none';
            document.getElementById('userArea').style.display='block';
        } else {
            // ドキュメントがない場合（削除された場合など）
            window.currentUserData = {};
        }
    } else {
        // ...既存のログアウト処理...
        removeAdminLink(); // ★追加: ログアウト時にリンク消去
    }
});

// ★追加: 管理者リンク表示用関数
function addAdminLink() {
    const menu = document.getElementById('headerMenu');
    // 重複防止
    if(document.getElementById('adminLinkItem')) return;

    const div = document.createElement('div');
    div.id = 'adminLinkItem';
    div.innerHTML = `
        <div class="menu-divider"></div>
        <div class="menu-item" onclick="location.href='admin.html'" style="color:#e74c3c;">
            <i class="fas fa-user-shield"></i> 管理画面へ
        </div>
    `;
    menu.appendChild(div);
}

function removeAdminLink() {
    const item = document.getElementById('adminLinkItem');
    if(item) item.remove();
}


// アプリ起動時の初期クリックイベント登録（ヘッダーメニューの背景クリックなど）
document.addEventListener('click', (e) => {
    const m = document.getElementById('headerMenu');
    const i = document.getElementById('headerUserIcon');
    if (m.classList.contains('active') && !m.contains(e.target) && !i.contains(e.target)) m.classList.remove('active');
});
