// ==UserScript==
// @name         飞书自动解除复制
// @namespace    https://github.com/88lin
// @version      2.0.0
// @icon         https://cdn.jsdmirror.com/gh/88lin/picx-images-hosting@master/favicon.67xwxgc03y.svg
// @description  解除飞书网页复制、剪切、粘贴、右键、文本选择、拖拽限制；仅拦 Ctrl/Cmd+C 键盘拦截，不影响正常输入；持续守护动态节点与同源 iframe。
// @author       茉灵智库
// @match        https://*.feishu.cn/*
// @run-at       document-start
// @grant        none
// @noframes     false
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    // —— 1. 目标事件与放行策略 ————————————————————————————
    // 这些事件网站常用来阻止复制/右键/选择
    const BLOCKED_EVENTS = new Set([
        'copy', 'cut', 'paste',
        'contextmenu',
        'selectstart', 'select',
        'dragstart', 'drag',
        'mousedown', 'mouseup',
        'beforecopy', 'beforecut', 'beforepaste',
    ]);

    // 键盘事件里，只拦「Ctrl/Cmd+C」以及 Ctrl/Cmd+X / A / V / S / P 这些常被禁用的组合
    const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);
    const isBlockedKeyCombo = (e) => {
        const k = (e.key || '').toLowerCase();
        const mod = e.ctrlKey || e.metaKey;
        return mod && ['c', 'x', 'a', 'v', 's', 'p', 'u'].includes(k);
    };

    // —— 2. 尽早注入 CSS：允许选择、允许右键菜单、清掉透明遮罩 ————
    const CSS = `
        *, *::before, *::after {
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            -webkit-touch-callout: default !important;
        }
        html, body { -webkit-user-drag: auto !important; }
    `;

    const injectStyle = (doc) => {
        try {
            if (!doc || doc.getElementById('__freecopy_pro_style__')) return;
            const s = doc.createElement('style');
            s.id = '__freecopy_pro_style__';
            s.textContent = CSS;
            (doc.head || doc.documentElement || doc).appendChild(s);
        } catch (_) {}
    };

    // 页面还没 <head> 就先挂到 documentElement 上，等 head 出来再补一次
    injectStyle(document);
    new MutationObserver(() => injectStyle(document)).observe(document, { childList: true, subtree: true });

    // —— 3. Hook addEventListener：直接拒绝页面注册这些拦截器 ————
    const rawAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        try {
            const t = (type || '').toLowerCase();
            if (BLOCKED_EVENTS.has(t)) {
                // 不真的注册；页面以为绑上了，其实是空
                return;
            }
            if (KEY_EVENTS.has(t) && typeof listener === 'function') {
                // 键盘事件包一层：如果监听器想拦 Ctrl/Cmd+C 之类，就吞掉
                const wrapped = function (e) {
                    if (isBlockedKeyCombo(e)) return; // 不把事件交给页面
                    return listener.apply(this, arguments);
                };
                return rawAdd.call(this, type, wrapped, options);
            }
        } catch (_) {}
        return rawAdd.call(this, type, listener, options);
    };

    // —— 4. 中和 on* 属性：让 document.oncopy = ... 之类无效化 ————
    const neutralize = (obj, prop) => {
        try {
            Object.defineProperty(obj, prop, {
                configurable: true,
                get() { return null; },
                set() { /* 吞掉赋值 */ },
            });
        } catch (_) {}
    };

    const NEUTRALIZE_PROPS = [
        'oncopy', 'oncut', 'onpaste',
        'oncontextmenu',
        'onselectstart', 'onselect',
        'ondragstart', 'ondrag',
        'onmousedown', 'onmouseup',
        'onbeforecopy', 'onbeforecut', 'onbeforepaste',
    ];

    const applyNeutralize = (win) => {
        try {
            const doc = win.document;
            [win, doc, doc.documentElement, doc.body].forEach((t) => {
                if (!t) return;
                NEUTRALIZE_PROPS.forEach((p) => neutralize(t, p));
            });
        } catch (_) {}
    };

    // —— 5. 顶层再挂一层捕获阶段的最终防线（有些页面直接派发合成事件） ——
    const finalGuard = (e) => {
        if (KEY_EVENTS.has(e.type)) {
            if (!isBlockedKeyCombo(e)) return;
        } else if (!BLOCKED_EVENTS.has(e.type)) {
            return;
        }
        // 只阻止事件继续冒泡传播，不阻止默认行为（默认行为就是我们要的复制/右键）
        e.stopImmediatePropagation();
    };
    const attachFinalGuard = (win) => {
        try {
            const doc = win.document;
            [...BLOCKED_EVENTS, ...KEY_EVENTS].forEach((ev) => {
                win.addEventListener(ev, finalGuard, true);
                doc.addEventListener(ev, finalGuard, true);
            });
        } catch (_) {}
    };

    // —— 6. 清理 HTML 属性型拦截 & 透明遮罩 ————————————————
    const HTML_ATTRS = ['onselectstart', 'oncopy', 'oncut', 'onpaste', 'oncontextmenu', 'ondragstart', 'unselectable'];
    const cleanupNode = (root, win) => {
        try {
            const nodes = root.nodeType === 1 ? [root, ...root.querySelectorAll('*')] : [];
            for (const el of nodes) {
                if (!el || !el.getAttribute) continue;
                for (const a of HTML_ATTRS) {
                    if (el.hasAttribute && el.hasAttribute(a)) el.removeAttribute(a);
                }
                // 内联 user-select:none 清掉
                if (el.style) {
                    if (el.style.userSelect === 'none') el.style.userSelect = '';
                    if (el.style.webkitUserSelect === 'none') el.style.webkitUserSelect = '';
                }
                // 透明高层遮罩：让下面能被点到
                try {
                    const cs = win.getComputedStyle(el);
                    if ((cs.position === 'fixed' || cs.position === 'absolute') && parseFloat(cs.opacity) === 0) {
                        el.style.pointerEvents = 'none';
                    }
                } catch (_) {}
            }
        } catch (_) {}
    };

    // —— 7. 同源 iframe：进入后照样来一遍 ————————————————
    const hookedWindows = new WeakSet();
    const hookWindow = (win) => {
        try {
            if (!win || hookedWindows.has(win)) return;
            hookedWindows.add(win);
            injectStyle(win.document);
            applyNeutralize(win);
            attachFinalGuard(win);
            cleanupNode(win.document.documentElement, win);

            // 持续观察
            new win.MutationObserver((records) => {
                for (const r of records) {
                    r.addedNodes && r.addedNodes.forEach((n) => {
                        if (n.tagName === 'IFRAME') {
                            try { if (n.contentWindow) hookWindow(n.contentWindow); } catch (_) {}
                        }
                        cleanupNode(n, win);
                    });
                }
                applyNeutralize(win); // body 可能刚出来
            }).observe(win.document, { childList: true, subtree: true, attributes: true, attributeFilter: HTML_ATTRS });
        } catch (_) {}
    };

    hookWindow(window);

    // 页面里已有的 iframe & 之后新增的 iframe
    const scanIframes = () => {
        try {
            document.querySelectorAll('iframe').forEach((f) => {
                try { if (f.contentWindow) hookWindow(f.contentWindow); } catch (_) {}
            });
        } catch (_) {}
    };
    scanIframes();
    window.addEventListener('DOMContentLoaded', scanIframes, true);
    window.addEventListener('load', scanIframes, true);
})();
