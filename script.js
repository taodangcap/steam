let searchTimeout;

// CORS proxy - Steam API chặn request trực tiếp từ browser
const proxy = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

document.getElementById('appid').addEventListener('input', function() {
    const val = this.value.trim();
    const suggestions = document.getElementById('suggestions');

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
                const res = await fetch(proxy(url));
                const data = await res.json();
                if (data[val]?.success) {
                    const g = data[val].data;
                    const img = `https://cdn.cloudflare.steamstatic.com/steam/apps/${val}/capsule_231x87.jpg`;
                    suggestions.innerHTML = `
                        <div class="suggestion-item" data-appid="${val}">
                            <img src="${img}" alt="">
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
            } catch (e) {}
        }

        try {
            const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(val)}&l=english&cc=US`;
            const res = await fetch(proxy(url));
            const data = await res.json();
            if (data.items?.length) {
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
                suggestions.innerHTML = '<div class="suggestion-empty">Không tìm thấy</div>';
                suggestions.classList.add('show');
            }
        } catch (e) {
            suggestions.innerHTML = '';
            suggestions.classList.remove('show');
        }
    }, 300);
});

document.getElementById('appid').addEventListener('blur', function() {
    setTimeout(() => {
        document.getElementById('suggestions').classList.remove('show');
    }, 200);
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

async function getGame() {
    const appid = document.getElementById("appid").value.trim();
    const resultDiv = document.getElementById("result");

    if (!appid) {
        alert("Vui lòng nhập AppID hoặc tên game");
        return;
    }

    resultDiv.innerHTML = '<p class="loading">Đang tải...</p>';

    try {
        const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
        const response = await fetch(proxy(url));
        const data = await response.json();

        if (!data[appid] || !data[appid].success) {
            resultDiv.innerHTML = "<p>Không tìm thấy game!</p>";
            return;
        }

        const game = data[appid].data;

        const downloadLink =
            `https://codeload.github.com/SteamAutoCracks/ManifestHub/zip/refs/heads/${appid}`;

        const heroImage =
            `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header_image.jpg`;

        resultDiv.innerHTML = `
            <div class="card">
                <h2>${game.name}</h2>

                <img src="${heroImage}" 
                     onerror="this.src='${game.header_image}'">

                <p><b>Release:</b> ${game.release_date?.date || "Unknown"}</p>
                <p><b>Developer:</b> ${game.developers?.join(", ") || "Unknown"}</p>

                <p class="desc">${game.short_description || ""}</p>

                <a href="${downloadLink}" target="_blank">
                    <button class="download-btn">Download Manifest</button>
                </a>
            </div>
        `;
    } catch (error) {
        resultDiv.innerHTML = "<p>Lỗi tải dữ liệu. Thử lại sau.</p>";
    }
}