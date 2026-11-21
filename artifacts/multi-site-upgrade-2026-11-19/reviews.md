# 多站点升级审查证据

## 存储
规格审查bae81fd7发现High：预览未绑定用户批准的旧密文，same-revision替换可迁移未预览内容。修复d0a001de完成，private实例ticket绑定完整密文摘要/文件身份/固定legacyConfig/UUID映射，写锁内先验再备份。源回归最终128/128及原repair9/9（完整最终集成另跑）。
独立复审617ab476：spec PASS→code PASS；对应vault hash ca4968b0e1afd13ca536f7550ed84cea7a9bc4215284c0a1848f80ced63ca028。测试hash之后有仅test收尾改变，最终由全量回归核实。
Low非阻断：测试read调用数断言假定完整返回；生产bounded循环正确。非协作writer最后CAS→rename存在既有TOCTOU，全部密文/身份/时间原样恢复的历史不可观测，不声称绝对消除。

## 查询/RPC
d9d59965规格P1：大金额FP容差可接受不一致的零余额。已纯解析复现，用源decimal<=64字符严格范围+BigInt十进制对齐精确比较关闭；不能FP容差猜金额。
87b690ed复审spec PASS，代码发现P1 DNS未取消但超时先释放槽、P2默认service未siteScoped；已引入内部DNSsettlement租约，并统一默认service及apply。旧preIO未配置测试明确注入legacy query，不将新默认入口测试改跳过。
5d095f91独立code PASS，18/18纯内存HTTP/新站查询fresh回归：三轮DNS停4/超时不迟发HTTP，settle1只开放1槽，全部settle后pending0/HTTP0。默认service在真实SDK源fixturereads1/BALANCE_KEY/network0。finalbuild仍另跑，不能用source证明旧lib已更新。

## 界面/分发
UI实现已完成并经9e34及7ba只读spec/code PASS，最终client hash743ee6dfb909f39cf1a414012d0ca90afc6f85c491b90179c8b7117f2f477c19。Low close-first-pending→reopen可手动reload恢复不阻断。最后追加test的错误存在性假设由lead更正为所有write禁用/回调noRPC且无legacy编辑，保留不降级断言，完整233/233；实际SDK16/16；5项build/local/sdk/pack/extract全部exit0，53包文件逐hash吻合。
UI实现者cfe无closing因runtime失败，所有writer停止后Lead用final hashes与full tests接手收尾；不能称其未发的DONE。BSK CLI与plugin不匹配(--policy unsupported)导致sync失败；已关闭session vjqq，未改工具或换backend绕过，真实GUI未验收。

## 审查执行边界
某query复审者试图用test-name-pattern排除隔离DPAPI测试未生效，31项全跑并由fixture自身清理；其如实报告，不能宣称该轮全程零文件写。此额外写仅tests/.fixtures，未触真实vault/config、未实际联网/安装。其后审查限定纯内存测试。本轮实现及正式测试均不获真实账号迁移、供应商Key导入或查询授权。
