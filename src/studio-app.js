import previewA from '../output_perfect_smooth.png';
import previewB from '../output_smooth.png';
import previewC from '../smooth_result.png';

import {
    assetBlueprint,
    identityPresets,
    personalityProfiles,
    publishChecklist,
    referenceSignals,
    roadmap,
    strategyCards,
    styleControls,
    workspaces
} from './studio-data.js';


const state = {
    activeWorkspace: 'overview',
    selectedPreset: identityPresets[0].id,
    selectedProfile: personalityProfiles[0].id,
    selectedPreview: 0
};

const previewShots = [
    { id: 'shot-a', label: '角色预览', note: '主视觉方向', src: previewA },
    { id: 'shot-b', label: '情绪镜头', note: '更柔和的陪伴气质', src: previewB },
    { id: 'shot-c', label: '舞台镜头', note: '高光更强，适合表演包装', src: previewC }
];

const root = document.getElementById('studio-app');


function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


function currentWorkspace() {
    return workspaces.find((workspace) => workspace.id === state.activeWorkspace) || workspaces[0];
}


function currentPreset() {
    return identityPresets.find((preset) => preset.id === state.selectedPreset) || identityPresets[0];
}


function currentProfile() {
    return personalityProfiles.find((profile) => profile.id === state.selectedProfile) || personalityProfiles[0];
}


function currentPreview() {
    return previewShots[state.selectedPreview] || previewShots[0];
}


function metricBar(value) {
    return `
        <div class="metric-bar">
            <span style="width:${Math.max(0, Math.min(100, value))}%"></span>
        </div>
    `;
}


function createPackagePreview() {
    const preset = currentPreset();
    const profile = currentProfile();

    return {
        packageName: `aigril-${preset.id}-${profile.id}`,
        avatar: {
            preset: preset.name,
            silhouette: preset.silhouette,
            runtimeFit: preset.runtimeFit
        },
        personality: {
            profile: profile.name,
            summary: profile.summary,
            voice: profile.voice
        },
        performance: {
            recommendedWorks: assetBlueprint.works.slice(0, 2).map((item) => item.name),
            defaultMotionTone: preset.name,
            assetCoverage: assetBlueprint.slots.reduce((accumulator, slot) => {
                accumulator[slot.label] = slot.count;
                return accumulator;
            }, {})
        },
        publishMeta: {
            target: 'AIGril Runtime',
            version: '0.1.0-prototype',
            rollback: true
        }
    };
}


function renderTopbar() {
    const preset = currentPreset();
    const profile = currentProfile();

    return `
        <header class="studio-topbar">
            <div class="brand-lockup">
                <div class="brand-mark">A</div>
                <div class="brand-meta">
                    <h1>AIGril Studio</h1>
                    <p>先定义角色，再装配能力，最后把虚拟人发布到 AIGril Runtime。</p>
                </div>
            </div>
            <div class="topbar-actions">
                <span class="chip">角色原型：${escapeHtml(preset.name)}</span>
                <span class="chip">性格协议：${escapeHtml(profile.name)}</span>
                <span class="chip">分支：codex/aigril-design-platform</span>
                <button class="ghost-btn" type="button" data-action="switch-workspace" data-workspace="publish">发布视角</button>
                <button class="primary-btn" type="button" data-action="switch-workspace" data-workspace="avatar">继续设计</button>
            </div>
        </header>
    `;
}


