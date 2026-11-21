# GitHub 同类项目与宿主能力调研（1.3.0 backlog 依据）

- 任务：t1（dfa-130-opt 队，只读调研轮）
- 日期：2026-11-21
- 审查对象：参考项目（4 个已读源码 + 4 个已读清单/目录）+ 宿主 `D:\FUGUI\ai\guanfangdsh\dsh\resources\app.asar`（只读扫描）
- 本插件现状基线：`src/style.css` 44 行、`src/client.js` 556 行、`src/index.js` 83 行、`src/host-providers.js` 535 行
- 纪律：本轮**未修改** `src/`、`lib/`、`tests/`、`scripts/`、`package.json`、`dist/`；本文件是本轮唯一新增文件
- 证据标注约定：**【已核实】**=读过源码/读过宿主字节，可复现到文件与行号；**【仅题录】**=只读到 README/目录/仓库元数据，未逐行读实现

---

## 0. 取证方法与可复现命令

宿主 app.asar 的解包全部只读，用本插件已有的两个脚本：

```bash
# 列出 asar 内所有条目（可加正则过滤）
node artifacts/provider-import-2026-11-20/asar-list.cjs "dsh-client-locale"

# 抽取单个文件到 %TEMP%\asar\（只读读源文件）
node artifacts/provider-import-2026-11-20/asar-extract.cjs \
  "dsh/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js" "$TEMP/asar/locale-client.js"
```

本轮实际抽取并逐行读过的宿主文件（全部位于 `%TEMP%\asar\`）：

| 文件 | 行数 | 用途 |
| --- | --- | --- |
| `locale-readme.md` / `locale-client.js` / `locale-index.js` | 148 / 1573 / 28 | locale API 形状与校验行为 |
| `layout-readme.md` / `layout-client.js` / `layout-index.js` | 107 / 720 / 4 | 槽位注册形态与几何 token |
| `theme-readme.md` / `theme-client.js` | — / 120 KB | 主题 token 全集 |
| `renderer-client.js` | 1884 | 槽位 `t` 席绑定与 locale face |
| `sidebar-client.js` | — | `sidebar.footer.action` 槽位声明 |
| `pm-readme.md` / `pm-tools.js` | — / 12 KB | `plugin_manager` 行为约束 |
| `dsh-credentials-readme.md` / `dsh-util-crypto-readme.md` / `dsh-atomic-write-readme.md` / `dsh-plugin-market-readme.md` / `dsh-package-manifest-readme.md` / `secret-mask-readme.md` / `app-boot-readme.md` / `host-plugin.md` | — | 宿主能力面清单 |

---

## 1. GitHub 同类项目调研

### 1.1 g65tph4ycm-svg/dsh-balance-pill 【已核实】

- 仓库：`https://github.com/g65tph4ycm-svg/dsh-balance-pill`，最新 commit `f073cb9f623723e8c061791437c8d23a6d5cd2c9`（2026-10-23，"docs: describe the verified installation path"）
- 本地副本：`.ref/dsh-balance-pill-main/`（client.js 279 行 / index.js 244 行 / locale/zh.json / locale/en.json / package.json / cordis.patch.yml / README.md 全文已读）

| 出处文件:行 | 可借鉴点 | 对本插件的改动建议 | 收益 | 风险 |
| --- | --- | --- | --- | --- |
| `client.js:268-276` | `ctx.slots.inject('shell.overlay', () => ctx.slots.register({name:'shell.overlay', id:'dsh-balance-pill', order:90}, BalancePill))` | 1.3.0 可把悬浮面板从 `sidebar.footer.action`（`src/client.js:553`）**双挂**到 `shell.overlay`，order 取 95–100 与 balance-pill(90) 错开 | 面板可出现在视口任意位置，不再受侧栏宽度约束；与宿主 overlay 层 z-index 体系一致 | 低。`shell.overlay` 是 `kind:'list'` 加法槽（见 2.2），新 id 不替换任何宿主占用；但需 `package.json` 的 `dsh.client.inject` 追加 `@deepseek-ai/dsh-client-ui-layout` |
| `client.js:26-44` | 样式全部 `var(--dsw-alias-*, fallback)` 形式，无一处硬编码色 | 与 4.1 的 style.css token 化合并为同一批次 | 明暗主题自动跟随，无对比度回归 | 低。纯 CSS 改动 |
| `client.js:36` | `:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4D6BFE)}` | 本插件 `style.css:4,9` 用硬编码 `#93a7ff`/`#6b82f5` 画焦点环 | 焦点环与宿主统一 | 低 |
| `client.js:188-196` | 浮球按钮带 `aria-expanded` + `aria-haspopup:'dialog'` + `aria-label`，详情卡 `role:'dialog'`（`client.js:201-205`） | 本插件浮球 `src/client.js:520` 已有 `aria-expanded`，但面板无 `id`、浮球无 `aria-controls` | 补齐 3 个属性即可让屏幕阅读器关联浮球↔面板 | 低 |
| `client.js:150-164` | 点击外部/Escape 关闭卡片的 pointerdown 捕获 + keydown 监听分离 | 本插件 `src/client.js:318-323` 的 Escape 监听挂在 document 冒泡阶段，向导内 Esc 会直接关整面板（对应 ui-ux-review 的 A6） | 改为捕获阶段 + `stopPropagation`，向导内 Esc 只退回上一步 | 低-中。需要新的回归断言 |
| `locale/zh.json` + `locale/en.json`（各 6 行） | `meta.title` / `meta.description` 双语 | 见 4.1 的本地化批次 | 插件在 Plugin Manager/Settings 里显示正确标题 | 低 |
| `package.json:38-45` | `dsh.client.inject: ["@deepseek-ai/dsh-client-ui-layout"]` | 本插件 `package.json` 的 `dsh.client.inject` 目前是空数组 `[]` | 声明依赖后宿主保证 layout 先于本插件挂载 | 低。但需要加 peerDependency 声明（见 3.3） |

**冲突做法（不采纳）**：SSE 长连接 `/dsh-balance-pill/stream`（`index.js:156-186`）+ `agent/status → idle` 触发刷新（`index.js:152-154,205`）。本插件契约是"余额只手动查询，不轮询、不自动重试"（README 1.2.0 升级范围），不采纳。

### 1.2 CaoQiNeng/dsh-deepseek-balance 【已核实】

- 仓库：`https://github.com/CaoQiNeng/dsh-deepseek-balance`，commit `8e6447fd282ec5b18dbc7b54c7f14c7c65348275`（2026-09-06）
- 本地副本：`.ref/dsh-deepseek-balance-main/`（plugin.json / package.json / src/host.js 199 行 / src/client.js 234 行 / docs/ARCHITECTURE.md 全读）

