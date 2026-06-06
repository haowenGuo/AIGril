#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { callDesktopLlmProvider } = require('../electron/desktop-llm-provider.cjs');

const SERVER_INFO = { name: 'aigl_research', version: '0.1.0' };
const PROTOCOL_VERSION = '2025-06-18';
const MAX_FETCH_CHARS = 24000;

function normalizeString(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
}

function clampNumber(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(min, Math.min(Math.round(numeric), max));
}

function readDesktopLlmSettings() {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    const statePath = path.join(appData, 'humanclaw', 'desktop-state.json');
    if (!fsSync.existsSync(statePath)) {
        return null;
    }
    const state = JSON.parse(fsSync.readFileSync(statePath, 'utf8'));
    const preferences = state.preferences || {};
    const apiKey = normalizeString(
        preferences.llmApiKey ||
        process.env.DOUBAO_API_KEY ||
        process.env.ARK_API_KEY ||
        process.env.VOLCENGINE_API_KEY ||
        process.env.OPENAI_COMPATIBLE_API_KEY
    );
    const settings = {
        provider: normalizeString(preferences.llmProvider, 'openai-compatible'),
        baseUrl: normalizeString(preferences.llmBaseUrl, 'https://ark.cn-beijing.volces.com/api/v3'),
        model: normalizeString(preferences.llmModel, 'doubao-seed-2-0-mini-260215'),
        apiKey,
        temperature: 0,
        timeoutMs: 120000
    };
    return settings.baseUrl && settings.model && settings.apiKey ? settings : null;
}

function imageMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.webp') return 'image/webp';
    return 'image/png';
}

function send(message) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

function textResult(text, details = {}) {
    const structuredContent = {
        ok: details.ok !== false,
        ...details
    };
    return {
        content: [{ type: 'text', text: normalizeString(text, JSON.stringify(details, null, 2)) }],
        structuredContent,
        details
    };
}

function errorResult(message, details = {}) {
    const structuredContent = {
        ok: false,
        status: 'error',
        error: message,
        ...details
    };
    return {
        content: [{ type: 'text', text: message }],
        isError: true,
        structuredContent,
        details: structuredContent
    };
}

function isPdfContentType(contentType = '') {
    return /application\/pdf|application\/x-pdf/i.test(contentType);
}