function renderSidebar() {
    return `
        <aside class="studio-sidebar">
            <div class="nav-group">
                <div class="section-caption">Workspace</div>
                ${workspaces.map((workspace) => `
                    <button
                        class="nav-item${workspace.id === state.activeWorkspace ? ' is-active' : ''}"
                        type="button"
                        data-action="switch-workspace"
                        data-workspace="${workspace.id}"
                    >
                        <strong>${escapeHtml(workspace.label)}</strong>
                        <span>${escapeHtml(workspace.outcome)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="roadmap-band">
                <div class="section-caption">Roadmap</div>
                ${roadmap.map((item) => `
                    <div class="roadmap-item">
                        <strong>${escapeHtml(item.phase)} · ${escapeHtml(item.title)}</strong>
                        <span>${escapeHtml(item.detail)}</span>
                    </div>
                `).join('')}
            </div>
        </aside>
    `;
}


function renderOverview() {
    return `
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>为什么要拆成两个系统</h3>
                    <div class="strategy-grid">
                        ${strategyCards.map((card, index) => `
                            <div class="strategy-card">
                                <header>
                                    <strong>${escapeHtml(card.title)}</strong>
                                    <span class="badge${index === 1 ? ' accent-badge' : ''}">${escapeHtml(card.badge)}</span>
                                </header>
                                <p>${escapeHtml(card.body)}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>设计平台的最小闭环</h3>
                    <div class="publish-groups">
                        <div class="publish-group">
                            <header><strong>1. 定义角色</strong><span class="badge">Identity</span></header>
                            <ul>
                                <li>确定视觉原型、风格线、动作气质</li>
                                <li>确定性格协议、声线协议、记忆边界</li>
                                <li>确定作品与演出资源的最低需求</li>
                            </ul>
                        </div>
                        <div class="publish-group">
                            <header><strong>2. 装配能力</strong><span class="badge">Capability</span></header>
                            <ul>
                                <li>按作品绑定歌曲、伴奏、歌词、动作与表情模板</li>
                                <li>做默认演出模板，而不是每次临时拼接</li>
                                <li>给每个角色保留可扩展的资源增长路径</li>
                            </ul>
                        </div>
                        <div class="publish-group">
                            <header><strong>3. 发布到 Runtime</strong><span class="badge">Publish</span></header>
                            <ul>
                                <li>生成标准角色包并做兼容性校验</li>
                                <li>把包推送到虚拟人对话系统，直接可运行</li>
                                <li>保留版本、回滚和默认作品集</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>参考信号</h3>
                    <div class="reference-list">
                        ${referenceSignals.map((signal) => `
                            <div class="reference-row">
                                <header>
                                    <strong>${escapeHtml(signal.name)}</strong>
                                    <span class="badge">${escapeHtml(signal.region)}</span>
                                </header>
                                <p>${escapeHtml(signal.cue)}</p>
                                <p>${escapeHtml(signal.focus.join(' / '))}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>当前建议</h3>
                    <p>先做“角色定义 + 资源装配 + 发布协议”三件事，不急着做大型协作平台。只要这三条闭环打通，设计平台就已经比单纯的资源面板高一个层级了。</p>
                </section>
            </div>
        </div>
    `;
}


function renderAvatarWorkspace() {
    const preset = currentPreset();
    const preview = currentPreview();

    return `
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>角色原型</h3>
                    <div class="profile-tabs">
                        ${identityPresets.map((item) => `
                            <button
                                class="profile-tab${item.id === preset.id ? ' is-active' : ''}"
                                type="button"
                                data-action="select-preset"
                                data-preset="${item.id}"
                            >${escapeHtml(item.name)}</button>
                        `).join('')}
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>中心预览</h3>
                    <div class="preview-canvas">
                        <div class="avatar-preview">
                            <img src="${preview.src}" alt="${escapeHtml(preview.label)}" />
                            <div class="preview-overlay">
                                <strong>${escapeHtml(preset.name)}</strong>
                                <span>${escapeHtml(preset.style)} · ${escapeHtml(preset.runtimeFit)}</span>
                            </div>
                        </div>
                        <div class="thumbnail-column">
                            ${previewShots.map((shot, index) => `
                                <button
                                    class="thumb-button${index === state.selectedPreview ? ' is-active' : ''}"
                                    type="button"
                                    data-action="select-preview"
                                    data-preview="${index}"
                                >
                                    <img src="${shot.src}" alt="${escapeHtml(shot.label)}" />
                                    <strong>${escapeHtml(shot.label)}</strong>
                                    <span>${escapeHtml(shot.note)}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>角色 DNA</h3>
                    <div class="metric-list">
                        <div class="metric-row">
                            <header><strong>风格线</strong><span class="badge">${escapeHtml(preset.style)}</span></header>
                            <p>${escapeHtml(preset.silhouette)}</p>
                        </div>
                        <div class="metric-row">
                            <header><strong>运行时定位</strong><span class="badge accent-badge">Runtime Fit</span></header>
                            <p>${escapeHtml(preset.runtimeFit)}</p>
                        </div>
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>完成度</h3>
                    <div class="metric-list">
                        ${styleControls.map((item) => `
                            <div class="metric-row">
                                <header><strong>${escapeHtml(item.label)}</strong><span>${item.value}%</span></header>
                                ${metricBar(item.value)}
                            </div>
                        `).join('')}
                    </div>
                </section>
            </div>
        </div>
    `;
}


function renderPersonalityWorkspace() {
    const profile = currentProfile();

    return `
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>人格模板</h3>
                    <div class="profile-tabs">
                        ${personalityProfiles.map((item) => `
                            <button
                                class="profile-tab${item.id === profile.id ? ' is-active' : ''}"
                                type="button"
                                data-action="select-profile"
                                data-profile="${item.id}"
                            >${escapeHtml(item.name)}</button>
                        `).join('')}
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>对话与声线协议</h3>
                    <p>${escapeHtml(profile.summary)}</p>
                    <div class="trait-grid">
                        ${profile.traits.map(([name, value]) => `
                            <div class="trait-card">
                                <strong>${escapeHtml(name)}</strong>
                                <span>${value}%</span>
                                ${metricBar(value)}
                            </div>
                        `).join('')}
                    </div>
                    <div class="voice-card">
                        <strong>声线建议</strong>
                        <span>音色：${escapeHtml(profile.voice.timbre)}</span><br />
                        <span>语速：${escapeHtml(profile.voice.pace)}</span><br />
                        <span>唱歌风格：${escapeHtml(profile.voice.singing)}</span>
                    </div>
                </section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>为什么这一层单独存在</h3>
                    <p>形象和性格必须分开编辑。用户以后会反复换外观、补歌曲、改动作，但“她怎么说话、什么边界、什么声线”应该是可版本化的协议，不应该埋在 prompt 里。</p>
                </section>
                <section class="tool-surface">
                    <h3>协议草案</h3>
                    <pre class="json-preview">${escapeHtml(JSON.stringify({
                        profile: profile.name,
                        summary: profile.summary,
                        traits: Object.fromEntries(profile.traits),
                        voice: profile.voice
                    }, null, 2))}</pre>
                </section>
            </div>
        </div>
    `;
}


function renderPerformanceWorkspace() {
    return `
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>资源槽位</h3>
                    <div class="asset-slots">
                        ${assetBlueprint.slots.map((slot) => `
                            <div class="slot-row">
                                <header>
                                    <strong>${escapeHtml(slot.label)}</strong>
                                    <span class="slot-status ${slot.status}">${slot.count} 项</span>
                                </header>
                                <span>角色能力不再直接绑散文件，而是绑定到标准槽位上。</span>
                            </div>
                        `).join('')}
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>作品模板</h3>
                    <div class="work-list">
                        ${assetBlueprint.works.map((work) => `
                            <div class="work-row">
                                <header>
                                    <strong>${escapeHtml(work.name)}</strong>
                                    <span class="work-progress ${work.progress >= 80 ? 'ready' : work.progress >= 70 ? 'review' : 'growing'}">${work.progress}%</span>
                                </header>
                                <p>${escapeHtml(work.fit)}</p>
                                <p>${escapeHtml(work.resources)}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>这层的产品判断</h3>
                    <p>不要直接做“资源仓库”。真正有价值的是“角色 -> 作品 -> 演出模板”三级结构。资源只是一层原料，模板才是可复用能力。</p>
                </section>
                <section class="tool-surface">
                    <h3>优先级建议</h3>
                    <div class="publish-groups">
                        <div class="publish-group">
                            <header><strong>先做</strong><span class="badge">V1</span></header>
                            <ul>
                                <li>作品模型</li>
                                <li>资源槽位</li>
                                <li>模板化绑定</li>
                                <li>运行时兼容校验</li>
                            </ul>
                        </div>
                        <div class="publish-group">
                            <header><strong>后做</strong><span class="badge accent-badge">V2</span></header>
                            <ul>
                                <li>大规模协作</li>
                                <li>市场与分发</li>
                                <li>第三方创作者审核流</li>
                                <li>商业化计费</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;
}


function renderPublishWorkspace() {
    const packagePreview = createPackagePreview();

    return `
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>发布门禁</h3>
                    <div class="publish-groups">
                        ${publishChecklist.map((group) => `
                            <div class="publish-group">
                                <header>
                                    <strong>${escapeHtml(group.title)}</strong>
                                    <span class="slot-status ${group.status}">${group.status === 'ready' ? '已定义' : '待补强'}</span>
                                </header>
                                <ul>
                                    ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                                </ul>
                            </div>
                        `).join('')}
                    </div>
                </section>
                <section class="tool-surface">
                    <h3>发布后的体验</h3>
                    <p>Runtime 只负责消费角色包和演出模板。用户在 Studio 里修改角色后，Runtime 接受新版本并提供切换、灰度、回滚，而不是重新编辑底层资源。</p>
                </section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface">
                    <h3>角色包草案</h3>
                    <pre class="json-preview">${escapeHtml(JSON.stringify(packagePreview, null, 2))}</pre>
                </section>
            </div>
        </div>
    `;
}


function renderInspector() {
    const workspace = currentWorkspace();
    const preset = currentPreset();
    const profile = currentProfile();

    const blocks = {
        overview: [
            {
                title: '这次最重要的决定',
                items: [
                    '把运行系统和设计系统彻底分开',
                    '先定角色包协议，再扩展功能',
                    '优先做创作闭环，不先做重运营后台'
                ]
            },
            {
                title: '你现在能判断什么',
                items: [
                    '产品拆分是否成立',
                    'Studio 是否值得单独立项',
                    '下一阶段先投形象编辑还是资源装配'
                ]
            }
        ],
        avatar: [
            {
                title: '当前原型',
                items: [
                    `${preset.name}`,
                    `${preset.style}`,
                    `${preset.runtimeFit}`
                ]
            },
            {
                title: 'MVP 截断线',
                items: [
                    '先做原型级形象组合，不追求完整建模器',
                    '先输出角色设定包，不急着做复杂材质编辑',
                    '先跟 Runtime 的 VRM 接口打通'
                ]
            }
        ],
        personality: [
            {
                title: '当前协议',
                items: [
                    `${profile.name}`,
                    `${profile.voice.timbre}`,
                    `${profile.voice.singing}`
                ]
            },
            {
                title: '为什么值钱',
                items: [
                    '性格协议决定留存，不只是皮相',
                    '声线协议决定唱歌与说话的一致性',
                    '后面接模型或 TTS 时不会重做一遍'
                ]
            }
        ],
        performance: [
            {
                title: '这一层的核心',
                items: [
                    '先把角色能力模板化',
                    '作品是装配单位，不是文件夹',
                    '演出模板要能直接投给 Runtime'
                ]
            },
            {
                title: '下一刀最该砍哪',
                items: [
                    '作品模板数据模型',
                    '动作库与歌曲库的双轴索引',
                    '发布前校验器'
                ]
            }
        ],
        publish: [
            {
                title: 'Runtime 接口约束',
                items: [
                    '角色包必须稳定可回滚',
                    '发布后默认作品必须可运行',
                    '旧版本对话角色不受新编辑影响'
                ]
            },
            {
                title: '可以晚一点做',
                items: [
                    '多人协作权限',
                    '大规模市场分发',
                    '复杂审核流'
                ]
            }
        ]
    };

    return `
        <aside class="studio-inspector">
            <div>
                <h3 class="inspector-title">${escapeHtml(workspace.label)}</h3>
                <p class="inspector-copy">${escapeHtml(workspace.outcome)}</p>
            </div>
            <div class="inspector-list">
                ${(blocks[workspace.id] || []).map((block) => `
                    <section class="inspector-block">
                        <h4>${escapeHtml(block.title)}</h4>
                        <ul>
                            ${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </section>
                `).join('')}
            </div>
        </aside>
    `;
}


function renderMain() {
    const workspace = currentWorkspace();
    const sections = {
        overview: renderOverview,
        avatar: renderAvatarWorkspace,
        personality: renderPersonalityWorkspace,
        performance: renderPerformanceWorkspace,
        publish: renderPublishWorkspace
    };
    const body = (sections[workspace.id] || renderOverview)();

    return `
        <main class="studio-main">
            <section class="workspace-header">
                <div>
                    <h2>${escapeHtml(workspace.title)}</h2>
                    <p>${escapeHtml(workspace.subtitle)}</p>
                </div>
                <div class="workspace-outcome">
                    这一页的目标：${escapeHtml(workspace.outcome)}
                </div>
            </section>
            ${body}
        </main>
    `;
}


function renderApp() {
    root.innerHTML = `
        ${renderTopbar()}
        ${renderSidebar()}
        ${renderMain()}
        ${renderInspector()}
    `;
}


root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) {
        return;
    }

    const action = trigger.dataset.action;

    if (action === 'switch-workspace') {
        state.activeWorkspace = trigger.dataset.workspace || state.activeWorkspace;
    }

    if (action === 'select-preset') {
        state.selectedPreset = trigger.dataset.preset || state.selectedPreset;
        state.activeWorkspace = 'avatar';
    }

    if (action === 'select-profile') {
        state.selectedProfile = trigger.dataset.profile || state.selectedProfile;
        state.activeWorkspace = 'personality';
    }

    if (action === 'select-preview') {
        state.selectedPreview = Number(trigger.dataset.preview || 0);
        state.activeWorkspace = 'avatar';
    }

    renderApp();
});


renderApp();