| 出处文件:行 | 可借鉴点 | 对本插件的改动建议 | 收益 | 风险 |
| --- | --- | --- | --- | --- |
| `plugin.json:1-16` | 发布 manifest 约定：`{idPrefix, name, purpose, platform:'dynamic-cordis-plugin', version, entrypoints:{host,client}, installHint, api:{endpoint,docs}}` | **注意**：宿主 asar 内 `plugin.json` 只出现在 `node_modules/openai` 的 `.codex-plugin/plugin.json` 注释里（`asar-grep.cjs "plugin.json"` 命中 2 处，均非宿主插件契约），因此 `plugin.json` **不是** DSH 官方 manifest 格式。本插件不应新增 `plugin.json`，而应走 `package.json` 的 `dsh` 字段（见 3.3） | 避免发布时误导用户 | 低。**本条是排除项，不是采纳项** |
| `src/host.js:165-197` | RPC 三段式：`configure` / `clear` / `refresh`，`refresh` 内 20 秒去重窗口 | 本插件已有 `saveCredential`/`removeCredential`/`selectBalanceCredential`（`src/index.js:55-57`），不需要改 | — | — |
| `src/host.js:45-71` | 响应解析只取白名单叶子字段（`currency`/`total`/`granted`/`topped_up`），不序列化活对象 | 本插件 `src/client.js:39-41` `safeBalanceResult` 已是同样模式 | 已对齐 | 无 |
| `src/client.js:227-232` | `slots.register({name:'shell.overlay', id:'dsw-ds-balance', order:100, label:'DeepSeek 余额'})` | 见 1.1 第 1 行；`label` 字段本插件目前没用（`src/client.js:553` 只给了 `name`/`id`/`order`） | 槽位行有可读名 | 低 |
| `docs/ARCHITECTURE.md`「UI seat」节 | 明确写清"新 id 不替换任何宿主占用（replaceRisk: none）"，并说明 layer 本身 click-through、widget 自己 `position:fixed` + `pointer-events:auto` | 宿主确有 `replaceRisk` 概念（`asar-grep.cjs "replaceRisk"` 在 `dsh-cordis-client-runner/lib/client.js` 多处命中，含 `'none'` 与 `'shadows-shipped-ui'` 两种取值） | 本插件迁移到 `shell.overlay` 前应先核对 `replaceRisk` | 低 |

**冲突做法（不采纳）**：`src/host.js:20` `const secret = { value: '' }` 明文 Key 常驻内存 + `src/client.js:91-99` 客户端 `timer.interval(60000)` 每分钟轮询 + `src/client.js:198` 文案"Key 仅保存在本次运行内存中"。与本插件"DPAPI 加密落盘、明文不回显、不轮询"契约直接冲突，见第 5 节。

### 1.3 V1ki/dsh-plugin-subscriptions 【已核实】

- 仓库：`https://github.com/V1ki/dsh-plugin-subscriptions`，commit `c58464c92f86b03ca99e2706d5573f1db8bcf4fb`（2026-11-20，v0.9.14）
- 读了 `package.json`、`cordis.patch.yml`、`overlay.example.yml`、`src/client/ProviderAccountManager.tsx`（336 行读取）

| 出处文件:行 | 可借鉴点 | 对本插件的改动建议 | 收益 | 风险 |
| --- | --- | --- | --- | --- |
| `src/client/ProviderAccountManager.tsx:76-86` | 对话框打开时记录 `document.activeElement`，卸载时 `previous.focus()` 归还焦点 | 本插件 `src/client.js:139` `close()` 已有 `ball.current?.focus()`，但**视图切换**（编辑器 ↔ 导入两步 ↔ 站点列表）没有焦点迁移/归还（对应 ui-ux-review 的 A2） | 键盘用户在导入向导两步之间不丢失位置 | 低-中。需新增 ref 管理 + 行为断言 |
| `ProviderAccountManager.tsx:243-246` | tabpanel 用 `role="tabpanel"` + `id` + `aria-labelledby` + `tabIndex={0}`；每组用 `fieldset` + `legend` 承载名称 | 本插件导入冲突区 `src/client.js:294-299` 是普通 `div` + `label`，单选组无可访问名（对应 A3） | 冲突单选组有可访问名 | 低 |
| `ProviderAccountManager.tsx:302-316` | 校验失败时 `aria-invalid` + `aria-describedby` 指向 `role="alert"` 的错误节点 | 本插件 `src/client.js:382-398` 的 `reject(message)` 只 `setError`，没有把错误与字段关联 | 表单错误可被辅助技术定位 | 低-中 |
| `package.json` 的 `dsh.client.inject` 含 `@deepseek-ai/dsh-client-locale` | 显式声明 locale 依赖 | 见 4.1 | 见 4.1 | 低 |
| `cordis.patch.yml`（632 B 全文） | bundle 自激活 patch：`insert: [{id, name}]`；注释说明"client 半由 package.json 的 `dsh.client` 声明自动发现" | 本插件 `cordis.patch.yml` 已经是同形状（`- insert: [{id: floating-accounts, name: dsh-floating-accounts}]`），无需改 | 已对齐 | 无 |
| `overlay.example.yml`（402 B 全文） | 给出 `--patch` 覆盖文件用法，`name` 写绝对路径 | 本插件若要给"仅本机目录安装"提供路径，可加同名示例文件 | 低优先 | 低 |

### 1.4 realchendahuang/dsh-provider-studio 【已核实】

- 仓库：`https://github.com/realchendahuang/dsh-provider-studio`，commit `fedf6768aa56fdb7dc751b4c55352ac05dcca865`（2026-11-08）
- 读了 `client.js`（构建产物，含完整中英字典）、`package.json`、`cordis.patch.yml`、仓库树（`assets/icons/` 下 218 个供应商图标）

| 出处文件:行 | 可借鉴点 | 对本插件的改动建议 | 收益 | 风险 |
| --- | --- | --- | --- | --- |
| `client.js`（`Na(e)` 函数） | 客户端字典注册样板：`ctx.locale.register(lo,{zh:Pi,en:Oi})` → `i = ctx.locale.bind(lo)` → 把 `t` 透传给组件 | **这就是宿主 `ctx.locale.register(ns,{zh,en})` 的最小可运行形态**（与 3.1 的签名核实一致） | 见 4.1 | 低 |
| `client.js`（`Na(e)` 末段） | `ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section', id, order:13, label:()=>i('nav'), locale:lo}, ...))` | 本插件可把"账号配置"做成 Settings 页的一个 section（宿主 `settings.section` 是 root 级 slot，见 2.3），与悬浮球并存 | 多一种入口，且天然适配宿主导航/搜索/深链 | 中。需要 `settings.section` 槽位契约核对 + 新增远程方法支持"按需加载" |
| `client.js`（`Si` 组件的 `Ti/Te` 函数） | 未保存草稿写入 `sessionStorage`（**不是** `localStorage`），离开时清理，回归时弹"恢复未保存的修改？" | 本插件浮球位置已用 `localStorage`（`src/client.js:5,481`）——位置是非敏感数据，可保留；但**未来任何草稿类数据（如未保存的站点表单）应走 `sessionStorage`**，与本插件"不存浏览器缓存"契约不冲突 | 减少浏览器持久化的敏感面 | 低-中。属 1.3.0 之后的可选批次 |
| `client.js`（`Co` 组件） | `getDerivedStateFromError` + `componentDidCatch` 的 React ErrorBoundary，配 `role="alert"` 与"重试"按钮 | 本插件渲染树无错误边界，一次渲染异常整个面板白屏 | 单个账号卡出错不再炸掉整面板 | 中。需引入类组件，破坏当前纯函数组件风格 |
| `client.js`（`ha` 组件的 key 输入框） | Key 输入框 `type` 在 `password`/`text` 间切换、`autoComplete:'off'`、`spellCheck:false`、聚焦时才懒加载已存 Key | 本插件 `src/client.js:516` 已经是 `type:'password'` + `autoComplete:'new-password'` + `spellCheck:false`，但**不回显**（更安全，符合本插件契约） | — | 无 |
| `client.js`（`ye`/`ci` 的错误映射） | 错误码 → 字典键映射（`err.*`），文案全部走 `t()` | 见 4.1 | 见 4.1 | 低 |
| `package.json` 的 `dsh.client.inject` 含 `@deepseek-ai/dsh-client-locale`；`files` 含 `locale/*.json` | 双语字典随包发布 | 见 4.1 / 4.3 | 见 4.3 | 低 |