function isHtmlContentType(contentType = '') {
    return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

function isReadableTextContentType(contentType = '') {
    if (!contentType) {
        return true;
    }
    return /(^|\b)text\/|application\/(json|xml|javascript|xhtml\+xml)|\+json|\+xml/i.test(contentType);
}

function unsupportedContentTypeResult(toolName, url, fetched = {}, suggestedTools = []) {
    const contentType = fetched.contentType || 'unknown';
    return errorResult(
        `${toolName} only returns readable HTML or text. Unsupported content type: ${contentType}.`,
        {
            status: 'unsupported_content_type',
            errorCode: 'unsupported_content_type',
            tool: toolName,
            url,
            contentType,
            isBinary: Boolean(fetched.isBinary),
            suggestedTools
        }
    );
}

function safeDownloadName(rawUrl = '', fallback = 'download') {
    let basename = fallback;
    try {
        const parsed = new URL(rawUrl);
        basename = path.basename(parsed.pathname) || fallback;
    } catch {}
    basename = basename.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
    if (basename.length > 120) {
        const extension = path.extname(basename);
        basename = `${basename.slice(0, 100)}${extension}`;
    }
    return basename;
}

function decodeHtml(value = '') {
    return String(value)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(html = '') {
    return decodeHtml(String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n'))
        .trim();
}

function extractDuckDuckGoResults(html = '', maxResults = 8) {
    const rows = [];
    const linkPattern = /<a\s+rel="nofollow"\s+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>[\s\S]*?<td\s+class=['"]result-snippet['"]>([\s\S]*?)<\/td>/gi;
    let match;
    while ((match = linkPattern.exec(html)) && rows.length < maxResults) {
        const href = decodeHtml(match[1]);
        let url = href;
        try {
            const parsed = new URL(href.startsWith('//') ? `https:${href}` : href);
            const uddg = parsed.searchParams.get('uddg');
            if (uddg) {
                url = decodeURIComponent(uddg);
            }
        } catch {
            url = href;
        }
        rows.push({
            title: stripHtml(match[2]).replace(/\s+/g, ' '),
            url,
            snippet: stripHtml(match[3]).replace(/\s+/g, ' ')
        });
    }
    return rows;
}

function normalizeUrlCandidate(value = '') {
    const url = decodeHtml(String(value || '').trim());
    if (!url) {
        return '';
    }
    try {
        const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
        const target = parsed.searchParams.get('u') ||
            parsed.searchParams.get('url') ||
            parsed.searchParams.get('uddg');
        if (target) {
            const decodedTarget = decodeSearchRedirectTarget(target);
            return decodedTarget || decodeURIComponent(target);
        }
        return parsed.toString();
    } catch {
        return /^https?:\/\//i.test(url) ? url : '';
    }
}

function decodeSearchRedirectTarget(value = '') {
    const raw = decodeHtml(String(value || '').trim());
    if (!raw) {
        return '';
    }
    const decoded = decodeURIComponent(raw);
    if (/^https?:\/\//i.test(decoded)) {
        return decoded;
    }
    const candidates = [decoded, decoded.replace(/^a1/i, '')];
    for (const candidate of candidates) {
        if (!candidate || candidate.length < 8) {
            continue;
        }
        try {
            const padded = candidate.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(candidate.length / 4) * 4, '=');
            const text = Buffer.from(padded, 'base64').toString('utf8');
            if (/^https?:\/\//i.test(text)) {
                return text;
            }
        } catch {}
    }
    return '';
}

function dedupeSearchResults(results = [], maxResults = 8) {
    const seen = new Set();
    const rows = [];
    for (const result of results) {
        const url = normalizeUrlCandidate(result.url);
        if (!url || seen.has(url)) {
            continue;
        }
        const title = stripHtml(result.title || '').replace(/\s+/g, ' ').trim();
        const snippet = stripHtml(result.snippet || '').replace(/\s+/g, ' ').trim();
        if (!title && !snippet) {
            continue;
        }
        seen.add(url);
        rows.push({ title: title || url, url, snippet });
        if (rows.length >= maxResults) {
            break;
        }
    }
    return rows;
}

function extractBingResults(html = '', maxResults = 8) {
    const rows = [];
    const blockPattern = /<li\s+class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    let blockMatch;
    while ((blockMatch = blockPattern.exec(html)) && rows.length < maxResults * 2) {
        const block = blockMatch[1];
        const linkMatch = block.match(/<h2[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i) ||
            block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) {
            continue;
        }
        const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
            block.match(/<div[^>]*class=["'][^"']*\bb_caption\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        rows.push({
            title: linkMatch[2],
            url: linkMatch[1],
            snippet: snippetMatch ? snippetMatch[1] : ''
        });
    }
    return dedupeSearchResults(rows, maxResults);
}

const SEARCH_BACKENDS = Object.freeze({
    duckduckgo_lite: Object.freeze({
        id: 'duckduckgo_lite',
        buildUrl: (query) => `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
        extract: extractDuckDuckGoResults
    }),
    bing_html: Object.freeze({
        id: 'bing_html',
        buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        extract: extractBingResults
    })
});

function normalizeSearchBackends(args = {}) {
    const raw = Array.isArray(args.backends)
        ? args.backends
        : String(args.backend || args.searchBackend || args.search_backend || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    const requested = raw.length ? raw : ['duckduckgo_lite', 'bing_html'];
    const backends = requested
        .map((id) => SEARCH_BACKENDS[normalizeString(id).toLowerCase()])
        .filter(Boolean);
    return backends.length ? backends : [SEARCH_BACKENDS.duckduckgo_lite, SEARCH_BACKENDS.bing_html];
}

async function runSearchBackend(backend, query, maxResults, timeoutMs) {
    const startedAt = Date.now();
    const url = backend.buildUrl(query);
    const fetched = await fetchText(url, timeoutMs);
    const durationMs = Date.now() - startedAt;
    if (!fetched.ok) {
        return {
            ok: false,
            backend: backend.id,
            url,
            durationMs,
            status: fetched.status || 0,
            errorCode: fetched.errorCode || (fetched.timedOut ? 'timeout' : 'fetch_failed'),
            error: fetched.error || 'search fetch failed',
            stderr: fetched.stderr || '',
            retryable: true
        };
    }
    const results = backend.extract(fetched.text || '', maxResults);
    if (!results.length) {
        return {
            ok: false,
            backend: backend.id,
            url,
            durationMs,
            status: fetched.status || 0,
            errorCode: 'no_results_parsed',
            error: 'Search backend returned a page, but no result rows were parsed.',
            retryable: true
        };
    }
    return {
        ok: true,
        backend: backend.id,
        url,
        durationMs,
        status: fetched.status || 0,
        results
    };
}

async function webSearch(args = {}) {
    const query = normalizeString(args.query || args.q || args.search || args.text);
    if (!query) {
        return errorResult('web_search requires query');
    }
    const maxResults = clampNumber(args.maxResults || args.limit, 8, 1, 12);
    const timeoutMs = clampNumber(args.timeoutMs || args.timeout_ms, 45000, 5000, 120000);
    const attempts = [];
    for (const backend of normalizeSearchBackends(args)) {
        const attempt = await runSearchBackend(backend, query, maxResults, timeoutMs);
        attempts.push(attempt);
        if (!attempt.ok) {
            continue;
        }
        const text = attempt.results.map((item, index) => [
            `${index + 1}. ${item.title}`,
            `URL: ${item.url}`,
            `Snippet: ${item.snippet}`
        ].join('\n')).join('\n\n');
        return textResult(text, {
            status: 'completed',
            query,
            backend: attempt.backend,
            url: attempt.url,
            durationMs: attempt.durationMs,
            attempts,
            results: attempt.results
        });
    }
    return errorResult('web_search failed across all configured search backends', {
        status: 'search_failed',
        errorCode: 'search_backends_failed',
        query,
        retryable: true,
        attempts,
        suggestedTools: ['web_fetch', 'web_extract_links']
    });
}

async function webFetch(args = {}) {
    const url = normalizeString(args.url || args.uri);
    if (!/^https?:\/\//i.test(url)) {
        return errorResult('web_fetch requires http(s) url');
    }
    const maxChars = clampNumber(args.maxChars || args.max_chars, MAX_FETCH_CHARS, 1000, 80000);
    const wikiText = await maybeFetchWikipediaWikitext(url, 90000);
    const fetched = wikiText || await fetchText(url, 90000);
    if (!fetched.ok) {
        return errorResult(fetched.error || 'web_fetch fetch failed', { url, stderr: fetched.stderr });
    }
    const contentType = fetched.contentType || '';
    if (isPdfContentType(contentType) || fetched.isPdf || fetched.isBinary || !isReadableTextContentType(contentType)) {
        return unsupportedContentTypeResult('web_fetch', url, fetched, ['pdf_extract_text', 'download_file']);
    }
    const body = fetched.text;
    const text = fetched.kind === 'wikipedia_wikitext'
        ? stripWikiText(body)
        : /html/i.test(contentType) ? stripHtml(body) : body.trim();
    const focused = focusTextWindow(text, {
        query: args.query || args.contains || '',
        url,
        maxChars
    });
    return textResult(focused.text, {
        status: 'completed',
        url,
        contentType,
        originalChars: text.length,
        returnedChars: focused.text.length,
        focus: focused.focus
    });
}

async function webExtractLinks(args = {}) {
    const url = normalizeString(args.url || args.uri);
    if (!/^https?:\/\//i.test(url)) {
        return errorResult('web_extract_links requires http(s) url');
    }
    const maxLinks = clampNumber(args.maxLinks || args.max_links || args.limit, 80, 1, 300);
    const fetched = await fetchText(url, args.timeoutMs || 90000);
    if (!fetched.ok) {
        return errorResult(fetched.error || 'web_extract_links fetch failed', { url, stderr: fetched.stderr });
    }
    if ((fetched.contentType && !isHtmlContentType(fetched.contentType)) || fetched.isBinary) {
        return unsupportedContentTypeResult('web_extract_links', url, fetched, ['web_fetch', 'download_file']);
    }
    const links = [];
    const seen = new Set();
    const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = pattern.exec(fetched.text)) && links.length < maxLinks) {
        let href = decodeHtml(match[1]).trim();
        if (!href || href.startsWith('#') || /^javascript:/i.test(href)) {
            continue;
        }
        try {
            href = new URL(href, url).href;
        } catch {
            continue;
        }
        if (seen.has(href)) {
            continue;
        }
        seen.add(href);
        links.push({
            url: href,
            text: stripHtml(match[2]).slice(0, 240)
        });
    }
    const text = links.length
        ? links.map((link, index) => `${index + 1}. ${link.text || '(no text)'}\nURL: ${link.url}`).join('\n\n')
        : `No links extracted from: ${url}`;
    return textResult(text, { status: 'completed', url, links });
}

async function downloadFile(args = {}) {
    const url = normalizeString(args.url || args.uri);
    if (!/^https?:\/\//i.test(url)) {
        return errorResult('download_file requires http(s) url');
    }
    const outputDir = path.resolve(normalizeString(args.outputDir || args.output_dir, path.join(process.cwd(), 'tmp', 'aigl-research-downloads')));
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.resolve(outputDir, safeDownloadName(url, 'download.bin'));
    if (!outputPath.startsWith(outputDir + path.sep) && outputPath !== outputDir) {
        return errorResult('download_file output path escaped output directory', { url, outputDir, outputPath });
    }
    const code = `
import json, pathlib, requests, sys
url = sys.argv[1]
output_path = pathlib.Path(sys.argv[2])
timeout = float(sys.argv[3])
r = requests.get(url, timeout=timeout, headers={"User-Agent": "AIGLResearchMCP/0.1 (+local assistant research tool)"})
output_path.parent.mkdir(parents=True, exist_ok=True)
if 200 <= r.status_code < 400:
    output_path.write_bytes(r.content)
print(json.dumps({
  "status": r.status_code,
  "content_type": r.headers.get("content-type", ""),
  "content_length": len(r.content),
  "path": str(output_path),
}, ensure_ascii=False))
`.trim();
    const result = await runProcess('python', ['-c', code, url, outputPath, String(Math.max(5, Math.ceil((args.timeoutMs || 90000) / 1000)))], {
        timeoutMs: args.timeoutMs || 90000
    });
    if (result.exitCode !== 0) {
        return errorResult('download_file failed', { url, outputPath, stderr: result.stderr.slice(0, 3000) });
    }
    let payload;
    try {
        payload = JSON.parse(result.stdout);
    } catch (error) {
        return errorResult(`download_file invalid payload: ${error.message}`, { url, outputPath, stderr: result.stderr });
    }
    if (!(payload.status >= 200 && payload.status < 400)) {
        return errorResult(`download_file HTTP ${payload.status || 0}`, { url, outputPath, ...payload });
    }
    return textResult(`Downloaded ${url}\nPath: ${payload.path}\nContent-Type: ${payload.content_type}\nBytes: ${payload.content_length}`, {
        status: 'completed',
        url,
        path: payload.path,
        contentType: payload.content_type,
        bytes: payload.content_length
    });
}

async function pdfExtractText(args = {}) {
    const sourceUrl = normalizeString(args.url || args.uri);
    const sourcePath = normalizeString(args.path || args.file || args.filePath || args.file_path);
    if (!sourceUrl && !sourcePath) {
        return errorResult('pdf_extract_text requires url or path');
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
        return errorResult('pdf_extract_text url must be http(s)', { url: sourceUrl });
    }
    const maxChars = clampNumber(args.maxChars || args.max_chars, MAX_FETCH_CHARS, 1000, 120000);
    const maxPages = clampNumber(args.maxPages || args.max_pages, 24, 1, 300);
    const code = `
import json, os, pathlib, sys, tempfile
source_url = sys.argv[1]
source_path = sys.argv[2]
max_chars = int(sys.argv[3])
max_pages = int(sys.argv[4])
timeout = float(sys.argv[5])
content_type = ""
download_path = ""
path = pathlib.Path(source_path) if source_path else None
if source_url:
    import requests
    r = requests.get(source_url, timeout=timeout, headers={"User-Agent": "AIGLResearchMCP/0.1 (+local assistant research tool)"})
    content_type = r.headers.get("content-type", "")
    if not (200 <= r.status_code < 400):
        print(json.dumps({"ok": False, "status": r.status_code, "error": f"HTTP {r.status_code}", "content_type": content_type}, ensure_ascii=False))
        raise SystemExit(0)
    fd, tmp_name = tempfile.mkstemp(prefix="aigl_pdf_", suffix=".pdf")
    os.close(fd)
    path = pathlib.Path(tmp_name)
    path.write_bytes(r.content)
    download_path = str(path)
if not path or not path.exists():
    print(json.dumps({"ok": False, "error": "pdf path does not exist", "path": str(path or "")}, ensure_ascii=False))
    raise SystemExit(0)
data = path.read_bytes()[:8]
if not data.startswith(b"%PDF"):
    print(json.dumps({"ok": False, "error": "not a PDF file", "path": str(path), "content_type": content_type}, ensure_ascii=False))
    raise SystemExit(0)
engine = ""
pages = 0
parts = []
errors = []
try:
    try:
        from pypdf import PdfReader
        engine = "pypdf"
    except Exception:
        from PyPDF2 import PdfReader
        engine = "PyPDF2"
    reader = PdfReader(str(path))
    pages = len(reader.pages)
    for page in reader.pages[:max_pages]:
        try:
            parts.append(page.extract_text() or "")
        except Exception as exc:
            errors.append(str(exc))
except Exception as exc:
    try:
        import pdfplumber
        engine = "pdfplumber"
        with pdfplumber.open(str(path)) as pdf:
            pages = len(pdf.pages)
            for page in pdf.pages[:max_pages]:
                parts.append(page.extract_text() or "")
    except Exception as second:
        print(json.dumps({
            "ok": False,
            "error": "pdf parser unavailable or extraction failed",
            "parser_errors": [str(exc), str(second)],
            "path": str(path),
            "content_type": content_type,
        }, ensure_ascii=False))
        raise SystemExit(0)
text = "\\n\\n".join(part.strip() for part in parts if part and part.strip())
print(json.dumps({
    "ok": bool(text.strip()),
    "status": "completed" if text.strip() else "empty_text",
    "error": "" if text.strip() else "PDF extraction returned empty text",
    "source_url": source_url,
    "path": str(path),
    "download_path": download_path,
    "content_type": content_type,
    "engine": engine,
    "pages": pages,
    "max_pages": max_pages,
    "original_chars": len(text),
    "text": text[:max_chars],
}, ensure_ascii=False))
`.trim();
    const result = await runProcess('python', [
        '-c',
        code,
        sourceUrl,
        sourcePath,
        String(maxChars),
        String(maxPages),
        String(Math.max(5, Math.ceil((args.timeoutMs || 120000) / 1000)))
    ], {
        timeoutMs: args.timeoutMs || 120000
    });
    if (result.exitCode !== 0) {
        return errorResult('pdf_extract_text failed', { url: sourceUrl, path: sourcePath, stderr: result.stderr.slice(0, 3000) });
    }
    let payload;
    try {
        payload = JSON.parse(result.stdout);
    } catch (error) {
        return errorResult(`pdf_extract_text invalid payload: ${error.message}`, { url: sourceUrl, path: sourcePath, stderr: result.stderr });
    }
    if (!payload.ok) {
        return errorResult(payload.error || 'pdf_extract_text failed', {
            status: payload.status || 'error',
            errorCode: payload.status || 'pdf_extract_failed',
            url: sourceUrl,
            path: sourcePath,
            ...payload
        });
    }
    return textResult(payload.text, {
        status: 'completed',
        source: sourceUrl || sourcePath,
        url: sourceUrl,
        path: payload.path,
        downloadPath: payload.download_path,
        contentType: payload.content_type || 'application/pdf',
        engine: payload.engine,
        pages: payload.pages,
        maxPages: payload.max_pages,
        originalChars: payload.original_chars,
        returnedChars: String(payload.text || '').length
    });
}

async function maybeFetchWikipediaWikitext(rawUrl, timeoutMs = 90000) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }
    if (!/\.wikipedia\.org$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/wiki/')) {
        return null;
    }
    const pageTitle = decodeURIComponent(parsed.pathname.replace(/^\/wiki\//, '')).split('#')[0];
    if (!pageTitle || /Special:|File:|Category:/i.test(pageTitle)) {
        return null;
    }
    const apiUrl = `${parsed.protocol}//${parsed.hostname}/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json`;
    const fetched = await fetchText(apiUrl, timeoutMs);
    if (!fetched.ok) {
        return null;
    }
    try {
        const payload = JSON.parse(fetched.text);
        const text = payload?.parse?.wikitext?.['*'];
        if (!text) {
            return null;
        }
        return {
            ok: true,
            status: fetched.status,
            contentType: 'text/x-wiki',
            kind: 'wikipedia_wikitext',
            text,
            stderr: ''
        };
    } catch {
        return null;
    }
}

function stripWikiText(value = '') {
    return decodeHtml(String(value)
        .replace(/<ref[\s\S]*?<\/ref>/gi, ' ')
        .replace(/<ref[^>]*\/>/gi, ' ')
        .replace(/\{\{[\s\S]*?\}\}/g, ' ')
        .replace(/\[\[File:[^\]]+\]\]/gi, ' ')
        .replace(/\[\[Category:[^\]]+\]\]/gi, ' ')
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/''+/g, '')
        .replace(/\|-/g, '\n')
        .replace(/^\|[+!]?/gm, '')
        .replace(/^\|/gm, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n'))
        .trim();
}

function focusTextWindow(text, { query = '', url = '', maxChars = MAX_FETCH_CHARS } = {}) {
    const normalizedText = String(text || '');
    const terms = [];
    const explicitQuery = normalizeString(query);
    if (explicitQuery) {
        terms.push(explicitQuery);
    }
    try {
        const parsed = new URL(url);
        const hash = decodeURIComponent(parsed.hash || '').replace(/^#/, '').replace(/[_-]+/g, ' ').trim();
        if (hash) {
            terms.push(hash);
        }
    } catch {}
    const lower = normalizedText.toLowerCase();
    let selectedIndex = -1;
    let selectedTerm = '';
    for (const term of terms) {
        const lowerTerm = term.toLowerCase();
        if (!lowerTerm) {
            continue;
        }
        let index = lower.indexOf(lowerTerm);
        while (index >= 0) {
            selectedIndex = index;
            selectedTerm = term;
            index = lower.indexOf(lowerTerm, index + lowerTerm.length);
        }
        if (selectedIndex >= 0) {
            break;
        }
    }
    if (selectedIndex < 0) {
        return {
            text: normalizedText.slice(0, maxChars),
            focus: terms.length ? { mode: 'not_found', terms } : { mode: 'head' }
        };
    }
    const start = Math.max(0, selectedIndex - 2500);
    const end = Math.min(normalizedText.length, selectedIndex + maxChars);
    return {
        text: normalizedText.slice(start, end),
        focus: {
            mode: 'window',
            term: selectedTerm,
            start,
            end
        }
    };
}

function runProcess(command, args, options = {}) {
    const timeoutMs = clampNumber(options.timeoutMs, 120000, 1000, 600000);
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: options.cwd || process.cwd(),
            windowsHide: true,
            shell: false
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
        }, timeoutMs);
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('close', (exitCode) => {
            clearTimeout(timer);
            resolve({ exitCode, stdout, stderr, timedOut: exitCode === null });
        });
        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({ exitCode: -1, stdout, stderr: stderr || error.message, timedOut: false });
        });
    });
}

