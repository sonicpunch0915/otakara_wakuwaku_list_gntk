/*
  お買い物リスト v10
*/

const SUPABASE_URL = 'https://eepnykeysqokgqesyihq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2XqYDT8NWQICxIK0DTqu5A_D0mgnh2v';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const APP_PASSWORD = 'gintaka0910';
const STORAGE_KEY_AUTH = 'shopping_app_v10_auth';
const STORAGE_KEY_USER = 'shopping_app_v10_user';

// icon/ フォルダの画像ファイルを使用
const ICON_LIST = [
    { id: 'icon01.png' },
    { id: 'icon02.png' },
    { id: 'icon03.png' },
    { id: 'icon04.png' },
    { id: 'icon05.png' }
];

function iconPath(iconId) {
    return `icon/${iconId}`;
}

let shoppingList = [];
let currentUser = { name: '', icon: '' };
let expandedSpaces = new Set();
let expandedPersons = new Set();
let isFirstLoad = true;

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    setupEventListeners();
    await checkAuth();
}

// ===== 認証 =====
async function checkAuth() {
    if (localStorage.getItem(STORAGE_KEY_AUTH) === 'true') {
        await checkUserConfig();
    } else {
        showOverlay('login-overlay');
    }
}

async function checkUserConfig() {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (!saved) {
        renderIconSelector();
        showOverlay('user-config-overlay');
    } else {
        currentUser = JSON.parse(saved);
        hideOverlay('login-overlay');
        hideOverlay('user-config-overlay');
        document.getElementById('main-app').style.display = 'block';
        updateUserBadge();
        await loadData();
    }
}

function showOverlay(id) { document.getElementById(id).style.display = 'flex'; }
function hideOverlay(id) { document.getElementById(id).style.display = 'none'; }

function updateUserBadge() {
    const img = `<img src="${iconPath(currentUser.icon)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:5px;">`;
    document.getElementById('current-user-display').innerHTML = `${img}${currentUser.name}`;
}

function handleLogin() {
    if (document.getElementById('login-password').value === APP_PASSWORD) {
        localStorage.setItem(STORAGE_KEY_AUTH, 'true');
        checkUserConfig();
    } else {
        document.getElementById('login-error').textContent = 'パスワードが違います';
    }
}

function renderIconSelector() {
    const container = document.getElementById('config-icon-selector');
    container.innerHTML = '';
    ICON_LIST.forEach(i => {
        const span = document.createElement('span');
        span.className = 'icon-option';
        span.dataset.iconId = i.id;
        const img = document.createElement('img');
        img.src = iconPath(i.id);
        img.alt = i.id;
        span.appendChild(img);
        span.onclick = () => {
            document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
            span.classList.add('selected');
        };
        container.appendChild(span);
    });
}

function handleSaveConfig() {
    const name = document.getElementById('config-user-name').value.trim();
    const sel = document.querySelector('.icon-option.selected');
    if (!name) { document.getElementById('config-error').textContent = 'なまえを入力してね'; return; }
    if (!sel) { document.getElementById('config-error').textContent = 'アイコンを選んでね'; return; }
    currentUser = { name, icon: sel.dataset.iconId };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
    checkUserConfig();
}

function logout() { localStorage.removeItem(STORAGE_KEY_AUTH); location.reload(); }

// ===== イベント設定 =====
function setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('config-save-btn').addEventListener('click', handleSaveConfig);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('open-add-modal-btn').addEventListener('click', openAddModal);
    document.getElementById('add-item-form').addEventListener('submit', handleAddItem);
    document.getElementById('edit-item-form').addEventListener('submit', handleEditItem);
    document.getElementById('refresh-data-btn').addEventListener('click', loadData);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('backup-btn').addEventListener('click', exportData);
    document.getElementById('restore-input').addEventListener('change', importData);
    document.getElementById('toggle-all-btn').addEventListener('click', toggleAllSpaces);
    document.getElementById('item-image').addEventListener('change', e => handleImagePreview(e, 'image-preview'));
    document.getElementById('edit-item-image').addEventListener('change', e => handleImagePreview(e, 'edit-image-preview'));

    document.getElementById('current-user-badge').addEventListener('click', () => {
        if (confirm('名前やアイコンを変更しますか？')) {
            localStorage.removeItem(STORAGE_KEY_USER);
            location.reload();
        }
    });

    // ハンバーガーメニュー開閉
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    hamburgerBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = hamburgerMenu.style.display !== 'none';
        hamburgerMenu.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
        hamburgerMenu.style.display = 'none';
    });
    hamburgerMenu.addEventListener('click', e => e.stopPropagation());
}

