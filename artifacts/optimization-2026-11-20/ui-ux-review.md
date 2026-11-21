# dsh-floating-accounts 1.2.0 悬浮面板 UI/UX 与可访问性审查

- 任务：t3（dsh-floating-accounts-opt 队，只读审计轮）
- 日期：2026-11-20
- 审查对象：`dsh-floating-accounts` 1.2.0 界面层（`src/style.css` 44 行 / 13,321 B，`src/client.js` 556 行 / 68,090 B，`src/index.js` 83 行）
- 佐证物料：[ui-polish-preview.html](../provider-import-2026-11-20/ui-polish-preview.html)（明暗双主题合成数据预览，CSS 与构建产物逐字一致）、[ui-polish-2026-11-20.md](../provider-import-2026-11-20/ui-polish-2026-11-20.md)（1.2.0 已做项）
- 纪律：本轮未修改 `src/`、`lib/`、`tests/`、`dist/`；未安装插件、未重启 DSH、未做浏览器自动化压测；本文件是本轮唯一新增文件。

---

## 0. 审查基线与取证方法

### 0.1 现状取证（全部为静态读取）

| 证据源 | 取证方式 | 用途 |
| --- | --- | --- |
| `src/style.css` | 全文 44 行逐行读 | 动效、token、对比度、断点、层级 |
| `src/client.js` | 全文 556 行逐行读 | DOM 结构、事件绑定、焦点、ARIA、文案 |
| `src/index.js` | 全文 83 行 | 对外 RPC 能力面（决定哪些建议属"需后端能力支持"） |
| `ui-polish-2026-11-20.md` | 全文 | 排除"1.2.0 已做项"，避免重复建议 |
| 宿主 `app.asar`（只读 grep） | `grep -a -o` 统计宿主 token 出现次数 | 一致性维度的事实基线（见 0.2） |

### 0.2 宿主 `--dsw-alias-*` / `--dsw-*` token 实测清单（关键事实）

对 `D:\FUGUI\ai\guanfangdsh\dsh\resources\app.asar` 做只读统计（未解包修改、未联网）：

| 宿主 token | asar 内出现次数 | 说明 |
| --- | --- | --- |
| `--dsw-alias-state-business-primary` | 188 | 宿主业务主色（插件目前完全没用） |
| `--dsw-alias-state-error-primary` | 130 | 宿主错误色（插件用硬编码 `#b73131`/`#c73939`） |
| `--dsw-alias-state-success-primary` | 37 | 宿主成功色（插件用硬编码 `#19764b`） |
| `--dsw-alias-state-warn-primary` | 22 | 宿主警告色（插件用硬编码 `#b08a1e`/`#8a6d1a`） |
| `--dsw-alias-bg-layer-1` | 57 | 浅色 = `neutral-bluish-00`；深色 = `neutral-bluish-875` |
| `--dsw-alias-bg-layer-2` | 31 | 浅色 = `neutral-bluish-00`；深色 = `neutral-bluish-850` |
| `--dsw-alias-bg-layer-3` | — | 浅色 = `neutral-bluish-00`；深色 = `neutral-bluish-800` |
| `--dsw-alias-border-l1` / `l2` / `l3` | 112（l2） | 三级描边，宿主用于表达嵌套层级 |
| `--dsw-elevation-prominent` / `-panel` / `-stroke` | 24 | 宿主阴影/描边 elevation 体系 |
| `--dsw-specific-menu` / `--dsw-menu-backdrop-filter` | 28 | 宿主浮层（菜单/面板）背景与磨砂参数 |
| `--dsw-focus-ring-color` / `--dsw-focus-ring-width` | 106 / 52 | 宿主焦点环 token |
| `--dsw-alias-scrollbar-bg-l2` / `-hover-l2`、`--dsh-scrollbar-thumb` / `-hover` / `-track-margin` | — | 宿主滚动条体系 |
| `--dsh-frame-chrome-top` | 7 | 仅在 `html[data-windows-titlebar]` 与 macOS 非全屏时定义；普通 Web 视口未定义 → 插件 `max(16px, var(--dsh-frame-chrome-top,0px))` 退化为 16px |

**两条硬结论（后文反复引用）**

1. **浅色主题下 `--dsw-alias-bg-layer-1`、`-2`、`-3` 取值完全相同**（均为 `neutral-bluish-00`），仅深色主题有 875/850/800 三级差。插件用 layer-1/layer-2 区分"站点卡/账号卡"（`style.css:11` 与 `style.css:18`），**在浅色主题下两层底色一致，1.2.0 的卡片层次几乎不可见**。
2. 插件的主色/状态色/焦点环/阴影/磨砂/滚动条**全部硬编码**，宿主已提供对应 token，因此"与 DSH 主界面观感割裂"是可定位、可零行为风险修复的一致性欠账（多数只改 `style.css`）。

### 0.3 1.2.0 已做项（本报告不重复建议）

据 `ui-polish-2026-11-20.md`：悬浮球径向渐变+双层外发光+hover 放大+3.2s 呼吸光；面板 20 圆角+三层阴影+16px 磨砂+0.18s 开合动画+细滚动条；站点卡片化与协议 chip；账号卡/凭据行/导入行 hover；按钮 primary/danger/icon 化与 focus-visible 统一；横幅族（error/success/migration/import-warning/import-conflict）左侧色条+圆形图标伪元素；深色主题 `color-mix` 适配；余额 `tabular-nums`；输入/select 圆角与 focus 光圈；480px 断点；全部动画包在 `prefers-reduced-motion: no-preference`。

> 核验结论：`prefers-reduced-motion` 覆盖**完整**（`style.css:34-43`），本报告不重复提出"补 reduced-motion 覆盖"；仅在 B2 中指出"减弱动效后需保留非动效状态提示"这一衍生需求。

---

## 1. 候选项索引（24 条）

