// Supabaseの接続情報
const SUPABASE_URL = 'https://eepnykeysqokgqesyihq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2XqYDT8NWQICxIK0DTqu5A_D0mgnh2v';

// パスワード設定（合言葉）
const APP_PASSWORD = 'gintaka0910';

// Supabaseクライアントの初期化
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 買い物リストデータ
let shoppingList = [];

// DOM要素
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const addItemForm = document.getElementById('add-item-form');
const shoppingItemsContainer = document.getElementById('shopping-items');
const totalAmountElement = document.getElementById('total-amount');
const itemCountElement = document.getElementById('item-count');
const spaceCountElement = document.getElementById('space-count');
const imagePreview = document.getElementById('image-preview');
const itemImageInput = document.getElementById('item-image');
const mapUpload = document.getElementById('map-upload');
const mapDisplay = document.getElementById('map-display');
const spaceInfoPanel = document.getElementById('space-info-panel');
const spaceInfoContent = document.getElementById('space-info-content');
const spaceInfoTitle = document.getElementById('space-info-title');
const refreshBtn = document.getElementById('refresh-data-btn');

// 地図関連
let currentMap = null;

// 初期化
document.addEventListener('DOMContentLoaded', async function() {
    setupEventListeners();
    checkAuth(); // 認証状態をチェック
});

// 認証チェック
function checkAuth() {
    const isAuthed = sessionStorage.getItem('isAuthed') === 'true';
    const loginOverlay = document.getElementById('login-overlay');
    const mainApp = document.getElementById('main-app');

    if (isAuthed) {
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        loadDataFromSupabase();
        
        // 保存された地図を復元（認証後に行う）
        const savedMapData = JSON.parse(localStorage.getItem('mapData_v6'));
        if (savedMapData && savedMapData.mapContent) {
            mapDisplay.innerHTML = savedMapData.mapContent;
            mapDisplay.classList.add('has-map');
            currentMap = savedMapData.currentMap;
            setupMapInteraction();
            updateMapColors();
        }
    } else {
        loginOverlay.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

// ログイン処理
function handleLogin() {
    const passInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error');
    
    if (passInput.value === APP_PASSWORD) {
        sessionStorage.setItem('isAuthed', 'true');
        checkAuth();
    } else {
        errorMsg.textContent = 'パスワードが違います';
        passInput.value = '';
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // ログインボタン
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // タブ切り替え
    tabButtons.forEach(button => {
        btn = button; // for scope
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // フォーム送信
    addItemForm.addEventListener('submit', handleAddItem);

    // 画像プレビュー
    itemImageInput.addEventListener('change', handleImagePreview);

    // 更新ボタン
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.style.transform = 'rotate(360deg)';
        await loadDataFromSupabase();
        setTimeout(() => refreshBtn.style.transform = '', 500);
    });

    // 地図関連
    mapUpload.addEventListener('change', handleMapUpload);
    document.getElementById('create-sample-map').addEventListener('click', createSampleMap);
    document.getElementById('update-map-colors').addEventListener('click', updateMapColors);
    document.getElementById('clear-map').addEventListener('click', clearMap);
    document.getElementById('close-space-info').addEventListener('click', closeSpaceInfo);

    // 編集機能
    document.getElementById('edit-item-form').addEventListener('submit', handleEditItem);
    document.getElementById('edit-item-image').addEventListener('change', handleEditImagePreview);

    // 展開・折りたたみ
    document.getElementById('expand-all').addEventListener('click', expandAllSpaces);
    document.getElementById('collapse-all').addEventListener('click', collapseAllSpaces);

    // バックアップ・復元（ローカルJSONファイル用）
    document.getElementById('backup-btn').addEventListener('click', exportData);
    document.getElementById('restore-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = handleImportData;
        input.click();
    });
}

// データの読み込み
async function loadDataFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('shopping_items')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        // CamalCaseに変換して保持
        shoppingList = data.map(item => ({
            id: item.id, // UUID
            spaceNo: item.space_no,
            name: item.item_name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes,
            image: item.image_url,
            purchased: item.is_purchased,
            createdAt: item.created_at
        }));

        renderShoppingList();
        updateStats();
        updateMapColors();
    } catch (error) {
        console.error('Supabaseからの読み込みエラー:', error);
        alert('データの読み込みに失敗しました。SQLを実行したか確認してください。');
    }
}

