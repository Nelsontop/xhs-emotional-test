# xhs-tests-runnable-v3

## 线上产品感升级点
- ✅ 一题一页 & 选完自动下一题
- ✅ 断点续答（localStorage 自动保存进度）
- ✅ 分享链接（把结果编码在 URL hash，打开即可复现结果页）
- ✅ 结果可视化：安全感雷达图、情绪劳动条形图
- ✅ 海报下载 PNG（纯前端 canvas 渲染，无第三方库）

## 运行方式
1. 解压
2. 双击打开 `index.html`
3. 手机端体验更像线上产品

## 部署方式（正式版）
这是纯静态站，可直接部署到：
- GitHub Pages
- Vercel / Netlify
- 任何对象存储静态托管（OSS / COS / S3）

## 修改题库
编辑：
- `data/relationship_security_test_v1.json`
- `data/emotional_labor_index_test_v1.json`

然后运行（可选）：
```bash
python tools/build_data_js.py
```
它会把 JSON 转成 `data/*.js`（挂到 window.TESTS），保证 file:// 直接打开也能跑。

## 注意
- 分享链接用 hash (`#share=...`)：非常适合静态站，不依赖后端。
- 若你要做“付费解锁报告/兑换码”，建议加后端或用无服务器函数（Cloudflare/Vercel）。

## v3 新增
- ✅ 海报更像小红书：1080×1440 版式、留白与更适合晒图的视觉
- ✅ 结果页一键导出长图（整页报告）
- ✅ 测前引导更强：3秒告诉用户“你会得到什么、测完能做什么”
