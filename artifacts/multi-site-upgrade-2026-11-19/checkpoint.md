# 多站点升级完成检查点

## 完成范围
批准的1.1.0源码、测试与离线包完成。见[交付报告](<../../docs/2026-11-19_升级交付-多站点1.1.0-report.md>)和[最终收据](<verification-final.json>)。不要重复创建团队或重写功能。

最终fresh build/local/sdk/pack/extract均exit0；本地233/233、实际宿主SDK16/16（包括生成客户端真实JSON→gateway），附带旧UI子进程22/22；离线包53分发文件逐SHA256/build身份一致。原安装46文件集合和哈希不变。最终包SHA256：22fef256e256fd457640ba44770d9b94966575e67fde288ecaf9d581132076ff，140776bytes。

## 实现与审查
存储High完整密文预览能力修复并spec/code独立PASS，vault ca4968b0e1afd13ca536f7550ed84cea7a9bc4215284c0a1848f80ced63ca028。Query精确decimal/DNS租约/defaultservice已修，查询codePASS。界面最终client743ee6dfb909f39cf1a414012d0ca90afc6f85c491b90179c8b7117f2f477c19，独立9e34与7ba最后复读spec/codePASS。实现者cfe结束前崩溃但源文件留下；lead确认没有活动writer后接手最后测试与构建，未沿用其未完成声明。

最终新增UI回归27/27：未知write不能丢掉lastknownschema2列表，站点内add按钮可见但disabled并回调不发write，不进入legacy编辑lane。SDK初次fixtureVM请求绕过JSONrealm边界导致2失败，修harness JSONroundtrip，未放宽生产validator，6新SDK通过。GNUtar解包Windows盘符/反斜线问题在证据runner修成cwdrelativeforwardslash，最终解包PASS。所有失败均定位修正，未跳过测试。

## 保留边界
migrate({revision,confirm:true})必须先同vault实例preview，成功顶层migrationBackup是完整备份basename。schema1兼容与旧Remote保留，schema2只站点协议；默认service和apply均siteScoped。新空schema1可saveSite初始化schema2不自动迁移。Key归属只能本账号model，noautoselect。仅手动余额，failnot0。

## 安装后新增授权与下一步
用户明确选择“安装1.1.0并预览迁移”。安装53分发文件已完成，旧46file完整目录移至新的multisitebackup；profile/patch/其它受保护配置及真实账号密文字节不变。实际SDK新模块mount通过，未重启DSH，不声称运行中的GUI已激活新版。
[安装及预览记录](<deployment-and-preview.md>)；[安装收据](<multisite-deployment-receipt.json>)已消耗token57096b1b-bf76-47a5-9a63-7f6cd1806f29，绝不重跑deploy-multisite --apply或旧wallet部署器。备份在desktop/floating-accounts-multisite-backup-57096b1b-bf76-47a5-9a63-7f6cd1806f29，旧代码完整保留。
[真实只读预览](<real-migration-preview.json>)已通过：schema1/revision2，1站点yizhichun.online (https://yizhichun.online/v1)、1账号“账号 1”、1模型Key/无group，继承Sub2API /v1/usage USD multiplier1。默认effective dataFile与mount后vault.file严格匹配批准path，错误DSH_HOME负例在read之前拒绝；预览I/O仅同path的lstat/open r，crypto仅unprotect，无Key输出/摘要，无余额请求。
**仍未迁移，未创建迁移密文备份。** 原账号文件hash9e336cded8b8f5c2fb4bad0aa3e19c0dc79e88876a0ebe62e47a1b8328fe4f7a，前后文件身份一致。离线private预览票随进程退出失效，后续明确迁移确认要新实例preview、比对本次密文身份/config/安全摘要未变再commit；不能使用相同revision就跳过snapshot核对。实际迁移需单独用户确认，现在仅待该确认。
BSK vjqq已关闭、sync CLI --policy mismatch，真实GUI未验收。未真实Key导入/live余额/重启。无Git仓库、分支/commit、活跃subagent/background job。安装review e205事务PASS；路径门禁缺口已修且正负验证；两个转义误报已用实际char92length1及generated --check证伪，不需要按误报变更。
