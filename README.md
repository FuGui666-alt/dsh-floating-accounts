# DSH 悬浮账号配置插件

独立的DSH Web悬浮球：按**站点 → 账号 → 凭据**管理多个平台和多个登录邮箱账号。密钥由Windows DPAPI当前用户加密；**余额只手动查询，不轮询、不自动重试、不调用模型、不改其它用量插件。**

## 1.2.0升级范围
- 新增“从 DSH 导入供应商”：宿主只读当前 profile 配置列出供应商（名称、Base URL、模型、是否已配 Key）；明文 Key 与引用名不出现在清单、不落日志。用户勾选并在预览变更清单后明确确认（确认文案逐字“确认导入”）才写入本插件 vault，Key 经 Windows DPAPI 当前用户加密落库。
- 同 origin 合并：目标 origin 仅对应一个现有站点时默认在其下新增账号、不重复建站、不改站点任何配置；多站点同 origin 时返回冲突清单，由用户选择目标站点或新建站点，不自动合并。新建站点余额协议保持未配置。
- 清单与导入全程零新增联网；导入完成后的“检测协议”仍是现有手动流程，需用户再次确认并遵守原有请求限制。
- 重复导入不判重：同一供应商再次导入会产生重复账号；确认文案已明示。

## 1.1.1升级范围
- 手动“检测协议”仅在用户确认后使用所选模型Key，对同origin有限只读端点进行至多两次顺序GET；不自动安装、不检测真实账号。
- 检测结果仅提供候选配置及状态，不返回余额或响应内容；需用户再次确认后才能应用。

## 1.1.0升级范围
- 同站多账号：账号显示名与可选邮箱/身份备注仅用于区分，不用于登录、不收集邮箱密码。
- 账号内多Key：模型API密钥与分组密钥分开；显式选择一把模型Key查询余额，分组密钥不用于余额鉴权。
- 每站独立查询协议：Sub2API、New API token usage、DeepSeek官方余额。不按域名或模型名自动猜协议/单位。
- 账户余额与所选Key额度分开。DeepSeek保留CNY/USD总可用、赠金、充值分项；不跨币种合计、不重复计算同钱包。
- 旧schema1账号可预览迁移；只有用户点击确认后才保留旧加密备份并提交schema2。

**当前源码/离线包升级不表示已安装或迁移当前真实账号。** 之前已安装1.0.2钱包修复版的安装收据只证明旧版；新包安装、真实数据迁移及真实供应商查询各自需明确授权。此前钱包诊断mode已脱敏，不能声称完整响应原样回放验证通过。

支持Windows、DSH 0.2.x、Node22.19+或24。ESM、React与Typert由DSH提供，不额外安装依赖。不是系统覆盖所有应用的悬浮窗，只显示在DSH Web页面中。更新宿主代码后需保存会话、退出并重启DSH；仅刷新网页不足以确认新宿主已加载。

## 使用多站点、多账号
1. 点击蓝色“账”球；拖动调整位置，浏览器缓存只保存非敏感坐标。
2. 添加站点，填写名称和完整模型Base URL。余额协议默认未配置；确认平台公开规范后再选择。
3. 在站点内添加账号，填写账号名称及可选身份备注。多个邮箱分别建账号，不自动合并。
4. 在账号内添加“模型API密钥”或“分组密钥”。秘密不回显，编辑旧凭据时留空保留，替换后清空本次输入。
5. 选择用于查询余额的模型Key，然后点击该账号“查询余额”。没有协议或选中Key时显示具体原因，不请求平台也不显示零。
6. 站点删除不级联删除账号；账号或凭据删除有确认。站点已绑定凭据时不能跨origin替换地址；请新建站点重新录入，避免旧Key送到另一家。

NVIDIA试用限流、本地/内网端点、麦块云登录授权、火山AK/SK财务接口、WorkBuddy积分和未证实的站点暂不能当模型Key余额查询。可建档，但必须保持未配置；不能把未知或不适用显示成0。

## 手动协议检测
检测RPC仅传 `{id, revision}`。账号明确选中的模型Key只发送至该站同origin的固定候选路径；官方 `https://api.deepseek.com` 只访问 `/user/balance`。最多顺序GET两次，未配置协议也可检测，缺少所选Key则不发请求。检测不是余额查询，不返回金额、不刷新余额状态；只有单一严格匹配的结果可供前端展示并在用户再次确认后应用。schema1账号检测不写回配置。

## 手动余额协议
查询RPC仍仅传账号ID和revision：`args: { request: { id, revision } }`。宿主读取该账号的所选Key和所属站点配置；浏览器不能指定任意origin、路径、Header或Key。schema2不从旧全局配置fallback。

| 协议 | 配置 | 余额语义 |
|---|---|---|
| `sub2api-usage` | 固定 `/v1/usage`，显式USD/CNY，倍率1 | `quota_limited`须active及完整quota；`unrestricted`仅严格balance=remaining钱包；订阅/未知模式拒绝 |
| `new-api-token-usage` | 明确根相对token-usage路径、单位和倍率 | `code=true`；`data.user_quota`为可选账户额度，`data.total_available`为Key额度；无限Key不等于无限资金 |
| `deepseek-balance` | 固定 `/user/balance`，无单位/倍率配置，仅官方 `https://api.deepseek.com` | 响应CNY/USD逐币种总余额/赠金/充值；Key独立额度“接口未提供” |
| 未配置 | `null` | 只建档，不请求，不猜测 |

