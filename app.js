// ===== 应用状态 =====
const state = {
    currentMode: 'challenge',
    currentChapter: 0,
    currentQuestion: 0,
    currentBlank: 0,
    userAnswers: [],
    combo: 0,
    maxCombo: 0,
    points: 0,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    wrongQuestions: [],
    lastStudyDate: null
};

// ===== 初始化 =====
function init() {
    loadProgress();
    setupEventListeners();
    renderQuestion();
    updateStats();
    renderAchievements();
    renderChapters();
    checkDailyStreak();
}

// ===== 事件监听 =====
function setupEventListeners() {
    // 导航按钮
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // 提交按钮
    document.getElementById('submitBtn').addEventListener('click', submitAnswer);

    // 回车提交
    document.getElementById('answerInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitAnswer();
    });

    // 提示按钮
    document.getElementById('hintBtn').addEventListener('click', showHint);

    // 跳过按钮
    document.getElementById('skipBtn').addEventListener('click', skipQuestion);
}

// ===== 模式切换 =====
function switchMode(mode) {
    state.currentMode = mode;

    // 更新导航样式
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // 显示对应视图
    document.getElementById('challengeView').style.display = mode === 'challenge' ? 'block' : 'none';
    document.getElementById('achievementsView').style.display = mode === 'achievements' ? 'block' : 'none';
    document.getElementById('chaptersView').style.display = mode === 'chapters' ? 'block' : 'none';

    if (mode === 'review') {
        startReviewMode();
    }
}

// ===== 渲染题目 =====
function renderQuestion() {
    const chapter = questionsData.chapters[state.currentChapter];
    const question = chapter.questions[state.currentQuestion];

    // 更新章节标签
    document.getElementById('chapterTag').textContent = chapter.name;

    // 更新难度
    document.getElementById('difficulty').textContent = '⭐'.repeat(question.difficulty);

    // 渲染题目内容，将填空替换为可点击的空格
    let content = question.content;
    const blanks = question.blanks;

    // 重置用户答案数组
    state.userAnswers = new Array(blanks.length).fill('');
    state.currentBlank = 0;

    // 替换下划线为空格元素
    let blankIndex = 0;
    content = content.replace(/____+/g, (match) => {
        const idx = blankIndex++;
        const isActive = idx === 0 ? 'active' : '';
        return `<span class="blank ${isActive}" data-index="${idx}"><span class="blank-text"></span></span>`;
    });

    document.getElementById('questionContent').innerHTML = content;

    // 绑定空格点击事件
    document.querySelectorAll('.blank').forEach(blank => {
        blank.addEventListener('click', () => {
            state.currentBlank = parseInt(blank.dataset.index);
            updateBlankHighlight();
            document.getElementById('answerInput').focus();
        });
    });

    // 更新进度条
    updateProgress();

    // 清空输入
    document.getElementById('answerInput').value = '';
    document.getElementById('answerInput').focus();

    // 隐藏反馈
    document.getElementById('feedback').style.display = 'none';
}

// ===== 更新空格高亮 =====
function updateBlankHighlight() {
    document.querySelectorAll('.blank').forEach((blank, idx) => {
        blank.classList.toggle('active', idx === state.currentBlank);
    });
}

// ===== 提交答案 =====
function submitAnswer() {
    const input = document.getElementById('answerInput');
    const answer = input.value.trim();

    if (!answer) {
        showToast('请输入答案');
        return;
    }

    const chapter = questionsData.chapters[state.currentChapter];
    const question = chapter.questions[state.currentQuestion];
    const correctAnswer = question.blanks[state.currentBlank];

    // 检查答案（支持模糊匹配）
    const isCorrect = checkAnswer(answer, correctAnswer);

    // 更新空格显示
    const blankElement = document.querySelectorAll('.blank')[state.currentBlank];
    blankElement.querySelector('.blank-text').textContent = answer;
    blankElement.classList.remove('active');
    blankElement.classList.add(isCorrect ? 'correct' : 'wrong');

    state.userAnswers[state.currentBlank] = answer;

    if (isCorrect) {
        // 正确
        state.combo++;
        state.correctCount++;
        state.points += 10 * (1 + Math.floor(state.combo / 5)); // 连击加分

        if (state.combo > state.maxCombo) {
            state.maxCombo = state.combo;
        }

        // 显示连击
        if (state.combo >= 3) {
            showCombo();
        }

        // 检查成就
        checkAchievements();

        // 移动到下一个空格或下一题
        if (state.currentBlank < question.blanks.length - 1) {
            state.currentBlank++;
            updateBlankHighlight();
            input.value = '';
            input.focus();
        } else {
            // 全部填完，显示成功反馈
            showFeedback(true);
            setTimeout(() => nextQuestion(), 1500);
        }
    } else {
        // 错误
        state.combo = 0;
        state.wrongCount++;

        // 记录错题
        if (!state.wrongQuestions.find(q => q.id === question.id)) {
            state.wrongQuestions.push({
                ...question,
                chapterName: chapter.name
            });
        }

        showFeedback(false, correctAnswer);
        hideCombo();
    }

    updateStats();
    saveProgress();
}