| ID | 维度 | 标题 | 改动层级 | 工作量 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| A1 | 可访问性 | 浮球↔面板缺 ARIA 关联、无开合视觉状态、键盘无法移动/复位 | 需改 client.js 逻辑（+style.css） | 1.5h | **P0** |
| A2 | 可访问性 | 视图切换（编辑器/导入两步/导入完成）无焦点迁移与归还 | 需改 client.js 逻辑 | 2h | **P0** |
| A3 | 可访问性 | 冲突单选组无 fieldset/legend，无障碍名丢失 | 需改 client.js 逻辑（+style.css） | 1h | **P0** |
| A4 | 可访问性 | 余额区重复 live region，状态被播报两次 | 需改 client.js 逻辑 | 0.5h | P1 |
| A5 | 可访问性 | 同名按钮（查询余额/编辑账号/删除账号…）无归属标识 | 需改 client.js 逻辑 | 1h | P1 |
| A6 | 可访问性 | Esc 监听冒泡与宿主冲突；向导内 Esc 直接关整面板 | 需改 client.js 逻辑 | 1h | P1 |
| A7 | 可访问性 | 标题层级跳跃（strong → h3），账号/站点层级倒置 | 需改 client.js 逻辑 | 0.5h | P1 |
| B1 | 动效与性能 | 面板 16px 磨砂硬编码，低端机/高缩放开销与观感双输 | 仅 style.css | 1h | P1 |
| B2 | 动效与性能 | 呼吸光无限动画 box-shadow，常驻重绘且面板打开时不暂停 | 仅 style.css（+client.js 暂停开关） | 1h | P1 |
| B3 | 动效与性能/一致性 | 面板阴影/圆角/字号与宿主菜单体系不一致 | 仅 style.css | 1h | P1 |
| B4 | 动效与性能 | 长列表无渲染裁剪（上限 100 站点 / 100 账号 × 10 凭据） | 仅 style.css | 0.5h | P2 |
| C1 | 信息架构 | 供应商导入缺步骤指示与进度反馈 | 需改 client.js 逻辑（+style.css） | 2h | **P0** |
| C2 | 信息架构 | 导入预览清单缺汇总/结果徽标/重复风险定位 | 需改 client.js 逻辑 | 2.5h | **P0** |
| C3 | 信息架构 | 空态只有"全空"一种，缺分级空态与 CTA | 需改 client.js 逻辑（+style.css） | 1.5h | P1 |
| C4 | 信息架构 | 错误/离线态无就地重试、错误不绑定动作上下文 | 需改 client.js 逻辑 | 2h | P1 |
| C5 | 信息架构 | 站点卡信息量不足（无账号数/凭据数/余额摘要） | 需改 client.js 逻辑 | 1.5h | P1 |
| D1 | 批量效率 | 无搜索过滤/排序，账号与凭据多时不可导航 | 需改 client.js 逻辑 | 2h | P1 |
| D2 | 批量效率 | 删除逐条系统弹窗，无多选与批量删除/编辑 | 需改 client.js 逻辑（原子批量需后端能力支持） | 3h / 5h | P1 |
| D3 | 批量效率 | 同源冲突只能逐条选择，缺批量策略 | 需改 client.js 逻辑 | 2h | P2 |
| D4 | 批量效率 | 无"全部查询余额"批量刷新 | 需改 client.js 逻辑 | 2.5h | P2 |
| E1 | 响应式 | 断点按视口而非面板宽度，480–640px 区间触摸目标退化 | 仅 style.css | 1h | P1 |
| E2 | 响应式/本地化 | 全量文案硬编码中文，`toLocaleString('zh-CN')` 锁死 locale | 需改 client.js 逻辑 | 4–6h | P1 |
| F1 | 一致性 | 主色/状态色/焦点环/滚动条硬编码，11px 页脚对比偏弱 | 仅 style.css | 1.5h | **P0** |
| F2 | 一致性 | 浅色主题下 layer-1/layer-2 同值，站点卡与账号卡不可区分 | 仅 style.css | 1h | P1 |

---

## 2. 候选项详情

### A1 [P0] 浮球↔面板缺 ARIA 关联、无开合视觉状态、键盘无法移动/复位

- **维度**：可访问性 / 信息架构
- **现状证据**：`src/client.js:520` 浮球 `h('button', { className:'dfa-ball', …, 'aria-label':'账号配置悬浮球', 'aria-expanded':open, title:'点击管理账号 · 拖动调整位置' }, '账')`；`src/client.js:496` 面板 `h('section', { className:'dfa-panel', …, role:'dialog', 'aria-label':'悬浮账号配置', 'aria-modal':false, ref:panel, tabIndex:-1 })`；`src/style.css:2-4` 浮球仅有静态渐变与 hover/focus 态，**无"已展开"视觉差异**；`client.js:468-482` 仅实现 `pointerDown/pointerMove/pointerEnd`（`client.js:475` 以 5px 位移阈值区分拖拽与点击），浮球按钮上**没有任何键盘移动处理**。
- **问题**：`aria-expanded` 有值但面板无 `id`，浮球无 `aria-controls`，屏幕阅读器无法把浮球与面板关联（无法用 `aria-controls` 跳转/确认控制对象）；视觉上浮球开/合完全同形，用户只能凭"面板是否出现"判断状态；同时**浮球位置没有复位入口**（位置存 `POS_KEY='dsh-floating-accounts.position.v1'`，`client.js:5,481`），误拖到屏幕角落后只能靠拖拽找回；运动障碍/纯键盘用户完全无法移动浮球。
- **建议改法**：①面板加 `id='dfa-floating-accounts-panel'`，浮球加 `aria-controls='dfa-floating-accounts-panel'`；②浮球加 `data-open` 属性（open 时置 `'true'`），CSS 用**静态**属性差异表达状态（如外环加宽 + 边框变色），确保 `prefers-reduced-motion: reduce` 下仍可分辨（不依赖动画）；③面板工具栏加"重置浮球位置"入口（写回 `localStorage` 的 `POS_KEY` 并复位 `position` state）；④浮球获得焦点后按 `Ctrl/Alt + 方向键` 以 16px 步进移动位置（每次 `setPosition(clampPosition(...))`，`client.js:6-8`，并防抖写 `localStorage`），键盘移动后在 `aria-live` 区域播报"浮球已移动"。
- **改动层级**：需改 client.js 逻辑（id/属性/复位动作/键盘移动）+ 仅 style.css（状态视觉）
- **预估工作量**：1.5h（若排期不足可先做 ①②③，④ 延后）
- **验证方式**：结构断言 `ball.props['aria-controls'] === 'dfa-floating-accounts-panel'` 且面板节点 `props.id` 同值；`aria-expanded` 切换断言（现有 `tests/client.test.mjs:14` 已断言该属性，可扩展）；行为断言——键盘事件触发后 `position` 变化且 `clampPosition` 边界正确，`localStorage` 写入 `POS_KEY`；截图对比：浮球"收起/展开"两态外观必须可区分（明暗各一张），键盘移动后浮球位置变化且不遮挡面板。

### A2 [P0] 视图切换无焦点迁移与归还

- **维度**：可访问性
- **现状证据**：`client.js:340-348` `beginEditor()` 直接 `setEditor(nextEditor)` 替换主体内容，**未对表单容器或首个字段调用 focus()**；`client.js:228-232` `importPreview()` 把 `step` 从 `'list'` 切到 `'confirm'`，触发按钮（"下一步：预览导入"，`client.js:290`）随之卸载，同样不迁焦；`client.js:266-271` 导入冲突回填时 `step` 仍为 `'confirm'`；`client.js:259-263` 导入成功后向导整体清空（`setDshImport(null)`）并回到站点列表；`client.js:139` `close()` 结束时 `ball.current?.focus()`（**关闭路径有归还，开/关视图切换没有**）。
- **问题**：焦点停留在已卸载的 DOM 节点上时，浏览器会把焦点落到 `document.body`，键盘用户的下一次 Tab 从页面开头开始，屏幕阅读器用户失去"我在哪、刚才触发了什么"的上下文；"下一步：预览导入"这类两步流程尤其容易踩中（按钮消失 → 焦点丢失 → 用户不知道预览已打开）。
- **建议改法**：①新增视图容器 ref（`form`/导入 `section`/站点列表容器统一加 `tabIndex:-1`），在 `beginEditor`、`importPreview`、`importBack`、`submitImport` 成功、`cancelEditor`、编辑保存完成后调用 `containerRef.current?.focus()`；②记录"触发按钮"ref（`editorTriggerRef`/`importTriggerRef`），视图退出时把焦点还给触发按钮；③焦点迁移处加 `scrollIntoView({block:'nearest'})` 避免滚动跳动。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：2h
- **验证方式**：行为断言——在测试桩中记录 `focus()` 调用，断言"点『下一步：预览导入』后焦点落在 `.dfa-import` 容器"、"点『取消』后焦点回到『+ 添加站点』按钮"；键盘实测：Tab 序列在视图切换后从新视图首个可聚焦元素开始；截图对比：切换后无滚动跳动。
- **风险**：`client.js:318-323` 已有 `panel.current?.focus()` 的打开时聚焦，可与本条共用同一套 ref 管理，不冲突。

### A3 [P0] 冲突单选组无 fieldset/legend，丢失"属于哪个供应商"

