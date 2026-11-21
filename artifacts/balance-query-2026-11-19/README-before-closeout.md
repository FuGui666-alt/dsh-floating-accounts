# DSH 悬浮账号配置插件

独立的 DSH Desktop 悬浮球与多账号配置面板。**Windows DPAPI 保存密钥；余额只由用户点击查询，不调用 AI、不轮询、不自动重试、不修改原余额插件。**

当前工作区新增余额能力，尚未发布或替换已安装的 1.0.2。余额网络查询**默认关闭**。2026-11-19 用户授权的本站单次查询已确认 `Sub2API /v1/usage` 的密钥限额模式及USD单位；源码已适配，但尚未覆盖安装或写入宿主配置。其它平台协议/单位不能沿用本站结论。未配置时点击按钮只显示“尚未启用”，不会读取密钥或发送平台请求。

支持 Windows、DSH 0.2.x、Node 22.19+ / 24。密钥使用 Windows DPAPI 当前用户加密；不支持明文降级。安装后需重启 DSH 才能确认加载。既有 1.0.2 账号保存已由用户人工验收；新增余额按钮尚未人工验收；本站的限额密钥响应及USD单位已在一次明确授权请求中核验，不代表其它模式已核验。本地真实加密、持久化和隔离 SDK 测试不替代页面验收。

## 手动查询余额（开发能力，默认关闭）

每个账号的“查询余额”按钮只调用宿主 `floatingAccounts/queryBalance`，RPC 载体为 `args: { request: { id, revision } }`。密钥由宿主在查询时读取，不回传浏览器；不使用分组密钥、Cookie 或模型接口。查询不保存结果、不递增账号修订号；结果仅在面板内存中保留。

- **账户余额**：New API仅读取 `data.user_quota.total_available`。已实测的Sub2API限额密钥响应不提供钱包余额，显示“接口未提供”，不会拿密钥额度顶替。
- **密钥额度**：New API读取 `data.total_available`，明确 `unlimited_quota: true` 时标无限；Sub2API限额模式读取 `quota.remaining`，单位由响应和配置双重核对。
- **失败**：HTTP/业务/解析失败显示错误，不生成余额零。刷新失败时若保留历史成功值，会标“上次成功结果（非本次）”。
- **时间与配置变化**：显示查询完成时间（本机时区），与账号保存时间不同；重新载入、编辑、保存、删除、关闭面板使结果失效，迟到响应不能覆盖新配置。

宿主配置 `balanceQuery` 仅供接口资料核对后的启用，不自动识别站点。支持显式选择 `new-api-token-usage` 或 `sub2api-usage`，不会尝试多个接口。New API候选路径 `/api/usage/token/` 仅为上游协议，**不证明用户平台支持它**；本站已确认Sub2API限额模式的 `/v1/usage`。配置必须提供：

| 配置字段 | 要求 |
|---|---|
| `protocol` | `new-api-token-usage` / `sub2api-usage` |
| `endpointPath` | 明确根相对路径；无 query/hash、身份信息、跨站 URL、点路径 |
| `unit` | `QUOTA` / `USD` / `CNY`，必须由平台资料确认 |
| `quotaPerUnit` | 正的有限数字；`QUOTA` 只能为 `1`；货币倍率不得猜测 |

不设置任何默认币种、`500000` 倍率或汇率。只有平台明确确认返回原始额度单位时，才能用 `QUOTA` 和 `1` 显示原始额度。HTTP 只接受同站公网 HTTPS、单次 GET；DNS 地址固定、拒绝私网/回环/保留地址、不跟随重定向；网络最多 10 秒、JSON 最多 64 KiB、宿主整个查询最多 12 秒。同一宿主实例最多 4 个在途查询（同账号最多 1 个）；超时但尚未完成的不可取消读取仍占槽，等待其结束后恢复，不无限排队。本次没有更改任何已安装宿主配置。

本站后续授权部署时的宿主配置值如下（本轮未写入安装环境）：

```json
{"balanceQuery":{"protocol":"sub2api-usage","endpointPath":"/v1/usage","unit":"USD","quotaPerUnit":1}}
```

