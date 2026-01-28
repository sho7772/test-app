import { auth, db } from "./config.js";
// Auth関連のみ auth.js からインポート
import { updateEmail, updatePassword, reauthenticateWithCredential, deleteUser, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Firestore関連 (doc, updateDoc, getDoc をこっちに移動)
import { doc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showNotify, showConfirmDialog, switchTab, uploadToCloudinary } from "./ui.js";


let tempIconData = { color: '#555', icon: 'fa-user', imageUrl: null };
let selectedFile = null;
const colors = ['#555', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#95a5a6'];
const icons = ['fa-user', 'fa-smile', 'fa-robot', 'fa-cat', 'fa-dog', 'fa-fish', 'fa-rocket', 'fa-star'];

window.showProfile = () => {
    if(!auth.currentUser) return window.openAuthModal('login');
    switchTab(''); 
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('profileScreen').style.display = 'block';
    
    const user = window.currentUserData;
    document.getElementById('publicName').value = user.publicName || "";
    document.getElementById('customId').value = user.customId || "";
    
    tempIconData = { color: user.iconColor || '#555', icon: user.iconClass || 'fa-user', imageUrl: user.photoURL || null };
    selectedFile = null;
    
    renderProfileAvatar();
    createIconSelector();
    checkProfileChanges();
};

function checkProfileChanges() {
    const user = window.currentUserData;
    const nameChanged = document.getElementById('publicName').value !== (user.publicName || "");
    const idChanged = document.getElementById('customId').value !== (user.customId || "");
    const iconChanged = (tempIconData.color !== (user.iconColor||'#555')) || (tempIconData.icon !== (user.iconClass||'fa-user'));
    const imgChanged = !!selectedFile || (user.photoURL && !tempIconData.imageUrl);
    document.getElementById('saveProfileDataBtn').disabled = !(nameChanged || idChanged || iconChanged || imgChanged);
}
document.getElementById('publicName').oninput = checkProfileChanges;
document.getElementById('customId').oninput = checkProfileChanges;

window.savePublicProfile = () => showConfirmDialog("変更を保存しますか？", async () => {
    const newName = document.getElementById('publicName').value;
    const newId = document.getElementById('customId').value;
    showNotify("保存中...", "success");
    try {
        let finalUrl = window.currentUserData.photoURL || null;
        if (!tempIconData.imageUrl && window.currentUserData.photoURL) finalUrl = null;
        if (selectedFile) finalUrl = await uploadToCloudinary(selectedFile);

        const updateData = { publicName: newName, customId: newId, iconColor: tempIconData.color, iconClass: tempIconData.icon, photoURL: finalUrl };
        await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
        Object.assign(window.currentUserData, updateData); // ローカル更新
        window.updateHeader(); // app.jsの関数
        showNotify("更新しました");
        window.goBack();
    } catch(e) { showNotify("エラー: " + e.message, "error"); }
});

function renderProfileAvatar() {
    const d = document.getElementById('currentAvatar');
    const img = document.getElementById('avatarImg');
    const ico = document.getElementById('avatarIcon');
    const rst = document.getElementById('resetIconBtn');
    if (tempIconData.imageUrl) {
        img.src = tempIconData.imageUrl; img.style.display = 'block'; ico.style.display = 'none';
        d.style.background = 'transparent'; d.style.border = 'none'; rst.style.display = 'block';
    } else {
        img.style.display = 'none'; ico.style.display = 'block';
        ico.className = `avatar-icon fas ${tempIconData.icon}`;
        d.style.background = tempIconData.color; d.style.border = '4px solid white'; d.style.color = 'white';
        rst.style.display = 'none';
    }
}

window.triggerImageUpload = () => document.getElementById('imageInput').click();
window.handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { tempIconData.imageUrl = e.target.result; renderProfileAvatar(); checkProfileChanges(); };
    reader.readAsDataURL(file);
};
window.resetToDefaultIcon = () => { tempIconData.imageUrl = null; selectedFile = null; renderProfileAvatar(); checkProfileChanges(); };

window.toggleIconSelector = () => { const s = document.getElementById('iconSelector'); s.style.display = s.style.display === 'block' ? 'none' : 'block'; };
function createIconSelector() {
    const cP = document.getElementById('colorPalette'); cP.innerHTML = '';
    const iP = document.getElementById('iconPalette'); iP.innerHTML = '';
    colors.forEach(c => {
        const e = document.createElement('div'); e.className = 'color-option'; e.style.backgroundColor = c;
        if(c === tempIconData.color) e.classList.add('selected');
        e.onclick = () => { tempIconData.color = c; if(!tempIconData.imageUrl) renderProfileAvatar(); checkProfileChanges(); createIconSelector(); };
        cP.appendChild(e);
    });
    icons.forEach(i => {
        const e = document.createElement('div'); e.className = 'icon-option'; e.innerHTML = `<i class="fas ${i}"></i>`;
        if(i === tempIconData.icon) e.classList.add('selected');
        e.onclick = () => { tempIconData.icon = i; if(!tempIconData.imageUrl) renderProfileAvatar(); checkProfileChanges(); createIconSelector(); };
        iP.appendChild(e);
    });
}

// アカウント設定・削除機能は長くなるため、accountSettingsScreenのID要素に対するイベントは
// このファイルの末尾やinit関数などで処理するのが一般的ですが、今回はwindow関数として公開します。
window.showAccountSettings = () => {
    if(!auth.currentUser) return window.openAuthModal('login');
    switchTab('');
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('accountSettingsScreen').style.display = 'block';
    document.getElementById('editEmail').value = auth.currentUser.email || "";
    document.getElementById('editPass').value = ""; document.getElementById('editPassConfirm').value = "";
    checkAccountChanges();
};

function checkAccountChanges() {
    const e = document.getElementById('editEmail').value !== auth.currentUser.email;
    const p = document.getElementById('editPass').value.length > 0;
    document.getElementById('saveAccountBtn').disabled = !(e || p);
}
['editEmail','editPass'].forEach(id => document.getElementById(id).oninput = checkAccountChanges);

window.updateAccountInfo = () => {
    const e = document.getElementById('editEmail').value;
    const p = document.getElementById('editPass').value;
    const pc = document.getElementById('editPassConfirm').value;
    if(p && (p.length<6 || p!==pc)) return showNotify("パスワードを確認してください", "error");
    showConfirmDialog("変更を保存しますか？", async () => {
        try {
            const u = auth.currentUser;
            if(e !== u.email) await updateEmail(u,e);
            if(p) await updatePassword(u,p);
            window.updateHeader(); showNotify("更新しました"); window.goBack();
        } catch(err) { 
            if(err.code==='auth/requires-recent-login') { showNotify("再ログインが必要です","error"); window.logoutExecution(); }
            else showNotify(err.message, "error");
        }
    });
};
window.confirmDeleteAccount = () => {
    const passInput = document.getElementById('confirmPassword'); passInput.value = "";
    showConfirmDialog("アカウントを完全に削除しますか？\n確認のためパスワードを入力してください", async () => {
        const password = passInput.value;
        if(!password) return showNotify("パスワードを入力してください", "error");
        showNotify("削除処理中...", "success");
        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            const batch = writeBatch(db);
            const q = query(collection(db, "posts"), where("userId", "==", user.uid));
            const snapshot = await getDocs(q);
            snapshot.forEach((doc) => { batch.delete(doc.ref); });
            await batch.commit();
            await deleteDoc(doc(db, "users", user.uid));
            await deleteUser(user);
            showNotify("アカウントを削除しました"); setTimeout(()=>location.reload(), 1500);
        } catch(e) { showNotify(e.code === 'auth/wrong-password' ? "パスワードが違います" : "エラー: "+e.message, "error"); }
    }, true);
    passInput.style.display = 'block'; passInput.focus();
};
