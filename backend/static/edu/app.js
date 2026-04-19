const state = {
    status: null,
    me: null,
    student: null,
    teacher: null,
    teacherStudents: [],
    teacherClassrooms: null,
    questionBank: null,
    selectedQuestionIds: new Set(),
    loading: false,
};

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');

const subjectOptions = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const gradeOptions = ['初一', '初二', '初三', '高一', '高二', '高三'];
const examOptions = ['中考', '高考'];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function splitList(rawValue) {
    return String(rawValue ?? '')
        .replaceAll('，', ',')
        .replaceAll('、', ',')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.style.background = isError ? '#8a1538' : '#16324a';
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.classList.add('hidden');
    }, 2800);
}

async function api(path, options = {}) {
    const config = {
        method: options.method || 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
        },
    };
    if (options.body !== undefined) {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(options.body);
    }

    const response = await fetch(path, config);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof payload === 'string'
            ? payload
            : payload.detail || payload.error?.message || '请求失败';
        throw new Error(message);
    }

    return payload.data ?? payload;
}

async function loadStatus() {
    state.status = await api('/api/edu/system/status');
}

async function loadMe() {
    state.me = await api('/api/edu/me');
}

async function loadStudentData() {
    state.student = await api('/api/edu/student/overview');
}

async function loadTeacherData({ keepSelection = true } = {}) {
    const previousSelection = keepSelection ? new Set(state.selectedQuestionIds) : new Set();
    const teacher = state.me?.user || {};
    const presetSubject = state.questionBank?.filters?.subject || teacher.managedSubjects?.[0] || '数学';

    const [overview, students, classrooms, questionBank] = await Promise.all([
        api('/api/edu/teacher/overview'),
        api('/api/edu/teacher/students'),
        api('/api/edu/teacher/classroom-sessions'),
        api(`/api/edu/teacher/question-bank?subject=${encodeURIComponent(presetSubject)}&limit=12`),
    ]);

    state.teacher = overview;
    state.teacherStudents = students;
    state.teacherClassrooms = classrooms;
    state.questionBank = questionBank;
    state.selectedQuestionIds = previousSelection;
}

async function refreshSessionData() {
    await loadMe();
    if (state.me?.user?.role === 'student') {
        await loadStudentData();
    } else if (state.me?.user?.role === 'teacher') {
        await loadTeacherData();
    }
}

function renderMetricCards(metrics = {}) {
    return `
        <div class="metrics-grid">
            <div class="panel metric blue">
                <span class="muted">学情画像</span>
                <strong>${escapeHtml(metrics.diagnosticsCount ?? 0)}</strong>
                <span class="muted">已建立画像科目</span>
            </div>
            <div class="panel metric teal">
                <span class="muted">练习派发</span>
                <strong>${escapeHtml(metrics.assignmentCount ?? 0)}</strong>
                <span class="muted">当前关联练习包</span>
            </div>
            <div class="panel metric orange">
                <span class="muted">仿真课堂</span>
                <strong>${escapeHtml(metrics.classroomCount ?? 0)}</strong>
                <span class="muted">课堂记录累计</span>
            </div>
            <div class="panel metric rose">
                <span class="muted">课堂正确</span>
                <strong>${escapeHtml(metrics.correctCount ?? 0)}</strong>
                <span class="muted">累计答对题目</span>
            </div>
        </div>
    `;
}

