# 1.2.0 安装记录（2026-11-20，用户明确授权 12:43 +08:00）

目标：`DSH_HOME=D:\FUGUI\ai\dsh-data`，profile `desktop`。安装源为 1.2.0 最终交付构建（工作区 `lib/`，离线包 `dist/dsh-floating-accounts-1.2.0.tgz` sha256=`b12992daeb6add43f501d543ef1e974f6644b29841fd41d3d5a2948c140ab06c`，64 文件）。流程与纪律沿用 [1.1.1 安装记录](<../protocol-detection-2026-11-19/install-1.1.1-2026-11-20.md>)。执行人 verifier，任务 t9 attempt 2（e14c9432-b752-4730-bd04-a646eaa2f742）。

## 执行序列

1. **安装前快照**：无遗留生命周期锁（`.floating-accounts.lifecycle.lock` 不存在）；`floating-accounts-uninstall-state.json` 为 1.1.1 轮预期残留（`phase:"complete"`，uninstall 按注册态自动重开，非阻塞）；加密账号文件 `plugin-data/dsh-floating-accounts/accounts.dpapi.json`（3150 字节）sha256=`240e4771d4f6ff354da9ffc9207662866741ae3019bd5c5e07f49670b2ae53cd`（=T0 基线）；profile package.json（2618 字节）sha256=`66e633d066a2aa87e297dadd3d3cdda6f9f258fe1190af5950227350421d450`；已装版本 1.1.1（installation.json token `21ad6830-2ad3-470c-b6f8-7c94d9369314`，installedPackageHash 与当时 profile 哈希互证）；bundle 注册项与 `file:` 依赖就位。
2. `node scripts/uninstall.mjs` 退出 0：1.1.1 代码备份至 `profiles/desktop/floating-accounts-uninstall-c9fafc18-1954-4dd7-978a-d44833340198`，`encryptedVaultPreserved=true`、`packagePreserved=true`、`cleanupWarnings=[]`；uninstall/install 之间零插入写操作。
3. `node scripts/install.mjs` 退出 0：安装至 `profiles/desktop/node_modules/dsh-floating-accounts`，`registered=true`，profile 清单备份至 `floating-accounts-backup-c2a32722-7807-4708-9f71-9a0f7aefd134`，`originalPluginsPreserved=true`、`cleanupWarnings=[]`。
4. `node scripts/verify-installed.mjs` 退出 0：`registered=true`、`priorProfileUnchanged=true`（除本插件注册项外清单逐字段不变）、`installedSourceMatchesBuild=true`；五文件哈希：index.js=`faba89e08c65586406829aa4503d0e433dee390163827a87d020f3f7f1a010d4`、validation.js=`1a34af8908c5c5ea26445884ab4be40ebd7d6a97712cfedf01154f9a43fcbce1`、vault.js=`0313976f95e5430e049606106c287312fa3536ac21628689dc19a5b0813a11d6`、dpapi.ps1=`e4a30450bcc545617d56a156f587c327ade04f657a51cd104de8731bda01912e`、client.js=`ac0130e12dfab1ff6521400c1c720398faf515bec0370314b9b9204d8a5fa2bd`（与工作区 lib 逐字节一致；脚本按设计另写工作区 `artifacts/installation-verification.json`）。
5. **安装后核对**：已装 package.json `version=1.2.0`；65 文件 = 64 分发文件 + installation.json（token `c2a32722-7807-4708-9f71-9a0f7aefd134`）；vault sha256 与字节数与安装前逐字节一致（`240e4771…`/3150B，未解密未读取）；profile 清单 bundle 注册项恰好 1 处、依赖 `file:D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts`；profile package.json 哈希回到 `66e633d0…`（卸装→重装同形注册的确定性往返，与安装前逐字节一致）；uninstall journal `phase:"complete"`（backup=c9fafc18…）。

## 状态

- 已完成：离线安装 1.2.0、注册、构建一致性（五文件哈希）、账号数据保留核验。
- GUI：未启动/未重启 DSH（红线：重启与新面板加载由用户自行执行）；`restartRequired=true`、`realGuiVerified=false` 如实记录。
- 未做：真实导入、GUI 动作、解密 vault、任何 vault 写入。

## 回退

如需回退 1.2.0：运行 `node scripts/uninstall.mjs`（1.2.0 代码将备份至新 `floating-accounts-uninstall-<uuid>`），再从 `floating-accounts-uninstall-c9fafc18-1954-4dd7-978a-d44833340198/plugin` 恢复 1.1.1 目录并手工恢复清单注册（bundle 追加 + `file:` 依赖，或直接重装 1.1.1 离线包 `dist/dsh-floating-accounts-1.1.1.tgz`，sha256=`9170d0ac44ab7f4c8ccfbb1d332f57f1ddc47af094d9579e6d1eecab88478e39`）。vault 数据不受安装/卸载影响（encryptedVaultPreserved=true 两次核验）。

## 关键哈希速览

| 对象 | 哈希/大小 |
| --- | --- |
| vault 安装前=安装后 | `240e4771d4f6ff354da9ffc9207662866741ae3019bd5c5e07f49670b2ae53cd` / 3150B |
| profile package.json 前=后 | `66e633d066a2aa87e297dadd3d3cdda6f9f2578fe1190af5950227350421d450` / 2618B |
| 卸装备份（1.1.1 代码） | `floating-accounts-uninstall-c9fafc18-1954-4dd7-978a-d44833340198` |
| 清单备份（本轮） | `floating-accounts-backup-c2a32722-7807-4708-9f71-9a0f7aefd134` |
| 离线包 | `dsh-floating-accounts-1.2.0.tgz` / `b12992daeb6add43f501d543ef1e974f6644b29841fd41d3d5a2948c140ab06c` |