- **维度**：可访问性
- **现状证据**：`client.js:294-299` 冲突区渲染 `h('div', { className:'dfa-import-conflict-row' }, h('p', null, `${供应商名} · ${c.origin}`), h('label', null, h('input', { type:'radio', name:`import-target-${c.providerId}`, value:'new', … }), '新建站点（不并入现有站点）'), c.siteIds.map(...))`，**每条冲突是普通 div + 若干 label**，没有 `fieldset/legend`；`style.css:24` `.dfa-import-conflict-row` 仅有边框与虚线分隔。
- **问题**：同一 `name` 的 radio 构成一个原生单选组，但组没有可访问名，屏幕阅读器只会播报"新建站点（不并入现有站点）单选按钮 1/3"，用户**无法知道这一组属于哪个供应商、哪个 origin**；多条冲突并存时（多个同源供应商）更难分辨。视觉上 `.dfa-import-conflict-row` 的虚线分隔也弱，组与组之间无标题层级。
- **建议改法**：每条冲突改为 `h('fieldset', { key:c.providerId, className:'dfa-import-conflict-row' }, h('legend', null, `${供应商名} · ${c.origin}`), …radios…)`，并把原 `<p>` 文本移入 legend；CSS 侧给 `fieldset` 去掉浏览器默认 `min-inline-size:min-content` 与 `border/padding` 默认值，统一到现有 `.dfa-import-conflict-row` 外观（`legend` 字号 12–13px，字重 500）。
- **改动层级**：需改 client.js 逻辑（+ 仅 style.css 的 fieldset 复位）
- **预估工作量**：1h
- **验证方式**：结构断言——渲染树中存在 `tag==='fieldset'` 且其 `legend` 文本包含对应 `providerId` 的供应商名与 origin；radio 组数量 == 冲突条数；截图对比：多冲突时每组有明确组标题。
- **关联**：本条与 C2（预览徽标）、D3（冲突批量策略）同属导入向导，建议同批实施。

### A4 [P1] 余额区重复 live region，状态被播报两次

- **维度**：可访问性
- **现状证据**：`client.js:86-87` `balanceView()` 外层 `h('div', { className:'dfa-balance', 'aria-live':'polite' }, … state?.status === 'loading' && h('p', { role:'status' }, '正在查询余额…'), state?.status === 'error' && h('p', { className:'dfa-balance-error', role:'alert' }, state.message) …)`；面板顶部另有 `client.js:498-500` 的 `role='alert'`/`role='status'` 横幅。
- **问题**：同一容器既是 `aria-live` 区域，内部又是 `role=status`/`role=alert` 活动区 → 屏幕阅读器可能对同一条"余额查询失败"播报两次；`role=alert`（ assertive）嵌在 `aria-live=polite` 容器内还会造成播报时机不确定。
- **建议改法**：二选一并全量统一：①容器保留 `aria-live='polite'`，内部去掉 `role`（错误文本改纯 `p.dfa-balance-error`）；②容器去掉 `aria-live`，内部保留 `role='status'`（加载/成功）与 `role='alert'`（错误）。推荐 ②——错误用 assertive 更符合语义，且与面板顶部横幅的 `role` 约定一致（`client.js:498`）。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：0.5h
- **验证方式**：结构断言——同一 `.dfa-balance` 子树内 `role=status|alert` 计数 ≤ 1，且外层不再带 `aria-live`；与 `client.js:498` 的横幅 role 约定做一致性断言（同一屏最多 1 个 alert）。

### A5 [P1] 同名按钮无归属标识，误删风险

- **维度**：可访问性
- **现状证据**：`client.js:494` 每个账号卡渲染 4 个按钮，文本固定为 `'查询余额'`、`'检测协议'`、`'编辑账号'`、`'删除账号'`；`client.js:489` 凭据行 `'编辑凭据'`、`'删除凭据'`；`client.js:507` 旧格式账号同样是 `'查询余额'`/`'检测协议'`/`'编辑'`/`'删除'`。对照 `client.js:492` 的余额 Key 下拉已经用了 `aria-label: \`余额查询 Key：${row.name}\``——**项目内已有正确惯例，只是未贯彻到按钮**。
- **问题**：屏幕阅读器用户以"按钮列表"方式浏览时，几十个同名"删除账号"按钮无法区分归属；语音控制用户说"点击 删除账号"会命中第一个；破坏性按钮与普通按钮同名同序，误操作风险最高（虽然有 `window.confirm`，但确认框文本里才出现账号名，见 `client.js:433`）。
- **建议改法**：统一给账号级/凭据级按钮加 `aria-label`：`查询余额：${row.name}`、`检测协议：${row.name}`、`编辑账号：${row.name}`、`删除账号：${row.name}`；凭据行用 `编辑凭据：${row.name} / ${c.label}` 形式。**保留可见文本不变**（aria-label 覆盖可见文本会让"按钮列表"播报变长，建议改为可见文本 + `aria-describedby` 指向账号名，或用 `aria-label` 但确保包含可见文本关键词以满足 WCAG 2.5.3 Label in Name）。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：1h
- **验证方式**：结构断言——按 `data-account-id`（`client.js:487` 已有该属性）定位每张账号卡，断言其 4 个按钮的 `aria-label` 互不相同且都包含 `row.name`；断言可见文本仍为"删除账号"等原词（Label in Name 断言）；截图对比：视觉不变。

### A6 [P1] Esc 监听冒泡与宿主冲突；向导内 Esc 直接关整面板

- **维度**：可访问性 / 交互
- **现状证据**：`client.js:318-323` `useEffect(() => { if(!open) return; panel.current?.focus(); const key = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }; document.addEventListener('keydown', key); … }, [open, busy, editor])`；`client.js:139` `close()` → `discard()` → `window.confirm('放弃尚未保存的编辑？')`（`client.js:131`）；`client.js:233-237` 已有 `importBack()`（回到 list 步），但 Esc 路径不经过它。
- **问题**：①`document` 上的冒泡阶段监听里 `stopPropagation()` **不能阻止同一节点上其他监听器**（需要 `stopImmediatePropagation()`，且与注册顺序相关），宿主若也在 document 上处理 Esc（关闭自己的面板/浮层），两端会同时响应；②若宿主在 capture 阶段 `stopPropagation()`，本插件根本收不到 Esc → 面板关不掉；③导入向导第二步按 Esc 会直接关掉整面板并丢弃已勾选状态，而向导本身已有"返回修改"（`client.js:303`）与"取消导入"（`client.js:304`）两条更细粒度出口。
- **建议改法**：①把 Esc 监听改为 **capture 阶段**（`document.addEventListener('keydown', key, true)`）并在处理后 `stopPropagation()`，确保先于宿主的冒泡处理拿到事件；②分级 Esc：向导 `'confirm'` 步 → 先 `importBack()`（回 list 步），再按 Esc 才 `close()`；编辑器有未保存内容 → 维持现有 `discard()` 确认；③`close()` 时若焦点已在浮球以外（例如用户点了宿主页面），避免强制抢焦点（用 `ball.current?.focus({preventScroll:true})` 并检查 `document.activeElement`）。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：1h
- **验证方式**：行为断言——向导 confirm 步触发 keydown Escape → 断言 `step` 回到 `'list'` 且面板仍 `open`；再触发一次 → 面板关闭且 `document.activeElement` 为浮球；截图对比：向导 Esc 后仍显示第 1 步。

### A7 [P1] 标题层级跳跃，账号/站点层级倒置