function renderSidebar() {
    const user = state.me?.user;
    const questionBank = state.status?.questionBankSource || {};
    return `
        <aside class="sidebar">
            <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80" alt="课堂场景">
            <div class="brand">
                <h1>仿真教学平台</h1>
                <p>把学生建档、学情画像、仿真课堂、教师派题和真实题库，收进同一套教学服务闭环。</p>
            </div>
            <div class="status-card">
                <h2>系统状态</h2>
                <p>${escapeHtml(state.status?.appName || '仿真教学平台')}</p>
                <p>题库源：${escapeHtml(questionBank.label || '未加载')}</p>
                <p>数据集：${escapeHtml(questionBank.dataset || '-')}</p>
            </div>
            <div class="sidebar-section">
                <h2>核心模块</h2>
                <ul class="status-list">
                    ${(state.status?.modules || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
            <div class="sidebar-section">
                <h2>${user ? '当前登录' : '使用说明'}</h2>
                ${user ? `
                    <p>${escapeHtml(user.fullName)} · ${escapeHtml(user.role === 'teacher' ? '教师端' : '学生端')}</p>
                    <p>${escapeHtml(user.email)}</p>
                    <p>${escapeHtml(user.role === 'teacher' ? (user.managedSubjects || []).join('、') || '待配置学科' : user.grade || '待建档')}</p>
                ` : `
                    <p>学生端完成建档后，直接进入画像与仿真课堂。</p>
                    <p>教师端使用邀请码注册，随后可检索真题并定向派题。</p>
                `}
            </div>
        </aside>
    `;
}

function renderAuthView() {
    return `
        <main class="content">
            <div class="toolbar">
                <div>
                    <h2>直接进入教学工作台</h2>
                    <p class="muted">先登录，或者把学生档案、教师角色一次建好。</p>
                </div>
                <div class="pill-row">
                    <span class="pill">真实题库</span>
                    <span class="pill">仿真课堂</span>
                    <span class="pill">教师派题</span>
                </div>
            </div>
            <div class="auth-grid">
                <section class="auth-card">
                    <div class="section-head">
                        <h3>登录</h3>
                        <span class="muted">已有账号直接进</span>
                    </div>
                    <form data-form="login" class="form-grid">
                        <div class="field full">
                            <label for="login-email">邮箱</label>
                            <input id="login-email" name="email" type="email" required>
                        </div>
                        <div class="field full">
                            <label for="login-password">密码</label>
                            <input id="login-password" name="password" type="password" required>
                        </div>
                        <div class="field full actions">
                            <button class="btn-primary" type="submit">登录并进入</button>
                        </div>
                    </form>
                </section>
                <section class="auth-card">
                    <div class="section-head">
                        <h3>学生建档</h3>
                        <span class="muted">建档后自动登录</span>
                    </div>
                    <form data-form="student-register" class="form-grid">
                        <div class="field"><label>姓名</label><input name="fullName" required></div>
                        <div class="field"><label>邮箱</label><input name="email" type="email" required></div>
                        <div class="field"><label>手机号</label><input name="phone" required></div>
                        <div class="field"><label>年级</label><select name="grade">${gradeOptions.map((item) => `<option value="${item}">${item}</option>`).join('')}</select></div>
                        <div class="field"><label>密码</label><input name="password" type="password" minlength="6" required></div>
                        <div class="field"><label>确认密码</label><input name="confirmPassword" type="password" minlength="6" required></div>
                        <div class="field"><label>学校</label><input name="schoolName" required></div>
                        <div class="field"><label>班级</label><input name="className" required></div>
                        <div class="field"><label>目标考试</label><select name="targetExam">${examOptions.map((item) => `<option value="${item}">${item}</option>`).join('')}</select></div>
                        <div class="field"><label>学习偏好</label><input name="learningPreference" value="刷题 + 答疑"></div>
                        <div class="field full"><label>擅长科目（逗号分隔）</label><input name="favoriteSubjects" placeholder="数学,英语"></div>
                        <div class="field full"><label>薄弱科目（逗号分隔）</label><input name="weakSubjects" placeholder="物理,化学"></div>
                        <div class="field full"><label>目标摘要</label><textarea name="goalSummary" placeholder="例如：一个月内把数学稳定到 110+"></textarea></div>
                        <div class="field"><label>家长姓名</label><input name="parentName" required></div>
                        <div class="field"><label>家长手机号</label><input name="parentPhone" required></div>
                        <div class="field full actions">
                            <label><input type="checkbox" name="parentNoticeOptIn" checked> 接收学习通知</label>
                            <label><input type="checkbox" name="agreementAccepted" required> 已确认学习服务自愿协议书</label>
                        </div>
                        <div class="field full actions">
                            <button class="btn-primary" type="submit">创建学生档案</button>
                        </div>
                    </form>
                </section>
                <section class="auth-card">
                    <div class="section-head">
                        <h3>教师接入</h3>
                        <span class="muted">接入角色后自动开通教师台</span>
                    </div>
                    <form data-form="teacher-register" class="form-grid">
                        <div class="field"><label>姓名</label><input name="fullName" required></div>
                        <div class="field"><label>邮箱</label><input name="email" type="email" required></div>
                        <div class="field"><label>手机号</label><input name="phone" required></div>
                        <div class="field"><label>教师职称</label><input name="teacherTitle" placeholder="数学教研组长" required></div>
                        <div class="field"><label>密码</label><input name="password" type="password" minlength="6" required></div>
                        <div class="field"><label>确认密码</label><input name="confirmPassword" type="password" minlength="6" required></div>
                        <div class="field"><label>学校</label><input name="schoolName" required></div>
                        <div class="field"><label>班级 / 教研组</label><input name="className" value="教研组"></div>
                        <div class="field full"><label>管理学科（逗号分隔）</label><input name="managedSubjects" value="数学,英语"></div>
                        <div class="field full"><label>管理年级（逗号分隔）</label><input name="managedGrades" value="初三,高三"></div>
                        <div class="field full"><label>邀请码</label><input name="inviteCode" required></div>
                        <div class="field full actions">
                            <button class="btn-primary" type="submit">接入教师端角色</button>
                        </div>
                    </form>
                </section>
            </div>
        </main>
    `;
}