async function fetchText(url, timeoutMs = 60000) {
    const code = `
import json, requests, sys
url = sys.argv[1]
timeout = float(sys.argv[2])
r = requests.get(url, timeout=timeout, headers={"User-Agent": "AIGLResearchMCP/0.1 (+local assistant research tool)"})
content = r.content or b""
content_type = r.headers.get("content-type", "")
prefix = content[:16]
is_pdf = content.startswith(b"%PDF") or "application/pdf" in content_type.lower()
has_nul = b"\\x00" in content[:2048]
is_binary = is_pdf or has_nul
text = "" if is_binary else r.text
print(json.dumps({
  "status": r.status_code,
  "content_type": content_type,
  "content_length": len(content),
  "is_pdf": is_pdf,
  "is_binary": is_binary,
  "prefix_hex": prefix.hex(),
  "text": text,
}, ensure_ascii=False))
`.trim();
    const result = await runProcess('python', ['-c', code, url, String(Math.max(5, Math.ceil(timeoutMs / 1000)))], { timeoutMs });
    if (result.exitCode !== 0) {
        return {
            ok: false,
            timedOut: result.timedOut === true,
            errorCode: result.timedOut === true ? 'timeout' : 'fetch_process_failed',
            error: `python requests exit ${result.exitCode}`,
            stderr: result.stderr
        };
    }
    let payload;
    try {
        payload = JSON.parse(result.stdout);
    } catch (error) {
        return {
            ok: false,
            error: `invalid requests payload: ${error.message}`,
            stderr: result.stderr
        };
    }
    const status = Number(payload.status || 0);
    const contentType = normalizeString(payload.content_type);
    return {
        ok: status >= 200 && status < 400,
        status,
        errorCode: status >= 200 && status < 400 ? '' : `http_${status || 'unknown'}`,
        contentType,
        contentLength: Number(payload.content_length || 0),
        isPdf: payload.is_pdf === true,
        isBinary: payload.is_binary === true,
        prefixHex: normalizeString(payload.prefix_hex),
        text: String(payload.text || ''),
        stderr: result.stderr,
        error: status ? `HTTP ${status}` : ''
    };
}

