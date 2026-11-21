# 一键余额协议检测1.1.1

## 批准范围
用户于2026-11-19选择“一键检测并用所选Key验证”。自动指一次手动按钮后的有限识别过程，不是后台轮询。源码/测试/离线包获准，未批准自动安装1.1.1、当前真实Key检测或真实账号迁移。此前1.1.0已安装，旧schema1数据仅预览、未迁移。

## 行为
- 账号旁提供“检测协议”，在按钮确认文案列出目标站及可能发送Key的同源只读路径。只有主动确认后调用RPC。schema2只用本账号明确选中的model-api-key；schema1沿用其原有单一API Key，检测不改数据。缺Key不联网。
- 未配置协议也能检测。未知中转origin最多顺序GET `/v1/usage`、`/api/usage/token/`，均携带所选Key，仅原同origin。官方 `https://api.deepseek.com` 只GET `/user/balance`，不把中转DeepSeek模型Key送到官网。每次最多2请求、无重定向/重试/Cookie/代理/模型调用、HTTPS公网/DNS固定/64KiB。
- 对所有允许的候选严格使用现有解析器验证，不能以HTTP200、首页品牌、401/404或generic JSON认定协议。Sub2API必须响应明确CNY/USD且符合原mode/字段契约；New API先用QUOTA/倍率1验证及显示为原始额度单位，不猜币种/货币换算；DeepSeek沿用官方字符串精确比较。
- 探测两候选以发现歧义：唯一完整匹配为detected，无匹配为unrecognized，多匹配为ambiguous；不会将auth/permission/unsupported/invalidresponse视成功。不吞网络超时/限流/安全边界错误而继续猛探。
- 检测结果只含候选配置与安全状态/身份/时间，不含余额数值、原响应、秘密/Key摘要。检测不是余额查询，不刷新余额成功状态。
- 唯一候选允许“应用检测配置”；用户明确点击后保存所在站点配置，提示会影响该站其它账号。schema1先提示迁移后才能应用。ambiguous只展示候选、不自动应用；可用现有手动站点编辑。
- 任何修改/选择Key/关闭/载入/迁移使旧检测代际失效；应用使用检测时captured revision与原site/credential归属，不能将另站结果存过来。应用仍原saveSite写owner，有RESULT_UNKNOWN保护。

## 接缝与owner
- 新Remote `detectBalanceProtocol(request={id,revision})`；不能传baseURL、Key、协议、path、headers。
- AccountVault新增lookupForDetection({id,revision})，复用原lookup的ID/revision/key归属验证，仅免掉站点必须已有balanceQuery条件，schema1仍明确兼容；没有新的持久化字段/schema迁移。
- 同一个BalanceQuery负责query与detect共享并发租约（全局4/每账号1）、deadline、abort及不可取消DNSsettlement。query原12秒；detect18秒，候选传输各最长8秒；UIRPC20秒。期限结束禁止晚vault读发新HTTP，DNS仍在途不提前放槽。
- 返回 `{accountId,revision,siteId?,credentialId?,queriedAt,status,candidates,attempts}`；candidates仅balanceConfig白名单，attempts仅预设protocol/endpointPath/status。后查询revision校验。
- 前端严格status/candidates去重、配置有效性、账号/站点/selectedKey/time归属检查并白名单拷贝；detected恰1，unrecognized0，ambiguous2；官方onlyDeepSeek。

## 验收
1. 显式按钮确认/noautodetect/取消0RPC；未配置但有Key可检测，缺Key不查；RPC仅id/revision。
2. 唯一Sub2API/NewAPI/DeepSeek严格匹配；不含unit不猜USD、NewrawQUOTA1；错误、zero异常、HTMLgeneric200不成功；两协议均匹配为ambiguous不自动应用。
3. 同源/no官网泄漏、2顺序请求上限、rate/networkstop、4槽共享/同accountbusy、lateDNS/vault/postrevision丢结果。
4. safeDTO无rawsecret/余额，应用需确认且capturedrevision；变更/关闭/载入丢late检测，schema1无saveSite写。
5. 旧余额/存储/迁移/SDK/UI回归保留，全量fresh build/local/SDK/packmanifest验证；安装代码及真实数据不动。

## 未知与限度
SvenX公开[首页](https://svenx.net/home)仅说明控制台余额/用量，未公开余额端点或协议。2026-11-19只读取公开首页，未登录/调用API/用Key；不能据此称已识别。定制路径/登录Token平台不在本检测范围，明确显示未识别，不承诺万能检测。既有手动配置继续保留。
