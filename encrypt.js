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
        } else if (file.endsWith('.html')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk('public');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 如果没有加密标记，直接跳过
    if (!content.includes('name="encrypt-password"')) return;

    const $ = cheerio.load(content, { decodeEntities: false });
    const passwordMeta = $('meta[name="encrypt-password"]');
    
    if (passwordMeta.length > 0) {
        const password = passwordMeta.attr('content');
        const hintMeta = $('meta[name="encrypt-hint"]');
        const hint = hintMeta.length > 0 ? hintMeta.attr('content') : null;
        
        passwordMeta.remove();
        hintMeta.remove();

        const tocContainer = $('.widget--toc');
        let plainTOC = '';
        if (tocContainer.length > 0) {
            plainTOC = tocContainer.html(); 
            tocContainer.empty(); 
            const rightSidebar = tocContainer.closest('.right-sidebar');
            if (rightSidebar.length > 0) {
                rightSidebar.attr('style', 'display: none !important;').addClass('encrypted-right-sidebar');
            } else {
                tocContainer.closest('section.widget').attr('style', 'display: none !important;').addClass('encrypted-toc-widget');
            }
        }

        const articleContent = $('.article-content');
        if (articleContent.length > 0) {
            const plainHTML = articleContent.html();
            const payload = JSON.stringify({ c: plainHTML, t: plainTOC });
            const ciphertext = CryptoJS.AES.encrypt(payload, password).toString();
            const passHash = CryptoJS.SHA256(password).toString();
            
            const hintHTML = hint ? `<div class="encrypt-hint">提示: ${hint}</div>` : '';
            
            // ================= 重点修复：采用幽灵按钮，完美适配动态色彩 =================
            const uiHTML = `
            <style>
                .encrypt-box {
                    text-align: center;
                    padding: 50px 20px;
                    background: var(--card-background);
                    border-radius: var(--card-border-radius, 8px);
                    box-shadow: var(--shadow-sm);
                    margin: 30px 0;
                    border: 1px solid rgba(128, 128, 128, 0.15);
                    color: inherit; 
                }
                .encrypt-icon {
                    margin-bottom: 20px;
                    opacity: 0.8;
                    color: currentColor; 
                }
                .encrypt-title {
                    margin-bottom: 25px;
                    font-size: 1.5rem;
                    font-weight: bold;
                }
                .encrypt-form {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    flex-wrap: wrap;
                    margin-bottom: 20px;
                }
                .encrypt-input {
                    padding: 12px 20px;
                    border: 2px solid rgba(128, 128, 128, 0.4) !important;
                    border-radius: 8px;
                    outline: none;
                    background: transparent;
                    color: inherit !important;
                    font-size: 16px;
                    flex: 1;
                    max-width: 300px;
                    transition: all 0.3s;
                }
                .encrypt-input::placeholder {
                    color: rgba(128, 128, 128, 0.6);
                }
                .encrypt-input:focus {
                    /* 兼容 Stack 新版 MD3 变量 --sys-color-primary */
                    border-color: var(--sys-color-primary, var(--accent-color, #3498db)) !important;
                    box-shadow: 0 0 0 2px rgba(128, 128, 128, 0.1);
                }
                
                /* ================= 全新设计的幽灵按钮 ================= */
                .encrypt-btn {
                    padding: 12px 25px;
                    /* 1. 背景抽空，彻底避免强光色 */
                    background: transparent !important;
                    /* 2. 边框使用强调色点缀 */
                    border: 2px solid var(--sys-color-primary, var(--accent-color, #3498db)) !important;
                    /* 3. 文字继承正文颜色，黑底白字，白底黑字，永不撞色 */
                    color: inherit !important;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    transition: all 0.3s;
                }
                .encrypt-btn:hover { 
                    /* 悬浮时铺一层极淡的透明底色 */
                    background: rgba(128, 128, 128, 0.1) !important; 
                }
                
                .encrypt-hint {
                    display: inline-block;
                    padding: 12px 20px;
                    background: rgba(128, 128, 128, 0.1);
                    border-radius: 6px;
                    font-size: 1.05rem; 
                    margin-top: 10px;
                    color: inherit;
                }
                .encrypt-error {
                    color: #e74c3c;
                    margin-top: 20px;
                    font-size: 1rem;
                    display: none;
                    font-weight: bold;
                }
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
                                catch(e) { data = { c: decryptedStr, t: '' }; }

                                if (isManual) {
                                    sessionStorage.setItem('post-pwd-' + location.pathname, pwd);
                                    location.reload(); 
                                } else {
                                    articleContent.innerHTML = data.c;
                                    
                                    if (data.t) {
                                        const rightSidebar = document.querySelector('.encrypted-right-sidebar');
                                        if (rightSidebar) {
                                            const tocContainer = rightSidebar.querySelector('.widget--toc');
                                            if (tocContainer) tocContainer.innerHTML = data.t;
                                            rightSidebar.style.removeProperty('display');
                                        } else {
                                            const tocWidget = document.querySelector('.encrypted-toc-widget');
                                            if (tocWidget) {
                                                const tocContainer = tocWidget.querySelector('.widget--toc');
                                                if (tocContainer) tocContainer.innerHTML = data.t;
                                                tocWidget.style.removeProperty('display');
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                if (isManual) showError();
                            }
                        } else {
                            if (isManual) showError();
                        }
                    }

                    function showError() {
                        msg.style.display = 'block';
                        pwdInput.value = '';
                        setTimeout(() => { msg.style.display = 'none'; }, 3000);
                    }

                    const cachedPwd = sessionStorage.getItem('post-pwd-' + location.pathname);
                    if (cachedPwd) {
                        doDecrypt(cachedPwd, false);
                    }

                    btn.addEventListener('click', () => {
                        if (pwdInput.value) doDecrypt(pwdInput.value, true);
                    });

                    pwdInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && pwdInput.value) doDecrypt(pwdInput.value, true);
                    });
                })();
            </script>
            `;
            
            articleContent.html(uiHTML);
        }
        
        const commentsSelectors = ['.article-comments', '.comments-provider', '#comments', '#disqus_thread', '#vcomments', '#gitalk-container', '#tcomment', '.giscus'];
        commentsSelectors.forEach(selector => { $(selector).remove(); });
        $('script').each(function() {
            const src = $(this).attr('src') || '';
            if (src.includes('giscus') || src.includes('waline') || src.includes('twikoo') || src.includes('disqus') || src.includes('gitalk') || src.includes('valine')) {
                $(this).remove(); 
            }
        });
        
        fs.writeFileSync(file, $.html(), 'utf8');
        console.log('已加密文章:', file);
    }
});
