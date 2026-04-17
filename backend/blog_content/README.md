# Blog Content Guide

这个目录就是博客的内容层。以后大多数更新都只需要改这里。

如果你准备让其他 AI 来帮你发文，优先先看：

- `PUBLISHING_GUIDE.md`
- `templates/post_template_zh.md`
- `templates/post_template_en.md`
- `templates/posts_json_entry_template.json`

## 结构

- `site.json`
  - 站点配置
  - 支持 `zh` / `en` 两套文案
  - 首页、About、Projects、Writing 的静态内容都放这里

- `posts.json`
  - 文章元数据
  - 每篇文章支持多语言翻译
  - 通过 `body_file` 指向 Markdown 正文

- `posts/zh/*.md`
  - 中文文章正文

- `posts/en/*.md`
  - 英文文章正文

## 新增文章

1. 在 `posts/zh/` 和 `posts/en/` 下分别新建 Markdown 文件
2. 在 `posts.json` 中新增一条文章记录
3. 提交并推送，Render 会自动更新

## 推荐流程

1. 先阅读 `PUBLISHING_GUIDE.md`
2. 按模板写中英文文章
3. 复制 `posts_json_entry_template.json` 作为元数据起点
4. 提交并推送

## 当前页面

- `/blog`
- `/blog/about`
- `/blog/projects`
- `/blog/writing`
- `/blog/{slug}`
- `/en/blog`
- `/en/blog/about`
- `/en/blog/projects`
- `/en/blog/writing`
- `/en/blog/{slug}`
