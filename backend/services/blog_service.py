import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


BLOG_DIR = Path(__file__).resolve().parent.parent / "blog_content"
POSTS_PATH = BLOG_DIR / "posts.json"
SITE_PATH = BLOG_DIR / "site.json"


@dataclass(frozen=True)
class FeaturedProject:
    name: str
    description: str
    link: str


@dataclass(frozen=True)
class AboutSection:
    title: str
    body: str


@dataclass(frozen=True)
class InspirationLink:
    name: str
    url: str
    note: str


@dataclass(frozen=True)
class BlogSite:
    site_title: str
    site_subtitle: str
    hero_title: str
    hero_intro: str
    bio: str
    location: str
    email: str
    github: str
    x: str
    now_title: str
    now_text: str
    about_sections: list[AboutSection]
    featured_projects: list[FeaturedProject]
    inspirations: list[InspirationLink]


@dataclass(frozen=True)
class BlogPost:
    slug: str
    title: str
    summary: str
    published_at: str
    reading_time: str
    featured: bool
    tags: list[str]
    content: list[str]


def _load_site() -> BlogSite:
    with SITE_PATH.open("r", encoding="utf-8") as file:
        raw_site = json.load(file)

    return BlogSite(
        site_title=str(raw_site["site_title"]),
        site_subtitle=str(raw_site["site_subtitle"]),
        hero_title=str(raw_site["hero_title"]),
        hero_intro=str(raw_site["hero_intro"]),
        bio=str(raw_site["bio"]),
        location=str(raw_site["location"]),
        email=str(raw_site["email"]),
        github=str(raw_site["github"]),
        x=str(raw_site.get("x", "")),
        now_title=str(raw_site["now_title"]),
        now_text=str(raw_site["now_text"]),
        about_sections=[
            AboutSection(title=str(item["title"]), body=str(item["body"]))
            for item in raw_site.get("about_sections", [])
        ],
        featured_projects=[
            FeaturedProject(
                name=str(item["name"]),
                description=str(item["description"]),
                link=str(item["link"]),
            )
            for item in raw_site.get("featured_projects", [])
        ],
        inspirations=[
            InspirationLink(
                name=str(item["name"]),
                url=str(item["url"]),
                note=str(item["note"]),
            )
            for item in raw_site.get("inspirations", [])
        ],
    )


def _load_posts() -> list[BlogPost]:
    with POSTS_PATH.open("r", encoding="utf-8") as file:
        raw_posts = json.load(file)
    return [
        BlogPost(
            slug=str(item["slug"]),
            title=str(item["title"]),
            summary=str(item["summary"]),
            published_at=str(item["published_at"]),
            reading_time=str(item.get("reading_time", "")),
            featured=bool(item.get("featured", False)),
            tags=[str(tag) for tag in item.get("tags", [])],
            content=[str(paragraph) for paragraph in item.get("content", [])],
        )
        for item in raw_posts
    ]


@lru_cache()
def get_blog_site() -> BlogSite:
    return _load_site()


@lru_cache()
def get_blog_posts() -> list[BlogPost]:
    return _load_posts()


def get_blog_post(slug: str) -> BlogPost | None:
    for post in get_blog_posts():
        if post.slug == slug:
            return post
    return None


def get_featured_posts() -> list[BlogPost]:
    return [post for post in get_blog_posts() if post.featured]
