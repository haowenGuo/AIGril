from html import escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from backend.services.blog_service import get_blog_post, get_blog_posts


router = APIRouter()


def _page_shell(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    :root {{
      --bg: #f6f7fb;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --accent: #2563eb;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      color: var(--text);
    }}
    .wrap {{
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 20px 72px;
    }}
    .hero {{
      margin-bottom: 28px;
      padding: 28px 30px;
      border: 1px solid rgba(37, 99, 235, 0.12);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(8px);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }}
    .hero h1 {{
      margin: 0 0 10px;
      font-size: 36px;
      line-height: 1.15;
    }}
    .hero p {{
      margin: 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.7;
    }}
    .nav {{
      display: flex;
      gap: 14px;
      margin-top: 18px;
      flex-wrap: wrap;
    }}
    .nav a, .post-link {{
      color: var(--accent);
      text-decoration: none;
    }}
    .card {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 22px 24px;
      margin-bottom: 18px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
    }}
    .meta {{
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 12px;
    }}
    .tags {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }}
    .tag {{
      display: inline-block;
      font-size: 12px;
      color: #1d4ed8;
      background: #dbeafe;
      border-radius: 999px;
      padding: 5px 10px;
    }}
    .content p {{
      line-height: 1.85;
      color: #1e293b;
      margin: 0 0 14px;
    }}
    .footer {{
      margin-top: 32px;
      color: var(--muted);
      font-size: 13px;
      text-align: center;
    }}
    @media (max-width: 640px) {{
      .hero h1 {{
        font-size: 28px;
      }}
      .card {{
        padding: 18px;
      }}
    }}
  </style>
</head>
<body>
  <main class="wrap">
    {body}
    <div class="footer">
      Powered by AIGril FastAPI backend on Render
    </div>
  </main>
</body>
</html>
"""


@router.get("/blog")
async def blog_home():
    posts = get_blog_posts()
    post_cards = []
    for post in posts:
        tags = "".join(
            f'<span class="tag">{escape(tag)}</span>'
            for tag in post.tags
        )
        post_cards.append(
            f"""
            <article class="card">
              <div class="meta">{escape(post.published_at)}</div>
              <h2><a class="post-link" href="/blog/{escape(post.slug)}">{escape(post.title)}</a></h2>
              <p>{escape(post.summary)}</p>
              <div class="tags">{tags}</div>
            </article>
            """
        )

    body = f"""
    <section class="hero">
      <h1>My Blog</h1>
      <p>一个先上线、后打磨的个人博客。现在先把最小版本部署好，后续再慢慢补充正式内容、项目记录和随笔。</p>
      <div class="nav">
        <a href="/">AIGril Backend</a>
        <a href="/docs">API Docs</a>
      </div>
    </section>
    {''.join(post_cards)}
    """
    return HTMLResponse(_page_shell("My Blog", body))


@router.get("/blog/{slug}")
async def blog_post(slug: str):
    post = get_blog_post(slug)
    if post is None:
        raise HTTPException(status_code=404, detail="文章不存在")

    tags = "".join(
        f'<span class="tag">{escape(tag)}</span>'
        for tag in post.tags
    )
    paragraphs = "".join(
        f"<p>{escape(paragraph)}</p>"
        for paragraph in post.content
    )
    body = f"""
    <section class="hero">
      <div class="meta">{escape(post.published_at)}</div>
      <h1>{escape(post.title)}</h1>
      <p>{escape(post.summary)}</p>
      <div class="nav">
        <a href="/blog">← 返回博客首页</a>
        <a href="/docs">API Docs</a>
      </div>
    </section>
    <article class="card content">
      {paragraphs}
      <div class="tags">{tags}</div>
    </article>
    """
    return HTMLResponse(_page_shell(post.title, body))


@router.get("/blog/")
async def blog_home_slash():
    return RedirectResponse(url="/blog", status_code=307)
