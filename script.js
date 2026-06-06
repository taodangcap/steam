let searchTimeout;

// Popular games data for the featured grid
const featuredGames = [
    { id: 570, name: "Dota 2", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/capsule_231x87.jpg" },
    { id: 730, name: "Counter-Strike 2", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/capsule_231x87.jpg" },
    { id: 271590, name: "Grand Theft Auto V", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/capsule_231x87.jpg" },
    { id: 1245620, name: "Elden Ring", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/capsule_231x87.jpg" },
    { id: 2358720, name: "Black Myth: Wukong", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/2358720/capsule_231x87.jpg" },
    { id: 1091500, name: "Cyberpunk 2077", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/capsule_231x87.jpg" },
    { id: 990080, name: "Hogwarts Legacy", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/990080/capsule_231x87.jpg" },
    { id: 620, name: "Portal 2", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/620/capsule_231x87.jpg" }
];

// Multi-proxy fallback list to bypass CORS and avoid rate limits
// Thay YOUR_WORKER_SUBDOMAIN bằng subdomain Cloudflare Worker của bạn
// (deploy file worker.js lên https://workers.cloudflare.com - miễn phí 100k req/ngày)
const WORKER_URL = 'https://steam.trinhhuy12343.workers.dev'; // Cloudflare Worker proxy

const proxies = [
    // Proxy tự host (ưu tiên cao nhất - nhanh và không bị chặn)
    ...(WORKER_URL ? [(url) => `${WORKER_URL}/?url=${encodeURIComponent(url)}`] : []),
    // Proxy miễn phí dự phòng
    (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Helper to access Cache (sessionStorage)
function getCache(key) {
    try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        return null;
    }
}

function setCache(key, val) {
    try {
        sessionStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
}

// Robust fetch function trying proxies in sequence
async function fetchWithFallback(url) {
    let lastError = null;
    for (let i = 0; i < proxies.length; i++) {
        try {
            const proxyUrl = proxies[i](url);
            console.log(`Trying proxy ${i + 1}/${proxies.length}: ${proxyUrl}`);
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const text = await res.text();
                if (text && text.trim()) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed.contents) {
                                return JSON.parse(parsed.contents);
                            }
                        } catch (err) {}
                        throw new Error("Invalid JSON returned by proxy");
                    }
                }
            }
        } catch (e) {
            console.warn(`Proxy ${i + 1} failed:`, e);
            lastError = e;
        }
    }
    throw lastError || new Error("All CORS proxies failed to fetch the data");
}

// Load featured games into grid on load
function loadFeaturedGames() {
    const grid = document.getElementById("featured-grid");
    if (!grid) return;
    grid.innerHTML = featuredGames.map(game => `
        <div class="featured-card" onclick="selectFeaturedGame(${game.id})">
            <img src="${game.image}" alt="${game.name}" onerror="this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${game.id}/header.jpg'">
            <div class="featured-card-overlay">
                <strong>${game.name}</strong>
                <span>AppID: ${game.id}</span>
            </div>
        </div>
    `).join('');
}

function selectFeaturedGame(appid) {
    document.getElementById("appid").value = appid;
    getGame();
    scrollToTop();
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Tab Switcher for Setup Guides
function switchGuideTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    const targetPane = document.getElementById(`guide-${tabId}`);
    if (targetPane) targetPane.classList.add('active');
}

// Initialize on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    loadFeaturedGames();
    
    // Add active styling logic for header links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// Suggestions Autocomplete Trigger
document.getElementById('appid').addEventListener('input', function() {
    const val = this.value.trim();
    const suggestions = document.getElementById('suggestions');

    // Update download link if button is rendered
    const btn = document.querySelector('.download-link-btn');
    if (btn && /^\d+$/.test(val)) {
        btn.href = `https://codeload.github.com/SSMGAlt/ManifestHub2/zip/refs/heads/${val}`;
    }

    clearTimeout(searchTimeout);

    if (val.length < 2) {
        suggestions.innerHTML = '';
        suggestions.classList.remove('show');
        return;
    }

    searchTimeout = setTimeout(async () => {
        const isNumeric = /^\d+$/.test(val);

        if (isNumeric && val.length >= 3) {
            try {
                const url = `https://store.steampowered.com/api/appdetails?appids=${val}`;
                const cacheKey = `steam_app_${val}`;
                
                let data = getCache(cacheKey);
                if (!data) {
                    data = await fetchWithFallback(url);
                    if (data) setCache(cacheKey, data);
                }

                if (data && data[val]?.success) {
                    const g = data[val].data;
                    const img = `https://cdn.cloudflare.steamstatic.com/steam/apps/${val}/capsule_231x87.jpg`;
                    suggestions.innerHTML = `
                        <div class="suggestion-item" data-appid="${val}">
                            <img src="${img}" alt="" onerror="this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${val}/header.jpg'">
                            <div>
                                <strong>${g.name}</strong>
                                <span>AppID: ${val}</span>
                            </div>
                        </div>
                    `;
                    suggestions.classList.add('show');
                    bindSuggestionClick();
                    return;
                }
            } catch (e) {
                console.error("Suggestions appdetails error", e);
            }
        }

        try {
            const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(val)}&l=english&cc=US`;
            const cacheKey = `steam_suggest_${val}`;
            
            let data = getCache(cacheKey);
            if (!data) {
                data = await fetchWithFallback(url);
                if (data) setCache(cacheKey, data);
            }

            if (data && data.items?.length) {
                suggestions.innerHTML = data.items.map(item => `
                    <div class="suggestion-item" data-appid="${item.id}">
                        <img src="${item.tiny_image}" alt="">
                        <div>
                            <strong>${item.name}</strong>
                            <span>AppID: ${item.id}</span>
                        </div>
                    </div>
                `).join('');
                suggestions.classList.add('show');
                bindSuggestionClick();
            } else {
                suggestions.innerHTML = '<div class="suggestion-empty">Không tìm thấy game</div>';
                suggestions.classList.add('show');
            }
        } catch (e) {
            console.error("Suggestions storesearch error", e);
            suggestions.innerHTML = '';
            suggestions.classList.remove('show');
        }
    }, 450);
});

document.getElementById('appid').addEventListener('blur', function() {
    setTimeout(() => {
        document.getElementById('suggestions').classList.remove('show');
    }, 250);
});

function bindSuggestionClick() {
    document.querySelectorAll('.suggestion-item').forEach(el => {
        el.onclick = () => {
            document.getElementById('appid').value = el.dataset.appid;
            document.getElementById('suggestions').classList.remove('show');
            getGame();
        };
    });
}

function copyCmd(btn) {
    const cmd = btn.closest('.cmd-box').querySelector('.cmd-text').textContent;
    navigator.clipboard.writeText(cmd).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 1500);
    });
}

function copyCmdText(elementId, btn) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 1500);
    });
}

// Live commands update helper for right card command generator
function updateGeneratedCommands(appid) {
    const depotId = document.getElementById("depot-id-input").value.trim() || "[DepotID]";
    const manifestId = document.getElementById("manifest-id-input").value.trim() || "[ManifestID]";
    
    document.getElementById("depot-downloader-cmd").textContent = `dotnet DepotDownloader.dll -app ${appid} -depot ${depotId} -manifest ${manifestId} -user YOUR_STEAM_USER`;
    document.getElementById("steamcmd-cmd").textContent = `steamcmd.exe +login YOUR_USER YOUR_PASS +download_depot ${appid} ${depotId} ${manifestId} +quit`;
}

// Primary game fetch function
async function getGame() {
    let appid = document.getElementById("appid").value.trim();
    const resultDiv = document.getElementById("result");

    if (!appid) {
        alert("Vui lòng nhập AppID hoặc tên game");
        return;
    }

    // Render beautiful skeleton cards while loading
    resultDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Đang tìm kiếm và xử lý dữ liệu game...</p>
        </div>
    `;

    // Smart input detection: resolve game name to AppID
    const isNumeric = /^\d+$/.test(appid);
    if (!isNumeric) {
        try {
            const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(appid)}&l=english&cc=US`;
            const cacheKey = `steam_suggest_${appid}`;
            
            let searchData = getCache(cacheKey);
            if (!searchData) {
                searchData = await fetchWithFallback(searchUrl);
                if (searchData) setCache(cacheKey, searchData);
            }

            if (searchData && searchData.items && searchData.items.length > 0) {
                const matchedGame = searchData.items[0];
                appid = matchedGame.id.toString();
                document.getElementById("appid").value = appid;
            } else {
                resultDiv.innerHTML = `<div class="error-message">Không tìm thấy game nào khớp với tên "${appid}"!</div>`;
                return;
            }
        } catch (error) {
            console.error("Smart query search error", error);
            resultDiv.innerHTML = `<div class="error-message">Lỗi khi tìm kiếm game. Vui lòng thử lại sau.</div>`;
            return;
        }
    }

    try {
        const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
        const cacheKey = `steam_app_${appid}`;
        
        let data = getCache(cacheKey);
        if (!data) {
            data = await fetchWithFallback(url);
            if (data) setCache(cacheKey, data);
        }

        if (!data || !data[appid] || !data[appid].success) {
            resultDiv.innerHTML = `<div class="error-message">Không tìm thấy dữ liệu game cho AppID ${appid}!</div>`;
            return;
        }

        const game = data[appid].data;
        const downloadLink = `https://codeload.github.com/SSMGAlt/ManifestHub2/zip/refs/heads/${appid}`;
        const heroImage = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

        resultDiv.innerHTML = `
            <div class="result-layout">
                <!-- Left Panel: Info Card -->
                <div class="game-info-card">
                    <h2>${game.name}</h2>
                    <img src="${heroImage}" 
                         onerror="this.onerror=null; this.src='${game.header_image || ''}'"
                         class="header-img"
                         alt="${game.name}">

                    <div class="metadata-grid">
                        <div class="meta-box">
                            <span class="meta-box-label">AppID</span>
                            <span class="meta-box-val">${appid}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-box-label">Ngày Phát Hành</span>
                            <span class="meta-box-val">${game.release_date?.date || "Chưa xác định"}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-box-label">Nhà Phát Triển</span>
                            <span class="meta-box-val">${game.developers?.join(", ") || "Chưa xác định"}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-box-label">Nhà Phát Hành</span>
                            <span class="meta-box-val">${game.publishers?.join(", ") || "Chưa xác định"}</span>
                        </div>
                    </div>

                    <p class="desc">${game.short_description || "Không có mô tả ngắn cho game này."}</p>
                </div>

                <!-- Right Panel: Actions & Command Generator -->
                <div class="actions-card">
                    <h3>Tải Manifest & Công Cụ</h3>
                    
                    <div class="action-buttons-wrap">
                        <a href="https://codeload.github.com/SSMGAlt/ManifestHub2/zip/refs/heads/${appid}" target="_blank" class="download-link-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Tải Manifest ZIP từ ManifestHub
                        </a>
                        <div class="secondary-actions-row">
                            <a href="https://steamdb.info/app/${appid}/depots/" target="_blank" class="steamdb-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                Tra cứu Depots trên SteamDB
                            </a>
                        </div>
                    </div>

                    <div class="generator-section">
                        <h4 class="generator-title">⚙️ Trình tạo câu lệnh tải Depot</h4>
                        <div class="depot-select-wrap">
                            <input type="text" id="depot-id-input" placeholder="Nhập Depot ID (Ví dụ: 571)" oninput="updateGeneratedCommands('${appid}')">
                            <input type="text" id="manifest-id-input" placeholder="Nhập Manifest ID" oninput="updateGeneratedCommands('${appid}')">
                        </div>
                        
                        <div class="generator-label" style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Dành cho DepotDownloader:</div>
                        <div class="generator-code-block">
                            <code class="generator-code-text" id="depot-downloader-cmd">dotnet DepotDownloader.dll -app ${appid} -depot [DepotID] -manifest [ManifestID] -user YOUR_STEAM_USER</code>
                            <button class="generator-copy-btn" onclick="copyCmdText('depot-downloader-cmd', this)" title="Copy">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                        </div>

                        <div class="generator-label" style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; margin-top: 10px;">Dành cho SteamCMD:</div>
                        <div class="generator-code-block">
                            <code class="generator-code-text" id="steamcmd-cmd">steamcmd.exe +login YOUR_USER YOUR_PASS +download_depot ${appid} [DepotID] [ManifestID] +quit</code>
                            <button class="generator-copy-btn" onclick="copyCmdText('steamcmd-cmd', this)" title="Copy">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Dynamically update the instructions in the main guide panel to use the loaded AppID
        document.getElementById("depot-cmd-text").textContent = `dotnet DepotDownloader.dll -app ${appid} -depot [DepotID] -manifest [ManifestID] -user YOUR_STEAM_USER`;
        document.getElementById("steamcmd-text").textContent = `steamcmd.exe +login YOUR_USER YOUR_PASS +download_depot ${appid} [DepotID] [ManifestID] +quit`;
        
    } catch (error) {
        console.error("Get game details error", error);
        resultDiv.innerHTML = `<div class="error-message">Không thể kết nối đến máy chủ Steam qua các cổng CORS Proxy. Vui lòng thử lại sau.</div>`;
    }
}