// ===== 检查答案 =====
function checkAnswer(userAnswer, correctAnswer) {
    // 移除空格和标点，转小写比较
    const normalize = (str) => str.replace(/[\s，。、？！""'']/g, '').toLowerCase();
    return normalize(userAnswer) === normalize(correctAnswer);
}

// ===== 显示反馈 =====
function showFeedback(isCorrect, correctAnswer = '') {
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'flex';
    feedback.className = `feedback ${isCorrect ? 'success' : 'error'}`;

    feedback.querySelector('.feedback-icon').textContent = isCorrect ? '✓' : '✗';
    feedback.querySelector('.feedback-text').textContent = isCorrect ? '回答正确！' : '再想想...';
    feedback.querySelector('.correct-answer').textContent = isCorrect ? '' : `正确答案：${correctAnswer}`;
    feedback.querySelector('.correct-answer').style.display = isCorrect ? 'none' : 'block';
}

// ===== 下一题 =====
function nextQuestion() {
    const chapter = questionsData.chapters[state.currentChapter];

    if (state.currentQuestion < chapter.questions.length - 1) {
        state.currentQuestion++;
    } else if (state.currentChapter < questionsData.chapters.length - 1) {
        // 进入下一章节
        state.currentChapter++;
        state.currentQuestion = 0;
        showToast(`🎉 进入新章节：${questionsData.chapters[state.currentChapter].name}`);
    } else {
        // 全部完成
        showToast('🎊 恭喜！你已完成所有题目！');
        state.currentChapter = 0;
        state.currentQuestion = 0;
    }

    renderQuestion();
    saveProgress();
}

// ===== 跳过题目 =====
function skipQuestion() {
    state.combo = 0;
    hideCombo();
    nextQuestion();
}

// ===== 显示提示 =====
function showHint() {
    const chapter = questionsData.chapters[state.currentChapter];
    const question = chapter.questions[state.currentQuestion];

    if (question.hint) {
        showToast(`💡 ${question.hint}`);
        state.points = Math.max(0, state.points - 5); // 使用提示扣分
        updateStats();
    }
}

// ===== 连击显示 =====
function showCombo() {
    const comboDisplay = document.getElementById('comboDisplay');
    document.getElementById('comboCount').textContent = state.combo;
    comboDisplay.style.display = 'block';
    comboDisplay.style.animation = 'none';
    comboDisplay.offsetHeight; // 触发重排
    comboDisplay.style.animation = 'comboPop 0.5s ease';
}

function hideCombo() {
    document.getElementById('comboDisplay').style.display = 'none';
}

// ===== 更新进度条 =====
function updateProgress() {
    const chapter = questionsData.chapters[state.currentChapter];
    const progress = ((state.currentQuestion + 1) / chapter.questions.length) * 100;

    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent =
        `${state.currentQuestion + 1} / ${chapter.questions.length}`;
}

// ===== 更新统计 =====
function updateStats() {
    document.getElementById('streak').textContent = state.streak;
    document.getElementById('points').textContent = state.points;
}

