import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    HumanClawPlatformAdapter,
    createHumanClawPlatformAdapter
} = require('../electron/humanclaw-platform-adapter.cjs');
const { HumanClawGateway } = require('../electron/humanclaw-gateway.cjs');

test('HumanClaw platform adapter normalizes OS-specific path and shell behavior', () => {
    const windows = new HumanClawPlatformAdapter({
        platform: 'win32',
        env: {
            SystemDrive: 'C:',
            WINDIR: 'C:\\Windows',
            ComSpec: 'C:\\Windows\\System32\\cmd.exe'
        }
    });
    assert.equal(windows.id, 'windows');
    assert.equal(windows.isPathInside('C:\\Work', 'C:\\WORK\\note.txt'), true);
    assert.equal(windows.pathKey('C:\\Work\\Note.txt'), path.resolve('C:\\Work\\Note.txt').toLowerCase());
    assert.deepEqual(windows.shellArgs('echo hi'), ['/d', '/s', '/c', 'echo hi']);
    assert.equal(windows.aclSetCommand('C:\\Work\\note.txt', ['/grant', 'User:(R)']).supported, true);
    assert.equal(windows.getStatus().capabilities.aclSet, true);

    const linux = createHumanClawPlatformAdapter('linux');
    assert.equal(linux.id, 'linux');
    assert.equal(linux.isPathInside('/tmp/work', '/tmp/work/note.txt'), true);
    assert.equal(linux.isPathInside('/tmp/work', '/tmp/work-other/note.txt'), false);
    assert.deepEqual(linux.shellArgs('echo hi'), ['-lc', 'echo hi']);
    assert.equal(linux.aclSetCommand('/tmp/work/note.txt', []).supported, false);
});

test('HumanClaw Gateway exposes the active platform adapter to tools and status', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'humanclaw-platform-gateway-'));
    const platformAdapter = new HumanClawPlatformAdapter({ platform: 'win32' });
    const gateway = new HumanClawGateway({
        port: 0,
        workspaceRoot,
        projectRoot: path.resolve('.'),
        auditDir: path.join(workspaceRoot, '.audit'),
        platformAdapter
    });

    try {
        await gateway.start();
        const status = gateway.getStatus();
        assert.equal(status.platform.id, 'windows');
        assert.equal(status.runtime.platform.id, 'windows');

        const schema = await gateway.callTool({
            tool: 'computer',
            args: { action: 'schema' },
            context: {
                workspace: workspaceRoot
            }
        });
        assert.equal(schema.ok, true);
        assert.equal(schema.result.details.schema.safety.platform.id, 'windows');
    } finally {
        await gateway.stop().catch(() => {});
    }
});