Sub2API强制此固定路径、倍率1、USD或CNY且响应单位必须匹配。当前只支持已实测的 `quota_limited` 有效密钥模式；未核验的无限或订阅模式报不支持，不推断钱包余额或无限账户资金。一次授权的实测值与边界见[结果报告续作节](<docs/balance-query-result.md#sub2api-实测与适配续作>)。

新实现：[协议与编排](<src/balance.js>)、[受限 HTTPS](<src/balance-http.js>)；完整实施边界、回归路径和待验收项见[余额查询计划](<docs/balance-query-plan.md>)。

## 安装（本轮未执行）

解压源码/离线安装包，进入插件目录。PowerShell 示例：

```powershell
cd 'D:\FUGUI\ai\WORK\软件设计\dsh-floating-accounts'
node scripts/build.mjs
$env:DSH_HOME = 'D:\FUGUI\ai\dsh-data'
node scripts/install.mjs desktop
```

安装器仅增加本插件目录及 profile 的依赖/bundle，自动备份原 profile 清单，不写密钥或改模型配置。安装/卸载共用独占锁 `.floating-accounts.lifecycle.lock`，提交与回滚前比对 profile 快照；失败不会整份写回旧配置，也不会删除不属于本次的目录。若提示 `PROFILE_BUSY`，先停止安装操作，备份后人工确认并改名遗留锁，不要运行中删除。卸载先备份插件代码并把阶段写入 `floating-accounts-uninstall-state.json`，中途失败可重复执行续作；加密账号文件始终保留。没有下载依赖；Cordis、Typert SDK、React由DSH提供。如果DSH版本超出0.2.x，先核对SDK兼容性。当前 profile 必须已有可运行 Web GUI。

保存会话后关闭并重新启动 DSH，然后打开桌面提供的已授权 Web 页面。仅刷新网页不等于重新加载新增宿主插件。**本插件不是系统级覆盖所有应用的悬浮窗，只显示在 DSH Web 页面内。**

## 填写与保存

1. 页面右下区域出现蓝色“账”悬浮球，默认位于屏幕底部上方约180像素；与原“用量”悬浮球独立。拖动可调整位置，位置仅保存非敏感坐标。
2. 点击“账”展开“账号配置”面板；再次点击或点击“×”收起。未配置时显示“请先完成配置”。
3. 点击“添加账号”，填写下面字段，再点击“保存”。

| 字段 | 规则 | 保存方式 |
|---|---|---|
| 账号名称 | 选填，留空自动生成；最多80字符 | 加密文件中的元数据 |
| API网址 | 必填，HTTPS；本机回环可用HTTP；不得夹带用户名密码、query或hash | 加密文件 |
| API密钥 | 新账号必填，最多8192字符，不能含空格或控制字符 | Windows当前用户加密 |
| 分组密钥 | 选填；按秘密处理，不推断其供应商含义 | Windows当前用户加密 |

4. 显示“已加密保存”后关闭并重开面板，账号名称、网址和“密钥已保存”状态仍在。
5. 点击“编辑”修改。API密钥留空保留旧值，填写新值替换；分组密钥留空保留，勾选“清除已保存的分组密钥”删除该项。
6. 点击“删除”并确认，删除该账号及其密钥。没有明文查看或导出功能。已保存秘密不会回传浏览器；保存、取消、关闭后清除本次输入。

“保存”代表本地存储成功，**不代表填写的API能连通**。本次没有模型名字段，也不会发送测试请求。

## 数据与安全边界

默认数据文件在：

```text
%DSH_HOME%\plugin-data\dsh-floating-accounts\accounts.dpapi.json
```

未设置DSH_HOME时使用用户目录下的 `.dsh`。文件只存加密内容，不能在记事本中直接编辑。profile插件配置可指定绝对 `dataFile` 覆盖路径。

- 使用 `System.Security.Cryptography.ProtectedData`，CurrentUser与插件专用entropy；明文只存在本次浏览器表单、RPC请求与宿主进程内存，不落明文文件、localStorage或插件日志。字节数组在助手脚本 `finally` 中清零；受管理的不可变字符串无法保证被彻底擦除，插件不宣称能做到。
- 账号文件读取使用单一文件句柄做类型/容量检查与有界读取，并在提交前后比对文件身份；发现外部替换即拒绝覆盖并提示重新载入。最后一次检查到替换之间的极小剩余窗口无法通过普通文件 API 对非协作进程完全消除，插件不宣称抵抗同一用户下的恶意程序。
- 宿主RPC超过20秒视为结果未知：不自动重试，也不把“超时”当作保存失败；面板禁止继续编辑，须重新载入确认实际状态后再操作。
- DPAPI绑定当前Windows用户，换Windows账户/机器可能不可解密；PowerShell 不可用等环境故障会明确提示“未改动账号文件”，不会误报为文件损坏。
- DPAPI绑定当前Windows用户，换Windows账户/机器可能不可解密。请保留原用户环境并安全备份文件；没有跨机器明文导出功能。
- 同一Windows用户下恶意程序或已控制DSH会话仍可能读取内存/调用系统解密；本插件不承诺隔离同用户恶意程序。RPC请求本身包含你正在保存的密钥，DSH/代理若额外开启全量请求抓取须自行避免记录敏感内容；插件没有新增请求日志。
- 写操作revision冲突时要求重新载入，避免旧窗口覆盖新保存；文件锁与原子替换防止并发半写。
- 没有删除旧账号/自动抓取第三方登录凭据；数据唯一归本插件管理。

## 常见问题

- **“无法连接宿主”/未出现悬浮球**：确认已安装并注册bundle、重启DSH、使用有sidebar槽位的已授权Web页面。
- **“账号已在其他窗口更新”**：取消编辑，点击“重新载入”，再编辑；为了安全，失败后本次密钥输入会清空。
- **“Windows加密/解密失败”**：检查PowerShell/.NET是否被策略禁用、当前Windows用户是否与保存时一致；绝不改用明文。
- **“账号文件损坏或不是当前Windows用户加密的文件”**：停止保存，保留文件和备份；不要删除以“修复”。
- **持续“另一个写入正在进行”**：只在确认所有DSH进程已关闭后，将数据文件旁的`.lock`改名留作备份再启动。不要在运行中删除别人的锁。
- **API密钥无法查看**：这是预期行为，只显示已保存状态；遗失原密钥时请从供应商取得并替换。

## 源码结构

```text
dsh-floating-accounts/
  package.json           # 插件元数据/宿主peer依赖
  cordis.patch.yml       # 独立bundle入口
  src/
    index.js             # Cordis Remote服务；安全错误及元数据出口
    validation.js        # 名称/URL/密钥/版本校验
    vault.js             # 单一加密数据源；单句柄读取/revision/文件锁/原子替换
    dpapi.js             # DPAPI 子进程生命周期、超时与错误分型
    dpapi.ps1            # 仅stdin/stdout字节流的Windows系统加密
    client.js            # React悬浮球与CRUD表单
    style.css            # 独立作用域、视口自适应样式
  lib/                   # build生成的可运行宿主、客户端与构建清单
  scripts/
    build.mjs            # 暂存构建、语法与哈希校验后提升
    distribution.mjs     # package.files 唯一交付清单与产物门禁
    lifecycle.mjs        # profile 独占锁、快照CAS、安全暂存清理
    install.mjs          # 离线复制、备份、profile独立注册
    uninstall.mjs        # 分阶段可续作卸载，保留数据与代码备份
    pack.mjs             # 离线包打包
  tests/                 # 真DPAPI、快照竞争、安装/卸载、交付与客户端回归
```

源文件说明：[校验](<src/validation.js>)、[加密存储](<src/vault.js>)、[DPAPI](<src/dpapi.ps1>)、[宿主](<src/index.js>)、[客户端](<src/client.js>)、[样式](<src/style.css>)、[构建](<scripts/build.mjs>)、[安装](<scripts/install.mjs>)、[卸载](<scripts/uninstall.mjs>)。

## 开发与验证

```powershell
node scripts/build.mjs
npm test
```

安装包是开发包：包含全部源码、测试、构建/安装/验证脚本与 loader，因此安装目录也可运行上述命令；隔离 fixture 不会进入包。运行中宿主只加载 `lib/`，不会执行这些脚本。也可用 `node scripts/verify.mjs` 一次跑构建+全部本地测试（SDK 缺失时记录 `hostTestsSkipped: true`）。

宿主测试需要使用当前DSH提供的Cordis与Typert SDK；[宿主测试](<tests/host.test.mjs>)执行实际注册服务和方法，但尚不代表真实浏览器RPC。当前安装环境可用：

```powershell
$env:DSH_CHECKOUT = 'D:\FUGUI\ai\guanfangdsh\dsh\resources\app.asar\dsh'
$env:ELECTRON_RUN_AS_NODE = '1'
& 'D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

[运行时loader](<scripts/runtime-loader.mjs>)只解析SDK公开导出，不读取源码，不启动GUI。不要安装来源不明SDK或启动另一个Web服务器假装已验证当前GUI。

## 人工界面验收（需用户实操）

本地回归不能替代真实页面。安装或升级后重启 DSH，打开其提供的已授权页面，逐项确认：

1. 蓝色“账”球出现，原“用量”球不受影响；`v1.0.2` 显示在面板页脚。
2. 把球拖到面板覆盖区域内再展开：球仍可见且可再次点击收起（R1 修复项）；把球拖到四个屏幕角落，面板不越界。
3. 空配置显示“请先完成配置”；添加账号仅填 `example.invalid` 与测试密钥，保存后页脚提示“已加密保存”。
4. 关闭页面或重启 DSH 后重新打开，账号、网址与“密钥已保存”仍在，密钥不回显。
5. 编辑：旧密钥留空保留；填写可替换；勾选清除分组密钥后保存，状态变为“未设置”。
6. 删除先确认，取消不删除；确认后列表更新。
7. 缩放窗口至手机宽度、按 Esc、保存中重复点击，均应表现正常。
8. 真实宿主 RPC 参数与返回元数据（不含明文密钥）需在此页面确认；隔离 SDK gateway 测试不代表真实页面传输层。
9. 新余额功能需要**另行授权覆盖安装后**由用户人工确认：开面板不自动查询；未配置协议时点击“查询余额”显示尚未启用，不显示零。
10. 接口/单位确认并另行授权真实请求后：账户余额、密钥额度与查询完成时间分开显示；账户字段缺失不拿密钥额度替代，无限密钥不显示无限账户金额。
11. 人工构造失败或网络断开后，不能显示新成功金额零；保留历史值必须标“上次成功结果（非本次）”。编辑/删除/载入/关闭后迟到结果不能重新出现。本轮未进行这些真实页面/平台验收。

## 卸载与回退

```powershell
node scripts/uninstall.mjs desktop
```

只去掉本插件注册，保留加密账号数据；插件代码移到profile备份目录，保留其它插件/模型配置，之后重启DSH。不要用旧profile整文件覆盖后来其它配置。
