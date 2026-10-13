# 卡片内容与来源

卡片内容来自 eternity4719 的[《高性价比人生指南》](https://github.com/eternity4719/HowToLiveBetter)，按照 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。许可证原文保留于 `LICENSE-CC-BY-4.0` 与 `source/LICENSE`，网站发布包提供 `CONTENT-LICENSE.txt`。

源版本、同步日期与文件范围记录在 `source-manifest.json`。`source/book/` 保留 34 章的完整原文，`source/docs/` 保留 README 指向的九篇长文，`source/README.md` 保留导航、术语和证据分级说明。快照不包含上游代码、skills、代理指令与 Git 元数据。

每个正文 `### N. 建议` 对应一张卡片。正面使用原建议标题，背面使用原文「说人话」；成本、收益、完整备注、证据等级与全部来源另有字段保留。改动限于 JSON 转换和移除 Markdown 格式，不自行重写医学、法律或理财结论。`sourceUrl` 固定到同步版本的 commit 和准确行范围，可追溯这一张卡片的全文。

九篇长文是正文条目的扩展、对照表或场景清单，不再重复抽卡。延伸阅读和可解析出的正文映射保存在 `dist/source-meta.json` 的 `guides` 字段。`docs/核实记录/` 是原作者的核验历史，不另作建议卡片。

离线生成：

```sh
python3 scripts/content_sync.py
```

更新到源库最新版本（需要网络与 Git）：

```sh
python3 scripts/content_sync.py --refresh
```

也可从已有的原库 checkout 导入：

```sh
python3 scripts/content_sync.py --from /path/to/HowToLiveBetter
```

生成器会校验正文计数与 README 一致、ID 唯一、必填字段完整、证据等级合法、来源链接格式有效。离线生成仅依赖 Python 3 与 Node.js，无第三方包。数据 schema 见 `cards.schema.json`。

证据分级沿用原作者定义：A 表示有数字可核查的荟萃分析、大型队列或随机试验，法律政策条目的 A 表示引用到官方原文；B 表示有研究支持但没有确切数字，或只有小样本/单项研究；C 表示作者经验或公认做法、缺少直接研究文献。A 不代表必然是因果。作者自己的性价比判断也不等于证据等级。

原书内容可能过时，也可能有错；各地政策执行可能不同。办事、看病、打官司时，以当地部门、医生和律师的说法为准。