// ===== データ読み込み =====
async function loadData() {
    try {
        const { data, error } = await supabaseClient
            .from('shopping_items')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        shoppingList = data.map(item => {
            let wantedUsers = [];
            if (item.wanted_users && item.wanted_users.trim() !== '') {
                wantedUsers = item.wanted_users.split(',').filter(u => u.trim() !== '');
            }
            if (wantedUsers.length === 0) {
                wantedUsers = [`${item.user_name || '全員'}:${item.user_icon || 'icon01.png'}:1`];
            }
            return {
                id: item.id,
                spaceNo: item.space_no,
                name: item.item_name,
                price: item.price || 0,
                quantity: item.quantity || 1,
                notes: item.notes || '',
                imageUrl: item.image_url || null,
                isPurchased: item.is_purchased || false,
                userName: item.user_name || '',
                userIcon: item.user_icon || 'icon01.png',
                wantedUsers
            };
        });

        if (isFirstLoad) {
            shoppingList.forEach(i => expandedSpaces.add(i.spaceNo));
            isFirstLoad = false;
        }

        renderShoppingList();
        renderPersonList();
        updateStats();
    } catch (e) {
        console.error('loadData error:', e);
    }
}

// ===== wanted_users パーサー =====
function parseWantedUsers(wantedUsers) {
    return wantedUsers.map(u => {
        const parts = u.split(':');
        return { name: parts[0] || '', iconId: parts[1] || 'icon01.png', qty: parseInt(parts[2]) || 1 };
    });
}

function serializeWantedUsers(parsed) {
    return parsed.map(u => `${u.name}:${u.iconId}:${u.qty}`).join(',');
}