### 1.5 Ox0400/dsh-vault 【已核实（部分）】

- 仓库：`https://github.com/Ox0400/dsh-vault`，commit `deebe535663e17db5daf94683888e17928ec74e6`（2026-10-16）
- 读了 `package.json`（3353 B）、`src/client/locales.ts`（49616 B）、仓库树；**未逐行读** `src/index.ts`（377 KB）、`src/store.ts`（62 KB）

| 出处 | 可借鉴点 | 判定 |
| --- | --- | --- |
| `package.json` | `dsh.client.inject` 声明 4 个宿主包；`dsh.bundle.patch`；`peerDependencies` 精确到 `>=0.2.1-0`；`engines.dsh: ">=3.4.0"` | **本插件的 manifest 应对标**：当前 `package.json` 的 `engines` 只有 `{node}`，**没有 `engines.dsh`**；`peerDependencies` 也没有 `@deepseek-ai/dsh-client-*` 任何一项 |
| `src/client/locales.ts` | 一整个 TS 文件就是 zh/en 双语字典（`const en = {...}` / `const zh = {...}`），组件里 `t('key')` 直取 | 与 provider-studio 同构，证明这是社区主流做法 |
| 仓库树 | `docs/master-key-custody.md`（39767 B）专门讲"谁能读主密钥" | 值得本插件后续写一篇"DPAPI 密钥保管边界"文档，对应发布可信度 |

### 1.6 awesome-dsh-plugin / awesome-dsh-plugins / DSH-Plugins-Marketplace 【仅题录】

| 仓库 | 最新 commit | 性质 | 对本插件的意义 |
| --- | --- | --- | --- |
| `awesome-dsh-plugin/awesome-dsh-plugin` | `7f92a90683d7027e0d696a180bf2c4435cee68f0`（2026-11-20） | 目录型，README.md 4.5 MB / README.zh.md 4.2 MB，内含每插件一个 `owner__plugin.yml` 卡片（如 `leotier196__dsh-lifeboard.yml` 439 B） | 插件要被索引，需要一份"卡片式"元数据；本插件 1.3.0 打包时应准备同形状的条目文件 |
| `kejixiaoliang/awesome-dsh-plugins` | 未取到 commit | 目录型 | 同上 |
| `bradeGithub/DSH-Plugins-Marketplace` | 未取到 commit | 市场型（209★） | 同上 |
| `AwesomeHou/dsh-plugin-marketplace`（35★）、`AI-Scarlett/DSH-Store` | 未取到 commit | 市场型 | 同上 |

**宿主侧市场契约已核实**（`%TEMP%\asar\dsh-plugin-market-readme.md`）：`plugin_market` 工具只读用户配置的 index URL，条目里每个 version 带 `target` 与 `registry`，供 `plugin_manager` 的 `install_bundle` 使用；`marketInstallTarget` 对 npm 生成 `name@version`，对 Git 包目录生成 `git+<url>.git#<commit>` 并带 `&path:/<path>`。**这意味着本插件若要进市场，需要 GitHub 上的真实仓库 + npm 发布（或至少 npm 包名），不能只放离线 zip。**

---

## 2. 宿主能力核实（app.asar 只读扫描）

### 2.1 `@deepseek-ai/dsh-client-locale` —— 字典 API 确切形状 【已核实】

**包存在**：`asar-list.cjs "dsh-client-locale"` 命中 9 个文件，含 `lib/client.js`（62962 B / 1573 行）、`README.md`、`README.zh.md`、`locale/{en,zh}.json`。

**确切签名**（`%TEMP%\asar\locale-client.js:1387-1413`）：