// ===== Toast 通知 =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== 成就系统 =====
function checkAchievements() {
    const achievements = questionsData.achievements;

    // 初露锋芒
    if (state.correctCount >= 1) {
        unlockAchievement('first_correct');
    }

    // 连击成就
    if (state.combo >= 5) {
        unlockAchievement('combo_5');
    }
    if (state.combo >= 10) {
        unlockAchievement('combo_10');
    }

    // 百题斩
    if (state.correctCount >= 100) {
        unlockAchievement('total_100');
    }

    // 连续学习
    if (state.streak >= 3) {
        unlockAchievement('daily_streak_3');
    }
    if (state.streak >= 7) {
        unlockAchievement('daily_streak_7');
    }
}

function unlockAchievement(id) {
    const achievement = questionsData.achievements.find(a => a.id === id);
    if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        showToast(`🏆 解锁成就：${achievement.name}！`);
        renderAchievements();
        saveProgress();
    }
}

function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    grid.innerHTML = questionsData.achievements.map(a => `
        <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}">
            <div class="achievement-icon">${a.icon}</div>
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.desc}</div>
        </div>
    `).join('');
}

// ===== 章节系统 =====
function renderChapters() {
    const list = document.getElementById('chaptersList');
    list.innerHTML = questionsData.chapters.map((chapter, idx) => {
        const isLocked = idx > state.currentChapter + 1;
        const stars = idx < state.currentChapter ? '⭐⭐⭐' :
            idx === state.currentChapter ? '⭐' : '☆☆☆';

        return `
            <div class="chapter-item ${isLocked ? 'locked' : ''}" 
                 onclick="${isLocked ? '' : `selectChapter(${idx})`}">
                <div class="chapter-number">${isLocked ? '🔒' : idx + 1}</div>
                <div class="chapter-info">
                    <div class="chapter-title">${chapter.name}</div>
                    <div class="chapter-progress">${chapter.questions.length} 道题</div>
                </div>
                <div class="chapter-stars">${stars}</div>
            </div>
        `;
    }).join('');
}

function selectChapter(idx) {
    state.currentChapter = idx;
    state.currentQuestion = 0;
    switchMode('challenge');
    renderQuestion();
}

// ===== 错题复习 =====
function startReviewMode() {
    if (state.wrongQuestions.length === 0) {
        showToast('📝 暂无错题，继续加油！');
        switchMode('challenge');
        return;
    }

    showToast(`📝 开始复习 ${state.wrongQuestions.length} 道错题`);
    // TODO: 实现错题复习逻辑
    switchMode('challenge');
}

// ===== 每日打卡 =====
function checkDailyStreak() {
    const today = new Date().toDateString();

    if (state.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (state.lastStudyDate === yesterday.toDateString()) {
            state.streak++;
        } else if (state.lastStudyDate !== today) {
            state.streak = 1;
        }

        state.lastStudyDate = today;
        saveProgress();
    }
}

// ===== 进度保存/加载 =====
function saveProgress() {
    const data = {
        currentChapter: state.currentChapter,
        currentQuestion: state.currentQuestion,
        points: state.points,
        streak: state.streak,
        correctCount: state.correctCount,
        wrongCount: state.wrongCount,
        maxCombo: state.maxCombo,
        wrongQuestions: state.wrongQuestions,
        lastStudyDate: state.lastStudyDate,
        achievements: questionsData.achievements.map(a => ({ id: a.id, unlocked: a.unlocked }))
    };
    localStorage.setItem('studyProgress', JSON.stringify(data));
}

function loadProgress() {
    const saved = localStorage.getItem('studyProgress');
    if (saved) {
        const data = JSON.parse(saved);
        state.currentChapter = data.currentChapter || 0;
        state.currentQuestion = data.currentQuestion || 0;
        state.points = data.points || 0;
        state.streak = data.streak || 0;
        state.correctCount = data.correctCount || 0;
        state.wrongCount = data.wrongCount || 0;
        state.maxCombo = data.maxCombo || 0;
        state.wrongQuestions = data.wrongQuestions || [];
        state.lastStudyDate = data.lastStudyDate || null;

        // 恢复成就状态
        if (data.achievements) {
            data.achievements.forEach(saved => {
                const achievement = questionsData.achievements.find(a => a.id === saved.id);
                if (achievement) {
                    achievement.unlocked = saved.unlocked;
                }
            });
        }
    }
}

// ===== 启动应用 =====
document.addEventListener('DOMContentLoaded', init);