async function runPythonFile(args = {}) {
    const filePath = path.resolve(normalizeString(args.path || args.file || args.filePath || args.file_path));
    const stat = filePath ? await fs.stat(filePath).catch(() => null) : null;
    if (!stat || !stat.isFile()) {
        return errorResult('run_python_file requires an existing path', { path: filePath });
    }
    const result = await runProcess('python', [filePath], {
        cwd: path.dirname(filePath),
        timeoutMs: args.timeoutMs || 120000
    });
    const text = [
        result.stdout ? `STDOUT:\n${result.stdout.trim()}` : '',
        result.stderr ? `STDERR:\n${result.stderr.trim()}` : ''
    ].filter(Boolean).join('\n\n') || `exitCode=${result.exitCode}`;
    return {
        ...textResult(text, { status: result.exitCode === 0 ? 'completed' : 'error', ...result }),
        isError: result.exitCode !== 0
    };
}

async function readSpreadsheet(args = {}) {
    const filePath = path.resolve(normalizeString(args.path || args.file || args.filePath || args.file_path));
    const maxRows = clampNumber(args.maxRows || args.max_rows, 80, 1, 500);
    const code = `
import json, sys, pandas as pd
path = sys.argv[1]
max_rows = int(sys.argv[2])
df = pd.read_excel(path) if path.lower().endswith(('.xlsx', '.xls')) else pd.read_csv(path)
numeric = df.select_dtypes(include="number")
payload = {
  "shape": list(df.shape),
  "columns": [str(c) for c in df.columns],
  "rows": df.head(max_rows).where(pd.notnull(df), None).to_dict(orient="records"),
  "numeric_sums": {str(k): float(v) for k, v in numeric.sum(numeric_only=True).items()},
  "total_numeric_sum": float(numeric.to_numpy().sum()) if len(numeric.columns) else 0.0,
}
print(json.dumps(payload, ensure_ascii=False, default=str))
`.trim();
    const result = await runProcess('python', ['-c', code, filePath, String(maxRows)], {
        cwd: path.dirname(filePath),
        timeoutMs: args.timeoutMs || 120000
    });
    if (result.exitCode !== 0) {
        return errorResult('read_spreadsheet failed', { path: filePath, stderr: result.stderr });
    }
    return textResult(result.stdout.trim(), { status: 'completed', path: filePath });
}