// タブ切り替え
function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'map') {
        setTimeout(updateMapColors, 100);
    }
}

// アイテム追加
async function handleAddItem(e) {
    e.preventDefault();
    
    const spaceNo = document.getElementById('space-no').value.trim();
    const itemName = document.getElementById('item-name').value.trim();
    const price = parseInt(document.getElementById('item-price').value) || 0;
    const quantity = parseInt(document.getElementById('item-quantity').value) || 1;
    const notes = document.getElementById('item-notes').value.trim();
    
    let imageUrl = null;
    const imageFile = itemImageInput.files[0];
    
    // 画像がある場合はSupabase Storageにアップロード（今回は簡単のためDataURLで一旦DBに入れるか、Storageを使うか）
    // Storage設定が面倒な場合を考え、一旦画像なしで追加できるようにし、後でStorageを案内する方針に
    if (imageFile) {
        // 本当はStorageを使うべきだが、まずはDBにBase64で入れる（容量制限に注意）
        // または、Storageのバケット作成が必要になるので、一旦画像なしで進めるか、警告を出す
        const reader = new FileReader();
        reader.onload = async function(event) {
            imageUrl = event.target.result;
            await addItemToSupabase(spaceNo, itemName, price, quantity, notes, imageUrl);
        };
        reader.readAsDataURL(imageFile);
    } else {
        await addItemToSupabase(spaceNo, itemName, price, quantity, notes, null);
    }
}

async function addItemToSupabase(spaceNo, itemName, price, quantity, notes, imageUrl) {
    try {
        const { data, error } = await supabaseClient
            .from('shopping_items')
            .insert([
                { 
                    space_no: spaceNo, 
                    item_name: itemName, 
                    price: price, 
                    quantity: quantity, 
                    notes: notes, 
                    image_url: imageUrl,
                    is_purchased: false
                }
            ])
            .select();

        if (error) throw error;

        await loadDataFromSupabase();
        addItemForm.reset();
        imagePreview.innerHTML = '';
        alert('追加しました！');
    } catch (error) {
        console.error('追加エラー:', error);
        alert('追加に失敗しました。');
    }
}

// 買い物リスト表示（スペースグループ化）
function renderShoppingList() {
    shoppingItemsContainer.innerHTML = '';
    
    if (shoppingList.length === 0) {
        shoppingItemsContainer.innerHTML = '<p>買い物リストが空です。アイテムを追加するか、更新ボタンを押してください。</p>';
        return;
    }

    const groupedBySpace = {};
    shoppingList.forEach(item => {
        if (!groupedBySpace[item.spaceNo]) {
            groupedBySpace[item.spaceNo] = [];
        }
        groupedBySpace[item.spaceNo].push(item);
    });

    const sortOption = document.getElementById('sort-option')?.value || 'spaceNo';
    
    const sortedSpaces = Object.keys(groupedBySpace).sort((a, b) => {
        switch (sortOption) {
            case 'spaceNo':
                return a.localeCompare(b, 'ja', { numeric: true, sensitivity: 'base' });
            case 'name':
                return groupedBySpace[a][0].name.localeCompare(groupedBySpace[b][0].name, 'ja');
            case 'price':
                const totalA = groupedBySpace[a].reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const totalB = groupedBySpace[b].reduce((sum, item) => sum + (item.price * item.quantity), 0);
                return totalB - totalA;
            case 'created':
                const oldestA = Math.min(...groupedBySpace[a].map(item => new Date(item.createdAt)));
                const oldestB = Math.min(...groupedBySpace[b].map(item => new Date(item.createdAt)));
                return oldestA - oldestB;
            default:
                return 0;
        }
    });

    sortedSpaces.forEach(spaceNo => {
        const spaceGroup = createSpaceGroupElement(spaceNo, groupedBySpace[spaceNo]);
        shoppingItemsContainer.appendChild(spaceGroup);
    });
}