```js
register(ns, localeOrDicts, dict) {
  const pairs = typeof localeOrDicts === "string" ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts);
  for (const [locale] of pairs) if (!LOCALE_ID_PATTERN.test(locale)) throw new Error(`locale id "${locale}" is not a BCP 47-style tag`);
  let locales = this.dicts.get(ns);
  ...
  for (const [locale] of pairs) if (locales.has(localeKey(locale))) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`);
  for (const [locale, entries] of pairs) locales.set(localeKey(locale), entries);
  this.publish(this.snapshot.active, false);
  return () => { /* 卸载时只移除自己注册的那份 entries */ };
}
```

要点（逐条可复现）：

| 结论 | 证据行 | 说明 |
| --- | --- | --- |
| `register(ns, {zh, en})` 双参形态合法 | `locale-client.js:1388`（`Object.entries(localeOrDicts)`） | `dict` 第三参只在单语言形态 `register(ns,'ja',{...})` 时使用 |
| locale id 必须匹配 BCP 47 风格 | `locale-client.js:9,1389` | `LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u` |
| 同一 ns 的同一 locale **不可重复注册**（抛错） | `locale-client.js:1395` | 插件重载/重复 apply 会抛 `locale namespace "..." already has locale "..."`，必须 try/catch 或保证只注册一次 |
| 注册返回 disposer，且只移除自己那一份 | `locale-client.js:1398-1412` | `if (owner.get(key) === entries)` 才删 |
| 注册会推进 snapshot revision（触发已挂载 outlet 重渲染），但**不**发 `locale/change` 事件 | `locale-client.js:1436-1455` | 只有切换语言才 `emit("locale/change")`；字典注册只 bump revision（`locale-client.js:1397` `this.publish(this.snapshot.active, false)`） |
| `bind(ns)` 返回**稳定引用**的翻译函数 | `locale-client.js:1414-1422` | `this.bound` Map 缓存，`(key, params) => this.translate(ns, key, params)` |
| 查不到键时回落顺序 | `locale-client.js:1423-1435` | 先当前 ns 的 fallback 链 → 再 `common` ns → 最后**直接显示 key 本身**（不是显示空） |
| 模板参数替换 | `locale-client.js:1427` | `template.replace(/\{(\w+)\}/g, ...)`，占位符形如 `{name}` |
| `resolveText(text)` 面向 `LocalizedText`（插件元数据），**不查** ns 字典 | `locale-client.js:1241-1244` | 用于 `locale/en.json` 里的 `meta.title`/`meta.description` 多语言映射 |
| 键的类型化校验在**编译期** | `README.md:38` | "the compiler checks every key against the namespace's typed key union and requires both shipped locales" —— 本插件是纯 JS 无 TS，**只能靠自检脚本保证 zh/en 键集合一致** |

**宿主强制**：`README.md:84` 与 `README.zh.md` 指出 "Product-authored Client UI text must enter through these typed dictionaries or an already-localized primitive prop; `verify-client-ui-i18n` enforces that source ownership"。→ 本插件 1.3.0 若接入 locale，**所有**客户端文案都要迁进字典，否则属于"未走字典的文案"。

### 2.2 `@deepseek-ai/dsh-client-ui-layout` —— 槽位与几何 token 【已核实】

**包存在**：`asar-list.cjs "dsh-client-ui-layout"` 命中 10 个文件（`lib/client.js` 32834 B / 720 行、`README.md`、`README.zh.md`、`locale/{en,zh}.json`）。

**槽位注册形态**（`%TEMP%\asar\layout-client.js:623-653`）：

```js
const disposeRegistration = ctx.slots.register({
  name: "root",
  locale: "common",
  children: {
    sidebar:   { kind: "single", scope: "root" },
    main:      { kind: "keyed",  scope: "root" },
    rightbar:  { kind: "single", scope: "root" },
    "shell.bottom":  { kind: "single", scope: "root" },
    "shell.overlay": { kind: "list",   scope: "root" },
    "shell.leading": { kind: "single", scope: "root" },
  },
  store
}, AppFrame);
```

| 结论 | 证据 |
| --- | --- |
| `shell.overlay` 是 **root 级 list 槽**（可叠加多个占用者） | `layout-client.js:643-646` |
| `shell.bottom` 是 root 级 single 槽，跨三列全宽 | `layout-client.js:639-642`；`README.md:34` |
| overlay 层 `pointer-events:none`，其子元素各自 `pointer-events:auto` | `layout-client.js:73`（CSS 字符串 `.mP3x-q_overlayLayer{...pointer-events:none;...} .mP3x-q_overlayLayer>*{pointer-events:auto}`） |
| `shell.overlay` 渲染点 | `layout-client.js:313` `renderSlot("shell.overlay", {})`，`:314` `shell.leading`，`:347` `shell.bottom` |
| `ctx.layout` 提供的方法 | `README.md:32`：`selectPanel(id)`、`openRightbar(track, fullscreen)`、`closeRightbar()`、`toggleSidebar()` |

**几何 token**（`%TEMP%\asar\layout-client.js:73` 的 CSS 串 + `README.md:39-43`）：

| token | 定义 | 值/语义 |
| --- | --- | --- |
| `--dsh-frame-top-clearance` | `html[data-platform=darwin]{--dsh-frame-top-clearance:48px}`；`html[data-windows-titlebar]{--dsh-frame-top-clearance:var(--dsh-windows-titlebar-height)}` | 窗口顶部预留带高度 |
| `--dsh-frame-overlay-top` | `html[data-platform=darwin],html[data-windows-titlebar]{--dsh-frame-overlay-top:calc(var(--dsh-frame-top-clearance) + 20px)}`；全屏时 `20px` | 对话框/菜单 overlay 的安全顶部距 |
| `--dsh-frame-chrome-top` | `html[data-windows-titlebar]{--dsh-frame-chrome-top:var(--dsh-windows-titlebar-height)}`；全屏 `0px` | 模态遮罩绘制时排除 Windows 标题栏 |
| `--dsh-frame-leading-clearance` | `html[data-platform=darwin][data-sidebar-collapsed]{--dsh-frame-leading-clearance:160px}` | macOS 隐藏侧栏时左上角让位 |
| `--dsh-windows-content-radius` | `[data-windows-titlebar]` 分支 | 左上角 16px 圆角 |

**普通 Web 视口不定义这些 token**（`README.md:43`："Plain browser documents publish none of these values."）→ 本插件 `style.css:5` 的 `top:max(16px,var(--dsh-frame-chrome-top,0px))` 在纯 Web 下退化为 16px，在 Desktop 下才有真实让位。

**主题 token 全集**（`%TEMP%\asar\theme-client.js` 实测存在的 `--dsw-alias-*`）至少包含：

```
--dsw-alias-bg-base / bg-layer-1 / bg-layer-2 / bg-layer-3 / bg-overlay / bg-skeleton / bg-mask-1..3
--dsw-alias-border-l1 / l2 / l3 / l4 / border-inverted
--dsw-alias-label-primary / -secondary / -tertiary / -caption / -dimmed / -primary-dimmed
--dsw-alias-brand-primary / brand-text / link
--dsw-alias-state-business-primary / state-error-primary / state-error-secondary
--dsw-alias-state-success-primary / -secondary / -tertiary
--dsw-alias-state-warn-primary / -secondary / -tertiary / state-warn-label
--dsw-alias-state-idle-primary
--dsw-alias-button-primary-fill / -hover / button-ghost-active-fill ...
--dsw-elevation-stroke / -stroke-color / -panel / -prominent / -soft
--dsw-focus-ring-color / --dsw-focus-ring-width
--dsw-specific-menu / --dsw-menu-backdrop-filter
```

（`asar` 内 `--dsw-alias-state-warn-primary` 等 token 全部实测存在；`--dsw-focus-ring-color` 的解析值见 `theme-readme.md:66`：浅色 `#4176E6`、深色 `#7AAAFF`；`--dsw-focus-ring-width` 标准 2px。）

**滚动条**：`theme-readme.md:64` 指出 `--dsw-alias-scrollbar-*` token 由 `scrollbar.css` 消费、由 `design-platform.css` 声明。

### 2.3 `plugin_manager` 行为约束与 manifest 约定 【已核实】

**工具契约**（`%TEMP%\asar\pm-tools.js:75-146`）：

| 事实 | 证据行 |
| --- | --- |
| 工具名 `plugin_manager`，动作枚举：`list_plugins` / `list_bundles` / `set_plugin` / `set_bundle` / `install_bundle` / `remove_bundle` / `list_version_exemptions` / `set_version_exemption` | `pm-tools.js:78` |
| 每个动作都要 `danger-full-access` 权限或用户批准 | `pm-tools.js:92-98` |
| `install_bundle` 的 `target` 是"package spec" | `pm-tools.js:79, 131-140` |
| `remove_bundle` 的 `target` 是 **bundle 名**（不是包名） | `pm-tools.js:139-142` |
| 已安装的包再装 → 报 `already-installed`，须先 `remove_bundle` | `pm-tools.js:12` |
| `install_bundle` 可带 `approvedBuilds`（用户逐个批准构建脚本名） | `pm-tools.js:83`、`pm-readme.md:64` |
| 未满足 `engines.dsh`（或 peer 依赖）→ **在 pnpm 运行前**就拒绝，什么都不下载 | `pm-readme.md:69` |
| 安装失败/取消 → 恢复 `package.json` 与 `pnpm-lock.yaml` 快照 | `pm-readme.md:60, 104, 162` |
| 无 HMR 时，删除正在运行的 bundle 会报 `restart-required` | `pm-readme.md:52, 100` |
| `install_bundle` 返回 `restartReason`：`no-hmr` / `package-moved` / HMR pending | `pm-readme.md:100` |

**manifest 约定**（`%TEMP%\asar\manifest-readme.md` = `@deepseek-ai/dsh-package-manifest`）：

```
DshPackageManifest: { name, version, engines:{node, npm?, dsh?}, dsh:{ manifestVersion?, bundle?:{patch}, client? } }
DshClientManifest: { platform: 'web', inject?: string[] }
```

- `dsh.manifestVersion` 是**格式标识**，声明值 `1`，与 npm 版本、Session 格式版本无关（`manifest-readme.md:52`）
- `engines.dsh` 是 SemVer range，可含精确 prerelease（`manifest-readme.md:53`）
- `dsh.bundle.patch` 是一个 patch 路径或有序列表，相对包根（`manifest-readme.md:46`）
- `LocalizedText` 可为字面量或语言映射，**必须有 en 回落**（`manifest-readme.md:55`）
- `PluginLocalizedMeta` 可带 `meta.title` / `meta.description` / 图标 data URL（`manifest-readme.md:55`）
- 
- 兼容性是**声明式**的：安装器/加载器**不强制** `dsh.manifestVersion` 或 `engines.dsh`；声明 range 不会拒绝不兼容宿主，也不校验 SemVer 语法（`manifest-readme.md:93`）

