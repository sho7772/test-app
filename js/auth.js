import { auth, db } from "./config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, query, collection, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showNotify, showConfirmDialog } from "./ui.js";

let currentAuthMode = 'login';

// モーダルを開く処理の実体
window._openAuthModal = (mode) => {
    currentAuthMode = mode; 
    document.getElementById('authModal').style.display = 'flex';
    
    const isReg = mode === 'register';
    document.getElementById('idGroup').style.display = isReg ? 'block' : 'none';
    document.getElementById('publicNameGroup').style.display = isReg ? 'block' : 'none';
    document.getElementById('passConfirmGroup').style.display = isReg ? 'block' : 'none';
    
    document.getElementById('modalTitle').innerText = isReg ? "新規登録" : "ログイン";
    document.getElementById('switchText').innerHTML = isReg ? "ログインへ戻る" : "<b>登録はこちら</b>";
    
    resetValidationDisplay();
    if(isReg) validateField('id');
};

window.toggleMode = () => window.openAuthModal(currentAuthMode==='login'?'register':'login');

// バリデーション表示リセット
function resetValidationDisplay() {
    document.querySelectorAll('.validation-icon').forEach(el => {
        el.classList.remove('valid', 'invalid');
    });
    document.getElementById('passHelper').classList.remove('valid');
    document.getElementById('emailError').style.display = 'none';
    const idBtn = document.getElementById('checkIdBtn');
    idBtn.className = "check-id-btn disabled";
    idBtn.innerHTML = "確認";
}

function setValidationStatus(elementId, isValid) {
    const icon = document.getElementById('icon-' + elementId);
    if (!icon) return;
    icon.classList.remove('valid', 'invalid', 'fa-check-circle', 'fa-exclamation-circle');
    if (isValid) { icon.classList.add('valid', 'fa-check-circle'); } 
    else { icon.classList.add('invalid', 'fa-exclamation-circle'); }
}

// リアルタイムバリデーション
function validateField(type) {
    if (currentAuthMode !== 'register') return;
    const val = document.getElementById('input' + type.charAt(0).toUpperCase() + type.slice(1))?.value || '';
    let isValid = false;

    if (type === 'id') {
        const idBtn = document.getElementById('checkIdBtn');
        if (/^[a-zA-Z0-9]+$/.test(val)) {
            if(idBtn.classList.contains('error') || idBtn.classList.contains('success')) {
                 idBtn.className = "check-id-btn active"; idBtn.innerHTML = "確認";
            } else if (idBtn.classList.contains('disabled')) {
                 idBtn.className = "check-id-btn active";
            }
        } else {
            idBtn.className = "check-id-btn disabled"; idBtn.innerHTML = "確認";
        }
        return;
    } 
    else if (type === 'publicName') { isValid = val.trim().length > 0; } 
    else if (type === 'email') {
        isValid = /\S+@\S+\.\S+/.test(val);
        document.getElementById('emailError').style.display = 'none';
    } else if (type === 'pass') {
        isValid = /^[a-zA-Z0-9]{6,}$/.test(val);
        const helper = document.getElementById('passHelper');
        if (isValid) helper.classList.add('valid'); else helper.classList.remove('valid');
        validateField('passConfirm');
    } else if (type === 'passConfirm') {
        const passVal = document.getElementById('inputPass').value;
        isValid = (val === passVal) && (val.length > 0);
    }

    let targetId = type;
    if (type === 'publicName') targetId = 'name';
    setValidationStatus(targetId, isValid);
}

// イベントリスナー設定
document.getElementById('inputId').addEventListener('input', () => validateField('id'));
document.getElementById('inputPublicName').addEventListener('input', () => validateField('publicName'));
document.getElementById('inputEmail').addEventListener('input', () => validateField('email'));
document.getElementById('inputPass').addEventListener('input', () => validateField('pass'));
document.getElementById('inputPassConfirm').addEventListener('input', () => validateField('passConfirm'));

// ID重複チェック
async function checkIdAvailability(id) {
    const q = query(collection(db, "users"), where("customId", "==", id));
    const snap = await getDocs(q);
    return snap.empty;
}

