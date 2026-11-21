# 安装记录：1.2.0 界面美化版（用户授权安装）

2026-11-20 14:19 用户授权（预览页确认观感 OK 后）。执行者：队长（captain）——ui/verifier 成员路由 codearts 积分耗尽不可用，队长按协议接管（attempt 2，attempt_id 0cc3b69c-35f3-4f01-af46-61eaed4598bc）。

安装源：工作区 D:\FUGUI\ai\WORK\软件设计\dsh-floating-accounts（构建含美化；dist/dsh-floating-accounts-1.2.0.tgz sha256=7703a4c1d1365d83da4a2cc9c649acdf2cda2992d93fc235a7bed6b72921883c）

## 预快照（安装前，只读）

| 项 | 值 |
| --- | --- |
| vault | 3962B，sha256=470766094f85051471caca6e9321a7407517cc6d8a7ee9b4af0bae5ded2bc597，mtime 2026-11-20 13:37:45+08:00（用户 13:37 GUI 真实操作后的现状） |
| 生命周期锁 | 无（plugin-data/dsh-floating-accounts/ 仅 accounts.dpapi.json + schema1 备份） |
| 已装版本 | 1.2.0；已装 package.json sha256=54d612f793109197ab6a73e46734c8f4e9635becdba55b8917785b51f5b5380c |
| desktop profile package.json | sha256=66e633d066a2aa87e297dadd3d3cdda6f9f2578fe1190af5950227350421d450（安装流程不得改写） |
| 已装 lib/client.js | ac0130e12dfab1ff6521400c1c720398faf515bec0370314b9b9204d8a5fa2bd（美化前） |
| 工作区 lib/client.js | c2e872017a52c633f4abc629b8e9d5a3e599fd54ff7606e3eb4d7ffbf2e0128f（美化后） |

## 安装序列

| 步骤 | 命令 | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | node scripts/uninstall.mjs | 0 | unregistered=true；代码备份 profiles/desktop/floating-accounts-uninstall-6a82e3e8-0838-4df8-8433-1140e900212e；encryptedVaultPreserved=true；packagePreserved=true；cleanupWarnings=[] |
| 2 | node scripts/install.mjs | 0 | 装至 profiles/desktop/node_modules/dsh-floating-accounts；registered=true；清单备份 floating-accounts-backup-47e291b9-4275-4bd5-9f4d-1dbbb6fe24cb；originalPluginsPreserved=true；cleanupWarnings=[] |
| 3 | node scripts/verify-installed.mjs | 0 | registered=true；priorProfileUnchanged=true；installedSourceMatchesBuild=true；五文件 sha256（index faba89e0…/validation 1a34af89…/vault 0313976f…/dpapi.ps1 e4a30450…/client c2e87201…）；restartRequired=true；realGuiVerified=false；realRpcTransportVerified=false |

## 后置核验

- 已装 lib/client.js sha256 = c2e872017a52c633f4abc629b8e9d5a3e599fd54ff7606e3eb4d7ffbf2e0128f，与工作区 lib/client.js **逐字节一致** → 已装即美化版
- 已装 client.js 内含 `backdrop-filter`（磨砂）与 `dfa-ball-breathe`（呼吸光）→ 美化 CSS 确已落到安装产物
- vault 安装后 sha256 = 470766094f85051471caca6e9321a7407517cc6d8a7ee9b4af0bae5ded2bc597 / 3962B，与安装前**完全一致**（全程只哈希不解密）
- desktop profile package.json sha256 = 66e633d0… 与预快照一致（安装未污染 profile 清单）
- 未做真实导入 GUI 操作；未解密 vault；未改其它插件

## 重启

install/uninstall/verify 三步均返回 restartRequired=true。重启由队长以脱离当前进程的延迟脚本执行（artifacts/provider-import-2026-11-20/restart-dsh.bat：延迟 20s → taskkill /F /IM "DeepSeek Harness.exe" → 拉起 D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe）。重启导致会话瞬断，重启时未完成的工具调用按「结果未知」收尾（见系统提示），重启后以只读方式核验外部状态。

### 重启执行结果（14:30 后核验）

- 宿主完成 kill+relaunch 全序列：进程组为新 PID 实例（10 个 DeepSeek Harness.exe），GUI 端口 57591 → 51163
- 已装 lib/client.js sha256 = c2e872017a52c633f4abc629b8e9d5a3e599fd54ff7606e3eb4d7ffbf2e0128f——重启未改变安装产物，仍为美化版
- vault sha256 = 470766094f85051471caca6e9321a7407517cc6d8a7ee9b4af0bae5ded2bc597 / 3962B，mtime 仍 13:37:45——重启未触碰
- 会话瞬断属预期；带副作用的 kill/relaunch 未重跑

## 未闭环项（交用户 GUI 确认）

- realGuiVerified / realRpcTransportVerified 仍为 false（沿用纪律：不伪造自动化 DOM/RPC 验收）
- 重启后需用户目视确认：浮球动效、面板磨砂在 DSH 实际主题下的表现、站点卡片与横幅图标观感