**插件显示元数据的读取规则**（`%TEMP%\asar\host-plugin.md:29-53`，宿主自带的插件开发技能文档）：

- `locale/en.json` 写 `meta.title` / `meta.description`；其他语言同结构（`host-plugin.md:33`）
- 需导出 `./locale/*.json` 与 `./icon`；或包根在 `package.json` 顶层声明 `icon`（`host-plugin.md:35,51`）
- 图标限 SVG/PNG/JPEG/WebP，≤256 KiB，须在包内（`host-plugin.md:51`）
- 缺失字段回落 `package.json` 的 `name` / `description`（`host-plugin.md:51`）
- 读元数据的实现：`dsh-app-boot/lib/index.js` 的 `readPluginMeta(specifier, parentURL)` / `ctx.pluginPackages.metaOf(...)`（`asar-grep.cjs "metaOf"` 命中）；客户端消费方：`dsh-client-ui-plugin-manager/lib/client.js` 的 `packageText(pkg, resolveText)`（`asar-grep.cjs "meta.title"` 命中）

**结论**：`plugin.json`（CaoQiNeng 那套 `{idPrefix,purpose,platform:'dynamic-cordis-plugin',entrypoints}`）**不是** DSH 官方 manifest，宿主 asar 内仅在 `node_modules/openai` 的注释里出现 `plugin.json` 字样。本插件走 `package.json` 的 `dsh` 字段 + `cordis.patch.yml`。

### 2.4 其他已核实的宿主能力面 【已核实】

| 包 | 关键能力 | 证据 |
| --- | --- | --- |
| `@deepseek-ai/dsh-credentials` | `ctx.credentials.describe(ref)` 返回 `{configured, source?, writable}` **绝不返回值**；`resolve(ref)` 返回 `{value, source}`；`describeRecord` / `listRecords` / `modifyRecord` / `deleteRecord`；事件 `credentials/reference-updated` / `credentials/record-updated` | `dsh-credentials-readme.md:50-58, 69-78, 113-123` |
| `@deepseek-ai/dsh-util-crypto` | `randomUUID()`（基于 `crypto.getRandomValues`；`crypto.randomUUID` 在非安全上下文不可用）、`bytesToBase64` | `dsh-util-crypto-readme.md:12, 34-42` |
| `@deepseek-ai/dsh-atomic-write` | 原子写文件（宿主已有实现，本插件 `src/vault.js:236-246` 自己实现了 tmp+rename） | `dsh-atomic-write-readme.md`（9557 B） |
| `@deepseek-ai/dsh-client-ui-secret-mask` | 识别 `sk-…`/`AIza…`/`ghp_…`/`AKIA…`/`eyJ…`/私钥块/`postgres://user:pass@host/db` 等已发布格式并遮罩显示 | `secret-mask-readme.md:12, 35-45` |
| `@deepseek-ai/dsh-client-ui-settings` | `settings.section` 等槽位类型；`ctx.configForms.describe()`；`whileServed(namespaces, register)` | `settings-readme.md:40-44` |
| `@deepseek-ai/dsh-client-ui-renderer` | 槽位注册项若声明 `locale: NS`，渲染器注入 `t` 席；`installLocale(face)` 是 boot-once | `renderer-client.js:742-746, 949-952, 1451-1453` |
| `@deepseek-ai/dsh-plugin-market` | `plugin_market` 只读工具；条目 version 带 `target`/`registry` 供 `install_bundle`；Git 包目标为 `git+<url>.git#<commit>&path:/<path>` | `dsh-plugin-market-readme.md:42, 62, 77` |
| `@deepseek-ai/dsh-client-ui-sidebar` | `sidebar.footer.action` 是 **root 级 list 槽**（`kind:"list"`），`inject: injectProps` 传 `wide` 标志 | `sidebar-client.js:643-645, 515` |
| `@deepseek-ai/dsh-app-boot` | `readPluginMeta` / `ctx.pluginPackages.metaOf` 读安装包展示文本而不激活插件 | `app-boot-readme.md:87` |
| `@deepseek-ai/dsh-host-plugin-inventory` | 库存条目带 `meta`（来自 `packages.metaOf`） | `plugin-inventory.js:127, 147` |
| `@deepseek-ai/dsh-client-ui-shortcuts` | 宿主快捷键注册能力（本轮未细读） | `shortcuts-readme.md`（8193 B，已提取） |

---

## 3. 「宿主已提供但本插件尚未使用」能力清单（按性价比排序）

> 这是本轮最有价值的产出。每条都给出"宿主证据 → 本插件现状证据 → 改动建议 → 收益 → 风险 → 工作量"。

### P0-1　客户端 locale 字典（`@deepseek-ai/dsh-client-locale`）

- **宿主证据**：`locale-client.js:1387-1413`（`register(ns,{zh,en})`）、`:1414-1422`（`bind(ns)`）、`:1423-1435`（查不到显示 key）、`README.md:38`（类型化键 + 强制双语）、`README.md:84`（`verify-client-ui-i18n` 强制文案走字典）、`renderer-client.js:742-746`（声明 `locale: NS` 的槽位自动获得 `t` 席）
- **本插件现状**：`src/client.js` 全量硬编码中文——含 CJK 的单引号字符串 **236 条**，另有含中文的模板字面量 **32 处**；`toLocaleString('zh-CN')` 硬编码 3 处（`src/client.js:84, 90, 314`）；`package.json` 的 `dsh.client.inject` 为 `[]`
- **改动建议**：
  1. 新建 `src/locale/zh.json` + `src/locale/en.json`（放 `locale/` 目录，键集一一对应）
  2. `src/client.js` 顶部 `ctx.locale.register('floatingAccounts', {zh, en})` + `const t = ctx.locale.bind('floatingAccounts')`
  3. 把 236 条中文字面量 + 32 处模板字面量换成 `t('key')`；`toLocaleString('zh-CN')` 改成跟随 `ctx.locale` 当前语言
  4. `package.json` 的 `dsh.client.inject` 加 `@deepseek-ai/dsh-client-locale`
- **收益**：与宿主语言开关联动；消除 ui-ux-review 的 E2（4–6h 那条）；插件标题在 Plugin Manager 里正确显示
- **风险**：**中**。改动面最大（249 处），且需保证 zh/en 键集完全一致，否则 `translate` 回落到 `common` 再回落到显示 key 本身（`locale-client.js:1425`）——界面会直接显示英文键名。建议拆成两步：先迁 20 条最高频文案（标题/按钮/错误）验证管线，再全量
- **工作量**：4–6h（含键集自检脚本）

### P0-2　`shell.overlay` 槽位（`@deepseek-ai/dsh-client-ui-layout`）