// ===== リスト描画 =====
function renderShoppingList() {
    const container = document.getElementById('shopping-items');
    container.innerHTML = '';

    const sortVal = document.getElementById('sort-option').value;
    let sorted = [...shoppingList];
    if (sortVal === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    else if (sortVal === 'price') sorted.sort((a, b) => b.price - a.price);

    const spaces = [...new Set(sorted.map(i => i.spaceNo))].sort((a, b) =>
        a.localeCompare(b, 'ja', { numeric: true })
    );

    spaces.forEach(spaceNo => {
        const items = sorted.filter(i => i.spaceNo === spaceNo);
        const isExp = expandedSpaces.has(spaceNo);
        const allDone = items.every(i => i.isPurchased);

        const card = document.createElement('div');
        card.className = 'space-card';
        card.innerHTML = `
            <div class="space-card-header" onclick="toggleSpace('${spaceNo}')">
                <h3><i class="bi bi-pin-angle-fill"></i> ${spaceNo}</h3>
                <div class="space-card-meta">
                    <span style="font-size:0.78rem; color:#9e9e9e;">${items.length}件</span>
                    <span class="badge ${allDone ? 'badge-done' : 'badge-pending'}">${allDone ? 'ゲット' : '未'}</span>
                    <span style="color:#9e9e9e; font-size:0.85rem;">${isExp ? '▲' : '▼'}</span>
                </div>
            </div>
            <div class="space-card-items" style="display:${isExp ? 'block' : 'none'}">
                ${items.map(item => renderItemRow(item)).join('')}
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('toggle-all-btn').textContent =
        expandedSpaces.size === 0 ? '全て展開' : '全て閉じる';
}

function renderItemRow(item) {
    const parsed = parseWantedUsers(item.wantedUsers);
    const isOwner = item.userName === currentUser.name;
    const iWant = parsed.some(u => u.name === currentUser.name);

    // ハートボタン: 自分が登録者なら非表示
    const heartBtn = isOwner ? '' : `
        <button class="btn-heart ${iWant ? 'active' : 'inactive'}"
                onclick="handleHeartToggle('${item.id}')"
                title="${iWant ? 'キャンセルする' : 'わたしもほしい！'}">
            <i class="bi ${iWant ? 'bi-heart-fill' : 'bi-heart'}"></i>
        </button>
    `;

    // 右カラム上段: ユーザーアイコン（右寄せ）
    const iconsHtml = parsed.map(u =>
        `<img src="${iconPath(u.iconId)}" class="wanted-icon" title="${u.name}(×${u.qty})" alt="${u.name}">`
    ).join('');

    const thumb = item.imageUrl
        ? `<img src="${item.imageUrl}" class="item-thumb" onclick="window.open('${item.imageUrl}')" alt="">`
        : `<div class="item-thumb-empty">No Image</div>`;

    return `
        <div class="item-row ${item.isPurchased ? 'purchased' : ''}">
            ${thumb}
            <div class="item-main">
                <div class="item-top-row">
                    ${heartBtn}
                    <span class="item-name" onclick="toggleStatus('${item.id}', ${item.isPurchased})">
                        ${item.isPurchased ? '✔ ' : ''}${item.name}
                    </span>
                </div>
                <div class="item-price">¥${item.price.toLocaleString()} × ${item.quantity} = ¥${(item.price * item.quantity).toLocaleString()}</div>
                ${item.notes ? `<div class="item-notes">※ ${item.notes}</div>` : ''}
            </div>
            <div class="item-actions">
                <div class="item-wanted-icons">${iconsHtml}</div>
                <div class="item-action-btns">
                    <button class="btn-sm ${item.isPurchased ? 'btn-sm-done' : 'btn-sm-success'}"
                            onclick="toggleStatus('${item.id}', ${item.isPurchased})">
                        ${item.isPurchased ? '戻す' : 'ゲット'}
                    </button>
                    <button class="btn-sm btn-sm-edit" onclick="openEditModal('${item.id}')">編集</button>
                    <button class="btn-sm btn-sm-danger" onclick="deleteItem('${item.id}')">削除</button>
                </div>
            </div>
        </div>
    `;
}

// ===== 人物別描画 =====
function renderPersonList() {
    const container = document.getElementById('person-accordion-container');
    container.innerHTML = '';

    const userMap = new Map();
    shoppingList.forEach(item => {
        parseWantedUsers(item.wantedUsers).forEach(u => {
            if (!userMap.has(u.name)) userMap.set(u.name, u.iconId);
        });
    });

    if (userMap.size === 0) {
        container.innerHTML = '<p style="color:#9e9e9e; padding:16px;">データがありません</p>';
        return;
    }

    userMap.forEach((iconId, userName) => {
        const userItems = shoppingList
            .map(item => {
                const entry = parseWantedUsers(item.wantedUsers).find(u => u.name === userName);
                if (!entry) return null;
                return { ...item, myQty: entry.qty };
            })
            .filter(Boolean);

        const total = userItems.reduce((s, i) => s + i.price * i.myQty, 0);
        const isExp = expandedPersons.has(userName);

        const div = document.createElement('div');
        div.className = 'person-group';
        div.innerHTML = `
            <div class="person-header" onclick="togglePerson('${userName}')">
                <span><img src="${iconPath(iconId)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;">${userName}</span>
                <span class="person-total">¥${total.toLocaleString()} ${isExp ? '▲' : '▼'}</span>
            </div>
            <div class="person-content" style="display:${isExp ? 'block' : 'none'}">
                <table class="person-table">
                    <thead><tr><th>スペース</th><th>品名</th><th>数</th><th>金額</th></tr></thead>
                    <tbody>
                        ${userItems.map(i => `
                            <tr>
                                <td>${i.spaceNo}</td>
                                <td style="text-align:left;">${i.isPurchased ? '✔ ' : ''}${i.name}</td>
                                <td>${i.myQty}</td>
                                <td style="text-align:right;">¥${(i.price * i.myQty).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(div);
    });
}

// ===== 統計 =====
function updateStats() {
    const total = shoppingList.reduce((s, i) => s + i.price * i.quantity, 0);
    document.getElementById('total-amount').textContent = `¥${total.toLocaleString()}`;
    document.getElementById('item-count').textContent = shoppingList.length;
    document.getElementById('space-count').textContent = new Set(shoppingList.map(i => i.spaceNo)).size;
}

// ===== タブ切り替え =====
function switchTab(t) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${t}-tab`));
}

// ===== アコーディオン =====
function toggleAllSpaces() {
    if (expandedSpaces.size > 0) expandedSpaces.clear();
    else shoppingList.forEach(i => expandedSpaces.add(i.spaceNo));
    renderShoppingList();
}
function toggleSpace(no) {
    expandedSpaces.has(no) ? expandedSpaces.delete(no) : expandedSpaces.add(no);
    renderShoppingList();
}
function togglePerson(name) {
    expandedPersons.has(name) ? expandedPersons.delete(name) : expandedPersons.add(name);
    renderPersonList();
}

// ===== 購入状態トグル =====
async function toggleStatus(id, cur) {
    const { error } = await supabaseClient
        .from('shopping_items')
        .update({ is_purchased: !cur })
        .eq('id', id);
    if (error) console.error('toggleStatus error:', error);
    await loadData();
}

// ===== ハートボタン（追加/キャンセル）=====
async function handleHeartToggle(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (!item) return;

    const parsed = parseWantedUsers(item.wantedUsers);
    const myIndex = parsed.findIndex(u => u.name === currentUser.name);

    if (myIndex === -1) {
        parsed.push({ name: currentUser.name, iconId: currentUser.icon, qty: 1 });
    } else {
        if (!confirm('「わたしもほしい」をキャンセルしますか？')) return;
        parsed.splice(myIndex, 1);
    }

    if (parsed.length === 0) {
        await supabaseClient.from('shopping_items').delete().eq('id', itemId);
    } else {
        const newQty = parsed.reduce((s, u) => s + u.qty, 0);
        const { error } = await supabaseClient
            .from('shopping_items')
            .update({ wanted_users: serializeWantedUsers(parsed), quantity: newQty })
            .eq('id', itemId);
        if (error) { console.error('heartToggle error:', error); alert('更新に失敗しました'); return; }
    }

    await loadData();
}

// ===== 追加 =====
function openAddModal() {
    document.getElementById('add-item-form').reset();
    document.getElementById('image-preview').innerHTML = '';
    showOverlay('add-item-modal');
}
function closeAddModal() { hideOverlay('add-item-modal'); }

async function handleAddItem(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const qty = parseInt(document.getElementById('item-quantity').value) || 1;
    const data = {
        space_no: document.getElementById('space-no').value.trim(),
        item_name: document.getElementById('item-name').value.trim(),
        price: parseInt(document.getElementById('item-price').value) || 0,
        quantity: qty,
        notes: document.getElementById('item-notes').value.trim(),
        is_purchased: false,
        user_name: currentUser.name,
        user_icon: currentUser.icon,
        wanted_users: `${currentUser.name}:${currentUser.icon}:${qty}`
    };

    const file = document.getElementById('item-image').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async ev => { data.image_url = ev.target.result; await pushItem(data, btn); };
        reader.readAsDataURL(file);
    } else {
        await pushItem(data, btn);
    }
}

async function pushItem(data, btn) {
    const { error } = await supabaseClient.from('shopping_items').insert([data]);
    if (error) {
        console.error('pushItem error:', error);
        alert('追加に失敗しました: ' + error.message);
    } else {
        closeAddModal();
        await loadData();
    }
    btn.disabled = false;
}

// ===== 編集 =====
function openEditModal(id) {
    const item = shoppingList.find(x => x.id === id);
    if (!item) return;
    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-space-no').value = item.spaceNo;
    document.getElementById('edit-item-name').value = item.name;
    document.getElementById('edit-item-price').value = item.price;
    // 編集フォームには登録者の数量を表示
    const parsed = parseWantedUsers(item.wantedUsers);
    const ownerEntry = parsed.find(u => u.name === item.userName);
    document.getElementById('edit-item-quantity').value = ownerEntry ? ownerEntry.qty : item.quantity;
    document.getElementById('edit-item-notes').value = item.notes || '';
    document.getElementById('edit-image-preview').innerHTML = item.imageUrl
        ? `<img src="${item.imageUrl}" style="max-width:100px; border-radius:6px;">`
        : '';
    showOverlay('edit-modal');
}
function closeEditModal() { hideOverlay('edit-modal'); }

async function handleEditItem(e) {
    e.preventDefault();
    const id = document.getElementById('edit-item-id').value;
    const newQty = parseInt(document.getElementById('edit-item-quantity').value) || 1;
    const item = shoppingList.find(x => x.id === id);

    let wantedStr = item ? item.wantedUsers.join(',') : '';
    let totalQty = newQty;

    if (item) {
        const parsed = parseWantedUsers(item.wantedUsers);
        const ownerEntry = parsed.find(u => u.name === item.userName);
        if (ownerEntry) ownerEntry.qty = newQty;
        totalQty = parsed.reduce((s, u) => s + u.qty, 0);
        wantedStr = serializeWantedUsers(parsed);
    }

    const body = {
        space_no: document.getElementById('edit-space-no').value.trim(),
        item_name: document.getElementById('edit-item-name').value.trim(),
        price: parseInt(document.getElementById('edit-item-price').value) || 0,
        quantity: totalQty,
        notes: document.getElementById('edit-item-notes').value.trim(),
        wanted_users: wantedStr
    };

    const file = document.getElementById('edit-item-image').files[0];
    if (file) {
        const r = new FileReader();
        r.onload = async ev => { body.image_url = ev.target.result; await updateItem(id, body); };
        r.readAsDataURL(file);
    } else {
        await updateItem(id, body);
    }
}

async function updateItem(id, body) {
    const { error } = await supabaseClient.from('shopping_items').update(body).eq('id', id);
    if (error) console.error('updateItem error:', error);
    closeEditModal();
    await loadData();
}

async function deleteItem(id) {
    if (!confirm('削除しますか？')) return;
    await supabaseClient.from('shopping_items').delete().eq('id', id);
    await loadData();
}

// ===== 画像プレビュー =====
function handleImagePreview(e, pid) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        document.getElementById(pid).innerHTML = `<img src="${ev.target.result}" style="max-width:100px; border-radius:6px;">`;
    };
    r.readAsDataURL(f);
}