- **维度**：可访问性 / 信息架构
- **现状证据**：`client.js:497` 面板头部标题用 `h('strong', null, '账号配置')`（非标题元素）；`client.js:506` 站点名用 `h('h3', null, site.name)`；`client.js:487` 账号名用 `h('strong', null, row.name)`（账号是站点的子级，却用弱于 h3 的 strong）；`client.js:502` 迁移预览 `h3`；`client.js:509` 编辑器标题 `h3`；`client.js:280` 导入区 `h3`。
- **问题**：屏幕阅读器的"标题大纲"从 h3 起跳，缺少面板级标题；站点(h3)→账号(strong)的层级反了，用户按标题浏览时看不到账号条目（账号是数量最多、最需要被扫读的单位）。
- **建议改法**：面板标题改 `h2`（加 `id` 并用 `aria-labelledby` 替换 `aria-label`，`client.js:496`）；站点名保持 `h3`；账号名改 `h4`（`client.js:487`）；导入向导/迁移预览/编辑器标题保持 `h3`（它们是面板内的一级分区）；凭据标签保持 `strong`。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：0.5h
- **验证方式**：结构断言——渲染树标题序列为 `h2(面板) → h3(分区/站点) → h4(账号)`，无跳级；截图对比：标题字号随层级递减（需同时调 `style.css` 的 `h4` 样式，`style.css:12` 目前只定义了 `.dfa-panel h3`）。

### B1 [P1] 面板 16px 磨砂硬编码，低端机/高缩放开销与观感双输

- **维度**：动效与性能 / 一致性
- **现状证据**：`style.css:6` `@supports ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))){.dfa-panel{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#fff) 86%,transparent);backdrop-filter:blur(16px) saturate(1.18);-webkit-backdrop-filter:blur(16px) saturate(1.18)}}`；宿主提供 `--dsw-menu-backdrop-filter`（asar 实测 28 处）。
- **问题**：①面板最大可到 `100dvh`（`style.css:5` `max-height:calc(100dvh - …)`）×480px，16px 模糊 + 1.18 饱和度意味着每帧对整个面板区域做背景重采样：软件渲染、150% 缩放、多显示器 DPI 切换时开销明显（面板是 `position:fixed` 常驻宿主页面）；②`blur(16px)` 是写死值，与宿主菜单的磨砂参数不一致，叠加在同一屏上时会出现两套玻璃质感。
- **建议改法**：①`backdrop-filter: var(--dsw-menu-backdrop-filter, blur(16px) saturate(1.18))`（宿主有值就用宿主的）；②新增 `@media (prefers-reduced-transparency: reduce){.dfa-panel{backdrop-filter:none;background:var(--dsw-alias-bg-layer-2,#fff)}}`（渐进增强，不支持的浏览器忽略）；③若宿主无 `--dsw-menu-backdrop-filter`，把模糊半径降到 12px 并保留 `color-mix` 半透明底。
- **改动层级**：仅 style.css
- **预估工作量**：1h
- **验证方式**：截图对比——明暗两主题下与宿主下拉面板并排，磨砂强度一致；DevTools Performance 面板录制面板打开/滚动 5s，对比有无 backdrop-filter 的 Frame 时间（低端模拟：4× CPU 降速）。

### B2 [P1] 呼吸光无限动画 box-shadow，常驻重绘且面板打开时不暂停

- **维度**：动效与性能
- **现状证据**：`style.css:36` `.dfa-ball{transition:transform .15s ease,box-shadow .15s ease;animation:dfa-ball-breathe 3.2s ease-in-out infinite}`；`style.css:41` `@keyframes dfa-ball-breathe{0%,100%{box-shadow:…0 0 0 4px…}50%{…0 0 0 7px…}}`；`style.css:37` `.dfa-ball:hover{transform:scale(1.05)}`。
- **问题**：①`box-shadow` 不可合成，3.2s 无限循环会持续触发 48px 元素的重绘；面板打开时动画**照常运行**（浮球仍可见），宿主其他页面也在跑；②`transition` 与 `animation` 同时作用于 `box-shadow`（`style.css:36` 同时声明），hover 与呼吸光叠加时阴影值互相打断，边缘出现跳变；③在 `prefers-reduced-motion: reduce` 下动画整段关闭，浮球因此失去唯一的"活着"信号（配合 A1 的静态状态差异正好互补）。
- **建议改法**：①把呼吸光改为**伪元素光圈**的 `opacity`/`transform` 动画（合成层，不触发重绘），主按钮只保留静态阴影；②面板打开时暂停呼吸（`client.js:520` 给浮球加 `data-open`，CSS `.dfa-ball[data-open="true"] .dfa-ring{animation:none}`）；③`document.visibilityState === 'hidden'` 时暂停（`client.js` 加 `visibilitychange` 监听，`alive` 清理函数里移除）；④去掉 `box-shadow` 上的 `transition`，避免与 keyframes 抢同一属性。
- **改动层级**：仅 style.css（视觉）+ 需改 client.js 逻辑（`data-open` 属性、可见性暂停开关）
- **预估工作量**：1h
- **验证方式**：DevTools Performance 录制 5s，对比呼吸前后 Frame/重绘次数；截图对比：呼吸光视觉强度与现状接近（明暗各一张）；断言面板打开后浮球 `data-open='true'` 且 CSS 规则命中。

### B3 [P1] 面板阴影/圆角/字号与宿主菜单体系不一致

- **维度**：动效与性能 / 一致性
- **现状证据**：`style.css:5` `border-radius:20px;box-shadow:0 24px 64px rgba(21,43,94,.16),0 8px 20px rgba(21,43,94,.12),0 1px 2px rgba(21,43,94,.22);font:13px/1.5 system-ui…`；宿主面板用 `--dsw-specific-menu` 背景、`--dsw-menu-backdrop-filter`、`--dsw-elevation-prominent`、radius 12、h3 13px（宿主 token 实测见 0.2）。
- **问题**：三段**蓝调**阴影（`rgba(21,43,94,…)`）在深色主题下与宿主中性 elevation 不匹配，观感偏"外挂面板"；20px 圆角 + 17px 标题（`style.css:7`）比宿主的 12px 圆角 / 13px 标题更"重"，同屏出现时层级语言不一致。
- **建议改法**：①`box-shadow: var(--dsw-elevation-prominent, 0 24px 64px rgba(21,43,94,.16), 0 8px 20px rgba(21,43,94,.12), 0 1px 2px rgba(21,43,94,.22))`；②面板背景 `var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2,#fff))`（与宿主浮层同源）；③圆角收敛到 12–16px；④字号层级对齐宿主（面板标题 13–14px、站点名 13px、正文 13px、次要 12px、页脚 11px）。
- **改动层级**：仅 style.css
- **预估工作量**：1h
- **验证方式**：截图对比——插件面板与宿主任一浮层（下拉/工具面板）同屏并排，阴影色相、圆角、字号基线三项可对齐；断言 `style.css` 不再出现 `rgba(21,43,94` 硬编码阴影。

### B4 [P2] 长列表无渲染裁剪

- **维度**：动效与性能
- **现状证据**：`client.js:506` 一次性 `snapshot.sites.map(… accounts.filter(…).map(accountView))` 全量渲染；`client.js:11` 校验上限 `accounts.length > 100 || sites.length > 100`，`client.js:18` 每账号凭据 ≤ 10 → 理论上限 100×(1+10)+凭据行 ≈ 1200+ 行 DOM；`style.css` 无 `content-visibility`。
- **问题**：满载数据下首次打开面板要构建上千节点，主线程卡顿 + 滚动掉帧；`style.css:11` 的 `.dfa-account:hover` 阴影、`style.css:18` 凭据行 hover 背景进一步放大重绘范围。
- **建议改法**：`.dfa-site,.dfa-account{content-visibility:auto;contain-intrinsic-size:auto 120px}`（仅 style.css，浏览器不支持时自动忽略）；配合 `style.css:8` 已有的 `overscroll-behavior:contain` 保持滚动惯性。
- **改动层级**：仅 style.css
- **预估工作量**：0.5h
- **验证方式**：构造 100 账号场景（离线渲染断言节点数）→ 手工滚动观察 FPS；对比改造前后 DevTools Performance 的 Layout/Recalculate 次数。

