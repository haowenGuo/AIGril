# Blog Content Guide

这个目录就是博客的内容层，后续大部分更新都只需要改这里。

## 文件说明

- `site.json`
  - 站点基础信息
  - 首页 Hero 文案
  - About 页面内容
  - Featured Projects
  - Inspirations

- `posts.json`
  - 博客文章列表
  - 每篇文章包含 slug、标题、摘要、时间、标签和正文段落

## 后续如何更新

### 新增文章

在 `posts.json` 里追加一个对象：

```json
{
  "slug": "my-new-post",
  "title": "My New Post",
  "summary": "文章摘要",
  "published_at": "2026-04-17",
  "reading_time": "4 min",
  "featured": false,
  "tags": ["notes", "devlog"],
  "content": [
    "第一段。",
    "第二段。"
  ]
}
```

### 修改首页 / About / Projects

直接编辑 `site.json`。

## 当前博客页面

- `/blog`
- `/blog/about`
- `/blog/projects`
- `/blog/writing`
- `/blog/{slug}`