function createSpaceGroupElement(spaceNo, items) {
    const div = document.createElement('div');
    div.className = 'space-group-container';
    
    const totalItems = items.length;
    const purchasedItems = items.filter(item => item.purchased).length;
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let statusClass = '';
    let statusText = '';
    if (purchasedItems === totalItems) {
        statusClass = 'all-purchased';
        statusText = '完了';
    } else if (purchasedItems > 0) {
        statusClass = 'partial-purchased';
        statusText = `${purchasedItems}/${totalItems}`;
    } else {
        statusClass = 'not-purchased';
        statusText = '未購入';
    }
    
    const safeSpaceId = spaceNo.replace(/[^a-zA-Z0-9]/g, '_');
    
    div.innerHTML = `
        <div class="space-header ${statusClass}" onclick="toggleSpaceGroup('${spaceNo}')">
            <div class="space-info">
                <h3 class="space-title">スペース: ${spaceNo}</h3>
                <div class="space-summary">
                    <span class="item-count">${totalItems}アイテム</span>
                    <span class="space-total">¥${totalAmount.toLocaleString()}</span>
                    <span class="purchase-status">${statusText}</span>
                </div>
            </div>
            <button class="space-toggle" onclick="event.stopPropagation(); toggleSpaceGroup('${spaceNo}')">
                <span class="toggle-icon">▼</span>
            </button>
        </div>
        <div class="space-items" id="space-${safeSpaceId}">
            ${items.map(item => createItemElementHTML(item)).join('')}
        </div>
    `;
    
    return div;
}

function createItemElementHTML(item) {
    const total = item.price * item.quantity;
    
    return `
        <div class="shopping-item ${item.purchased ? 'purchased' : ''}">
            <div class="item-image-container">
                ${item.image ? 
                    `<img src="${item.image}" alt="${item.name}" class="item-image">` : 
                    '<div class="item-image item-no-image"><span>画像なし</span></div>'
                }
            </div>
            <div class="item-details">
                <h4 class="item-name" onclick="openEditModal('${item.id}')" title="クリックで編集">${item.name}</h4>
                <div class="item-meta">
                    <div class="item-price">¥${item.price.toLocaleString()} × ${item.quantity} = ¥${total.toLocaleString()}</div>
                    ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-small btn-edit" onclick="openEditModal('${item.id}')">編集</button>
                <button class="btn-small btn-check" onclick="togglePurchased('${item.id}')">
                    ${item.purchased ? '未購入' : '購入済み'}
                </button>
                <button class="btn-small btn-delete" onclick="deleteItem('${item.id}')">削除</button>
            </div>
        </div>
    `;
}

function toggleSpaceGroup(spaceNo) {
    const safeSpaceId = spaceNo.replace(/[^a-zA-Z0-9]/g, '_');
    const spaceItems = document.getElementById(`space-${safeSpaceId}`);
    const container = document.querySelector(`[onclick*="toggleSpaceGroup('${spaceNo}')"]`).closest('.space-group-container');
    const toggleIcon = container.querySelector('.toggle-icon');
    const toggleButton = container.querySelector('.space-toggle');
    
    if (spaceItems && toggleIcon) {
        if (spaceItems.classList.contains('collapsed')) {
            spaceItems.classList.remove('collapsed');
            spaceItems.style.maxHeight = spaceItems.scrollHeight + 'px';
            toggleIcon.textContent = '▼';
            if (toggleButton) toggleButton.classList.remove('collapsed');
        } else {
            spaceItems.classList.add('collapsed');
            spaceItems.style.maxHeight = '0';
            toggleIcon.textContent = '▶';
            if (toggleButton) toggleButton.classList.add('collapsed');
        }
    }
}

