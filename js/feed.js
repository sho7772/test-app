import { auth, db } from "./config.js";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove, where, documentId, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showNotify, showConfirmDialog, escapeHtml, uploadToCloudinary } from "./ui.js";

let feedUnsubscribe = null; 
let userCache = {}; // ユーザー情報を一時保存するメモリ（何度も通信しないため）
let selectedPostFile = null;
let currentOpenPostId = null;
let commentsUnsubscribe = null;

// ユーザー情報をまとめて取得してキャッシュする関数
async function fetchUsersToCache(uids) {
    const missingUids = uids.filter(uid => !userCache[uid]);
    if (missingUids.length === 0) return;

    // Firestoreの制限により、一括取得は10件ずつ行う
    const chunks = [];
    for (let i = 0; i < missingUids.length; i += 10) {
        chunks.push(missingUids.slice(i, i + 10));
    }

    for (const chunk of chunks) {
        const q = query(collection(db, "users"), where(documentId(), "in", chunk));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            userCache[doc.id] = doc.data();
        });
    }
}

// フィード読み込み
export function loadFeed() {
    const list = document.getElementById('feedList');
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));

    if (feedUnsubscribe) feedUnsubscribe();

    feedUnsubscribe = onSnapshot(q, async (snapshot) => {
        const postsData = [];
        const uidsToFetch = new Set();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            postsData.push({ id: docSnap.id, ...data });
            uidsToFetch.add(data.userId);
        });

        // 投稿に関連するユーザー情報を最新版で取得（キャッシュになければ通信）
        await fetchUsersToCache(Array.from(uidsToFetch));

        list.innerHTML = "";
        if(postsData.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">投稿がありません。</div>`;
            return;
        }

        const currentUid = auth.currentUser ? auth.currentUser.uid : null;

        postsData.forEach(post => {
            // ★ キャッシュから最新のユーザー情報を取得（退会済みなどでなければ取得可能）
            const userData = userCache[post.userId] || { publicName: "不明なユーザー", iconColor: "#ccc", iconClass: "fa-user" };
            
            const el = document.createElement('div');
            el.className = 'feed-card';
            
            let timeStr = "";
            if(post.createdAt) {
                const d = post.createdAt.toDate();
                timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            }

            // アイコン表示に最新のuserDataを使用
            let iconHtml = userData.photoURL ? `<img src="${userData.photoURL}">` : `<i class="fas ${userData.iconClass || 'fa-user'}"></i>`;
            let bgStyle = userData.photoURL ? "background: transparent;" : `background: ${userData.iconColor || '#555'};`;
            
            const deleteBtnHtml = (currentUid && post.userId === currentUid) ? `<div class="post-delete-btn" onclick="deletePost('${post.id}')"><i class="fas fa-trash-alt"></i></div>` : '';
            const likedBy = post.likedBy || [];
            const isLiked = currentUid && likedBy.includes(currentUid);
            const idDisplay = userData.customId ? `<span class="feed-id">@${escapeHtml(userData.customId)}</span>` : '';
            const likesCount = (post.likes || 0) > 0 ? post.likes : 'いいね';
            const commentsCount = (post.commentCount || 0) > 0 ? post.commentCount : 'コメント';

            el.innerHTML = `
                ${deleteBtnHtml}
                <div class="feed-header">
                    <div class="feed-avatar" style="${bgStyle}">${iconHtml}</div>
                    <div class="feed-info">
                        <div class="feed-name">${escapeHtml(userData.publicName)}${idDisplay}</div>
                        <div class="feed-time">${timeStr}</div>
                    </div>
                </div>
                <div class="feed-content">${escapeHtml(post.text)}</div>
                ${post.imageUrl ? `<div class="feed-image" style="display:block;"><img src="${post.imageUrl}" onclick="event.stopPropagation(); openImageModal(this.src)"></div>` : ''}
                <div class="feed-actions">
                    <div class="action-item ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${likesCount}
                    </div>
                    <div class="action-item" onclick="openCommentModal('${post.id}')">
                        <i class="far fa-comment"></i> ${commentsCount}
                    </div>
                </div>
            `;
            list.appendChild(el);
        });
    });
}

window._loadFeed = loadFeed;
window.openPostModal = () => {
    if(!auth.currentUser) return window.openAuthModal('login');
    document.getElementById('postModal').style.display = 'flex';
    document.getElementById('postText').value = "";
    removePostImage();
};
window.closePostModal = () => document.getElementById('postModal').style.display = 'none';

