# 好好生活指南

将 [eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter) 的正文建议变成一张张生活闪卡。公开网页： https://how-to-live-better-cards.duamont.chatgpt.site

当前源版本 `df6df704c8f364b936528ae1e1e22e47e4f0b274`，整理日期 2026-10-12，共 34 个主题、687 条建议。正面是一个小提醒，背面保留原作「说人话」、完整备注、成本、收益、证据等级与来源。原作的争议、待核实和适用人群标签会显示在卡片上。延伸长文主要是正文的重排，保留在源快照中，不重复加入牌组。

## 发布到 GitHub Pages

本项目是纯静态网页，已经提供完整的 `dist/` 文件和 `.github/workflows/pages.yml`，不需要安装依赖、构建、服务器或 API 密钥。

1. 在 GitHub 新建一个 **Public** 仓库，默认分支使用 `main`。仓库名可使用 `how-to-live-better-cards`。
2. 解压项目包，将 `how-to-live-better-github/` 文件夹**里面的文件**上传到仓库根目录。确保 `.github/workflows/pages.yml` 也一起上传；仓库根目录应直接看到 `README.md`、`package.json`、`dist/`、`scripts/`、`content/`、`tests/` 和 `.github/`，不要再套一层项目文件夹，也不要只上传 ZIP。
3. 打开仓库 **Settings → Pages → Build and deployment**，将 **Source** 设为 **GitHub Actions**。
4. 打开 **Actions → Deploy to GitHub Pages → Run workflow**，选择 `main` 并运行。发布成功后，在该工作流或 **Settings → Pages** 查看网站链接。

之后每次向 `main` 提交修改，工作流会自动重新发布 `dist/`。如果使用其他分支，请同步修改 `pages.yml` 中的分支名。项目使用相对资源地址，支持 `https://用户名.github.io/仓库名/` 这样的仓库子路径。

GitHub Free 的 Pages 适用于公开仓库。配置参考 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。工作流只发布网站，不会自动创建仓库。

## 上传源码的命令方式（可选）

先在 GitHub 创建空仓库，然后进入解压后的项目文件夹，将下面的仓库地址换成自己的地址：

```sh
git init -b main
git add .
git commit -m "Publish 好好生活指南"
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

再按上面的第 3、4 步启用 GitHub Pages。

## 使用

- 每轮 Fisher–Yates 随机洗牌，所有卡片看完前不重复。
- 最后一张之后再点「下一张」，自动开始新一轮；多于一张时避免连续两轮首尾相同。
- 主题切换有独立进度；回看不减少本轮已抽数量。
- 进度、选择、当前主题、报告姓名和收藏保存在浏览器 localStorage；不可用时退回当前页面内存。已有旧版进度和收藏会迁移保留。
- 首页专注闪卡：手机首屏固定显示完整卡框、勾选和操作按钮，长内容只在卡片内部滚动。
- 图鉴、卡册和报告通过按钮进入独立界面；桌面采用侧边导航，手机使用底部导航。
- 竖版卡牌按可用高度调整宽度，徽章放大、问题字号收紧；主题与操作入口使用星形纹理和大色块。
- 支持游戏式主题图鉴、34套独立卡牌皮肤、全文搜索、收藏、原文和研究链接。
- 每张卡底部并排显示「不同意 / 不想做 / 用不到」「做到了」「加入todo」。todo 是待办，会继续参加下一轮；标记做到了或暂不采用时自动移出todo，并退出下一轮。
- todo 可在卡册筛选查看和移除，刷新后保留；它不增加指数或点亮金标。
- 界面已移除按钮说明、装饰英文和页脚提示，保留卡片建议、证据与来源。
- 每主题全部卡牌已勾选时点亮金标，取消后金标熄灭；卡册可按选择状态查看。
- 可手动生成当前报告，名字任意填写；扫完一轮、扫完主题或点亮金标时自动弹出报告。报告包含唯一看过数、做到数、暂不采用数及全部主题进展，并可下载SVG。
- 好好生活指数 =（唯一看过比例 × 30% + 做到比例 × 70%）× 100，四舍五入到整数，仅记录卡片进展。
- 快捷键：空格翻卡，左右方向键切换，S 收藏。

## 本地运行

无需安装依赖或构建。使用 Node 18+、Python 3.9+：

```sh
npm run dev
```

访问 http://127.0.0.1:4173 。`dist/` 可直接部署到任意静态托管服务。

```sh
npm test
npm run sync
python3 scripts/content_sync.py --refresh
python3 scripts/package-source.py
```

`sync` 默认从 `content/source/` 的离线快照重新生成数据，`--refresh` 才读取上游新版本。重新生成后需重新发布。新增、删除卡片会安全重置对应主题的抽卡进度。公开网页中的「关于这副卡片」可下载数据与完整网页源码。

## 文件

- `dist/index.html`、`styles.css`、`app.js`：无框架网页。
- `dist/deck-engine.js`、`progress-store.js`：随机牌组、互斥选择、累计统计和持久化。
- `dist/themes.js`、`themes.css`：34主题皮肤与6个卡牌系列。
- `dist/layout.css`：手机首屏、桌面精简布局、独立面板与卡内滚动。
- `dist/card-table.css`：竖版卡牌、桌面侧边导航与纹理按钮。
- `.github/workflows/pages.yml`：将 `dist/` 自动发布到 GitHub Pages。
- `dist/report.js`、`report.css`：报告界面与SVG导出。
- `dist/cards.json`、`source-meta.json`：卡片和来源元信息。
- `content/source/`：固定上游版本的正文、延伸指南与许可证快照。
- `scripts/content_sync.py`、`content-build.mjs`：可复现的内容同步与提取。
- `tests/`：抽卡完整性、下一轮排除、恢复、状态互斥、旧版迁移、金标、报告去重与边界条件测试。

## 许可与归属

卡片及原作正文依据 **CC BY 4.0** 使用，作者 eternity4719 与 HowToLiveBetter 社区贡献者。具体归属、来源版本和改编说明见 `dist/CONTENT-LICENSE.txt` 与 `source-meta.json`。卡片仅改变展示结构并移除 Markdown 格式，没有另行补写医学、法律或理财结论。原作的 A/B/C 分级定义保留在「关于这副卡片」和元数据中。

本网页新增代码采用 MIT，见 `LICENSE`。原指南仓库自身的代码和内容许可分别保留在 `content/source/` 中。