### C1 [P0] 供应商导入缺步骤指示与进度反馈

- **维度**：信息架构
- **现状证据**：`client.js:275-305` `importView()` 仅有 `wizard.step`（`'list'` / `'confirm'`）两态，无步骤条；标题固定 `h('h3', null, '从 DSH 导入供应商')`（`client.js:280`）；提交中仅把按钮文案换成 `'正在导入…'`（`client.js:302`），无 `aria-busy`、无进度区；任务描述中的五段流程（列表→勾选→冲突处理→两步确认→结果）在 UI 上最多只能表达两段。
- **问题**：用户无法判断"现在在哪一步、还剩几步、刚才那一步是否已完成"；冲突处理被内嵌在 `'confirm'` 步内（`client.js:294`），冲突态与普通确认态外观相同（都只是黄色横幅），步骤感进一步丢失；导入中除按钮文案外没有任何视觉/听觉进度，供应商多时等待感强。
- **建议改法**：①在导入区顶部加步骤条"第 1 步 / 共 2 步：选择供应商 → 第 2 步：确认写入"，冲突态用第 2 步内的子状态标签（如"待解决 N 处同源冲突"）；②计数徽标"已选 N / 可导入 M（K 个未配 Key 不可导入）"（`client.js:287` 已算出 `p.hasKey` 与 `modelsCount`）；③提交中给导入区加 `aria-busy="true"` 并加 `role='status'` 的进度行（"正在导入 3 个供应商…"，`client.js:302` 同步）；④导入成功后给 1.5s 的完成态（见 C2 的结果徽标）。
- **改动层级**：需改 client.js 逻辑（+ 少量 style.css 的步骤条样式）
- **预估工作量**：2h
- **验证方式**：截图对比——list / confirm / conflict / submitting 四态各一张，步骤条与计数徽标可见；结构断言——`importSection` 节点 `props['aria-busy']` 在提交中为 `'true'`；断言计数徽标文本 = "已选 N / 可导入 M"。

### C2 [P0] 导入预览清单缺汇总、结果徽标与重复风险定位

- **维度**：信息架构 / 批量效率
- **现状证据**：`client.js:291-293` 确认步逐行渲染 `${p.name} · ${p.baseURL} · 已配置 Key · ${p.modelsCount} 个模型`，**只有事实描述，没有"会发生什么"**；`client.js:289` 关于"重复导入同一供应商会产生重复账号；同 origin 已有单站点时默认并入该站点"只是一句长文本提示；`client.js:71` `safeProviderList` 只透传 `providerId/name/baseURL/hasKey/modelsCount`（**不含宿主站点信息**）；冲突信息要等到提交后服务端返回 `IMPORT_CONFLICT`（`client.js:266-267`）才出现在确认步。
- **问题**：预览页无法回答用户的三个核心问题——"会新建几个站点/账号？哪些会并入已有站点？会不会产生重复？"；重复风险只能在成功后的 notice（`client.js:263`）里看到"已从 DSH 导入 N 个账号"，而**没有逐项结果清单**；同源冲突（后端 `IMPORT_CONFLICT`）必须先提交一次才知道要选目标，用户在"预览"阶段拿到的是**不完整预览**。
- **建议改法**：①预览头部加汇总条（供应商 N · 新建站点 X · 新建账号 Y · 并入 Z · 冲突待处理 K）；②每行加结果徽标：`新建账号` / `并入「站点名」` / `与已有站点重复（将新增账号）`——**客户端即可计算**：已有 `snapshot.sites[].baseURL` 与供应商 `baseURL` 可直接做同源比对（`new URL(baseURL).origin`），无需后端；③结果页把 `safeImportResult`（`client.js:78-81`）返回的 `created.siteIds/accountIds/credentialIds` 展开成逐项清单（新建了什么、落在哪个站点），而不是只有一句汇总 notice（`client.js:263`）。
- **改动层级**：需改 client.js 逻辑（**不需后端**：同源比对与结果展开用现有 `snapshot.sites` + `safeImportResult` 即可）
- **预估工作量**：2.5h
- **验证方式**：截图对比——预览步出现汇总条与逐行徽标（合成 3 供应商 / 2 站点场景）；结构断言——预览行包含"并入"或"新建账号"徽标文本，且与 `snapshot.sites` 的 origin 计算结果一致；导入成功后断言结果清单条目数 == `created.accountIds.length`。

### C3 [P1] 空态只有"全空"一种，缺分级空态与 CTA

- **维度**：信息架构
- **现状证据**：`client.js:505` 仅当 `snapshot.accounts.length === 0 && snapshot.sites.length === 0` 时渲染 `div.dfa-empty`（"请先完成配置" + 说明，文案只引导"添加站点"）；`client.js:288` 供应商清单为空时只输出 `h('p', { className:'dfa-meta' }, 'DSH 宿主当前没有可导入的 llm-pi-ai 供应商。')`；`client.js:490` 账号无凭据时只输出 `h('p', { className:'dfa-meta' }, '暂无凭据；可先建档，不会自动选择查询 Key')`；`style.css:10` 已有 `.dfa-empty` 样式（虚线框 + 居中），可复用。
- **问题**：①"有站点但没有账号"是常见中间态，此时站点卡只显示名称/URL/三个按钮，用户看不到"这里还缺账号"；②供应商为空没有视觉空态，用户会以为是加载失败；③主路径是"从 DSH 导入供应商"（1.2.0 头条能力），但全空空态只引导"添加站点"，把用户推向更慢的路径。
- **建议改法**：①统一 `.dfa-empty` 结构（`strong` 标题 + `p` 说明 + 主 CTA 按钮），复用 `style.css:10`；②全空空态的 CTA 改为"从 DSH 导入供应商"（次 CTA"添加站点"）；③站点卡内账号为空时给行内紧凑空态 + "添加账号"按钮；④供应商为空改用 `.dfa-empty`（标题"没有可导入的供应商" + 说明"请先在 DSH 中配置模型供应商"）。
- **改动层级**：需改 client.js 逻辑（+ 仅 style.css 的紧凑空态变体）
- **预估工作量**：1.5h
- **验证方式**：截图对比——三类空态（全空 / 站点无账号 / 供应商为空）各一张，风格统一且都有可聚焦 CTA；结构断言——空态容器内存在 `tag==='button'`。

### C4 [P1] 错误/离线态无就地重试，错误不绑定动作上下文