async function transcribeAudio(args = {}) {
    const filePath = path.resolve(normalizeString(args.path || args.file || args.filePath || args.file_path));
    const model = normalizeString(args.model, 'base');
    const code = `
import json, os, sys, whisper
try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    if ffmpeg_path:
        os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get("PATH", "")
        import numpy as np
        import whisper.audio as whisper_audio
        from subprocess import CalledProcessError, run
        def load_audio_with_explicit_ffmpeg(file, sr=whisper_audio.SAMPLE_RATE):
            cmd = [
                ffmpeg_path,
                "-nostdin",
                "-threads", "0",
                "-i", file,
                "-f", "s16le",
                "-ac", "1",
                "-acodec", "pcm_s16le",
                "-ar", str(sr),
                "-"
            ]
            try:
                out = run(cmd, capture_output=True, check=True).stdout
            except CalledProcessError as exc:
                raise RuntimeError(f"Failed to load audio: {exc.stderr.decode()}") from exc
            return np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0
        whisper_audio.load_audio = load_audio_with_explicit_ffmpeg
except Exception:
    pass
path = sys.argv[1]
model_name = sys.argv[2]
model = whisper.load_model(model_name)
result = model.transcribe(path)
print(json.dumps({"text": result.get("text", ""), "language": result.get("language", "")}, ensure_ascii=False))
`.trim();
    const result = await runProcess('python', ['-c', code, filePath, model], {
        cwd: path.dirname(filePath),
        timeoutMs: args.timeoutMs || 300000
    });
    if (result.exitCode !== 0) {
        return errorResult('transcribe_audio failed', { path: filePath, stderr: result.stderr.slice(0, 2000) });
    }
    return textResult(result.stdout.trim(), { status: 'completed', path: filePath, model });
}

