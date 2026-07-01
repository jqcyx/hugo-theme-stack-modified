const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');

// 递归遍历 public 目录
function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            results.push(file);
        }
    });
    return results;
}

const files = walk('public');
const encryptedUrls = new Set();

// 辅助函数：推导 URL 路由（强制统一为 UTF-8 中文形态）
function getRelPermalink(filePath) {
    let p = filePath.replace(/\\/g, '/');
    if (p.startsWith('public/')) p = p.substring(7);
    if (!p.startsWith('/')) p = '/' + p;
    
    if (p.endsWith('/index.html')) p = p.substring(0, p.length - 10);
    else if (p.endsWith('.html')) p = p.substring(0, p.length - 5);
    
    // 确保从本地路径获取的也绝对是解码状态
    return decodeURI(p);
}

// ================= 阶段 1：处理 HTML 并加密正文 =================
files.forEach(file => {
    if (!file.endsWith('.html')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('name="encrypt-password"')) return;

    // 记录明文状态（或解码后）的文章永久链接
    encryptedUrls.add(getRelPermalink(file));

    const $ = cheerio.load(content, { decodeEntities: false });
    const passwordMeta = $('meta[name="encrypt-password"]');
    
    if (passwordMeta.length > 0) {
        const password = passwordMeta.attr('content');
        const hintMeta = $('meta[name="encrypt-hint"]');
        const hint = hintMeta.length > 0 ? hintMeta.attr('content') : null;
        
        passwordMeta.remove();
        hintMeta.remove();
        
        $('.custom-meta-item').filter(function() {
            const text = $(this).text();
            return text.includes('字') || text.includes('分钟');
        }).remove();
        
        let plainTOCDesktop = '';
        let plainTOCMobile = '';

        const desktopToc = $('.widget--toc');
        if (desktopToc.length > 0) {
            plainTOCDesktop = desktopToc.html();
            desktopToc.empty();
            const rightSidebar = desktopToc.closest('.right-sidebar');
            if (rightSidebar.length > 0) {
                rightSidebar.attr('style', 'display: none !important;').addClass('encrypted-right-sidebar');
            } else {
                desktopToc.closest('section.widget').attr('style', 'display: none !important;').addClass('encrypted-toc-widget');
            }
        }

        const mobileTocElements = $('.article-toc-title, .article-toc, [id="TableOfContents"]');
        mobileTocElements.each(function() {
            if ($(this).closest('.widget--toc, .right-sidebar').length > 0) return;
            let container = $(this).closest('.article-toc');
            if (container.length === 0) container = $(this).closest('details');
            if (container.length === 0) container = $(this);
            if (container.hasClass('encrypted-mobile-toc')) return;
            if (!plainTOCMobile) plainTOCMobile = container.html(); 
            container.empty().attr('style', 'display: none !important;').addClass('encrypted-mobile-toc');
        });

        const articleContent = $('.article-content');
        if (articleContent.length > 0) {
            const plainHTML = articleContent.html();
            const payload = JSON.stringify({ c: plainHTML, td: plainTOCDesktop, tm: plainTOCMobile });
            const ciphertext = CryptoJS.AES.encrypt(payload, password).toString();
            const passHash = CryptoJS.SHA256(password).toString();
            const hintHTML = hint ? `<div class="encrypt-hint">💡 提示: ${hint}</div>` : '';
            
            const uiHTML = `
            <style>
                .encrypt-box { text-align: center; padding: 50px 20px; background: var(--card-background); border-radius: var(--card-border-radius, 8px); box-shadow: var(--shadow-sm); margin: 30px 0; border: 1px solid rgba(128, 128, 128, 0.15); color: inherit; }
                .encrypt-icon { margin-bottom: 20px; opacity: 0.8; color: currentColor; }
                .encrypt-title { margin-bottom: 25px; font-size: 1.5rem; font-weight: bold; }
                .encrypt-form { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 20px; }
                .encrypt-input { padding: 12px 20px; border: 2px solid rgba(128, 128, 128, 0.4) !important; border-radius: 8px; outline: none; background: transparent; color: inherit !important; font-size: 16px; flex: 1; max-width: 300px; transition: all 0.3s; }
                .encrypt-input::placeholder { color: rgba(128, 128, 128, 0.6); }
                .encrypt-input:focus { border-color: var(--sys-color-primary, var(--accent-color, #3498db)) !important; box-shadow: 0 0 0 2px rgba(128, 128, 128, 0.1); }
                .encrypt-btn { padding: 12px 25px; background: transparent !important; border: 2px solid var(--sys-color-primary, var(--accent-color, #3498db)) !important; color: inherit !important; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s; }
                .encrypt-btn:hover { background: rgba(128, 128, 128, 0.1) !important; }
                .encrypt-hint { display: inline-block; padding: 12px 20px; background: rgba(128, 128, 128, 0.1); border-radius: 6px; font-size: 1.05rem; margin-top: 10px; color: inherit; }
                .encrypt-error { color: #e74c3c; margin-top: 20px; font-size: 1rem; display: none; font-weight: bold; }
                .article-comments, .comments-provider, .giscus { display: none !important; }
            </style>
            
            <div class="encrypt-box" id="decrypt-container">
                <svg class="encrypt-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <h2 class="encrypt-title">该文章已被加密！</h2>
                <div class="encrypt-form">
                    <input type="password" id="decrypt-pwd" class="encrypt-input" placeholder="请输入密码">
                    <button id="decrypt-btn" class="encrypt-btn">解锁</button>
                </div>
                ${hintHTML}
                <div id="decrypt-msg" class="encrypt-error">密码错误，请重试</div>
            </div>
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
            <script>
                (function() {
                    const encryptedData = "${ciphertext}";
                    const passHash = "${passHash}";
                    const pwdInput = document.getElementById('decrypt-pwd');
                    const btn = document.getElementById('decrypt-btn');
                    const msg = document.getElementById('decrypt-msg');
                    const articleContent = document.querySelector('.article-content');
                    
                    function doDecrypt(pwd, isManual) {
                        const hash = CryptoJS.SHA256(pwd).toString();
                        if (hash === passHash) {
                            try {
                                const bytes = CryptoJS.AES.decrypt(encryptedData, pwd);
                                const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                                if (!decryptedStr) throw new Error('Decrypt failed');
                                
                                let data;
                                try { data = JSON.parse(decryptedStr); } 
                                catch(e) { data = { c: decryptedStr, td: '', tm: '' }; }
                                
                                if (data.t && !data.td) { data.td = data.t; }

                                if (isManual) {
                                    sessionStorage.setItem('post-pwd-' + location.pathname, pwd);
                                    location.reload(); 
                                } else {
                                    articleContent.innerHTML = data.c;
                                    
                                    if (data.td) {
                                        const rightSidebar = document.querySelector('.encrypted-right-sidebar');
                                        if (rightSidebar) {
                                            const tocContainer = rightSidebar.querySelector('.widget--toc');
                                            if (tocContainer) tocContainer.innerHTML = data.td;
                                            rightSidebar.style.removeProperty('display');
                                        } else {
                                            const tocWidget = document.querySelector('.encrypted-toc-widget');
                                            if (tocWidget) {
                                                const tocContainer = tocWidget.querySelector('.widget--toc');
                                                if (tocContainer) tocContainer.innerHTML = data.td;
                                                tocWidget.style.removeProperty('display');
                                            }
                                        }
                                    }
                                    
                                    if (data.tm) {
                                        const mobileTocs = document.querySelectorAll('.encrypted-mobile-toc');
                                        mobileTocs.forEach(toc => { toc.innerHTML = data.tm; toc.style.removeProperty('display'); });
                                    }
                                }
                            } catch (e) { if (isManual) showError(); }
                        } else { if (isManual) showError(); }
                    }
                    function showError() { msg.style.display = 'block'; pwdInput.value = ''; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
                    const cachedPwd = sessionStorage.getItem('post-pwd-' + location.pathname);
                    if (cachedPwd) { doDecrypt(cachedPwd, false); }
                    btn.addEventListener('click', () => { if (pwdInput.value) doDecrypt(pwdInput.value, true); });
                    pwdInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && pwdInput.value) doDecrypt(pwdInput.value, true); });
                })();
            </script>
            `;
            
            articleContent.html(uiHTML);
        }
        
        const commentsSelectors = ['.article-comments', '.comments-provider', '#comments', '#disqus_thread', '#vcomments', '#gitalk-container', '#tcomment', '.giscus'];
        commentsSelectors.forEach(selector => { $(selector).remove(); });
        $('script').each(function() {
            const src = $(this).attr('src') || '';
            if (src.includes('giscus') || src.includes('waline') || src.includes('twikoo') || src.includes('disqus') || src.includes('gitalk') || src.includes('valine')) { $(this).remove(); }
        });
        
        fs.writeFileSync(file, $.html(), 'utf8');
        console.log('Processed HTML File:', file);
    }
});