window.handlePostImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    selectedPostFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('postImgPreview');
        img.src = e.target.result; img.style.display = 'block';
        document.getElementById('removePostImgBtn').style.display = 'flex';
    };
    reader.readAsDataURL(file);
};
window.removePostImage = removePostImage;
function removePostImage() {
    selectedPostFile = null;
    document.getElementById('postImageInput').value = "";
    document.getElementById('postImgPreview').style.display = 'none';
    document.getElementById('removePostImgBtn').style.display = 'none';
}

window.submitPost = async () => {
    const text = document.getElementById('postText').value.trim();
    if(!text && !selectedPostFile) return showNotify("本文または画像を入力してください", "error");
    if (!auth.currentUser) return showNotify("ログインしてください", "error");

    const btn = document.getElementById('submitPostBtn');
    btn.disabled = true; btn.innerText = "投稿中...";
    try {
        let imageUrl = null;
        if(selectedPostFile) imageUrl = await uploadToCloudinary(selectedPostFile, 'post');
        
        // 投稿データにはuserIdだけを入れる（名前やアイコンはusersから動的に取るため）
        await addDoc(collection(db, "posts"), {
            userId: auth.currentUser.uid,
            text: text, 
            imageUrl: imageUrl, 
            createdAt: serverTimestamp(), 
            likes: 0, 
            likedBy: [], 
            commentCount: 0 
        });
        showNotify("投稿しました！"); window.closePostModal();
    } catch(e) { showNotify("投稿エラー", "error"); } 
    finally { btn.disabled = false; btn.innerText = "投稿する"; }
};

window.toggleLike = async (postId) => {
    if(!auth.currentUser) return window.openAuthModal('login');
    const uid = auth.currentUser.uid;
    const postRef = doc(db, "posts", postId);
    const p = await getDoc(postRef);
    if(p.exists()) {
        const data = p.data();
        if((data.likedBy || []).includes(uid)) await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(uid) });
        else await updateDoc(postRef, { likes: increment(1), likedBy: arrayUnion(uid) });
    }
};
window.deletePost = (postId) => showConfirmDialog("削除しますか？", async () => {
    await deleteDoc(doc(db, "posts", postId)); showNotify("削除しました");
}, true);

// コメント機能
window.openCommentModal = (postId) => {
    if(!auth.currentUser) return window.openAuthModal('login');
    currentOpenPostId = postId;
    document.getElementById('commentModal').style.display = 'flex';
    document.getElementById('commentInput').value = "";
    const list = document.getElementById('commentList');
    list.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';

    if(commentsUnsubscribe) commentsUnsubscribe();
    commentsUnsubscribe = onSnapshot(query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc")), async (snapshot) => {
        const commentData = [];
        const commentUids = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            commentData.push(data);
            commentUids.add(data.userId);
        });

        // コメントユーザーも最新情報を取得
        await fetchUsersToCache(Array.from(commentUids));

        list.innerHTML = "";
        if (commentData.length === 0) { list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">コメントなし</div>'; return; }
        
        commentData.forEach(c => {
            const userData = userCache[c.userId] || { publicName: "不明", iconColor: "#555", iconClass: "fa-user" };
            const d = c.createdAt ? c.createdAt.toDate() : new Date();
            const timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            let iconHtml = userData.photoURL ? `<img src="${userData.photoURL}">` : `<i class="fas ${userData.iconClass || 'fa-user'}"></i>`;
            let bgStyle = userData.photoURL ? "background: transparent;" : `background: ${userData.iconColor || '#555'};`;
            
            list.insertAdjacentHTML('beforeend', `
                <div class="comment-item">
                    <div class="comment-avatar" style="${bgStyle}">${iconHtml}</div>
                    <div class="comment-body">
                        <div class="comment-user">${escapeHtml(userData.publicName)}</div>
                        <div class="comment-text">${escapeHtml(c.text)}</div>
                        <div class="comment-date">${timeStr}</div>
                    </div>
                </div>`);
        });
        list.scrollTop = list.scrollHeight;
    });
};

window.closeCommentModal = () => { document.getElementById('commentModal').style.display = 'none'; if(commentsUnsubscribe) commentsUnsubscribe(); };

window.submitComment = async () => {
    const text = document.getElementById('commentInput').value.trim();
    if(!text || !currentOpenPostId) return;
    const btn = document.getElementById('sendCommentBtn'); btn.disabled = true;
    try {
        // コメントもuserIdだけ保存
        await addDoc(collection(db, "posts", currentOpenPostId, "comments"), {
            userId: auth.currentUser.uid,
            text: text, 
            createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "posts", currentOpenPostId), { commentCount: increment(1) });
        document.getElementById('commentInput').value = "";
    } catch(e) { showNotify("エラー", "error"); } finally { btn.disabled = false; }
};