- **宿主证据**：`layout-client.js:643-646`（root 级 list 槽）、`:313`（渲染点）、`:73`（overlay 层 `pointer-events:none`，子元素 auto）；`README.md:34`
- **本插件现状**：`src/client.js:553` 只注册 `sidebar.footer.action`（root 级 list 槽，`sidebar-client.js:643-645`），面板用 `createPortal(..., document.body)` + `position:fixed` 自行定位（`src/client.js:495-496, 520`）
- **改动建议**：在 `shell.overlay` 再注册一份（`order:95`，与 balance-pill 的 90 错开），并把 `dsh.client.inject` 加上 `@deepseek-ai/dsh-client-ui-layout`
- **收益**：悬浮面板可脱离侧栏宽度；层级与宿主 overlay 一致（宿主 overlay 层 z-index 20，本插件 `style.css:2,5` 用了 `z-index:2147483102/2147483101` 这种极大值，是硬编码隐患）
- **风险**：**低-中**。需要确认与 `sidebar.footer.action` 双挂时的行为（是否两个入口同时渲染）；建议先只保留 overlay，保留侧栏按钮作为"展开"入口
- **工作量**：1–2h

### P0-3　主题 token 化（`--dsw-alias-*` / `--dsw-focus-ring-*` / `--dsw-elevation-*`）

- **宿主证据**：2.2 节的 token 全集；`theme-readme.md:66`（`--dsw-focus-ring-color` 浅色 `#4176E6` / 深色 `#7AAAFF`，`--dsw-focus-ring-width` 2px）；`theme-readme.md:84`（`--dsw-elevation-stroke/-panel/-prominent/-soft` 阴影体系，`--dsw-menu-backdrop-filter` 磨砂）
- **本插件现状**：`src/style.css` 硬编码 hex **26 种 / 共 117 处**（`#b08a1e` ×15、`#d9deea` ×14、`#697589` ×11、`#f5f7fb` ×10、`#b73131` ×10、`#19764b` ×8、`#6b82f5` ×5、`#5264dc` ×3 …）；焦点环硬编码 `#6b82f5`/`#93a7ff`；磨砂硬编码 `blur(16px) saturate(1.18)`
- **改动建议**：把所有硬编码色替换为 `var(--dsw-alias-*, <原值>)` 形式，保留原值作 fallback；焦点环改用 `var(--dsw-focus-ring-color, ...)` + `var(--dsw-focus-ring-width, 2px)`；阴影改 `--dsw-elevation-*`；磨砂改 `var(--dsw-menu-backdrop-filter, blur(16px) saturate(1.18))`
- **收益**：明暗主题自动跟随；与宿主主界面观感统一；修掉 ui-ux-review 的 F1（P0）
- **风险**：**低**。纯 CSS，`var()` 带 fallback 不会破坏现有渲染；唯一要小心的是 `--dsw-alias-bg-layer-1/2/3` 在浅色主题下同值（captain 已实测），所以**不能**用 layer-1/2/3 做卡片层级区分——见 P0-4
- **工作量**：1.5h

### P0-4　卡片层级（浅色主题 layer 同值问题）

- **宿主证据**：`theme-client.js` 内 `--dsw-alias-bg-layer-1/2/3` 均存在；captain 实测浅色主题下三者同为 `neutral-bluish-00`，仅深色有 875/850/800 三级差
- **本插件现状**：`src/style.css:11` 的 `.dfa-account`（账号卡）用 `--dsw-alias-bg-layer-2,#fff`，`:18` 的 `.dfa-site`（站点卡）用 `--dsw-alias-bg-layer-1,#f5f7fb`，而 `:5` 的 `.dfa-panel` 面板底也是 `--dsw-alias-bg-layer-2`。浅色主题下三者同值 → 面板底、站点卡、账号卡**完全同色**；深色主题下 layer-1(875) 比 layer-2(850) 更深，站点卡反而比面板底更深，层级语义与浅色相反
- **改动建议**：层级改用 `--dsw-alias-border-l2`/`l3` + `--dsw-elevation-soft`/`-panel` 表达，而不是背景层号；建议 **账号卡改为 transparent（继承面板底）**，**站点卡保留 layer-1 但加深描边到 border-l2**，使浅色/深色下层级方向一致
- **收益**：修掉 ui-ux-review 的 F2
- **风险**：低
- **工作量**：1h

### P1-1　`settings.section` 入口（`@deepseek-ai/dsh-client-ui-settings`）

- **宿主证据**：`settings-readme.md:40-44`（`settings.section` 贡献点、`whileServed`）；provider-studio `client.js` 的 `ctx.slots.inject('settings.section', ...)` 实测形态（`order`, `label:()=>t('nav')`, `locale:NS`）
- **本插件现状**：只有悬浮球 + 侧栏 footer 入口（`src/client.js:553, 520`）
- **改动建议**：新增一个只读/轻量的 Settings section 入口，主面板仍留在悬浮球
- **收益**：符合宿主信息架构；设置页可搜索到本插件
- **风险**：**中**。宿主 Settings 页对每个 section 有完整契约（`settings.section` + 可能需要 `settings.plugins.tab`），且需要新的远程方法做按需加载；不适合放进 1.3.0 低风险批次
- **工作量**：3–4h（建议列为 1.3.0 之后的 P1）

### P1-2　`ctx.credentials` 凭据服务（`@deepseek-ai/dsh-credentials`）

- **宿主证据**：`dsh-credentials-readme.md:50-58`（`describe`/`resolve`/`set`/`unset`）、`:69-78`（records API）、`:113`（"Configuration carries references, never secrets"）、`:121-123`（两个变更事件）
- **本插件现状**：`src/host-providers.js:10-17` 说明"列出从不用凭据值；hasKey 优先用 credentials 服务的 describe()，回落读 .credentials.yaml 的 KEY-NAME 集合"——**已经在用宿主的 credentials 服务做 hasKey 判定**，但**自己**用 DPAPI 存了一份密文 vault
- **改动建议**：**不要**改存储层（本插件的 DPAPI 方案是安全契约的一部分）；但可借 `describe()` 的 `source`/`writable` 字段，在导入向导里把"Key 状态依据"说得更准（当前 `src/client.js:289` 只显示 `hasKeyBasis`）
- **收益**：导入向导信息更准；未来若要支持"引用宿主凭据而非复制一份"，有现成 API
- **风险**：**中**。改存储层等于改安全契约；只做展示层增强则风险低
- **工作量**：展示层 1h / 存储层迁移 8h+（不建议在 1.3.0 做）

### P1-3　`ctx.shortcuts` 快捷键（`@deepseek-ai/dsh-client-ui-shortcuts`）

- **宿主证据**：`shortcuts-readme.md`（8193 B，已提取）；宿主自己在用：`layout-client.js:654-688` 注册 `sidebar.left.toggle`（`KeyB` + mod，含 `regions:["page","editable"]`、`modals:[]`）
- **本插件现状**：浮球位置只能鼠标拖（`src/client.js:468-482`），键盘用户无法移动；`style.css:2` 有 `cursor:grab`、`touch-action:none`
- **改动建议**：注册一个"切换账号面板"快捷键（如 `Alt+A`），以及浮球方向键移动
- **收益**：ui-ux-review 的 A1（键盘移动/复位）；同时解决"浮球误拖到角落找不回来"
- **风险**：**中**。快捷键与宿主/其它插件可能冲突；需查宿主已有键位表
- **工作量**：2h

### P1-4　`@deepseek-ai/dsh-atomic-write` 原子写

- **宿主证据**：`dsh-atomic-write-readme.md`（9557 B，已提取）
- **本插件现状**：`src/vault.js:236-246` 自己实现了 tmp + `fs.rename` + 事务锁
- **改动建议**：可换用宿主包，减少自研代码面；但宿主包会引入运行时依赖
- **收益**：代码量减少；行为更贴近宿主
- **风险**：**中**。会改 `src/vault.js` 的核心写入路径，且现有 `tests/vault*.test.mjs` 断言基于当前实现；**不建议在 1.3.0 动**
- **工作量**：3h（延后）

