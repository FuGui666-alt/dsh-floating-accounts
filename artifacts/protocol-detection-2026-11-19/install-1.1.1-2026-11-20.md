# 1.1.1 安装记录（2026-11-20，用户明确授权）

目标：`DSH_HOME=D:\FUGUI\ai\dsh-data`，profile `desktop`。

## 执行序列

1. 安装前快照：无遗留生命周期锁；加密账号文件 `plugin-data/dsh-floating-accounts/accounts.dpapi.json`（1382 字节）sha256=`4c36fedb2ba7af6ecedc991ec9545ca3c6821afdb8a1095d285ac045cf47b7a9`；profile package.json sha256=`fd30e9d8c5f0da932af982f674f06d6df667880b8253c8d774b852f59f3f55a7`；已装版本 1.1.0。
2. `node scripts/uninstall.mjs` 退出 0：撤销注册、代码备份至 `profiles/desktop/floating-accounts-uninstall-e94d1636-a4b0-4c1b-8603-f05268d8f09c`，encryptedVaultPreserved=true，cleanupWarnings=[]。
3. `node scripts/install.mjs` 退出 0：安装至 `profiles/desktop/node_modules/dsh-floating-accounts`，注册成功，profile 清单备份至 `floating-accounts-backup-21ad6830-2ad3-470c-b6f8-7c94d9369314`，originalPluginsPreserved=true。
4. `node scripts/verify-installed.mjs` 退出 0：registered=true，priorProfileUnchanged=true（除本插件注册项外清单逐字段不变），installedSourceMatchesBuild=true（index/validation/vault/dpapi.ps1/client 五文件与 workspace 构建一致）。
5. 安装后核对：已装 package.json version=1.1.1；vault sha256 仍为 `4c36fedb…`（字节不变，未读取/解密内容）；清单第 39 行依赖与第 76 行 bundle 注册项就位。

## 状态

- 已完成：离线安装、注册、构建一致性、账号数据保留核验。
- GUI：2026-11-20 09:18 用户重启 DSH Desktop 后确认界面正常打开（用户视觉确认；未做自动化 DOM 验收，未点击真实检测）。
- 未做：真实 Key 检测点击、真实余额查询、解密 vault。

## 回退

如需回退 1.1.1：运行 `node scripts/uninstall.mjs`，再从 `floating-accounts-uninstall-e94d1636-a4b0-4c1b-8603-f05268d8f09c/plugin` 恢复 1.1.0 目录并手工恢复清单注册（或直接重装对应版本）。