function expandAllSpaces() {
    const spaceItems = document.querySelectorAll('.space-items');
    spaceItems.forEach(item => {
        item.classList.remove('collapsed');
        item.style.maxHeight = item.scrollHeight + 'px';
    });
    document.querySelectorAll('.toggle-icon').forEach(icon => icon.textContent = '▼');
    document.querySelectorAll('.space-toggle').forEach(btn => btn.classList.remove('collapsed'));
}

function collapseAllSpaces() {
    const spaceItems = document.querySelectorAll('.space-items');
    spaceItems.forEach(item => {
        item.classList.add('collapsed');
        item.style.maxHeight = '0';
    });
    document.querySelectorAll('.toggle-icon').forEach(icon => icon.textContent = '▶');
    document.querySelectorAll('.space-toggle').forEach(btn => btn.classList.add('collapsed'));
}

async function togglePurchased(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        try {
            const { error } = await supabaseClient
                .from('shopping_items')
                .update({ is_purchased: !item.purchased })
                .eq('id', itemId);
            
            if (error) throw error;
            await loadDataFromSupabase();
        } catch (error) {
            alert('更新に失敗しました。');
        }
    }
}

async function deleteItem(itemId) {
    if (confirm('このアイテムを削除しますか？')) {
        try {
            const { error } = await supabaseClient
                .from('shopping_items')
                .delete()
                .eq('id', itemId);
            
            if (error) throw error;
            await loadDataFromSupabase();
        } catch (error) {
            alert('削除に失敗しました。');
        }
    }
}

function updateStats() {
    const totalAmount = shoppingList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const uniqueSpaces = [...new Set(shoppingList.map(item => item.spaceNo))];
    totalAmountElement.textContent = `¥${totalAmount.toLocaleString()}`;
    itemCountElement.textContent = shoppingList.length;
    spaceCountElement.textContent = uniqueSpaces.length;
}

function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => imagePreview.innerHTML = `<img src="${e.target.result}" alt="プレビュー">`;
        reader.readAsDataURL(file);
    } else {
        imagePreview.innerHTML = '';
    }
}

// 地図関連（Local保存のままでOK）
function handleMapUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            if (file.type.includes('svg')) {
                mapDisplay.innerHTML = event.target.result;
            } else {
                mapDisplay.innerHTML = `<img src="${event.target.result}" alt="会場地図">`;
            }
            mapDisplay.classList.add('has-map');
            currentMap = 'uploaded';
            saveMapToLocal();
            setupMapInteraction();
            updateMapColors();
        };
        if (file.type.includes('svg')) reader.readAsText(file);
        else reader.readAsDataURL(file);
    }
}