// ================= 阶段 2：净化搜索索引 (JSON) =================
files.forEach(file => {
    if (!file.endsWith('.json')) return;
    
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch(e) { return; }
    if (!content.trim().startsWith('[')) return;

    let indexData;
    try { indexData = JSON.parse(content); } catch (e) { return; }

    let modified = false;
    indexData.forEach(item => {
        if (item.permalink) {
            // 【中文路径修复】无论它有没有被 URL 编码，强制解密还原为真实的中文形态再做比对
            let rawLink = item.permalink.split('?')[0].replace(/\/$/, '');
            let normalizedLink = '';
            try { normalizedLink = decodeURI(rawLink); } catch(e) { normalizedLink = rawLink; }
            
            let isEncrypted = false;
            for (let url of encryptedUrls) {
                let normalizedUrl = url.replace(/\/$/, '');
                if (normalizedLink.endsWith(normalizedUrl)) {
                    isEncrypted = true;
                    break;
                }
            }

            if (isEncrypted) {
                item.content = "这是一篇加密文章，请点击进入详情页输入密码解锁。";
                if (item.description) item.description = "该文章已被加密";
                if (item.summary) item.summary = "该文章已被加密";
                modified = true;
            }
        }
    });

    if (modified) {
        fs.writeFileSync(file, JSON.stringify(indexData, null, 2), 'utf8');
        console.log('Processed JSON File:', file);
    }
});

