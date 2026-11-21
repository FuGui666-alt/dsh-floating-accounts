// ui-polish-preview 组装器：读取 src/style.css 原文内嵌，渲染合成 schema2 静态预览
// 纯本地文件组装；零网络；不触碰插件源码与 DSH_HOME。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const out = path.join(__dirname, 'ui-polish-preview.html');

const html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>dsh-floating-accounts 1.2.0 界面美化预览（合成数据）</title>
<style>
/* ===== 预览页专属：宿主主题 token 的明/暗两套取值（仅预览用，不属插件代码） ===== */
:root{
  --dsw-alias-bg-layer-1:#f5f7fb;--dsw-alias-bg-layer-2:#ffffff;
  --dsw-alias-label-primary:#182235;--dsw-alias-label-secondary:#55657a;--dsw-alias-label-tertiary:#697589;
  --dsw-alias-border-l1:#d9deea;
  --preview-page-bg:#eef1f7;--preview-page-label:#182235;
}
html[data-theme="dark"]{
  --dsw-alias-bg-layer-1:#1e2430;--dsw-alias-bg-layer-2:#171c26;
  --dsw-alias-label-primary:#e8ecf5;--dsw-alias-label-secondary:#b3bdd0;--dsw-alias-label-tertiary:#8a94a8;
  --dsw-alias-border-l1:#303947;
  --preview-page-bg:#0f1218;--preview-page-label:#e8ecf5;
}
body{margin:0;padding:28px 16px 60px;background:var(--preview-page-bg);color:var(--preview-page-label);font:14px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;transition:background .25s,color .25s}
.preview-bar{position:fixed;top:12px;right:16px;display:flex;gap:8px;z-index:99}
.preview-bar button{font:inherit;padding:8px 14px;border-radius:10px;border:1px solid #69758955;background:#ffffffd9;color:#182235;cursor:pointer;backdrop-filter:blur(6px)}
html[data-theme="dark"] .preview-bar button{background:#1e2430d9;color:#e8ecf5}
.preview-note{max-width:720px;margin:0 auto 18px;padding:10px 14px;border-radius:10px;background:#69758914;border:1px dashed #69758940;font-size:12.5px}
.preview-note b{display:block;margin-bottom:2px}
.preview-stage{display:flex;justify-content:center}
/* 以下把插件面板从 fixed 定位转为文档流，便于预览 */
.dfa-panel{position:static!important;max-height:none!important;width:min(560px,96vw)}
/* ===== 插件样式原文（src/style.css @ 5c6baa8f381fd85c5e26379a37c09c775f55d988e7a84c72d8bd276a6d1aad52） ===== */
</style>
<style>
${css}
</style>
</head>
<body>
<div class="preview-bar">
  <button id="themeBtn" type="button">切换深/浅主题</button>
</div>
<div class="preview-note">
  <b>合成数据预览（非真实账号）</b>
  这是 t12 界面美化的静态预览：CSS 与插件构建产物逐字一致，数据全部为虚构站点/账号/凭据。右上角切换明暗主题；面板默认位置已改为文档流便于滚动查看。安装前请先在此确认观感；功能零变更，文案与真实面板逐字相同。
</div>
<div class="preview-stage">
<div class="dfa-panel" id="panel" tabindex="-1">
  <header class="dfa-header">
    <div><strong>账号配置</strong><small>站点 → 账号 → 凭据 · 余额仅手动查询</small></div>
    <button class="dfa-icon" type="button" aria-label="收起账号面板">×</button>
  </header>
  <div class="dfa-body">
    <div class="dfa-success" role="status">已加密保存</div>
    <div class="dfa-toolbar">
      <div class="dfa-actions" style="gap:8px">
        <button class="dfa-primary" type="button">+ 添加站点</button>
        <button type="button">从 DSH 导入供应商</button>
      </div>
      <div class="dfa-actions" style="gap:8px">
        <button type="button">重新载入</button>
      </div>
    </div>

    <section class="dfa-site">
      <h3>DeepSeek 官方</h3>
      <div class="dfa-url">https://api.deepseek.com</div>
      <span class="dfa-meta">协议：deepseek-balance</span>
      <div class="dfa-actions dfa-site-actions">
        <button type="button">+ 添加账号</button>
        <button type="button">编辑站点</button>
        <button class="dfa-danger" type="button">删除站点</button>
      </div>
      <article class="dfa-account">
        <strong>主账号</strong>
        <div class="dfa-url">—</div>
        <p class="dfa-meta">1 个凭据</p>
        <ul class="dfa-credentials">
          <li>
            <div><strong>默认模型 Key</strong><span class="dfa-meta">模型 API Key · 已保存</span></div>
            <div class="dfa-actions"><button type="button">编辑凭据</button><button class="dfa-danger" type="button">删除凭据</button></div>
          </li>
        </ul>
        <div class="dfa-balance" aria-live="polite">
          <p>余额：¥ 86.42（总可用）</p>
          <p>赠金 ¥ 12.00 · 充值 ¥ 74.42</p>
        </div>
        <div class="dfa-actions">
          <button type="button">查询余额</button>
          <button type="button">检测协议</button>
          <button type="button">编辑</button>
          <button class="dfa-danger" type="button">删除</button>
        </div>
      </article>
    </section>

    <section class="dfa-site">
      <h3>中转站（示例）</h3>
      <div class="dfa-url">https://relay.example.com/v1</div>
      <span class="dfa-meta">协议：sub2api-usage · USD</span>
      <div class="dfa-actions dfa-site-actions">
        <button type="button">+ 添加账号</button>
        <button type="button">编辑站点</button>
        <button class="dfa-danger" type="button">删除站点</button>
      </div>
      <article class="dfa-account">
        <strong>示例账号 A</strong>
        <div class="dfa-url">—</div>
        <p class="dfa-meta">2 个凭据</p>
        <ul class="dfa-credentials">
          <li>
            <div><strong>Key #1</strong><span class="dfa-meta">模型 API Key · 已保存</span></div>
            <div class="dfa-actions"><button type="button">编辑凭据</button><button class="dfa-danger" type="button">删除凭据</button></div>
          </li>
          <li>
            <div><strong>分组密钥</strong><span class="dfa-meta">分组密钥 · 已保存</span></div>
            <div class="dfa-actions"><button type="button">编辑凭据</button><button class="dfa-danger" type="button">删除凭据</button></div>
          </li>
        </ul>
        <div class="dfa-balance" aria-live="polite">
          <p class="dfa-balance-error" role="alert">余额查询失败：接口限流（429）；未获得本次余额，请手动重试</p>
        </div>
        <div class="dfa-actions">
          <button type="button">查询余额</button>
          <button type="button">检测协议</button>
          <button type="button">编辑</button>
          <button class="dfa-danger" type="button">删除</button>
        </div>
      </article>
      <article class="dfa-account">
        <strong>示例账号 B（未配置协议）</strong>
        <div class="dfa-url">—</div>
        <p class="dfa-meta">1 个凭据</p>
        <ul class="dfa-credentials">
          <li>
            <div><strong>Key #2</strong><span class="dfa-meta">模型 API Key · 未设置</span></div>
            <div class="dfa-actions"><button type="button">编辑凭据</button><button class="dfa-danger" type="button">删除凭据</button></div>
          </li>
        </ul>
        <div class="dfa-balance" aria-live="polite"><p>余额：未查询</p></div>
        <div class="dfa-actions">
          <button type="button">查询余额</button>
          <button type="button">检测协议</button>
          <button type="button">编辑</button>
          <button class="dfa-danger" type="button">删除</button>
        </div>
      </article>
    </section>

    <div class="dfa-import">
      <h3>从 DSH 导入供应商</h3>
      <p>勾选要导入的供应商（name/baseURL/是否已配 Key），确认后写入本插件 DPAPI 加密存储，仅保存在本地。</p>
      <div class="dfa-import-row">
        <input type="checkbox" checked>
        <span><strong>示例供应商 · https://relay.example.com/v1</strong><span class="dfa-meta">已配置 Key · 4 个模型</span></span>
      </div>
      <div class="dfa-import-row">
        <input type="checkbox">
        <span><strong>本地 Ollama · http://localhost:11434/v1</strong><span class="dfa-meta">未配置 Key · 1 个模型</span></span>
      </div>
      <div class="dfa-import-warning">所选供应商 Key 将经宿主写入本插件 DPAPI 加密存储，仅保存在本地；重复导入同一供应商会产生重复账号。</div>
      <div class="dfa-import-conflict">
        <strong>同 origin 冲突（需选择）</strong>
        <div class="dfa-import-conflict-row"><label><input type="radio" name="c">并入「中转站（示例）」</label></div>
        <div class="dfa-import-conflict-row"><label><input type="radio" name="c">新建站点</label></div>
      </div>
      <div class="dfa-actions"><button class="dfa-primary" type="button">确认导入</button><button type="button">取消</button></div>
    </div>

    <div class="dfa-error" role="alert">站点仍有关联账号或凭据，不能删除或更换 origin；请先处理站内账号，跨 origin 须新建站点并重新录入凭据</div>
    <div class="dfa-migration">
      <p>检测到旧格式账号。预览迁移不会写入；确认迁移后才转为多站点格式。</p>
      <div class="dfa-actions"><button type="button">预览迁移</button></div>
    </div>
  </div>
  <footer class="dfa-footer">v1.2.0 · 密钥不会存入浏览器缓存</footer>
</div>
</div>
<script>
const btn=document.getElementById('themeBtn'),root=document.documentElement;
btn.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';});
</script>
</body>
</html>
`;
fs.writeFileSync(out, html, 'utf8');
console.log('written', out, html.length, 'bytes; css bytes =', css.length);
