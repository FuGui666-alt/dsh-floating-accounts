# dsh-floating-accounts 1.3.0 — Release Notes

DSH 悬浮账号配置插件：按 **站点 → 账号 → 凭据** 管理多平台模型账号，密钥经 Windows DPAPI 当前用户加密；余额仅手动查询，支持从 DSH 只读导入已配置的供应商。

- 仓库：<https://github.com/FuGui666-alt/dsh-floating-accounts>
- Tag：`v1.3.0`
- 许可：MIT

## 安装

```bash
git clone https://github.com/FuGui666-alt/dsh-floating-accounts.git
```

然后让 agent 执行 `plugin_manager` 的 `install_bundle`，`target` 指向该目录的绝对路径；或使用 Plugins 页面提供的本地目录安装入口。

卸载用 `remove_bundle`，`target` 为 `dsh-floating-accounts`。卸载保留加密数据。

## 本次更新

### 修复：同源批量导入建出重复站点

同一批次里多个同 origin 供应商以前会各建一个重复站点，之后该 origin 的导入永久 `IMPORT_CONFLICT`，与界面承诺的「同 origin 默认并入该站点」矛盾。

现在批次内两个同 origin 供应商产出 **1 个站点 + 2 个账号**；之后再次导入同 origin 仍并入；显式选「新建站点」则仍新建独立站点。

根因在 `src/host-providers.js` 的 `planImport`：自动解析语义（`undefined`）被降级成了显式新建（`null`），三值语义在跨层传递时丢失。三值语义现在原样透传到 vault，`src/vault.js` 未改动。

### 修复：导入同意被绕过

供应商标识若与 `Object.prototype` 的键同名（`constructor` / `__proto__` / `toString` / `valueOf` / `hasOwnProperty`），以前即使用户**没有勾选**也可能被真实提交并写入加密存储，违反导入向导最核心的「显式两步同意」契约。

现在客户端所有以供应商标识为键的访问都改为无原型污染取值，未勾选的供应商一律不进入提交路径，已勾选的只提交被勾选的那一条。

### 新增：导入向导信息架构

- 步骤指示与计数徽标（已选 / 可导入 / 未配 Key 不可导入）
- 预览汇总与逐项结果徽标；新建站点数按 origin 分组，与宿主修复后的实际行为口径一致
- 导入成功后展开逐项结果清单（新建了什么、落在哪个站点）
- 三类分级空态：全空 / 站点无账号 / 无可导入供应商，各带可聚焦主按钮
- 错误按作用域（导入 / 余额 / 编辑 / 载入 / 全局）就近显示并支持就地重试
- 宿主不可达时显示离线态

### 新增：界面一致性

- 主色、状态色、焦点环、阴影、圆角、滚动条全部改接宿主 `--dsw-*` 主题变量，每个 `var()` 都保留原值回退，普通 Web 视口渲染不退化
- 修掉浅色主题下站点卡与账号卡同底色导致层次不可见的问题
- 浮球与面板建立 ARIA 关联并给出展开态；浮球可用键盘移动与复位
- 视图切换做焦点迁移与归还到触发按钮
- 冲突单选组改为 `fieldset` / `legend`；标题层级 h2 → h3 → h4 无跳级
- 同一屏最多存在一个 `role="alert"`

### 新增：工程化

- 建立 Git 仓库、`.gitignore` 与 `.gitattributes`（统一换行符，避免跨平台空白噪声 diff）
- 离线包改为**确定性打包**：固定成员顺序、零化时间戳与属主、固定 gzip 头，同一份源码重打包得到同一个 SHA256
- 构建清单用内容派生的 `buildId` 取代墙钟时间戳，既能标识构建又不破坏可复现性
- 补齐 `engines.dsh`、`dsh.manifestVersion`、中英双语展示元数据与图标，便于被插件市场索引

## 验证

| 项目 | 结果 |
| --- | --- |
| `npm test` | 324 pass / 0 fail |
| SDK 宿主测试（host / multi-site-host / provider-import-host） | 20 pass / 0 fail |
| `node scripts/verify.mjs` | exit 0 |
| 离线包可复现性 | 连续两次 build+pack 的 SHA256 完全一致 |
| 离线包 SHA256 | `d77140f7b76157f52fee7468a8f8df73f7700ff4960208b59d9ea877df8d1511` |

## 未变更

- RPC 方法、参数形状与错误码均未变
- 导入路径零联网；明文 Key 仍不进 DTO、日志、错误信息与前端状态
- 「确认导入」确认文案逐字不变；勾选与确认校验仍在任何 vault I/O 与凭据解析之前

## 尚未包含

- 宿主 locale 字典接入、`shell.overlay` 挂载点迁移、原子批量删除 RPC、`ctx.credentials` 存储层、`dsh-atomic-write`
- npm 发布（需单独授权凭据）
- **真实 GUI 验收**：本轮验证均为 Node 级测试与 ASAR SDK gateway，不等于 GUI 验收