- **维度**：信息架构
- **现状证据**：`client.js:498` 面板顶部只有一条 `error` 文本：`error && h('div', { className:'dfa-error', role:'alert' }, error)`；`client.js:544-548` 传输失败统一抛"无法连接宿主，请检查 DSH 已加载悬浮账号插件"；`client.js:57` `RPC_UNAVAILABLE: '读取超时或无法连接宿主，请检查插件后重新载入'`；`client.js:63` `IMPORT_FAILED` 等；`client.js:270` 导入失败时 `setError(...)` 但同时把向导退回 `'list'` 步；`setError('')` 在 `openImport/beginEditor/commit/load` 等多处被清空。
- **问题**：①错误是**全局单槽**，后发生的动作会清掉先前错误的上下文，用户不知道是哪一步失败；②离线/宿主不可达没有专门的离线态表达（面板看起来和正常态一样，只是多一条红字），也没有就近的"重试"按钮——用户只能关掉面板重开（`toggle()` → `load()`）；③导入失败退回 list 步后，红字条在页首、失败发生在导入区底部，视线要来回扫。
- **建议改法**：①把 `error` 从字符串升级为 `{ scope:'import'|'balance'|'editor'|'load'|'global', message, retry?: () => void }`，渲染时按 scope 就近显示（导入失败显示在导入区、余额失败显示在对应账号卡，余额区已有 `balanceView` 落点，见 `client.js:86-90`）；②顶部错误条支持"重试"按钮（调用原失败动作，如 `load()` / `submitImport()`）；③新增离线态：宿主不可达时（`RPC_UNAVAILABLE`）给面板加 `data-offline="true"`，CSS 灰化操作区并显示离线徽标。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：2h
- **验证方式**：行为断言——模拟 `list` 失败后错误条内存在"重试"按钮，点击后再次触发 `floatingAccounts/list`；断言离线态渲染出 `data-offline='true'`；截图对比：离线态与普通错误态视觉可区分。

### C5 [P1] 站点卡信息量不足，账号层级弱于站点层级

- **维度**：信息架构
- **现状证据**：`client.js:506` 站点卡内容仅：名称 `h3`、URL `div.dfa-url`、协议 `p.dfa-meta`（`client.js:486` `protocolName()`）、三个按钮；**没有账号数/凭据数/余额摘要**。对比凭据与余额信息在账号卡内（`client.js:489-493`）。而预览页 `../provider-import-2026-11-20/ui-polish-preview.html:118` 出现了"1 个凭据"提示——**预览页与真实渲染不一致**（预览是合成结构，真实 client 没有该行）。
- **问题**：多站点多账号时无法快速扫描"哪个站点下有几个账号/有没有余额"，必须逐站点展开；账号（真正需要频繁操作的单位）在视觉与信息上从属于站点。
- **建议改法**：①站点卡头部加摘要 chip（`N 个账号 · M 个凭据`，`client.js:506` 内用 `snapshot.accounts.filter(a=>a.siteId===site.id)` 现算；凭据数同理）；②若该站点已有任一账号余额结果（`balances` state，`client.js:122`），显示最近一次余额摘要 chip；③账号卡标题升级为 `h4`（配合 A7）；④同步修正预览页与真实渲染的差异（预览页补 chip 行）。
- **改动层级**：需改 client.js 逻辑（+ style.css chip 样式，可复用 `style.css:18` 的 `.dfa-site>.dfa-meta` chip 形态）
- **预估工作量**：1.5h
- **验证方式**：截图对比——站点卡出现计数 chip，与预览页结构一致（两页可并排比对）；结构断言——站点卡 chip 文本包含账号计数且数值 == `snapshot.accounts.filter(...)` 长度。

### D1 [P1] 无搜索过滤与排序，账号与凭据多时不可导航

- **维度**：批量效率
- **现状证据**：`client.js:500` 工具栏只有"+ 添加站点 / 从 DSH 导入供应商 / 重新载入"；`client.js:506` 站点与账号平铺全量渲染，无过滤输入、无排序控件；上限 100 站点 / 100 账号（`client.js:11`）。
- **问题**：账号与凭据多时无法定位目标，只能滚动；`snapshot.sites` 的顺序来自 vault 存储顺序，不是用户可理解的排序（名称/最近更新/余额）；凭据（每账号最多 10 条，`client.js:18`）同样无过滤。
- **建议改法**：①工具栏加过滤输入框（占位"按站点/账号/身份备注过滤"，纯客户端过滤 `sites[].name`、`accounts[].name`、`identityLabel`）；②过滤生效时显示"显示 X / 共 Y"并提供"清除"；③加排序下拉（名称 A-Z / 最近更新 / 余额从低到高，`updatedAt` 已在快照里，`client.js:21-22`）；④凭据行过滤（账号内）可作为二级能力。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：2h
- **验证方式**：行为断言——输入过滤词后渲染出的 `.dfa-account` 数量减少且"显示 X / 共 Y"文案更新；排序断言——选择"名称 A-Z"后账号名序列有序；截图对比：工具栏新增控件后不挤压既有按钮（`style.css:8` `.dfa-toolbar` 已是 `flex-wrap:wrap`）。

### D2 [P1] 删除逐条系统弹窗，无多选与批量删除/编辑

- **维度**：批量效率
- **现状证据**：`client.js:420-440` `remove/removeSite/removeAccount/removeCredential` 各自 `window.confirm('删除账号「X」及其全部已保存凭据？此操作不可撤销。')` 后单条提交；无任何多选状态、无批量动作栏。
- **问题**：删 10 个账号需 10 次系统弹窗（系统 confirm 无法用宿主样式，还打断宿主窗口焦点）；没有"批量设置余额查询 Key""批量改身份备注"等常见批量编辑；破坏性操作分散在每个卡片角落，容易误点。
- **建议改法**：①账号卡增加复选框，进入"多选模式"后顶部出现批量操作条（批量删除 / 批量设置余额 Key / 批量清空身份备注）；②批量删除只弹**一次**确认，列出条目名与总数（用 `window.confirm` 也可，但建议改成面板内确认块以保持样式一致）；③技术路径：客户端串行调用现有 `removeAccount` / `removeCredential` RPC，每次用**上一条返回的新 revision**（`commit()` 已在 `client.js:364-368` 用返回快照更新 revision，可复用），失败时汇总"已完成 X / 未完成 Y"；④若要求原子性批量（全部成功或全部回滚），**需后端能力支持**：新增批量 RPC（如 `removeAccounts`），并由 vault 侧保证单 revision 提交——这是本条唯一涉及后端的部分。
- **改动层级**：需改 client.js 逻辑（前端批量编排）；**原子批量删除需后端能力支持**（新增批量 RPC + vault 事务语义）
- **预估工作量**：前端 3h / 含原子后端 5h
- **验证方式**：行为断言——勾选 3 个账号点击批量删除，**用户确认次数 == 1**，且 RPC 调用序列为 3 次 `removeAccount`，revision 逐次递进；失败注入时断言提示含"已完成/未完成"计数；截图对比：多选模式下的批量操作条。

### D3 [P2] 同源冲突只能逐条选择，缺批量策略

- **维度**：批量效率
- **现状证据**：`client.js:294-299` 每个冲突供应商一组 radio（"新建站点" + 若干"并入站点「X」"）；`client.js:242-248` `chooseImportTarget()` 只写单条 `targets[providerId]`；`client.js:226` `importConfirmReady()` 要求**每条**冲突都有 target 才允许提交。
- **问题**：多个供应商同源冲突时必须逐条选择；当多条冲突的目标站点集合相同（例如都属于同一个 relay 站），重复操作完全同质。
- **建议改法**：①在冲突区顶部加"应用到全部"策略（两个动作：全部并入指定站点 / 全部新建站点），执行后写入所有未单独覆盖的冲突项；②每条冲突保留单独覆盖（覆盖后从批量集合中排除）；③批量策略本身用 radio + 一个"应用到全部"按钮表达，避免歧义。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：2h
- **验证方式**：行为断言——点击"全部并入 X"后所有 `wizard.targets[providerId]` 均为 X，且 `importConfirmReady()` 变为 true；单条覆盖后批量不再回写该条；截图对比：冲突区出现批量策略行。

### D4 [P2] 无"全部查询余额"批量刷新