// 手動ID確認ボタン
window.verifyIdManually = async () => {
    const id = document.getElementById('inputId').value;
    const btn = document.getElementById('checkIdBtn');
    if(btn.classList.contains('disabled') || btn.classList.contains('success')) return;
    btn.innerText = "確認中...";
    try {
        const isAvailable = await checkIdAvailability(id);
        if(isAvailable) {
            btn.className = "check-id-btn success";
            btn.innerHTML = '<i class="fas fa-check-circle"></i>';
        } else {
            btn.className = "check-id-btn error";
            btn.innerHTML = "使用されています";
        }
    } catch(e) { console.error(e); btn.innerText = "確認"; }
};

// ログイン・登録実行
window.handleAuth = async () => {
    const e = document.getElementById('inputEmail').value;
    const p = document.getElementById('inputPass').value;
    const pc = document.getElementById('inputPassConfirm').value;
    const customId = document.getElementById('inputId').value;
    const pn = document.getElementById('inputPublicName').value;
    const btn = document.getElementById('authBtn');
    
    if(currentAuthMode==='register') {
        validateField('publicName'); validateField('email'); validateField('pass'); validateField('passConfirm');
        let basicError = false;
        if(!customId || !pn || !e || !p) basicError = true;
        if(!/^[a-zA-Z0-9]+$/.test(customId)) basicError = true;
        if(!/^[a-zA-Z0-9]{6,}$/.test(p)) basicError = true;
        if(p!==pc) basicError = true;

        if(basicError) return showNotify("入力内容を確認してください", "error");
        
        btn.disabled = true; btn.innerText = "確認中...";
        try {
            const isIdAvailable = await checkIdAvailability(customId);
            const idBtn = document.getElementById('checkIdBtn');
            let userCredential = null;
            let emailErrorOccurred = false;

            try {
                userCredential = await createUserWithEmailAndPassword(auth, e, p);
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') emailErrorOccurred = true;
                else throw authError;
            }

            // 同時チェック判定
            if (emailErrorOccurred && !isIdAvailable) {
                idBtn.className = "check-id-btn error"; idBtn.innerHTML = "使用されています";
                document.getElementById('emailError').style.display = 'block';
                setValidationStatus('email', false);
                btn.disabled = false; btn.innerText = "決定";
                return showNotify("入力内容を確認してください", "error");
            }
            if (emailErrorOccurred && isIdAvailable) {
                document.getElementById('emailError').style.display = 'block';
                setValidationStatus('email', false);
                idBtn.className = "check-id-btn success"; idBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
                btn.disabled = false; btn.innerText = "決定";
                return showNotify("入力内容を確認してください", "error");
            }
            if (!emailErrorOccurred && !isIdAvailable) {
                if (userCredential && userCredential.user) await deleteUser(userCredential.user);
                idBtn.className = "check-id-btn error"; idBtn.innerHTML = "使用されています";
                btn.disabled = false; btn.innerText = "決定";
                return showNotify("入力内容を確認してください", "error");
            }
            // 成功時
            if (!emailErrorOccurred && isIdAvailable && userCredential) {
                await setDoc(doc(db,"users",userCredential.user.uid), { 
                    createdAt: new Date(), publicName: pn, customId: customId, iconColor: '#555', iconClass: 'fa-user'
                });
                showNotify("登録完了");
                window.closeAuthModal();
            }
        } catch(err) {
            console.error(err);
            showNotify("エラー: " + err.message, "error");
            btn.disabled = false; btn.innerText = "決定";
        }
    } else {
        if(!e || !p) return showNotify("入力内容を確認してください", "error");
        btn.disabled = true; btn.innerText = "処理中...";
        try {
            await signInWithEmailAndPassword(auth,e,p);
            showNotify("ログイン成功");
            window.closeAuthModal();
        } catch(err) { showNotify("入力内容を確認してください", "error"); } 
        finally { btn.disabled = false; btn.innerText = "決定"; }
    }
};

window.confirmLogout = () => showConfirmDialog("ログアウトしますか？", async () => {
    await signOut(auth); showNotify("ログアウトしました"); setTimeout(()=>location.reload(),1000);
});
