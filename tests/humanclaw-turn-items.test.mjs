import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCodexLikeTurnItems,
    buildTurnItemsPromptObject
} from '../electron/humanclaw-turn-items.cjs';

test('Turn items map tool calls and results into Codex-like chronological items', () => {
    const promptObject = buildTurnItemsPromptObject({
        events: [
            {
                type: 'tool_call',
                id: 'step-1',
                title: 'Read paper notes',
                tool: 'computer',
                args: { action: 'read', path: 'paper.md' },
                iteration: 0
            },
            {
                type: 'tool_result',
                id: 'step-1',
                title: 'Read paper notes',
                tool: 'computer',
                status: 'completed',
                ok: true,
                preview: 'memory stream, reflection, planning',
                iteration: 0
            }
        ]
    });

    assert.equal(promptObject.model, 'codex_like_turn_items');
    assert.match(promptObject.note, /Tool failures are observations/);
    assert.equal(promptObject.items[0].type, 'tool_call');
    assert.equal(promptObject.items[0].status, 'started');
    assert.equal(promptObject.items[1].type, 'tool_result');
    assert.equal(promptObject.items[1].status, 'completed');
    assert.match(promptObject.items[1].preview, /reflection/);
});

test('Turn items keep failed tool observations available for the next model decision', () => {
    const items = buildCodexLikeTurnItems({
        stepResults: [
            {
                id: 'step-failed',
                title: 'Parse HTML',
                tool: 'computer',
                args: { action: 'exec', command: 'pup ".title text{}"' },
                iteration: 1,
                response: {
                    ok: false,
                    status: 'tool_failed',
                    error: "'pup' is not recognized as an internal or external command"
                }
            }
        ]
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'tool_result');
    assert.equal(items[0].status, 'failed');
    assert.equal(items[0].result_status, 'tool_failed');
    assert.match(items[0].preview, /pup/);
});

test('Turn items classify Windows command-not-found failures with recovery hints', () => {
    const items = buildCodexLikeTurnItems({
        stepResults: [
            {
                id: 'step-python3',
                title: 'Parse arXiv page',
                tool: 'computer',
                args: {
                    action: 'exec',
                    command: 'python3 -c "print(1)" > paper_metadata.txt'
                },
                iteration: 1,
                response: {
                    ok: false,
                    status: 'error',
                    result: {
                        content: [{ type: 'text', text: 'exitCode=9009' }],
                        details: {
                            action: 'exec',
                            command: 'python3 -c "print(1)" > paper_metadata.txt',
                            exitCode: 9009,
                            stdout: '',
                            stderr: ''
                        }
                    }
                }
            }
        ]
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].status, 'failed');
    assert.equal(items[0].error_type, 'missing_dependency');
    assert.match(items[0].preview, /python3/);
    assert.match(items[0].recovery_hint, /PowerShell|Node\.js|web_fetch/);
    assert.ok(items[0].alternatives.includes('node'));
});
