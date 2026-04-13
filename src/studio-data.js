export const referenceSignals = [
    {
        name: 'MetaHuman',
        region: 'Global',
        cue: '高保真角色创建、标准化发布链路、与运行时强绑定',
        focus: ['形象编辑', '质量门禁', '导出协议']
    },
    {
        name: 'Ready Player Me',
        region: 'Global',
        cue: '身份入口轻、跨应用分发强、资产标准统一',
        focus: ['一键生成', '跨场景复用', '开发者接入']
    },
    {
        name: 'VRoid Studio',
        region: 'Japan',
        cue: '从创作者视角组织脸、发型、服装与材质编辑',
        focus: ['细粒度编辑', '风格化形象', '创作手感']
    },
    {
        name: 'Character Creator',
        region: 'Global',
        cue: '角色、服装、动画、动作数据围绕同一角色资产组织',
        focus: ['资产装配', '角色一致性', '商业化资源管理']
    },
    {
        name: '腾讯云数字人',
        region: 'China',
        cue: '把形象、声音、脚本与业务接入拆成明确生产链',
        focus: ['企业交付', '流程化生产', '运营接入']
    },
    {
        name: 'Canva / Figma',
        region: 'Global',
        cue: '强信息架构、模板驱动、协作与版本意识',
        focus: ['模板系统', '设计资产中台', '发布治理']
    }
];


export const workspaces = [
    {
        id: 'overview',
        label: '产品蓝图',
        title: '先把 AIGril 分成两个系统',
        subtitle: '一个负责运行虚拟人，一个负责设计虚拟人。设计平台的任务，是让用户把“形象、性格、歌曲、动作”一次性组织成可发布资产。',
        outcome: '确认产品拆分、用户旅程和最小可行闭环'
    },
    {
        id: 'avatar',
        label: '形象工坊',
        title: '从角色 DNA 开始',
        subtitle: '用户先定义视觉身份：脸、发型、服装、风格、动作基调，最后导出一套可被运行时消费的角色包。',
        outcome: '形成角色外观和动作风格的统一资产'
    },
    {
        id: 'personality',
        label: '性格与声音',
        title: '把“她是谁”讲清楚',
        subtitle: '设计平台不只做模型，还要设计口吻、边界、情绪倾向、记忆偏好、声线与唱歌参数。',
        outcome: '形成对话协议和语音协议'
    },
    {
        id: 'performance',
        label: '歌曲与动作',
        title: '把资源装配成表演能力',
        subtitle: '歌曲、伴奏、歌词、动作、舞蹈风格要围绕作品和角色双轴组织，而不是散文件堆积。',
        outcome: '形成作品模板和演出模板'
    },
    {
        id: 'publish',
        label: '发布接入',
        title: '一键送进 AIGril Runtime',
        subtitle: '设计平台的终点不是“做完了”，而是把可运行的角色包发布到对话系统里，并保留版本和回滚。',
        outcome: '形成可接入、可升级、可回滚的发布体系'
    }
];


export const strategyCards = [
    {
        title: 'Runtime',
        badge: '现在已有',
        body: '负责对话、表情、动作、演出执行。它只吃标准化后的角色包，不再承担大规模编辑任务。'
    },
    {
        title: 'Studio',
        badge: '现在启动',
        body: '负责形象编辑、性格配置、资源管理、演出装配、模板与发布。它是创作入口，不是陪伴入口。'
    },
    {
        title: 'Package Contract',
        badge: '必须先定',
        body: '角色包至少要包含 avatar、personality、voice、performance、resources、publishMeta 六块。后续所有功能都围绕它生长。'
    }
];