async function describeImage(args = {}) {
    const filePath = path.resolve(normalizeString(args.path || args.file || args.filePath || args.file_path || args.imagePath || args.image_path));
    const stat = filePath ? await fs.stat(filePath).catch(() => null) : null;
    if (!stat || !stat.isFile()) {
        return errorResult('describe_image requires an existing image path', { path: filePath });
    }
    const settings = readDesktopLlmSettings();
    if (!settings) {
        return errorResult('describe_image requires local LLM settings with vision support', { path: filePath });
    }
    const question = normalizeString(args.question || args.prompt, 'Describe the image and answer any visible question.');
    const maxChars = clampNumber(args.maxChars || args.max_chars, 4000, 500, 12000);
    const imageBytes = await fs.readFile(filePath);
    const payload = {
        temperature: 0,
        timeoutMs: args.timeoutMs || 180000,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: question },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${imageMimeType(filePath)};base64,${imageBytes.toString('base64')}`
                        }
                    }
                ]
            }
        ]
    };
    let response = await callDesktopLlmProvider(settings, payload);
    if (!response.ok && response.code === 'timeout') {
        response = await callDesktopLlmProvider(settings, {
            ...payload,
            timeoutMs: Math.max(Number(args.timeoutMs) || 180000, 240000)
        });
    }
    if (!response.ok) {
        return errorResult('describe_image failed', {
            path: filePath,
            status: response.code || 'vision_model_error',
            error: response.error || ''
        });
    }
    return textResult(response.content.slice(0, maxChars), {
        status: 'completed',
        path: filePath,
        model: response.model
    });
}

async function youtubeTranscript(args = {}) {
    const url = normalizeString(args.url || args.videoUrl || args.video_url);
    if (!/^https?:\/\//i.test(url) || !/youtu\.be|youtube\.com/i.test(url)) {
        return errorResult('youtube_transcript requires a YouTube URL');
    }
    const language = normalizeString(args.language || args.lang, 'en');
    const maxChars = clampNumber(args.maxChars || args.max_chars, 12000, 1000, 60000);
    const code = `
import json, re, sys, requests, yt_dlp
url = sys.argv[1]
language = sys.argv[2]
max_chars = int(sys.argv[3])
ydl_opts = {"quiet": True, "skip_download": True, "noplaylist": True}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
def pick_caption(captions):
    if not captions:
        return None
    keys = list(captions.keys())
    preferred = [language, language.split("-")[0], "en", "en-US", "en-GB"]
    for key in preferred:
        if key in captions:
            return captions[key]
    for key in keys:
        if key.startswith(language.split("-")[0]):
            return captions[key]
    return captions[keys[0]]
tracks = pick_caption(info.get("subtitles")) or pick_caption(info.get("automatic_captions"))
track = None
if tracks:
    for item in tracks:
        if item.get("ext") in ("vtt", "srv3", "ttml", "json3"):
            track = item
            break
    track = track or tracks[0]
transcript = ""
if track and track.get("url"):
    text = requests.get(track["url"], timeout=60).text
    if track.get("ext") == "json3":
        payload = json.loads(text)
        parts = []
        for event in payload.get("events", []):
            segs = event.get("segs") or []
            parts.append("".join(seg.get("utf8", "") for seg in segs))
        transcript = " ".join(parts)
    else:
        lines = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("WEBVTT") or "-->" in line or re.match(r"^\\d+$", line):
                continue
            line = re.sub(r"<[^>]+>", "", line)
            lines.append(line)
        transcript = " ".join(lines)
    transcript = re.sub(r"\\s+", " ", transcript).strip()
payload = {
    "title": info.get("title", ""),
    "duration": info.get("duration"),
    "uploader": info.get("uploader", ""),
    "description": (info.get("description") or "")[:2000],
    "transcript_language": track.get("name") if track else "",
    "transcript": transcript[:max_chars]
}
print(json.dumps(payload, ensure_ascii=False))
`.trim();
    const result = await runProcess('python', ['-c', code, url, language, String(maxChars)], {
        timeoutMs: args.timeoutMs || 240000
    });
    if (result.exitCode !== 0) {
        return errorResult('youtube_transcript failed', { url, stderr: result.stderr.slice(0, 3000) });
    }
    return textResult(result.stdout.trim(), { status: 'completed', url });
}

const TOOLS = [
    {
        name: 'web_search',
        description: 'Search the public web for evidence through AIGL managed search backends. Returns titles, URLs, snippets, and structured backend attempts.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                q: { type: 'string' },
                search: { type: 'string' },
                text: { type: 'string' },
                maxResults: { type: 'number' },
                limit: { type: 'number' },
                timeoutMs: { type: 'number' },
                backend: { type: 'string', description: 'Optional backend id: duckduckgo_lite or bing_html. Omit for automatic fallback.' },
                backends: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional ordered backend ids. Omit for automatic fallback.'
                }
            }
        }
    },
    {
        name: 'web_fetch',
        description: 'Fetch a public HTTP(S) HTML or text resource and return readable text. Rejects PDF/binary content with unsupported_content_type; use pdf_extract_text or download_file for PDFs/files.',
        inputSchema: {
            type: 'object',
            required: ['url'],
            properties: {
                url: { type: 'string' },
                maxChars: { type: 'number' },
                query: { type: 'string' },
                contains: { type: 'string' }
            }
        }
    },
    {
        name: 'pdf_extract_text',
        description: 'Extract readable text from a public PDF URL or local PDF path. Use this instead of web_fetch for application/pdf or .pdf sources.',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                uri: { type: 'string' },
                path: { type: 'string' },
                file: { type: 'string' },
                filePath: { type: 'string' },
                file_path: { type: 'string' },
                maxChars: { type: 'number' },
                maxPages: { type: 'number' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'download_file',
        description: 'Download a public HTTP(S) resource to a local file and return path, content type, and byte count. Use for binary files or when another parser needs a local path.',
        inputSchema: {
            type: 'object',
            required: ['url'],
            properties: {
                url: { type: 'string' },
                uri: { type: 'string' },
                outputDir: { type: 'string' },
                output_dir: { type: 'string' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'web_extract_links',
        description: 'Fetch a public HTTP(S) HTML page and extract normalized outbound links with anchor text. Rejects PDF/binary content.',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                maxLinks: { type: 'number' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'run_python_file',
        description: 'Run a local Python file and return stdout/stderr. Use for benchmark code-output questions.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                file: { type: 'string' },
                filePath: { type: 'string' },
                file_path: { type: 'string' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'read_spreadsheet',
        description: 'Read an xlsx/xls/csv file and return shape, columns, rows, numeric_sums, and total_numeric_sum as JSON text. Set maxRows high enough when the full table is needed.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                file: { type: 'string' },
                filePath: { type: 'string' },
                file_path: { type: 'string' },
                maxRows: { type: 'number' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'transcribe_audio',
        description: 'Transcribe a local audio file with local Whisper and return recognized text.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                file: { type: 'string' },
                filePath: { type: 'string' },
                file_path: { type: 'string' },
                model: { type: 'string' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'describe_image',
        description: 'Describe or answer a question about a local image file using the configured vision-capable LLM. Use for attached PNG/JPG/WebP images.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                file: { type: 'string' },
                filePath: { type: 'string' },
                file_path: { type: 'string' },
                imagePath: { type: 'string' },
                image_path: { type: 'string' },
                question: { type: 'string' },
                maxChars: { type: 'number' },
                timeoutMs: { type: 'number' }
            }
        }
    },
    {
        name: 'youtube_transcript',
        description: 'Fetch YouTube metadata and available subtitles/auto-captions with yt-dlp. Use for YouTube questions before guessing from search snippets.',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                videoUrl: { type: 'string' },
                video_url: { type: 'string' },
                language: { type: 'string' },
                maxChars: { type: 'number' },
                timeoutMs: { type: 'number' }
            }
        }
    }
];

async function handleToolCall(request) {
    const name = normalizeString(request.params?.name);
    const args = request.params?.arguments && typeof request.params.arguments === 'object'
        ? request.params.arguments
        : {};
    if (name === 'web_search') return await webSearch(args);
    if (name === 'web_fetch') return await webFetch(args);
    if (name === 'pdf_extract_text') return await pdfExtractText(args);
    if (name === 'download_file') return await downloadFile(args);
    if (name === 'web_extract_links') return await webExtractLinks(args);
    if (name === 'run_python_file') return await runPythonFile(args);
    if (name === 'read_spreadsheet') return await readSpreadsheet(args);
    if (name === 'transcribe_audio') return await transcribeAudio(args);
    if (name === 'describe_image') return await describeImage(args);
    if (name === 'youtube_transcript') return await youtubeTranscript(args);
    return errorResult(`Unknown tool: ${name}`);
}

async function handleRequest(request) {
    if (!request.id) {
        return null;
    }
    if (request.method === 'initialize') {
        return {
            id: request.id,
            result: {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: { tools: {} },
                serverInfo: SERVER_INFO
            }
        };
    }
    if (request.method === 'tools/list') {
        return { id: request.id, result: { tools: TOOLS } };
    }
    if (request.method === 'tools/call') {
        return { id: request.id, result: await handleToolCall(request) };
    }
    return {
        id: request.id,
        error: { code: -32601, message: `Unknown method: ${request.method}` }
    };
}

function startStdioServer() {
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', async (line) => {
        let request;
        try {
            request = JSON.parse(line);
        } catch {
            return;
        }
        try {
            const response = await handleRequest(request);
            if (response) {
                send(response);
            }
        } catch (error) {
            if (request.id) {
                send({
                    id: request.id,
                    error: { code: -32000, message: error?.message || String(error) }
                });
            }
        }
    });
}

if (require.main === module) {
    startStdioServer();
}

module.exports = {
    TOOLS,
    downloadFile,
    extractBingResults,
    fetchText,
    handleRequest,
    handleToolCall,
    normalizeSearchBackends,
    pdfExtractText,
    SEARCH_BACKENDS,
    webExtractLinks,
    webFetch,
    webSearch
};