// ===== エクスポート / インポート =====
function exportData() {
    const exportItems = shoppingList.map(i => ({
        space_no: i.spaceNo,
        item_name: i.name,
        price: i.price,
        quantity: i.quantity,
        notes: i.notes,
        image_url: i.imageUrl,
        is_purchased: i.isPurchased,
        user_name: i.userName,
        user_icon: i.userIcon,
        wanted_users: i.wantedUsers.join(',')
    }));
    const blob = new Blob([JSON.stringify(exportItems, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shopping_list_v10_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (!confirm(`${imported.length}件のデータを追加しますか？`)) return;
            for (const raw of imported) {
                const qty = raw.quantity || 1;
                const item = {
                    space_no: raw.space_no || raw.spaceNo || '未分類',
                    item_name: raw.item_name || raw.name || '無名',
                    price: raw.price || 0,
                    quantity: qty,
                    notes: raw.notes || '',
                    image_url: raw.image_url || raw.imageUrl || null,
                    is_purchased: raw.is_purchased || raw.isPurchased || false,
                    user_name: raw.user_name || raw.userName || currentUser.name,
                    user_icon: raw.user_icon || raw.userIcon || currentUser.icon,
                    wanted_users: raw.wanted_users || `${raw.user_name || currentUser.name}:${raw.user_icon || currentUser.icon}:${qty}`
                };
                await supabaseClient.from('shopping_items').insert([item]);
            }
            alert('インポート完了！');
            await loadData();
        } catch (err) {
            alert('読み込みエラー。ファイルを確認してください。');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}
