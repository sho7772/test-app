import { auth, db } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let allUsers = [];

// 1. 認証チェック & 管理者権限チェック
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("ログインが必要です");
        window.location.href = "index.html";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // ★重要: isAdminフィールドがtrueでない場合は追い出す
            if (!userData.isAdmin) {
                alert("管理者権限がありません");
                window.location.href = "index.html";
                return;
            }

            // 管理者として認定
            document.getElementById('adminNameDisplay').innerText = `管理者: ${userData.publicName || user.email}`;
            fetchUsers(); // ユーザー一覧取得開始

        } else {
            alert("ユーザー情報が見つかりません");
            window.location.href = "index.html";
        }
    } catch (e) {
        console.error("Auth Error:", e);
        alert("認証エラー");
        window.location.href = "index.html";
    }
});

// 2. ユーザー一覧取得
async function fetchUsers() {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</td></tr>';

    try {
        // 全ユーザーを取得 (ユーザー数が多い場合はlimitやpaginationが必要ですが、まずは全件)
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        renderTable(allUsers);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">読み込みエラー: ${e.message}</td></tr>`;
    }
}

// 3. テーブル描画
function renderTable(users) {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = "";

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">ユーザーがいません</td></tr>';
        return;
    }

    users.forEach(user => {
        // 日付フォーマット
        let dateStr = "-";
        if (user.createdAt) {
            const d = user.createdAt.toDate();
            dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
        }

        // アイコン表示
        let iconHtml = user.photoURL 
            ? `<img src="${user.photoURL}">` 
            : `<i class="fas ${user.iconClass || 'fa-user'}"></i>`;
        let iconStyle = user.photoURL 
            ? "background: transparent;" 
            : `background: ${user.iconColor || '#555'};`;

        // ステータス判定
        const isBanned = user.isBanned === true;
        const statusBadge = isBanned 
            ? `<span class="status-badge status-banned">停止中</span>` 
            : `<span class="status-badge status-active">有効</span>`;

        // ボタン
        const banBtn = isBanned
            ? `<button class="action-btn btn-restore" onclick="toggleBan('${user.id}', false)">解除</button>`
            : `<button class="action-btn btn-ban" onclick="toggleBan('${user.id}', true)">停止</button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="user-icon-mini" style="${iconStyle}">${iconHtml}</div>
            </td>
            <td>
                <div style="font-weight:bold;">${escapeHtml(user.publicName || 'No Name')}</div>
                <div style="color:#888; font-size:11px;">@${escapeHtml(user.customId || '-')}</div>
            </td>
            <td>${user.id} <br><span style="font-size:10px; color:#aaa;">(Auth連携は別途確認)</span></td>
            <td>${dateStr}</td>
            <td>${statusBadge}</td>
            <td>
                ${banBtn}
                <button class="action-btn btn-delete" onclick="deleteUserStore('${user.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. 検索フィルタリング
document.getElementById('userSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u => {
        const name = (u.publicName || "").toLowerCase();
        const uid = (u.customId || "").toLowerCase();
        const id = u.id.toLowerCase();
        return name.includes(term) || uid.includes(term) || id.includes(term);
    });
    renderTable(filtered);
});

// 5. アクション関数 (BAN切り替え)
window.toggleBan = async (uid, doBan) => {
    if(!confirm(doBan ? "このユーザーを利用停止にしますか？" : "このユーザーの停止を解除しますか？")) return;
    
    try {
        await updateDoc(doc(db, "users", uid), {
            isBanned: doBan
        });
        showToast(doBan ? "ユーザーを停止しました" : "停止を解除しました");
        // 配列データを更新して再描画
        const target = allUsers.find(u => u.id === uid);
        if(target) target.isBanned = doBan;
        renderTable(allUsers); // 現在のフィルタ状態に関わらず全件ベースで再描画される簡易実装
    } catch(e) {
        alert("エラー: " + e.message);
    }
};

// 6. アクション関数 (Firestoreデータ物理削除)
window.deleteUserStore = async (uid) => {
    if(!confirm("【警告】\nFirestore上のユーザー情報を完全に削除します。\n(注: Firebase Authのログイン情報は残りますが、アプリ上では存在しない扱いになります)\n本当によろしいですか？")) return;

    try {
        // ユーザーに関連するデータ削除（簡易的: usersドキュメントのみ）
        // ※本来はPostsなども消すべきですが、まずはユーザー情報のみ
        await deleteDoc(doc(db, "users", uid));
        
        showToast("データを削除しました");
        allUsers = allUsers.filter(u => u.id !== uid);
        renderTable(allUsers);
    } catch(e) {
        alert("削除エラー: " + e.message);
    }
};

// ユーティリティ
function escapeHtml(unsafe) {
    if(!unsafe) return "";
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showToast(msg) {
    const t = document.getElementById('adminToast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 3000);
}