function renderStudentView() {
    const overview = state.student || {};
    const student = overview.student || {};
    const diagnostics = overview.learning?.diagnostics || [];
    const plan = overview.learning?.personalizedPlan || [];
    const assignments = overview.assignments?.recent || [];
    const activeSession = overview.classrooms?.activeSession || null;

    return `
        <main class="content">
            <div class="toolbar">
                <div>
                    <h2>${escapeHtml(student.fullName || '学生')} 的学习工作台</h2>
                    <p class="muted">${escapeHtml(student.grade || '')} · ${escapeHtml(student.schoolName || '')} · ${escapeHtml(student.vipLevel || '基础会员')}</p>
                </div>
                <div class="actions">
                    <button class="btn-secondary" data-action="refresh">刷新数据</button>
                    <button class="btn-danger" data-action="logout">退出登录</button>
                </div>
            </div>
            ${renderMetricCards(overview.metrics || {})}
            <div class="two-col">
                <section class="panel">
                    <div class="section-head">
                        <h3>个性化学习路径</h3>
                        <span class="muted">基于档案 + 学情画像</span>
                    </div>
                    <ul class="plan-list">
                        ${plan.map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>先完成第一份学情画像，再开启仿真课堂。</li>'}
                    </ul>
                    <div class="pill-row" style="margin-top:14px;">
                        ${(student.favoriteSubjects || []).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join('') || '<span class="pill">待补充喜好科目</span>'}
                    </div>
                </section>
                <section class="panel">
                    <div class="section-head">
                        <h3>档案摘要</h3>
                        <span class="muted">建档信息已接入后端</span>
                    </div>
                    <div class="bullet-list">
                        <div>目标考试：${escapeHtml(student.targetExam || '-')}</div>
                        <div>学习偏好：${escapeHtml(student.learningPreference || '-')}</div>
                        <div>家长通知：${student.parentNoticeOptIn ? '已开启' : '未开启'}</div>
                        <div>目标摘要：${escapeHtml(student.goalSummary || '待补充')}</div>
                    </div>
                </section>
            </div>
            <div class="two-col">
                <section class="panel">
                    <div class="section-head">
                        <h3>学情画像</h3>
                        <span class="muted">一科一档，实时更新</span>
                    </div>
                    <form data-form="diagnostic" class="form-grid">
                        <div class="field"><label>学科</label><select name="subject">${subjectOptions.map((item) => `<option value="${item}">${item}</option>`).join('')}</select></div>
                        <div class="field"><label>年级带</label><input name="gradeBand" value="${escapeHtml(student.grade || '')}"></div>
                        <div class="field"><label>基础分</label><input name="baselineScore" type="number" min="0" max="150" value="90"></div>
                        <div class="field"><label>自信度（0-10）</label><input name="confidenceLevel" type="number" min="0" max="10" value="6"></div>
                        <div class="field"><label>作业完成率</label><input name="homeworkCompletion" type="number" min="0" max="100" value="80"></div>
                        <div class="field"><label>错题回收率</label><input name="mistakeRecovery" type="number" min="0" max="100" value="60"></div>
                        <div class="field full"><label>薄弱点（逗号分隔）</label><input name="weakPoints" placeholder="函数,几何,阅读理解"></div>
                        <div class="field full actions">
                            <button class="btn-primary" type="submit">更新学情画像</button>
                        </div>
                    </form>
                    <div class="card-list" style="margin-top:16px;">
                        ${diagnostics.length ? diagnostics.map((item) => `
                            <article class="snapshot-card">
                                <div class="section-head">
                                    <h4>${escapeHtml(item.subject)}</h4>
                                    <span class="pill">${escapeHtml(item.currentLevel)}</span>
                                </div>
                                <p class="muted">画像分：${escapeHtml(item.confidenceScore)} · 薄弱点：${escapeHtml((item.weakPoints || []).join('、') || '待补充')}</p>
                                <p>${escapeHtml(item.masterySummary)}</p>
                            </article>
                        `).join('') : '<div class="empty-state">还没有学情画像，先提交一份诊断。</div>'}
                    </div>
                </section>
                <section class="panel">
                    <div class="section-head">
                        <h3>教师派发练习</h3>
                        <span class="muted">来自真实题库</span>
                    </div>
                    <div class="card-list">
                        ${assignments.length ? assignments.map((item) => `
                            <article class="assignment-card">
                                <div class="section-head">
                                    <h4>${escapeHtml(item.title)}</h4>
                                    <span class="pill">${escapeHtml(item.subject)}</span>
                                </div>
                                <p class="muted">${escapeHtml(item.questionCount)} 道题 · ${escapeHtml(item.source?.dataset || '')}</p>
                                <p>${escapeHtml(item.notes || '教师未填写备注')}</p>
                            </article>
                        `).join('') : '<div class="empty-state">暂时还没有教师派题。</div>'}
                    </div>
                </section>
            </div>
            <section class="panel">
                <div class="section-head">
                    <h3>仿真课堂</h3>
                    <span class="muted">点名、追问、即时判题都在这里</span>
                </div>
                <div class="two-col">
                    <div>
                        <form data-form="classroom-start" class="form-grid">
                            <div class="field"><label>课堂学科</label><select name="subject">${subjectOptions.map((item) => `<option value="${item}">${item}</option>`).join('')}</select></div>
                            <div class="field"><label>课堂主题</label><input name="topic" placeholder="例如：二次函数压轴题"></div>
                            <div class="field full actions">
                                <button class="btn-primary" type="submit">开启仿真课堂</button>
                            </div>
                        </form>
                        <div style="margin-top:16px;">
                            ${activeSession ? `
                                <div class="section-head">
                                    <h4>${escapeHtml(activeSession.subject)} · ${escapeHtml(activeSession.status === 'active' ? '进行中' : '已结束')}</h4>
                                    <span class="muted">答题 ${escapeHtml(activeSession.attemptedCount)} / 正确 ${escapeHtml(activeSession.correctCount)}</span>
                                </div>
                                <div class="transcript">
                                    ${(activeSession.transcript || []).map((item) => `
                                        <div class="bubble ${escapeHtml(item.role)}">
                                            <span class="bubble-meta">${escapeHtml(item.role === 'teacher' ? '仿真教师' : item.role === 'student' ? '学生' : '系统')}</span>
                                            ${escapeHtml(item.text)}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div class="empty-state">还没有正在进行的课堂，先开启一节新的仿真课堂。</div>'}
                        </div>
                    </div>
                    <div>
                        ${activeSession?.currentQuestion ? `
                            <div class="section-head">
                                <h4>当前题目</h4>
                                <span class="pill">${escapeHtml(activeSession.currentQuestion.subject || activeSession.subject)}</span>
                            </div>
                            <p>${escapeHtml(activeSession.currentQuestion.stem || '')}</p>
                            <div class="choice-grid" style="margin-top:14px;">
                                ${(activeSession.currentQuestion.choices || []).map((choice, index) => `
                                    <button class="choice-button" type="button" data-action="answer-choice" data-choice="${index}">
                                        ${String.fromCharCode(65 + index)}. ${escapeHtml(choice)}
                                    </button>
                                `).join('')}
                            </div>
                            <form data-form="classroom-free-text" style="margin-top:16px;">
                                <div class="field">
                                    <label>追问 / 思路补充</label>
                                    <textarea name="freeText" placeholder="把你的疑问、解题思路或求助内容直接发给仿真教师。"></textarea>
                                </div>
                                <div class="actions">
                                    <button class="btn-secondary" type="submit">发送追问</button>
                                    <button class="btn-danger" type="button" data-action="end-classroom">结束本节课堂</button>
                                </div>
                            </form>
                        ` : `
                            <div class="empty-state">当前没有待回答题目。开启课堂后，系统会自动点名并推送首题。</div>
                        `}
                    </div>
                </div>
            </section>
        </main>
    `;
}

function renderTeacherView() {
    const overview = state.teacher || {};
    const teacher = overview.teacher || {};
    const students = state.teacherStudents || [];
    const questionBank = state.questionBank || {};
    const recentAssignments = overview.recentAssignments || [];
    const recentClassrooms = state.teacherClassrooms?.sessions || [];

    return `
        <main class="content">
            <div class="toolbar">
                <div>
                    <h2>${escapeHtml(teacher.fullName || '教师')} 的教师总控台</h2>
                    <p class="muted">${escapeHtml((teacher.managedSubjects || []).join('、') || '待配置学科')} · ${escapeHtml((teacher.managedGrades || []).join('、') || '待配置年级')}</p>
                </div>
                <div class="actions">
                    <button class="btn-secondary" data-action="refresh">刷新数据</button>
                    <button class="btn-danger" data-action="logout">退出登录</button>
                </div>
            </div>
            ${renderMetricCards(overview.metrics || {})}
            <div class="two-col">
                <section class="panel">
                    <div class="section-head">
                        <h3>学生概览</h3>
                        <span class="muted">班级薄弱点一眼可见</span>
                    </div>
                    <div class="card-list">
                        ${students.length ? students.map((item) => `
                            <article class="student-card">
                                <div class="section-head">
                                    <h4>${escapeHtml(item.fullName)}</h4>
                                    <span class="pill">${escapeHtml(item.grade || '')}</span>
                                </div>
                                <p class="muted">${escapeHtml(item.schoolName || '')} · ${escapeHtml(item.className || '')}</p>
                                <div class="chip-wrap" style="margin:10px 0;">
                                    ${(item.favoriteSubjects || []).map((subject) => `<span class="chip">${escapeHtml(subject)}</span>`).join('') || '<span class="chip">待补充偏好科目</span>'}
                                </div>
                                <p>画像数 ${escapeHtml(item.diagnosticCount)} · 派题数 ${escapeHtml(item.assignmentsCount)} · 当前突出薄弱点 ${escapeHtml(item.topWeakness || '待诊断')}</p>
                            </article>
                        `).join('') : '<div class="empty-state">还没有接入学生。</div>'}
                    </div>
                </section>
                <section class="panel">
                    <div class="section-head">
                        <h3>近期教学动作</h3>
                        <span class="muted">课堂 + 派题同步回看</span>
                    </div>
                    <div class="card-list">
                        ${recentAssignments.length ? recentAssignments.map((item) => `
                            <article class="assignment-card">
                                <div class="section-head">
                                    <h4>${escapeHtml(item.title)}</h4>
                                    <span class="pill">${escapeHtml(item.subject)}</span>
                                </div>
                                <p class="muted">${escapeHtml(item.questionCount)} 道题 · ${escapeHtml(item.createdAt || '')}</p>
                            </article>
                        `).join('') : '<div class="empty-state">还没有派题记录。</div>'}
                    </div>
                </section>
            </div>
            <div class="two-col">
                <section class="panel">
                    <div class="section-head">
                        <h3>真实题库派题</h3>
                        <span class="muted">${escapeHtml(questionBank.source?.label || '')}</span>
                    </div>
                    <form data-form="question-search" class="form-grid">
                        <div class="field">
                            <label>学科</label>
                            <select name="subject">
                                ${subjectOptions.map((item) => `<option value="${item}" ${questionBank.filters?.subject === item ? 'selected' : ''}>${item}</option>`).join('')}
                            </select>
                        </div>
                        <div class="field">
                            <label>关键字</label>
                            <input name="query" value="${escapeHtml(questionBank.filters?.query || '')}" placeholder="函数、阅读理解、氧气">
                        </div>
                        <div class="field">
                            <label>返回条数</label>
                            <input name="limit" type="number" min="1" max="30" value="${escapeHtml(questionBank.filters?.limit || 12)}">
                        </div>
                        <div class="field actions" style="align-self:end;">
                            <button class="btn-secondary" type="submit">检索题库</button>
                        </div>
                    </form>
                    ${questionBank.warning ? `<p class="muted" style="margin-top:12px;">${escapeHtml(questionBank.warning)}</p>` : ''}
                    <div class="question-list" style="margin-top:16px;">
                        ${(questionBank.results || []).length ? questionBank.results.map((item) => `
                            <article class="question-card">
                                <label class="checkbox">
                                    <input type="checkbox" data-action="toggle-question" data-question-id="${escapeHtml(item.sourceId)}" ${state.selectedQuestionIds.has(item.sourceId) ? 'checked' : ''}>
                                    <div>
                                        <strong>${escapeHtml(item.subject || '综合')}</strong>
                                        <p style="margin:8px 0;">${escapeHtml(item.stem || '')}</p>
                                        <div class="chip-wrap">
                                            ${(item.choices || []).map((choice, index) => `<span class="chip">${String.fromCharCode(65 + index)}. ${escapeHtml(choice)}</span>`).join('')}
                                        </div>
                                    </div>
                                </label>
                            </article>
                        `).join('') : '<div class="empty-state">没有检索到题目，换个学科或关键字试试。</div>'}
                    </div>
                    <form data-form="assignment-create" class="form-grid" style="margin-top:16px;">
                        <div class="field">
                            <label>目标学生</label>
                            <select name="studentId">${students.map((item) => `<option value="${item.id}">${escapeHtml(item.fullName)} · ${escapeHtml(item.grade || '')}</option>`).join('')}</select>
                        </div>
                        <div class="field">
                            <label>练习标题</label>
                            <input name="title" placeholder="留空则自动生成">
                        </div>
                        <div class="field full">
                            <label>教师备注</label>
                            <textarea name="notes" placeholder="例如：先做前 5 题，再把错题思路写出来。"></textarea>
                        </div>
                        <div class="field full actions">
                            <button class="btn-primary" type="submit">向所选学生派发已勾选题目</button>
                        </div>
                    </form>
                </section>
                <section class="panel">
                    <div class="section-head">
                        <h3>课堂看板</h3>
                        <span class="muted">最近 ${escapeHtml(recentClassrooms.length)} 节课</span>
                    </div>
                    <div class="card-list">
                        ${recentClassrooms.length ? recentClassrooms.map((item) => `
                            <article class="session-card">
                                <div class="section-head">
                                    <h4>${escapeHtml(item.studentName || '学生')}</h4>
                                    <span class="pill">${escapeHtml(item.subject)}</span>
                                </div>
                                <p class="muted">${escapeHtml(item.topic || '未设主题')} · ${escapeHtml(item.status === 'active' ? '进行中' : '已结束')}</p>
                                <p>答题 ${escapeHtml(item.attemptedCount)} / 正确 ${escapeHtml(item.correctCount)}</p>
                            </article>
                        `).join('') : '<div class="empty-state">还没有课堂记录。</div>'}
                    </div>
                </section>
            </div>
        </main>
    `;
}

function render() {
    app.innerHTML = `
        <div class="shell">
            ${renderSidebar()}
            ${state.me?.user ? (state.me.user.role === 'teacher' ? renderTeacherView() : renderStudentView()) : renderAuthView()}
        </div>
    `;
}

function formToObject(form) {
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    for (const input of form.querySelectorAll('input[type="checkbox"]')) {
        payload[input.name] = input.checked;
    }
    return payload;
}

async function handleAuthSubmit(formName, payload) {
    if (formName === 'login') {
        await api('/api/edu/auth/login', { method: 'POST', body: payload });
        return;
    }

    if (formName === 'student-register') {
        await api('/api/edu/auth/register/student', {
            method: 'POST',
            body: {
                ...payload,
                favoriteSubjects: splitList(payload.favoriteSubjects),
                weakSubjects: splitList(payload.weakSubjects),
            },
        });
        return;
    }

    if (formName === 'teacher-register') {
        await api('/api/edu/auth/register/teacher', {
            method: 'POST',
            body: {
                ...payload,
                managedSubjects: splitList(payload.managedSubjects),
                managedGrades: splitList(payload.managedGrades),
            },
        });
    }
}

async function submitDiagnostic(form) {
    const payload = formToObject(form);
    await api('/api/edu/student/diagnostics', {
        method: 'POST',
        body: {
            ...payload,
            baselineScore: Number(payload.baselineScore),
            confidenceLevel: Number(payload.confidenceLevel),
            homeworkCompletion: Number(payload.homeworkCompletion),
            mistakeRecovery: Number(payload.mistakeRecovery),
            weakPoints: splitList(payload.weakPoints),
        },
    });
    await loadStudentData();
}

async function startClassroom(form) {
    const payload = formToObject(form);
    await api('/api/edu/student/classroom-sessions', {
        method: 'POST',
        body: payload,
    });
    await loadStudentData();
}

async function sendFreeText(form) {
    const activeSession = state.student?.classrooms?.activeSession;
    if (!activeSession) {
        throw new Error('当前没有进行中的课堂。');
    }
    const payload = formToObject(form);
    await api(`/api/edu/student/classroom-sessions/${activeSession.id}/respond`, {
        method: 'POST',
        body: {
            freeText: payload.freeText,
        },
    });
    await loadStudentData();
}

async function submitQuestionSearch(form) {
    const payload = formToObject(form);
    state.questionBank = await api(
        `/api/edu/teacher/question-bank?subject=${encodeURIComponent(payload.subject)}&query=${encodeURIComponent(payload.query || '')}&limit=${encodeURIComponent(payload.limit || 12)}`
    );
}

async function submitAssignment(form) {
    if (!state.selectedQuestionIds.size) {
        throw new Error('请先勾选至少 1 道真题。');
    }
    const payload = formToObject(form);
    await api('/api/edu/teacher/assignments', {
        method: 'POST',
        body: {
            studentId: Number(payload.studentId),
            questionIds: Array.from(state.selectedQuestionIds),
            subject: state.questionBank?.filters?.subject || '综合',
            query: state.questionBank?.filters?.query || '',
            title: payload.title,
            notes: payload.notes,
        },
    });
    state.selectedQuestionIds = new Set();
    await loadTeacherData({ keepSelection: false });
}

async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
        return;
    }
    const formName = form.dataset.form;
    if (!formName) {
        return;
    }

    event.preventDefault();
    try {
        if (formName === 'login' || formName === 'student-register' || formName === 'teacher-register') {
            await handleAuthSubmit(formName, formToObject(form));
            await refreshSessionData();
        } else if (formName === 'diagnostic') {
            await submitDiagnostic(form);
        } else if (formName === 'classroom-start') {
            await startClassroom(form);
        } else if (formName === 'classroom-free-text') {
            await sendFreeText(form);
        } else if (formName === 'question-search') {
            await submitQuestionSearch(form);
        } else if (formName === 'assignment-create') {
            await submitAssignment(form);
        }
        render();
        showToast('操作已完成。');
    } catch (error) {
        showToast(error.message || '操作失败', true);
    }
}