function createSampleMap() {
    const sampleSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#f8f8f8"/>
        <text x="400" y="30" font-family="Arial" font-size="20" text-anchor="middle" fill="#2196F3">会場MAP (サンプル)</text>
        ${generateSpaceRow('て', [1,2,3,4,5], 100, 100, 50, 40)}
        ${generateSpaceRow('て', [6,7,8,9,10], 100, 200, 50, 40)}
    </svg>`;
    mapDisplay.innerHTML = sampleSvg;
    mapDisplay.classList.add('has-map');
    currentMap = 'sample';
    saveMapToLocal();
    setupMapInteraction();
    updateMapColors();
}

function generateSpaceRow(block, numbers, startX, y, width, height) {
    return numbers.map((num, i) => {
        const x = startX + (i * (width + 10));
        const spaceId = block + num.toString().padStart(2, '0');
        return `
            <g class="space-group">
                <rect class="space-border space-clickable" data-space="${spaceId}" 
                      x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff" stroke="#333"/>
                <text x="${x + width/2}" y="${y + height/2 + 5}" font-family="Arial" font-size="14" text-anchor="middle">${num}</text>
            </g>`;
    }).join('');
}

function setupMapInteraction() {
    const svg = mapDisplay.querySelector('svg');
    if (svg) {
        svg.querySelectorAll('.space-clickable').forEach(el => el.addEventListener('click', handleSpaceClick));
    }
}

function handleSpaceClick(e) {
    const spaceId = e.target.dataset.space;
    if (spaceId) showSpaceInfo(spaceId);
}

function showSpaceInfo(spaceId) {
    const spaceItems = shoppingList.filter(item => item.spaceNo.toLowerCase().startsWith(spaceId.toLowerCase()));
    spaceInfoTitle.textContent = `スペース: ${spaceId}`;
    if (spaceItems.length === 0) {
        spaceInfoContent.innerHTML = '<p>予定なし</p>';
    } else {
        spaceInfoContent.innerHTML = spaceItems.map(item => `
            <div class="space-item ${item.purchased ? 'purchased' : ''}">
                <div class="space-item-info">
                    <div><b>${item.name}</b></div>
                    <div style="font-size:0.8rem">¥${item.price} (${item.spaceNo})</div>
                </div>
                <button class="btn-small ${item.purchased ? 'btn-secondary' : 'btn-check'}" onclick="togglePurchased('${item.id}')">
                    ${item.purchased ? '未' : '済'}
                </button>
            </div>
        `).join('');
    }
    spaceInfoPanel.classList.add('active');
}

function closeSpaceInfo() { spaceInfoPanel.classList.remove('active'); }

function updateMapColors() {
    const svg = mapDisplay.querySelector('svg');
    if (!svg) return;
    svg.querySelectorAll('.space-clickable').forEach(el => {
        const spaceId = el.dataset.space;
        const related = shoppingList.filter(i => i.spaceNo.toLowerCase().startsWith(spaceId.toLowerCase()));
        el.style.fill = '#fff';
        if (related.length > 0) {
            const purchased = related.filter(i => i.purchased).length;
            if (purchased === related.length) el.style.fill = '#9E9E9E';
            else if (purchased > 0) el.style.fill = '#FF9800';
            else el.style.fill = '#4CAF50';
        }
    });
}

function clearMap() {
    if (confirm('地図を削除しますか？')) {
        mapDisplay.innerHTML = '<p>地図なし</p>';
        mapDisplay.classList.remove('has-map');
        currentMap = null;
        saveMapToLocal();
    }
}

function saveMapToLocal() {
    localStorage.setItem('mapData_v6', JSON.stringify({
        currentMap: currentMap,
        mapContent: mapDisplay.innerHTML
    }));
}

// 編集モーダル
async function openEditModal(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-space-no').value = item.spaceNo;
    document.getElementById('edit-item-name').value = item.name;
    document.getElementById('edit-item-price').value = item.price;
    document.getElementById('edit-item-quantity').value = item.quantity;
    document.getElementById('edit-item-notes').value = item.notes || '';
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('edit-modal').style.display = 'none'; }

async function handleEditItem(e) {
    e.preventDefault();
    const id = document.getElementById('edit-item-id').value;
    const body = {
        space_no: document.getElementById('edit-space-no').value.trim(),
        item_name: document.getElementById('edit-item-name').value.trim(),
        price: parseInt(document.getElementById('edit-item-price').value) || 0,
        quantity: parseInt(document.getElementById('edit-item-quantity').value) || 1,
        notes: document.getElementById('edit-item-notes').value.trim()
    };
    
    try {
        const { error } = await supabaseClient.from('shopping_items').update(body).eq('id', id);
        if (error) throw error;
        await loadDataFromSupabase();
        closeEditModal();
    } catch (error) {
        alert('修正に失敗しました。');
    }
}

function handleEditImagePreview(e) { /* 同上 */ }

// インポート・エクスポート（今まで通りLocal用として残す）
function exportData() {
    const blob = new Blob([JSON.stringify(shoppingList)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shopping-list-v6.json';
    a.click();
}

async function handleImportData(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = JSON.parse(event.target.result);
            if (confirm('サーバーのデータをこれで上書きしていいですか？')) {
                // 面倒なので一つずつinsertするか空にしてから入れる
                alert('インポート機能は現在調整中です。アイテムを一つずつ追加してください。');
            }
        };
        reader.readAsText(file);
    }
}

// 外側クリックでモーダル閉じる
window.onclick = (e) => { if (e.target.className === 'modal') closeEditModal(); };