- **维度**：批量效率
- **现状证据**：`client.js:494` 每个账号一个"查询余额"按钮；`client.js:149-164` `queryBalance()` 单账号调用并用 `balancePending` Map 做**按账号**去重；后端失败码含 `BALANCE_BUSY`（同账号已有查询进行中）与 `BALANCE_LIMIT`（并发上限，`client.js:48`）。
- **问题**：多账号需要逐个点击；后端并发上限存在但客户端不发起并发，等于闲置了并发能力。
- **建议改法**：工具栏加"查询全部余额"，客户端以 2–3 并发逐个调用 `queryBalance`，逐账号复用现有 `balanceView` 状态与错误文案（`client.js:86-90`），汇总"成功 N / 失败 M"；并发上限应与后端 `BALANCE_LIMIT` 语义对齐（保守取 2）。
- **改动层级**：需改 client.js 逻辑
- **预估工作量**：2.5h
- **验证方式**：行为断言——点击后并发中的 `queryBalance` 调用数 ≤ 2，全部账号最终都有独立状态（success/error），且错误账号不影响其他账号；截图对比：批量进行中按钮显示计数进度。

### E1 [P1] 断点按视口而非面板宽度，480–640px 区间触摸目标退化

- **维度**：响应式
- **现状证据**：`style.css:44` 唯一断点 `@media(max-width:480px)`（提高 padding、按钮 min-height 40px、输入 42px、凭据行按钮整行等）；`client.js:495` 面板宽度 `const width = Math.min(480, window.innerWidth - 24)` —— **面板自身最大 480px，且宽度与断点阈值恰好相同**。
- **问题**：①断点语义错位：规则作用于"视口 ≤480px"，但面板宽度实际是 `min(480, 视口-24)`；在视口 481–640px 区间（横屏手机、窄窗口、150% 缩放后的 900px 物理窗口等）面板仍是 480px 宽，**触摸目标却退回 34px**（`style.css:9` `min-height:34px`）；②缩放 125%–150% 时 CSS 视口宽度按比例收缩，同样落入该"中间带"；③480px 以下 40px 的按钮高度仍低于移动端 44px 建议值。
- **建议改法**：①改用**容器查询**：`.dfa-panel{container-type:inline-size}` + `@container (max-width:480px){…}`，使规则跟随面板实际宽度（面板宽度变化时自动生效，无需 JS）；②若要避免 `container-type` 对 `position:fixed` 的影响，则补一条 `@media(max-width:640px)` 作为兜底；③把移动态按钮 `min-height` 提到 44px。
- **改动层级**：仅 style.css（容器查询方案 JS 无需改动；`client.js:495` 的宽度常量可保持）
- **预估工作量**：1h
- **验证方式**：截图对比——视口 480px / 560px / 640px 三档，面板内按钮高度随**面板宽度**变化而非视口宽度；150% 缩放截图确认无横向滚动与按钮过小；断言 `@container` 或 `@media(max-width:640px)` 规则命中。

### E2 [P1] 全量文案硬编码中文，`toLocaleString('zh-CN')` 锁死 locale

- **维度**：本地化 / 响应式
- **现状证据**：`client.js:44-53` `balanceFailure()`、`client.js:54-65` `operationFailure()` 为中文错误码字典；`client.js:84` `number.toLocaleString('zh-CN', {maximumSignificantDigits:15, notation:…})`、`client.js:90` 与 `client.js:314` `new Date(...).toLocaleString('zh-CN')`；JSX 内文案（面板标题、按钮、空态、导入向导）全部为中文字面量；全文件无字典/语言切换入口。
- **问题**：①无法跟随宿主语言（宿主 UI 插件声明注入 `client-locale`，见 `.dsh-src` 中 `dsh-experimental-client-ui-agent-team` 的 peerDependencies，插件未接）；②数字与日期格式写死 `zh-CN`，即使系统语言为英文也显示中文格式与千分位规则；③文案与逻辑耦合（字符串散落在条件表达式里），任何文案调整都要改逻辑分支，回归成本高；④字符串长度差异（英文通常更长）在 480px 固定宽度面板内易触发换行/截断，未预留 i18n 空间。
- **建议改法**：①抽出 `t(key, params)` 字典（至少 zh-CN / en-US 两套），把 `balanceFailure`/`operationFailure` 改为查字典而非内联中文字面量；②日期/数字改 `Intl.DateTimeFormat()` / `Intl.NumberFormat()`，locale 取宿主语言或 `navigator.language`；③字典分层（面板 UI 文案 / 错误码文案 / 导入向导文案），为后续英文长文案预留 `max-width` 与 `overflow-wrap`；④若宿主 `client-locale` 通道可用则接入，否则保留 `navigator.language` 兜底。
- **改动层级**：需改 client.js 逻辑（**不需后端**；接入宿主 locale 属宿主能力，非本插件后端）
- **预估工作量**：4–6h
- **验证方式**：断言——`t('panel.title')` 在 zh/en 两种 locale 下返回不同字符串，且 `Intl` 格式化结果随 locale 变化；截图对比——英文 locale 下 480px 面板无溢出（长按钮文案如"Detect protocol"不截断）。

### F1 [P0] 主色/状态色/焦点环/滚动条硬编码，11px 页脚对比偏弱

- **维度**：一致性 / 可访问性（对比度）
- **现状证据**：`style.css:9` primary 渐变 `linear-gradient(180deg,#6275e8,#5264dc)`、focus 环 `outline:2px solid #6b82f5`、danger `#c73939`；`style.css:4` 浮球 focus 环 `#93a7ff`；`style.css:13-14` error `#b73131` / success `#19764b`；`style.css:19,23,24` warn `#b08a1e`/`#8a6d1a`；`style.css:26-31` 深色适配用 `color-mix` 把硬编码色与 `--dsw-alias-label-primary` 混合；`style.css:8` 滚动条 `scrollbar-color:rgba(105,117,137,.45) transparent` 与 `::-webkit-scrollbar-thumb{background:rgba(105,117,137,.35)}`；`style.css:16` 页脚 `font-size:11px` + `--dsw-alias-label-tertiary`。宿主实测提供 `--dsw-alias-state-business-primary`（188 处）、`--dsw-alias-state-error-primary`（130）、`--dsw-alias-state-success-primary`（37）、`--dsw-alias-state-warn-primary`（22）、`--dsw-focus-ring-color`（106）、`--dsw-focus-ring-width`（52）、`--dsw-alias-scrollbar-bg-l2`/`-hover-l2`、`--dsh-scrollbar-thumb`/`-hover`/`-track-margin`、`--dsw-alias-label-caption`。
- **问题**：①宿主换品牌色/主题时插件主色不跟随（当前蓝 `#5264dc` 与宿主 business-primary 未必同值）；②错误/成功/警告三色是固定十六进制，深浅主题下对比度不可控（浅色回退 `#b73131` 于 `#ffeded` 尚可，但深色下 `color-mix` 结果依赖 `--dsw-alias-label-primary`，实际对比度未经验证）；③焦点环颜色与宿主不同 → 同屏内两套键盘焦点指示，削弱一致性；④`style.css:26-31` 的 `color-mix` 方案本质是"硬编码色 + 宿主文字色混合"，在宿主深色中性色下会得到偏灰的语义色，弱化语义可辨识度；⑤滚动条为插件私有实现，同屏两种滚动条观感；⑥页脚 11px + `label-tertiary`（浅色 `#697589` 于 `#fff` 约 4.6:1，勉强及线），且宿主面板使用 `scrollbar-gutter:stable`，插件未用 → 滚动条出现时 8px 布局抖动。
- **建议改法**：①全部语义色改 token + fallback：`var(--dsw-alias-state-error-primary,#b73131)`、`var(--dsw-alias-state-success-primary,#19764b)`、`var(--dsw-alias-state-warn-primary,#b08a1e)`；②主色改 `var(--dsw-alias-state-business-primary,#5264dc)`，渐变改为 `color-mix` 在该 token 上做明暗两档；③焦点环改 `outline: var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#6b82f5)`；④`color-mix` 深色段可简化为直接使用语义 token + 低透明底（`color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent)`），语义色保持纯净；⑤滚动条改宿主 token（`--dsh-scrollbar-thumb`/`--dsh-scrollbar-thumb-hover`，或 `--dsw-alias-scrollbar-bg-l2`/`-hover-l2`），并给 `.dfa-body` 加 `scrollbar-gutter:stable`；⑥页脚字号提到 12px，颜色改 `--dsw-alias-label-caption`（若宿主无 caption 则保留 tertiary）。
- **改动层级**：仅 style.css
- **预估工作量**：1.5h
- **验证方式**：截图对比——明暗双主题各一张，错误/成功/警告横幅与主按钮取色 = 宿主 token 解析值，滚动条与宿主滚动区一致；断言 `style.css` 中 `#b73131`/`#19764b`/`#b08a1e`/`#5264dc` 只作为 fallback 出现（`var(--x, #hex)` 形式）；对比度取色计算：正文/次要文字 ≥ 4.5:1，大字与图形 ≥ 3:1；滚动条出现时内容不横向跳动。