Sub2API与New API配置形态：

```json
{"protocol":"sub2api-usage","endpointPath":"/v1/usage","unit":"USD","quotaPerUnit":1}
```

DeepSeek官方配置形态（中转Key不适用）：

```json
{"protocol":"deepseek-balance","endpointPath":"/user/balance"}
```

单位仅支持QUOTA/USD/CNY；QUOTA倍率必须1，不猜500000、不自动读status/换汇。同origin公网HTTPS单次GET；DNS固定公共地址、拒绝回环/私网/保留范围、无Cookie/重定向/代理；网络10秒/JSON64KiB/宿主12秒；全局4在途、每账号1。超时后底层未结束仍占槽，无自动重试。

失败不造零；合法零、负钱包、小数和很小余额保留。上次成功值如仍保留只能标“上次成功结果（非本次）”。编辑、切换Key、保存、迁移、删除、重新载入、关闭面板都会失效；宿主结束前再次校验revision，迟到结果不能覆盖新状态。金额不持久化、不写浏览器缓存。

## 旧数据迁移与回退
查看schema1不写盘、旧查询沿原全局配置；有旧账号时面板提示迁移才能编辑三层结构。

1. “预览迁移”不写入，显示站点/账号/凭据数量与安全元数据。
2. 确认后宿主在原独占锁下校验revision及已批准预览的文件快照、完整密文摘要和固定配置/ID映射，保留旧加密文件独占备份，原子提交schema2。没有同实例预览、实例重建或同revision文件变化均要求重新预览。
3. 旧账号ID/name/apiKey/groupKey完整保留；仅相同完整Base URL＋查询配置可共享站点，绝不合并账号或Key。未确认的旧查询配置保持未配置。
4. 冲突、备份/DPAPI/容量失败保留原文件；不盲目重试“提交结果未知”，先重新载入。成功返回备份名；失败的partial backup不能作为完整回退备份。
5. 已schema2重复迁移不会创建重复账号/备份，仍要求当前revision。

**旧1.0.2不能读取schema2，将拒绝而不覆盖。** 降级不是仅覆盖代码：需要停止所有相关实例、保留当前schema2并核对迁移后是否又编辑，明确授权后恢复匹配旧密文。不得自动回退丢掉迁移后的新账号/Key。不要删除备份或运行中移除锁。

存储仍只有原AccountVault/DPAPI加密文件：默认DSH_HOME下plugin-data/dsh-floating-accounts。账号最多100、站点最多100、每账号10凭据，整个密文最多4MiB。损坏/异用户文件禁止覆盖；没有明文降级。修改只能同一revision事务提交；锁清理失败提示先核对状态。

## 构建、测试与离线包
在源码目录执行：

```powershell
node scripts/build.mjs
npm test
node scripts/pack.mjs
```

构建脚本生成ModuleLoader客户端及宿主模块、manifest，离线包包含分发文件与SHA256清单。SDK测试需要本机已有DSH SDK环境，独立于本地测试：

```powershell
$env:DSH_CHECKOUT = 'D:\FUGUI\ai\guanfangdsh\dsh\resources\app.asar\dsh'
$env:ELECTRON_RUN_AS_NODE = '1'
& 'D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

测试均使用隔离fixture或合成传输，不读取运行中profile的登录Token，不请求真实供应商。实际SDK gateway证明RPC描述符/持久化路径，不替代已安装GUI验收。浏览器测试如有提供，也必须注明隔离渲染还是现有DSH页面，不启动新服务器冒充当前GUI。

## 安装纪律
新环境首次安装器拒绝覆盖已有目录，仅注册本插件依赖/bundle并备份原profile，不读取账号明文；安装/卸载独占lifecycle锁和快照检查，卸载保留加密数据。安装属于独立授权动作，**已有安装不能用首次安装器强制覆盖**。先核对升级包和完整备份，再按当前环境授权执行；没有在此文提供自动覆盖真实数据命令。

## 源码与规格
[多站点升级规格](<docs/multi-site-upgrade-spec.md>)；[实现计划](<Plan/2. 多站点升级_plan.md>)；[存储](<src/vault.js>)与[数据校验](<src/vault-model.js>)；[查询owner](<src/balance.js>)与[受限HTTPS](<src/balance-http.js>)；[宿主RPC](<src/index.js>)；[界面](<src/client.js>)；[供应商导入规格](<docs/provider-import-spec.md>)；[导入实现计划](<Plan/4. 供应商导入_plan.md>)；[导入读取owner](<src/host-providers.js>)。

历史[余额计划](<docs/balance-query-plan.md>)描述1.0.2范围，仅用于旧版本证据与schema1兼容，不作为schema2站点配置的owner。
