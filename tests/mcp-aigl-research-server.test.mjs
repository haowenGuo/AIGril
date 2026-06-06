import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    TOOLS,
    extractBingResults,
    webExtractLinks,
    webFetch
} = require('../scripts/mcp-aigl-research-server.cjs');

async function withServer(handler, run) {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
        return await run(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('AIGL research MCP exposes Codex-aligned PDF/file tools', () => {
    const names = TOOLS.map((tool) => tool.name);
    const searchTool = TOOLS.find((tool) => tool.name === 'web_search');

    assert.ok(names.includes('web_search'));
    assert.ok(names.includes('web_fetch'));
    assert.ok(names.includes('pdf_extract_text'));
    assert.ok(names.includes('download_file'));
    assert.ok(searchTool.inputSchema.properties.backend);
    assert.ok(searchTool.inputSchema.properties.backends);
    assert.ok(searchTool.description.includes('managed search backends'));
});

test('web_search can parse Bing HTML result blocks for fallback search', () => {
    const html = `
        <html><body>
          <li class="b_algo">
            <h2><a href="https://playwright.dev/docs/actionability">Auto-waiting | Playwright</a></h2>
            <div class="b_caption"><p>Playwright performs actionability checks and auto-waits before actions.</p></div>
          </li>
          <li class="b_algo">
            <h2><a href="https://playwright.dev/docs/api/class-locator#locator-wait-for">locator.waitFor</a></h2>
            <p>Wait for a locator to satisfy state with timeout option.</p>
          </li>
        </body></html>
    `;
    const results = extractBingResults(html, 5);
    assert.equal(results.length, 2);
    assert.equal(results[0].url, 'https://playwright.dev/docs/actionability');
    assert.match(results[0].snippet, /auto-waits/i);
    assert.equal(results[1].title, 'locator.waitFor');
});

test('web_fetch rejects PDF/binary content instead of returning raw PDF bytes', async () => {
    await withServer((request, response) => {
        response.writeHead(200, { 'content-type': 'application/pdf' });
        response.end('%PDF-1.5\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\nbinary\nendstream');
    }, async (baseUrl) => {
        const result = await webFetch({ url: `${baseUrl}/paper.pdf` });

        assert.equal(result.isError, true);
        assert.equal(result.details.status, 'unsupported_content_type');
        assert.equal(result.details.contentType, 'application/pdf');
        assert.deepEqual(result.details.suggestedTools, ['pdf_extract_text', 'download_file']);
        assert.doesNotMatch(result.content[0].text, /%PDF-1\.5/);
    });
});

test('web_extract_links rejects non-HTML content', async () => {
    await withServer((request, response) => {
        response.writeHead(200, { 'content-type': 'application/pdf' });
        response.end('%PDF-1.5\nbinary');
    }, async (baseUrl) => {
        const result = await webExtractLinks({ url: `${baseUrl}/paper.pdf` });

        assert.equal(result.isError, true);
        assert.equal(result.details.status, 'unsupported_content_type');
    });
});