async function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) {
        return;
    }

    const action = target.dataset.action;
    try {
        if (action === 'refresh') {
            await refreshSessionData();
            render();
            showToast('数据已刷新。');
            return;
        }

        if (action === 'logout') {
            await api('/api/edu/auth/logout', { method: 'POST' });
            state.me = null;
            state.student = null;
            state.teacher = null;
            state.teacherStudents = [];
            state.questionBank = null;
            state.teacherClassrooms = null;
            state.selectedQuestionIds = new Set();
            render();
            showToast('已退出登录。');
            return;
        }

        if (action === 'answer-choice') {
            const activeSession = state.student?.classrooms?.activeSession;
            if (!activeSession) {
                throw new Error('当前没有进行中的课堂。');
            }
            await api(`/api/edu/student/classroom-sessions/${activeSession.id}/respond`, {
                method: 'POST',
                body: {
                    selectedChoiceIndex: Number(target.dataset.choice),
                    freeText: '',
                },
            });
            await loadStudentData();
            render();
            showToast('作答已提交。');
            return;
        }

        if (action === 'end-classroom') {
            const activeSession = state.student?.classrooms?.activeSession;
            if (!activeSession) {
                throw new Error('当前没有进行中的课堂。');
            }
            await api(`/api/edu/student/classroom-sessions/${activeSession.id}/complete`, {
                method: 'POST',
            });
            await loadStudentData();
            render();
            showToast('课堂已结束。');
            return;
        }

        if (action === 'toggle-question') {
            const questionId = target.dataset.questionId;
            if (!questionId) {
                return;
            }
            if (target.checked) {
                state.selectedQuestionIds.add(questionId);
            } else {
                state.selectedQuestionIds.delete(questionId);
            }
            return;
        }
    } catch (error) {
        showToast(error.message || '操作失败', true);
    }
}

async function init() {
    try {
        await loadStatus();
        await loadMe();
        if (state.me?.user?.role === 'student') {
            await loadStudentData();
        } else if (state.me?.user?.role === 'teacher') {
            await loadTeacherData();
        }
        render();
    } catch (error) {
        app.innerHTML = `
            <div class="shell">
                ${renderSidebar()}
                <main class="content">
                    <div class="panel">
                        <h2>系统暂时不可用</h2>
                        <p class="muted">${escapeHtml(error.message || '请稍后重试')}</p>
                    </div>
                </main>
            </div>
        `;
    }
}

app.addEventListener('submit', handleSubmit);
app.addEventListener('click', handleClick);

init();
