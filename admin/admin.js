const LANGS = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'French' },
    { code: 'ar', label: 'Arabic' },
    { code: 'hy', label: 'Armenian' },
];

const reportEl   = document.getElementById('build-report');
const progressEl = document.getElementById('build-progress');
const deployBtn  = document.getElementById('deploy-btn');
const previewBtn = document.getElementById('preview-btn');

let lastDiff = null;
let lastKnownBuild = null;
netlifyIdentity.on('login', () => {
    document.getElementById('translator-ui').style.display = 'block';
    fetchBuildStatus();
    // Show welcome banner if arriving from the invite/welcome page
    if (window.location.hash.includes('welcome=1')) {
        document.getElementById('welcome-banner').style.display = 'block';
        history.replaceState(null, '', window.location.pathname); // clean the URL
    }
});

function getToken() {
    return netlifyIdentity.currentUser().token.access_token;
}

async function fetchBuildStatus() {
    try {
        const res = await fetch('/metadata.json?t=' + Date.now());
        if (!res.ok) throw new Error('No metadata found.');
        const data = await res.json();
        const currentBuild = data.lastBuild;
        const updated = lastKnownBuild !== null && currentBuild !== lastKnownBuild;
        lastKnownBuild = currentBuild;
        reportEl.innerHTML = `
            <br>📅 Time: ${data.lastBuild}
            <br>📄 Pages Generated: <strong>${data.pageCount}</strong>
            <br>📁 Files Deployed: <strong>${data.totalFilesDeployed}</strong>
            <br>✅ Status: ${data.status}
        `;
        return updated;
    } catch {
        reportEl.innerText = 'No previous build data available.';
        return false;
    }
}

async function runPreview() {
    previewBtn.disabled = true;
    previewBtn.textContent = '⏳ Fetching diff…';
    deployBtn.disabled = true;
    document.getElementById('diff-placeholder').classList.add('hidden');
    document.getElementById('diff-results').classList.add('hidden');

    try {
        const res = await fetch('/.netlify/functions/fetch-preview', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Preview function failed.');
        }
        const diff = await res.json();
        renderDiff(diff);
        lastDiff = diff; // Store the diff object for later use
        deployBtn.disabled = diff.totalChanges === 0;
    } catch (err) {
        const ph = document.getElementById('diff-placeholder');
        ph.textContent = 'Preview failed: ' + err.message;
        ph.classList.remove('hidden');
    } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = '🔍 Preview Changes';
    }
}

function renderDiff(diff) {
    const { rows, totalChanges, changesByLang } = diff;

    const summaryEl = document.getElementById('diff-summary');
    if (totalChanges === 0) {
        summaryEl.innerHTML = '<span class="chip chip-none">✅ No changes — Sheet matches live site</span>';
    } else {
        const langChips = LANGS
            .filter(l => changesByLang[l.code] > 0)
            .map(l => `<span class="chip chip-lang">${l.label}: ${changesByLang[l.code]}</span>`)
            .join('');
        summaryEl.innerHTML = `<span class="chip chip-total">⚠️ ${totalChanges} change${totalChanges !== 1 ? 's' : ''}</span>${langChips}`;
    }

    const changedCount = rows.filter(r => r.changed).length;
    document.getElementById('key-count').textContent =
        changedCount + ' of ' + rows.length + ' keys changed';

    const tbody = document.getElementById('diff-tbody');
    tbody.innerHTML = '';

    rows.forEach(row => {
        const tr = document.createElement('tr');
        let rowClass = 'row-unchanged';
        let badge = '';

        if (row.isNew)         { rowClass = 'row-new';     badge = '<span class="badge badge-new">NEW</span>'; }
        else if (row.isDeleted){ rowClass = 'row-deleted'; badge = '<span class="badge badge-deleted">REMOVED</span>'; }
        else if (row.changed)  { rowClass = 'row-changed'; badge = '<span class="badge badge-changed">CHANGED</span>'; }

        tr.classList.add(rowClass);
        if (!row.changed) tr.classList.add('js-unchanged', 'hidden');

        const keyTd = document.createElement('td');
        keyTd.className = 'key-cell';
        keyTd.title = row.key;
        keyTd.innerHTML = row.key + badge;
        tr.appendChild(keyTd);

        LANGS.forEach(function(l) {
            const td = document.createElement('td');
            td.className = 'lang-cell';
            const d = row.langs[l.code] || { old: '', new: '', changed: false };
            if (!d.changed) {
                const val = d.new || d.old;
                td.innerHTML = val
                    ? '<span class="val-unchanged">' + escHtml(val) + '</span>'
                    : '<span class="val-empty">(empty)</span>';
            } else {
                const oldHtml = d.old
                    ? '<span class="val-old">' + escHtml(d.old) + '</span>'
                    : '<span class="val-empty val-old">(empty)</span>';
                const newHtml = d.new
                    ? '<span class="val-new">' + escHtml(d.new) + '</span>'
                    : '<span class="val-empty val-new">(empty)</span>';
                td.innerHTML = '<div class="val-changed-wrap">' + oldHtml + newHtml + '</div>';
            }
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    document.getElementById('diff-results').classList.remove('hidden');
}

function toggleUnchanged() {
    const show = document.getElementById('show-unchanged').checked;
    document.querySelectorAll('.js-unchanged').forEach(function(row) {
        row.classList.toggle('hidden', !show);
    });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function approveBuild() {
    if (!confirm('Deploy these changes to the live site?\n\nThe full site will rebuild from the current Google Sheet data.')) return;

    deployBtn.disabled = true;
    previewBtn.disabled = true;
    progressEl.style.display = 'inline';

    try {
        const response = await fetch('/.netlify/functions/trigger-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getToken()
            },
            body: JSON.stringify({
                totalChanges: lastDiff?.totalChanges ?? 0,
                totalKeys: lastDiff?.rows?.length ?? 0
            })
        });
        if (response.ok) {
            alert('Build triggered! The site will update in 1-2 minutes.');
            let attempts = 0;
            const interval = setInterval(async function() {
                const updated = await fetchBuildStatus();
                if (updated) {
                    clearInterval(interval);
                    progressEl.style.display = 'none';
                    deployBtn.disabled = false;
                    previewBtn.disabled = false;
                    await runPreview();
                    return;
                }
                attempts++;
                if (attempts > 24) {
                    clearInterval(interval);
                    progressEl.style.display = 'none';
                    deployBtn.disabled = false;
                    previewBtn.disabled = false;
                }
            }, 10000);
        } else {
            throw new Error('Trigger function failed.');
        }
    } catch (err) {
        alert('Error triggering build: ' + err.message + '\n\nCheck Netlify function logs.');
        deployBtn.disabled = false;
        previewBtn.disabled = false;
        progressEl.style.display = 'none';
    }
}