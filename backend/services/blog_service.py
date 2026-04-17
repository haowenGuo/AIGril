import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


BLOG_CONTENT_PATH = Path(__file__).resolve().parent.parent / "blog_content" / "posts.json"


@dataclass(frozen=True)
class BlogPost:
    slug: str
    title: str
    summary: str
    published_at: str
    tags: list[str]
    content: list[str]


def _load_posts() -> list[BlogPost]:
    with BLOG_CONTENT_PATH.open("r", encoding="utf-8") as file:
        raw_posts = json.load(file)
    return [
        BlogPost(
            slug=str(item["slug"]),
            title=str(item["title"]),
            summary=str(item["summary"]),
            published_at=str(item["published_at"]),
            tags=[str(tag) for tag in item.get("tags", [])],
            content=[str(paragraph) for paragraph in item.get("content", [])],
        )
        for item in raw_posts
    ]


@lru_cache()
def get_blog_posts() -> list[BlogPost]:
    return _load_posts()


def get_blog_post(slug: str) -> BlogPost | None:
    for post in get_blog_posts():
        if post.slug == slug:
            return post
    return None