### F2 [P1] 浅色主题下 layer-1/layer-2 同值，站点卡与账号卡不可区分

- **维度**：一致性 / 视觉层次
- **现状证据**：`style.css:11` `.dfa-account{…background:var(--dsw-alias-bg-layer-2,#fff)}`；`style.css:18` `.dfa-site{…background:var(--dsw-alias-bg-layer-1,#f5f7fb)}`；宿主实测（0.2）：**浅色主题 layer-1 = layer-2 = layer-3 = `neutral-bluish-00`**，仅深色为 875/850/800。
- **问题**：1.2.0 的"站点卡片化"依赖 `bg-layer-1` 与 `bg-layer-2` 的差，但**浅色主题下两者取值完全相同**，站点卡与账号卡同底色，层次只靠 `border` + 阴影（`style.css:11,18`）撑着，观感扁平且与"卡片化"的设计意图相反；深色主题反而有 25 级色差 → 两套主题下层次表现不一致。
- **建议改法**：①层级改用 `--dsw-alias-bg-layer-3`（深色 800）区分更深一层，并让账号卡用 layer-2、站点卡用 layer-1/3 形成两到三级；②或用宿主描边层级（`--dsw-alias-border-l2` / `l3`）表达嵌套 + `--dsw-elevation-stroke`；③注意浅色主题三层同值的事实，必要时给站点卡加 1px 更深描边而非改底色。
- **改动层级**：仅 style.css
- **预估工作量**：1h
- **验证方式**：截图对比——浅色与深色各一张，站点卡与账号卡底色/描边可区分（浅色主题下必须可区分）；取色验证：浅色下站点卡与账号卡底色 RGB 差 ≥ 3 或描边层级不同。

---

## 3. 最小改动高收益 Top 8

按"改动面最小 × 收益最高"排序（合计约 10.5h，全部不含新增后端能力）：

| # | ID | 改动面 | 一句话收益 | 工作量 |
| --- | --- | --- | --- | --- |
| 1 | **F1** | 仅 style.css | 主色/错误/成功/警告/焦点环全部接宿主 token → 主题随动 + 同屏观感统一 + 焦点环一致 | 1h |
| 2 | **B3** | 仅 style.css | 面板阴影/圆角/字号改宿主 elevation 体系 → 去掉"外挂面板"观感 | 1h |
| 3 | **F2** | 仅 style.css | 修掉浅色主题站点卡/账号卡同色 → 1.2.0 卡片层次真正可见 | 1h |
| 4 | **A5** | client.js | 账号级按钮 aria-label 带账号名 → 屏幕阅读器与语音控制可用，误删风险下降 | 1h |
| 5 | **A3** | client.js(+css) | 冲突 radio 组加 fieldset/legend → 导入冲突不再"不知道属于谁" | 1h |
| 6 | **A2** | client.js | 视图切换焦点迁移 + 焦点归还 → 键盘流程不再"跳回页首" | 2h |
| 7 | **C2** | client.js | 导入预览汇总 + 结果徽标 + 重复风险前置 → "会发生什么"在提交前可读 | 2.5h |
| 8 | **C1** | client.js(+css) | 导入向导步骤条 + 计数徽标 + `aria-busy` → 五段流程有步骤感与进度 | 2h |

> 备选（若排期只够 5 条）：F1 → B3 → F2 → A5 → C2（全部为低风险、无行为语义变更的改动）。
> **不建议**在 1.2.0 小版本里动的两项（改动面大、需回归）：E2（i18n 字典化，建议排到 1.3.0）、D2 的原子批量删除（需后端批量 RPC）。

---

## 4. 落地批次建议

- **批次 A（纯 style.css，零行为变更，可独立发版）**：F1 → B3 → F2 → B1 → B4 → E1。
  验证方式：重建后用 `../provider-import-2026-11-20/ui-polish-preview.html` 的同款明暗双主题截图对比（预览页可按新 CSS 复制一份对照），并跑 `npm test`（272 项）确认零回归。
- **批次 B（client.js 可访问性修复，行为不变）**：A2 → A3 → A4 → A5 → A6 → A7 → A1。
  验证方式：扩展 `tests/client.test.mjs` / `tests/provider-import-client.test.mjs`（现有断言风格：`s.button('账号配置悬浮球')`、`find(n=>n.props?.role==='alert')`，见 `tests/client.test.mjs:11,14`），新增"focus 调用记录""fieldset/legend 存在""aria-label 唯一"三类断言。
- **批次 C（信息架构与批量效率，需产品确认交互）**：C1 → C2 → C3 → C4 → C5 → D1 → D2(前端版) → D3 → D4。
  验证方式：导入向导按合成数据做端到端截图（列表/确认/冲突/提交中/结果五态），并对每条新增断言在 `tests/provider-import-client.test.mjs` 中留痕。
- **批次 D（需后端或宿主配合）**：D2 原子批量删除（后端批量 RPC）、E2 i18n（接宿主 locale 通道，可与批次 C 并行准备）。

---

## 5. 审查边界与未覆盖项

1. 本轮为**静态只读审查**：未启动浏览器、未对真实宿主做交互录制、未做性能压测、未验证 Windows DPAPI/宿主链路的运行时行为；所有"现状证据"均为文件行号或宿主 token 静态统计，可复核。
2. 未审 `src/vault.js`、`src/balance*.js`、`src/host-providers.js` 的内部算法（属其他成员/后续轮次范围）；本报告只在"界面呈现"层面引用其返回结构。
3. `ui-polish-preview.html` 为合成数据静态预览，其结构与真实 `client.js` 渲染已存在差异（例：预览页站点卡有"1 个凭据"行，真实 client 无此行，见 C5），引用时以 `client.js` 为准。
4. 宿主 token 的**具体色值**未逐一取样验证（仅统计了 token 名出现次数与浅/深两套 `--dsw-static-neutral-bluish-*` 映射）；F1 落地时需在真实宿主里复核解析后的对比度（浅色 + 深色各测一次）。
5. 键盘可达性结论基于源码语义推导（原生 `button`/`input`/`select`/`form` + 显式 `keydown` 监听），未做真实 Tab 序列实测；批次 B 落地后建议补一次手动键盘走查（打开→Tab→Enter→Esc→Tab 回浮球）。