export const identityPresets = [
    {
        id: 'idol',
        name: '舞台型偶像',
        style: '清爽、轻盈、镜头友好',
        silhouette: '中长发 + 演出服 + 高辨识配色',
        runtimeFit: '适合唱跳、短对话、陪伴型直播'
    },
    {
        id: 'companion',
        name: '陪伴型女友',
        style: '柔和、亲近、生活感强',
        silhouette: '日常穿搭 + 轻动作 + 温和表情',
        runtimeFit: '适合长对话、情绪陪伴、轻表演'
    },
    {
        id: 'cool',
        name: '冷感系主唱',
        style: '利落、锋利、舞台存在感强',
        silhouette: '硬朗造型 + 强节奏动作 + 灯光脸',
        runtimeFit: '适合强情绪演出、MV、短视频生成'
    }
];


export const styleControls = [
    { key: 'face', label: '脸部识别度', value: 78 },
    { key: 'hair', label: '发型完成度', value: 64 },
    { key: 'outfit', label: '服装统一性', value: 83 },
    { key: 'motion', label: '动作风格匹配', value: 59 },
    { key: 'publish', label: '运行时兼容度', value: 72 }
];


export const personalityProfiles = [
    {
        id: 'gentle',
        name: '温柔陪伴',
        summary: '慢热、会接话、边界柔和，优先照顾用户情绪。',
        traits: [
            ['亲密感', 82],
            ['主动性', 58],
            ['边界感', 61],
            ['幽默感', 46]
        ],
        voice: {
            timbre: '轻柔女声',
            pace: '偏慢',
            singing: '抒情优先'
        }
    },
    {
        id: 'stage',
        name: '舞台主角',
        summary: '表达强、反应快、镜头感足，适合表演和短句互动。',
        traits: [
            ['亲密感', 66],
            ['主动性', 81],
            ['边界感', 70],
            ['幽默感', 62]
        ],
        voice: {
            timbre: '亮感女声',
            pace: '中快',
            singing: '流行唱跳'
        }
    },
    {
        id: 'muse',
        name: '灵感缪斯',
        summary: '更偏创作搭子，适合陪用户写词、编舞、聊审美。',
        traits: [
            ['亲密感', 59],
            ['主动性', 74],
            ['边界感', 79],
            ['幽默感', 57]
        ],
        voice: {
            timbre: '空灵女声',
            pace: '中速',
            singing: '电子 / 梦核'
        }
    }
];


export const assetBlueprint = {
    slots: [
        { label: '歌曲', count: 36, status: 'ready' },
        { label: '伴奏', count: 22, status: 'ready' },
        { label: '歌词', count: 41, status: 'ready' },
        { label: '动作', count: 133, status: 'review' },
        { label: '舞蹈模板', count: 18, status: 'growing' },
        { label: '声线模板', count: 6, status: 'ready' }
    ],
    works: [
        {
            name: '夜风练习室',
            fit: '温柔陪伴 + 轻唱',
            resources: 'song / accompaniment / lyrics / idle-dance pack',
            progress: 82
        },
        {
            name: '聚光舞台',
            fit: '舞台主角 + 高能唱跳',
            resources: 'song / choreography / expression kit / camera preset',
            progress: 67
        },
        {
            name: '晚安广播',
            fit: '温柔陪伴 + 低动作',
            resources: 'voice / lyrics / idle / relaxed expression',
            progress: 91
        }
    ]
};


export const publishChecklist = [
    {
        title: '角色包结构',
        items: ['avatar.json', 'personality.json', 'voice.json', 'resource-index.json', 'performance-presets.json'],
        status: 'ready'
    },
    {
        title: '运行时校验',
        items: ['动作目录映射', '表情兼容', '音频路径与授权信息', '时间轴合法性'],
        status: 'review'
    },
    {
        title: '接入后效果',
        items: ['默认开场动作', '默认情绪曲线', '首批推荐作品', '回滚版本'],
        status: 'ready'
    }
];


export const roadmap = [
    {
        phase: 'Phase 1',
        title: '角色定义',
        detail: '形象、性格、声音、资源槽位建模'
    },
    {
        phase: 'Phase 2',
        title: '资源装配',
        detail: '歌曲、动作、歌词、模板作品与演出模板'
    },
    {
        phase: 'Phase 3',
        title: '协作与市场',
        detail: '模板复用、创作者市场、版本治理、团队审校'
    }
];
