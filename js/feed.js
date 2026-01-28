import { auth, db } from "./config.js";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showNotify, showConfirmDialog, escapeHtml, uploadToCloudinary } from "./ui.js";

let feedUnsubscribe = null; 
let selectedPostFile = null;
let currentOpenPostId = null;
let commentsUnsubscribe = null;

// フィード読み込み
export function loadFeed() {
    const list = document.getElementById('feedList');
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));

    feedUnsubscribe = onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        if(snapshot.empty) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">投稿がありません。</div>`;
            return;
        }
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;

        snapshot.forEach(docSnap => {
            const post = docSnap.data();
            const postId = docSnap.id;
            const el = document.createElement('div');
            el.className = 'feed-card';
            
            let timeStr = "";
            if(post.createdAt) {
                const d = post.createdAt.toDate();
                timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            }

            let iconHtml = post.userPhotoURL ? `<img src="${post.userPhotoURL}">` : `<i class="fas ${post.userIconClass || 'fa-user'}"></i>`;
            let bgStyle = post.userPhotoURL ? "background: transparent;" : `background: ${post.userIconColor || '#555'};`;
            const deleteBtnHtml = (currentUid && post.userId === currentUid) ? `<div class="post-delete-btn" onclick="deletePost('${postId}')"><i class="fas fa-trash-alt"></i></div>` : '';
            const likedBy = post.likedBy || [];
            const isLiked = currentUid && likedBy.includes(currentUid);
            const heartClass = isLiked ? "fas fa-heart" : "far fa-heart";
            const likeActionClass = isLiked ? "action-item liked" : "action-item";
            const idDisplay = post.customId ? `<span class="feed-id">@${escapeHtml(post.customId)}</span>` : '';

            // ★変更点: 画像クリック時に openImageModal を呼ぶ
            el.innerHTML = `
                ${deleteBtnHtml}
                <div class="feed-header">
                    <div class="feed-avatar" style="${bgStyle}">${iconHtml}</div>
                    <div class="feed-info">
                        <div class="feed-name">${escapeHtml(post.userName)}${idDisplay}</div>
                        <div class="feed-time">${timeStr}</div>
                    </div>
                </div>
                <div class="feed-content">${escapeHtml(post.text)}</div>
                ${post.imageUrl ? `<div class="feed-image" style="display:block;"><img src="${post.imageUrl}" onclick="event.stopPropagation(); openImageModal('${post.imageUrl}')"></div>` : ''}
                <div class="feed-actions">
                    <div class="${likeActionClass}" onclick="toggleLike('${postId}')">
                        <i class="${heartClass}"></i> ${post.likes || 0 > 0 ? post.likes : 'いいね'}
                    </div>
                    <div class="action-item" onclick="openCommentModal('${postId}')">
                        <i class="far fa-comment"></i> ${post.commentCount || 0 > 0 ? post.commentCount : 'コメント'}
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
    const btn = document.getElementById('submitPostBtn');
    btn.disabled = true; btn.innerText = "投稿中...";
    try {
        let imageUrl = null;
        if(selectedPostFile) imageUrl = await uploadToCloudinary(selectedPostFile, 'post');
        const user = window.currentUserData; 
        await addDoc(collection(db, "posts"), {
            userId: auth.currentUser.uid, userName: user.publicName || "名無しさん", customId: user.customId || "",
            userIconColor: user.iconColor || '#555', userIconClass: user.iconClass || 'fa-user', userPhotoURL: user.photoURL || null,
            text: text, imageUrl: imageUrl, createdAt: serverTimestamp(), likes: 0, likedBy: [], commentCount: 0 
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
    commentsUnsubscribe = onSnapshot(query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc")), (snapshot) => {
        list.innerHTML = "";
        if (snapshot.empty) { list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">コメントなし</div>'; return; }
        snapshot.forEach(doc => {
            const c = doc.data();
            const d = c.createdAt ? c.createdAt.toDate() : new Date();
            const timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            let iconHtml = c.userPhotoURL ? `<img src="${c.userPhotoURL}">` : `<i class="fas ${c.userIconClass || 'fa-user'}"></i>`;
            let bgStyle = c.userPhotoURL ? "background: transparent;" : `background: ${c.userIconColor || '#555'};`;
            
            list.insertAdjacentHTML('beforeend', `
                <div class="comment-item">
                    <div class="comment-avatar" style="${bgStyle}">${iconHtml}</div>
                    <div class="comment-body">
                        <div class="comment-user">${escapeHtml(c.userName)}</div>
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
        const user = window.currentUserData;
        await addDoc(collection(db, "posts", currentOpenPostId, "comments"), {
            userId: auth.currentUser.uid, userName: user.publicName, userIconColor: user.iconColor, userIconClass: user.iconClass, userPhotoURL: user.photoURL,
            text: text, createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "posts", currentOpenPostId), { commentCount: increment(1) });
        document.getElementById('commentInput').value = "";
    } catch(e) { showNotify("エラー", "error"); } finally { btn.disabled = false; }
};