// ================= 阶段 3：净化 RSS 订阅源 (XML) =================
files.forEach(file => {
    if (!file.endsWith('.xml')) return;
    
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch(e) { return; }
    if (!content.includes('<rss') && !content.includes('<feed')) return;

    const $ = cheerio.load(content, { xmlMode: true, decodeEntities: false });
    let modified = false;

    $('item, entry').each(function() {
        let link = $(this).find('link').text().trim() || 
                   $(this).find('link').attr('href') || 
                   $(this).find('guid').text().trim() || 
                   $(this).find('id').text().trim() || '';
                   
        if (!link) return;

        // 【中文路径修复】强行给带有 %E5... 的字符串解码回纯中文
        let rawLink = link.split('?')[0].replace(/\/$/, '');
        let normalizedLink = '';
        try { normalizedLink = decodeURI(rawLink); } catch(e) { normalizedLink = rawLink; }

        let isEncrypted = false;
        
        for (let url of encryptedUrls) {
            let normalizedUrl = url.replace(/\/$/, '');
            if (normalizedLink.endsWith(normalizedUrl)) {
                isEncrypted = true; 
                break;
            }
        }

        if (isEncrypted) {
            const tagsToWipe = ['description', 'summary', 'content', 'content\\:encoded'];
            
            tagsToWipe.forEach(tag => {
                const targetNode = $(this).find(tag);
                if (targetNode.length > 0) {
                    targetNode.empty().text('该文章已被加密，请点击进入详情页输入密码解锁。');
                }
            });
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(file, $.xml(), 'utf8');
        console.log('Processed XML File:', file);
    }
});