### P2-1　`@deepseek-ai/dsh-util-crypto` 的 `randomUUID`

- **宿主证据**：`dsh-util-crypto-readme.md:12, 41`（`crypto.randomUUID` 是 secure-context-only API，非安全上下文没有；仓库级 lint 规则 `no-restricted-properties` 指向本包）
- **本插件现状**：`src/vault.js:3` 用 `node:crypto` 的 `randomUUID`——**服务端 Node 场景，`crypto.randomUUID` 可用**，本条只对客户端代码有约束
- **改动建议**：仅当未来在客户端生成 id 时才需要；当前不需要
- **风险**：无
- **工作量**：0（仅登记）

### P2-2　`@deepseek-ai/dsh-client-ui-secret-mask`

- **宿主证据**：`secret-mask-readme.md:35-45`（识别格式清单）
- **本插件现状**：密钥输入框是 `type:'password'`（`src/client.js:516`），从不回显，**没有**明文进入会话的可能
- **改动建议**：无需改动；仅在用户手动把 key 贴进对话时由宿主遮罩
- **风险**：无
- **工作量**：0（仅登记）

### P2-3　`engines.dsh` 与 `peerDependencies` 声明

- **宿主证据**：`manifest-readme.md:53`（`engines.dsh` 是 SemVer range）、`pm-readme.md:69`（**未满足 `engines.dsh` 或 peer 依赖会在 pnpm 运行前拒绝，什么都不下载**）
- **本插件现状**：`package.json` 的 `engines` 只有 `{node:"^22.19.0 || >=24"}`，**没有 `engines.dsh`**；`peerDependencies` 只有 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-typert-protocol`、`react`、`react-dom`
- **改动建议**：加 `"dsh": ">=0.2.1-rc.3"`（与宿主当前 `0.2.1-rc.3` 对齐）与 `dsh.manifestVersion: 1`；若 1.3.0 接入 locale/layout，则把 `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-layout` 加入 `peerDependencies`
- **收益**：不兼容的宿主在安装前就被拒，而不是装完运行时报错；发布元数据更规范
- **风险**：**低**。但**版本下界写死会挡住老宿主用户**——需与 captain 确认目标宿主版本线
- **工作量**：0.5h

### P2-4　插件显示元数据与图标

- **宿主证据**：`host-plugin.md:29-53`（`locale/en.json` 的 `meta.title`/`meta.description`、`./icon` 导出、≤256 KiB、包根 `icon` 优先）
- **本插件现状**：`package.json` 的 `files` 数组**没有** `locale/*.json`，也没有 `icon`；`exports` 只有 `./`、`./client`、`./cordis.patch.yml`、`./package.json`
- **改动建议**：1.3.0 发布批次加 `locale/en.json` + `locale/zh.json`（含 `meta.title`/`meta.description`）与 `icon.svg`，并在 `exports`/`files` 中登记
- **收益**：Plugin Manager / Settings 显示正确标题与图标；市场索引能识别
- **风险**：低。图标须自绘或用许可兼容素材
- **工作量**：1h

---

## 4. 「不建议采纳」——与本插件安全契约冲突的做法（点名排除）

> 本插件的不可协商契约（来自 README 1.2.0 升级范围与 `src/host-providers.js:1-18` 的文件头注释）：
> **密钥由 Windows DPAPI 当前用户加密落库；明文不回显、不入浏览器缓存；余额只手动查询，不轮询、不自动重试、不调用模型；导入需两段确认；清单与导入零新增联网。**
> 下列做法全部**点名排除**，并写明理由。

### 4.1 明文 Key 常驻内存（dsh-deepseek-balance）——排除

- **出处**：`CaoQiNeng/dsh-deepseek-balance` `src/host.js:20` `const secret = { value: '' }`；`src/host.js:170` `secret.value = k`
- **理由**：本插件要求密钥 DPAPI 加密持久化；宿主进程内存里的明文常量会被 core dump / 内存读取 / 崩溃报告带出。dsh-deepseek-balance 自己也承认这是权衡（其 UI 文案 `src/client.js:198` 明写"Key 仅保存在本次运行内存中"），但**本插件的卖点恰恰是加密落库**，照抄等于取消卖点并降低安全基线
- **同时排除**：`src/client.js:199-201` 的 `<input type="password">` 明文 Key 输入框 + `src/host.js:165-180` 的 `ds-balance/configure` RPC 把明文 Key 从浏览器送进宿主——本插件的凭据写入只走 `saveCredential`，且浏览器端从**不回显**明文

### 4.2 浏览器侧直接发起外部请求 —— 排除

- **出处**：`dsh-balance-pill` `client.js:130` `new EventSource(STREAM_PATH)` + `client.js:168` `fetch(STREAM_PATH, {method:'POST'})`；`dsh-deepseek-balance` `src/client.js:80/93/106/123` 的 `host.call('ds-balance/*')` 走包私有 RPC
- **理由**：两者的对外请求都由**宿主**发起（`dsh-balance-pill` 的 `index.js:73-74` `ctx.deepseekAccount.getBalance(client)`；`dsh-deepseek-balance` 的 `src/host.js:90-99` `subprocess.spawn` argv 数组），**浏览器从不直接拿 Key 访问第三方**。本插件同构：浏览器只传 `{id, revision}`（`src/client.js:158`、`:181`），Key 由宿主从 vault 读取后使用
- **要排除的变体**：任何"把 Key 传给前端让它自己 fetch"的方案；`dsh-deepseek-balance` 的 `src/host.js:114-121` 回落路径 `shell.resolve({command: "curl ... -H '" + header + "' ..."})` 是**字符串拼接**（虽靠 `/^[A-Za-z0-9_.\-]{10,}$/` 白名单兜底，但仍是拼接式命令），本插件不用 shell 通道，**不引入**

### 4.3 轮询与自动刷新 —— 排除

- **出处**：`dsh-deepseek-balance` `src/client.js:91-99` `timerSvc.interval(..., 60000)`，UI 文案 `src/client.js:195` "每 60s 自动刷新"
- **理由**：本插件契约明写"余额只手动查询，不轮询、不自动重试"。轮询会把"用户主动查询"变成"后台持续对第三方平台发请求"，在用户不知情时消耗对方配额、延长 Key 暴露窗口，并在本插件的审计口径下无法解释
- **同时排除**：`dsh-balance-pill` 的 SSE 常连 + `agent/status → idle` 触发刷新（`index.js:152-154, 205-211`）与 `keepaliveTimer`（`index.js:195-203`，每 25 秒写 `: ping`）。虽然它"不轮询"（只在订阅、用户操作、对话结束时推），但对本插件而言仍是**非用户触发的外部请求**，与"余额仅手动查询"冲突

### 4.4 绕过两段确认的一次性导入 —— 排除

- **出处**：`dsh-balance-pill` 无导入功能；`dsh-deepseek-balance` `src/host.js:165-180` 的 `configure` 是"填 Key 即存即查"的单步交互（`src/client.js:206-214` "保存并查询"一按钮）
- **理由**：本插件 1.2.0 的供应商导入是"只读列清单 → 勾选 → 预览变更清单 → 逐字确认『确认导入』"（`src/client.js:249-274`，`confirmText:'确认导入'` 见 `src/host-providers.js:24`）。任何"一键导入全部供应商"的做法都必须排除
- **同时排除**：`dsh-deepseek-balance` `src/host.js:194` 的 20 秒去重窗口（`if (!force && last.ok && Date.now() - last.at < 20000) return snapshot()`）——它是缓存命中优化，不是安全机制；本插件不需要

### 4.5 用 `plugin.json` 作为发布 manifest —— 排除

- **出处**：`CaoQiNeng/dsh-deepseek-balance` `plugin.json:1-16`（`{idPrefix:'dsbal', platform:'dynamic-cordis-plugin', entrypoints:{host,client}, installHint, api:{endpoint,docs}}`）
- **理由**：宿主 asar 只读扫描（`asar-grep.cjs "plugin.json"`）只在 `node_modules/openai` 的 `.codex-plugin/plugin.json` **注释**里出现 2 次，**没有任何宿主代码读取插件根目录的 `plugin.json`**；官方 manifest 契约是 `package.json` 的 `dsh` 字段（`@deepseek-ai/dsh-package-manifest`，见 2.3）。新增 `plugin.json` 会被用户误认为官方格式
- **附带排除**：`platform:'dynamic-cordis-plugin'` 这条路径本身——那是被动注入的 dynamic Cordis 插件（需人工把函数体粘进 `cordis_define`），与本插件"独立 bundle + `cordis.patch.yml` 自激活"的形态不同

### 4.6 明文落盘的会话草稿（provider-studio）——部分排除

- **出处**：`realchendahuang/dsh-provider-studio` `client.js` 的 `Ti`/`Te`/`Ii` 函数，把供应商草稿写进 `sessionStorage`（key 前缀 `dsh-provider-studio:draft:`）
- **理由**：草稿里**含 API Key 明文**（其 Key 输入框 `ha` 组件把明文放进 draft，`client.js` 中 `H()` 读取已存 Key 并 `L(f?l:""` 写入 draft）。本插件明文密钥只在 `src/client.js:129` 的 `clearSecrets()` 生命周期内存活，且 `src/client.js:376` 在 finally 里 `delete payload.secret/apiKey/groupKey`
- **可借鉴的部分**：**若** 1.3.0 之后要加"未保存表单草稿恢复"，草稿必须**排除密钥字段**再落 `sessionStorage`，且用 `sessionStorage` 而非 `localStorage`（`localStorage` 跨会话存活，暴露面更大）

### 4.7 硬编码 z-index 极大值 —— 排除（本次不采纳为"照抄"）

- **出处**：本插件 `src/style.css:2` `z-index:2147483102`、`:5` `z-index:2147483101`
- **理由**：这不是从参考项目抄来的，是本插件自己的历史写法。参考项目都用**小整数**：`dsh-balance-pill` `client.js:21` `z-index:46`、`:47` `z-index:47`；`dsh-deepseek-balance` `src/client.js:22` `z-index:2147483000`（这一条**也建议排除**，它同样是极大值）。宿主 overlay 层是 `z-index:20`（`layout-client.js:73`）
- **结论**：1.3.0 迁到 `shell.overlay` 后应改用宿主层级的相对小值，让宿主 overlay 层负责层序

---

## 5. 1.3.0 候选 backlog 建议（按批次）

> 本节是调研结论的落点，不含实现；实现由后续任务承担。

**批次 A —— 低风险高收益（建议 1.3.0 首发）**

| 项 | 来源 | 改动层级 | 预计 |
| --- | --- | --- | --- |
| A-1 style.css token 化（26 种硬编码色 → `--dsw-alias-*` + fallback；焦点环 → `--dsw-focus-ring-*`；阴影 → `--dsw-elevation-*`；磨砂 → `--dsw-menu-backdrop-filter`） | P0-3 / 1.1 | 仅 `src/style.css` | 1.5h |
| A-2 卡片层级改用 border-l2/l3 + elevation，不用 bg-layer-1/2/3 区分 | P0-4 | 仅 `src/style.css` | 1h |
| A-3 浮球↔面板 ARIA 关联（面板 `id` + 浮球 `aria-controls`） | 1.1 / A1 | `src/client.js` | 0.5h |
| A-4 导入向导 IA：步骤指示 + 冲突单选组 `fieldset/legend` + 焦点迁移/归还 | 1.3 / A2 / A3 | `src/client.js` | 2–3h |
| A-5 插件显示元数据（`locale/{en,zh}.json` 的 `meta.title`/`meta.description` + `icon.svg` + `exports`/`files` 登记） | P2-4 | `package.json` + 新文件 | 1h |
| A-6 `engines.dsh` + `dsh.manifestVersion` + peerDependencies 补全 | P2-3 | `package.json` | 0.5h |

**批次 B —— 中风险（1.3.0 次版或 1.4.0）**

| 项 | 来源 | 风险点 |
| --- | --- | --- |
| B-1 全量本地化（268 条文案 + `toLocaleString` 跟随语言 + `dsh.client.inject` 加 locale） | P0-1 | 键集一致性；需自检脚本 |
| B-2 迁到 `shell.overlay` 槽位 + z-index 归位 | P0-2 / 4.7 | 与 `sidebar.footer.action` 双挂行为 |
| B-3 快捷键注册 + 浮球键盘移动/复位 | P1-3 | 与宿主键位冲突 |
| B-4 React ErrorBoundary（参考 provider-studio `Co` 组件） | 1.4 | 引入类组件，打破现有风格 |
| B-5 设置页 `settings.section` 入口 | P1-1 | 宿主 Settings 契约 + 新远程方法 |

**明确延后**：B-6 存储层换用 `@deepseek-ai/dsh-atomic-write`（P1-4，改核心写入路径 + 现有测试断言）；B-7 存储层换用 `ctx.credentials`（P1-2，改安全契约）。

---

## 6. 未完成 / 存疑事项（如实登记）

1. **`kejixiaoliang/awesome-dsh-plugins`、`bradeGithub/DSH-Plugins-Marketplace`、`AwesomeHou/dsh-plugin-marketplace`、`AI-Scarlett/DSH-Store`** 只拿到仓库元数据与目录规模，**未逐行读实现**；其"卡片式"索引文件的精确 schema（`owner__plugin.yml`）未逐字段核实。
2. **`Ox0400/dsh-vault` 的 `src/index.ts`（377 KB）/ `src/store.ts`（62 KB）未逐行读**；其 DPAPI/Argon2 主密钥保管模型只从 `docs/master-key-custody.md` 的存在与 `package.json` 推断。
3. **`@deepseek-ai/dsh-client-ui-shortcuts` 只提取了 README，未读实现**，快捷键注册的确切签名待核。
4. **`dsh-client-ui-layout` 的 `ctx.layout` 具体方法签名**只在 README 层面读到（`selectPanel` 等），未从 `layout-client.js` 逐个核实参数。
5. **未做浏览器自动化验证**：本轮只读，未在运行中的 DSH Web GUI 里实测 `shell.overlay` 挂载、locale 切换渲染、token 解析。所有"宿主提供"的结论均来自宿主字节与随包 README，属于**源码级核实**，不是运行级核实。
6. **未修改任何产品代码**；本文件是本轮唯一新增文件（`artifacts/optimization-2026-11-21/github-research.md`）。
