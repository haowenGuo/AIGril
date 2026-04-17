from html import escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from backend.services.blog_service import (
    BlogPost,
    BlogSite,
    get_blog_post,
    get_blog_posts,
    get_blog_site,
    get_featured_posts,
)


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
      --bg: #f7f5ef;
      --card: #ffffff;
      --text: #172033;
      --muted: #5b6475;
      --line: #e6e1d8;
      --accent: #1d4ed8;
      --accent-soft: #dbeafe;
      --warm: #f4ede1;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      font-family: "Georgia", "Times New Roman", "PingFang SC", "Microsoft YaHei", serif;
      background:
        radial-gradient(circle at top left, #fff8eb 0%, rgba(255, 248, 235, 0.5) 28%, transparent 52%),
        linear-gradient(180deg, #faf8f3 0%, #f3efe5 100%);
      color: var(--text);
    }}
    .wrap {{
      max-width: 980px;
      margin: 0 auto;
      padding: 34px 20px 80px;
    }}
    .topbar {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }}
    .brand {{
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }}
    .topnav {{
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
    }}
    .topnav a {{
      color: var(--text);
      text-decoration: none;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
    }}
    .hero {{
      margin-bottom: 30px;
      padding: 34px 36px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.05);
    }}
    .hero h1 {{
      margin: 0 0 10px;
      font-size: 48px;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }}
    .hero p {{
      margin: 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.8;
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
    .grid {{
      display: grid;
      grid-template-columns: minmax(0, 1.75fr) minmax(260px, 0.95fr);
      gap: 20px;
      align-items: start;
      margin-bottom: 22px;
    }}
    .card {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 24px 26px;
      margin-bottom: 18px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
    }}
    .card h2 {{
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 28px;
      line-height: 1.2;
    }}
    .eyebrow {{
      display: inline-block;
      margin-bottom: 14px;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
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
      background: var(--accent-soft);
      border-radius: 999px;
      padding: 5px 10px;
    }}
    .content p {{
      line-height: 1.95;
      color: #1e293b;
      margin: 0 0 18px;
      font-size: 18px;
    }}
    .list {{
      display: grid;
      gap: 14px;
    }}
    .list-item {{
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }}
    .list-item:last-child {{
      border-bottom: none;
      padding-bottom: 0;
    }}
    .list-item h3 {{
      margin: 0 0 8px;
      font-size: 20px;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }}
    .list-item p {{
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.75;
    }}
    .prose h2 {{
      margin-top: 0;
      font-size: 38px;
      line-height: 1.08;
      letter-spacing: -0.02em;
    }}
    .section-title {{
      margin: 0 0 14px;
      font-size: 24px;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }}
    .muted {{
      color: var(--muted);
    }}
    .cta {{
      display: inline-block;
      margin-top: 12px;
      padding: 10px 14px;
      color: white;
      background: var(--accent);
      border-radius: 999px;
      text-decoration: none;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
    }}
    .quote {{
      margin: 0;
      padding: 18px 20px;
      border-left: 4px solid #cbd5e1;
      border-radius: 14px;
      background: var(--warm);
      color: #334155;
      line-height: 1.8;
    }}
    .footer {{
      margin-top: 40px;
      color: var(--muted);
      font-size: 13px;
      text-align: center;
    }}
    @media (max-width: 820px) {{
      .grid {{
        grid-template-columns: 1fr;
      }}
    }}
    @media (max-width: 640px) {{
      .hero h1 {{
        font-size: 34px;
      }}
      .card {{
        padding: 18px;
      }}
    }}
  </style>
</head>
<body>
  <main class="wrap">
    <div class="topbar">
      <div class="brand">Personal Blog Framework</div>
      <nav class="topnav">
        <a href="/blog">Home</a>
        <a href="/blog/about">About</a>
        <a href="/blog/projects">Projects</a>
        <a href="/blog/writing">Writing</a>
      </nav>
    </div>
    {body}
    <div class="footer">
      Powered by AIGril FastAPI backend on Render
    </div>
  </main>
</body>
</html>
"""


def _render_post_card(post: BlogPost) -> str:
    tags = "".join(
        f'<span class="tag">{escape(tag)}</span>'
        for tag in post.tags
    )
    reading = f" · {escape(post.reading_time)}" if post.reading_time else ""
    return f"""
    <article class="card">
      <div class="meta">{escape(post.published_at)}{reading}</div>
      <h2><a class="post-link" href="/blog/{escape(post.slug)}">{escape(post.title)}</a></h2>
      <p>{escape(post.summary)}</p>
      <div class="tags">{tags}</div>
    </article>
    """


def _render_project_card(name: str, description: str, link: str) -> str:
    return f"""
    <div class="list-item">
      <h3><a class="post-link" href="{escape(link)}" target="_blank">{escape(name)}</a></h3>
      <p>{escape(description)}</p>
    </div>
    """


def _home_page(site: BlogSite, featured_posts: list[BlogPost], recent_posts: list[BlogPost]) -> str:
    featured_section = "".join(_render_post_card(post) for post in featured_posts)
    recent_section = "".join(_render_post_card(post) for post in recent_posts)
    project_section = "".join(
        _render_project_card(project.name, project.description, project.link)
        for project in site.featured_projects
    )
    inspiration_section = "".join(
        f'<div class="list-item"><h3><a class="post-link" href="{escape(item.url)}" target="_blank">{escape(item.name)}</a></h3><p>{escape(item.note)}</p></div>'
        for item in site.inspirations
    )

    return f"""
    <section class="hero">
      <div class="eyebrow">{escape(site.site_subtitle)}</div>
      <h1>{escape(site.hero_title)}</h1>
      <p>{escape(site.hero_intro)}</p>
      <div class="nav">
        <a href="/blog/writing">Read writing</a>
        <a href="/blog/projects">View projects</a>
        <a href="/blog/about">About me</a>
      </div>
    </section>

    <section class="grid">
      <div>
        <article class="card">
          <div class="eyebrow">Recent writing</div>
          <h2 class="section-title">Recent posts</h2>
          {recent_section}
        </article>
      </div>
      <div>
        <article class="card">
          <div class="eyebrow">{escape(site.now_title)}</div>
          <p class="muted">{escape(site.now_text)}</p>
        </article>
        <article class="card">
          <div class="eyebrow">About</div>
          <p class="muted">{escape(site.bio)}</p>
          <a class="cta" href="/blog/about">Read more</a>
        </article>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <div class="eyebrow">Featured writing</div>
        <h2 class="section-title">Start here</h2>
        {featured_section}
      </article>
      <article class="card">
        <div class="eyebrow">Projects</div>
        <h2 class="section-title">Selected work</h2>
        <div class="list">{project_section}</div>
      </article>
    </section>

    <section class="grid">
      <article class="card">
        <div class="eyebrow">Inspiration</div>
        <h2 class="section-title">Blog references</h2>
        <div class="list">{inspiration_section}</div>
      </article>
      <article class="card">
        <div class="eyebrow">How to update</div>
        <h2 class="section-title">Future workflow</h2>
        <p class="muted">以后你主要只需要修改 <code>backend/blog_content/site.json</code> 和 <code>backend/blog_content/posts.json</code>，不需要动页面代码。</p>
      </article>
    </section>
    """


@router.get("/blog")
async def blog_home():
    site = get_blog_site()
    posts = get_blog_posts()
    body = _home_page(site, get_featured_posts(), posts[:6])
    return HTMLResponse(_page_shell(site.site_title, body))


@router.get("/blog/about")
async def blog_about():
    site = get_blog_site()
    sections = "".join(
        f'<article class="card"><div class="eyebrow">{escape(section.title)}</div><p class="muted">{escape(section.body)}</p></article>'
        for section in site.about_sections
    )
    body = f"""
    <section class="hero">
      <div class="eyebrow">About</div>
      <h1>{escape(site.site_title)}</h1>
      <p>{escape(site.bio)}</p>
      <div class="nav">
        <a href="{escape(site.github)}" target="_blank">GitHub</a>
        <a href="mailto:{escape(site.email)}">Email</a>
      </div>
    </section>
    <section class="grid">
      <div>{sections}</div>
      <div>
        <article class="card">
          <div class="eyebrow">Base</div>
          <p class="muted">Location: {escape(site.location)}</p>
          <p class="muted">Email: {escape(site.email)}</p>
          <p class="muted">GitHub: <a class="post-link" href="{escape(site.github)}" target="_blank">{escape(site.github)}</a></p>
        </article>
        <article class="card">
          <div class="eyebrow">{escape(site.now_title)}</div>
          <p class="muted">{escape(site.now_text)}</p>
        </article>
      </div>
    </section>
    """
    return HTMLResponse(_page_shell(f"{site.site_title} · About", body))


@router.get("/blog/projects")
async def blog_projects():
    site = get_blog_site()
    project_cards = "".join(
        f'<article class="card"><div class="eyebrow">Project</div><h2><a class="post-link" href="{escape(project.link)}" target="_blank">{escape(project.name)}</a></h2><p>{escape(project.description)}</p></article>'
        for project in site.featured_projects
    )
    body = f"""
    <section class="hero">
      <div class="eyebrow">Projects</div>
      <h1>Selected projects</h1>
      <p>这里会逐步收录我认为值得长期维护和展示的项目。当前先保留最核心的两个入口，后面你只需要继续往 site.json 里追加项目即可。</p>
    </section>
    {project_cards}
    """
    return HTMLResponse(_page_shell(f"{site.site_title} · Projects", body))


@router.get("/blog/writing")
async def blog_writing():
    site = get_blog_site()
    posts = "".join(_render_post_card(post) for post in get_blog_posts())
    body = f"""
    <section class="hero">
      <div class="eyebrow">Writing</div>
      <h1>All writing</h1>
      <p>这里是文章列表页。后续无论你写项目复盘、技术笔记、周记还是更个人化的随笔，都可以沿用同一套结构。</p>
    </section>
    {posts}
    """
    return HTMLResponse(_page_shell(f"{site.site_title} · Writing", body))


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
    reading = f" · {escape(post.reading_time)}" if post.reading_time else ""
    body = f"""
    <section class="hero">
      <div class="meta">{escape(post.published_at)}{reading}</div>
      <h1>{escape(post.title)}</h1>
      <p>{escape(post.summary)}</p>
      <div class="nav">
        <a href="/blog/writing">← Back to writing</a>
        <a href="/blog/projects">Projects</a>
      </div>
    </section>
    <article class="card content prose">
      {paragraphs}
      <div class="tags">{tags}</div>
    </article>
    """
    return HTMLResponse(_page_shell(post.title, body))


@router.get("/blog/")
async def blog_home_slash():
    return RedirectResponse(url="/blog", status_code=307)
