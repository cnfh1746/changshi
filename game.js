/* ========================================
   背诵尖塔 - Slay the Spire Logic
   ======================================== */

// ========== 游戏配置 ==========
const CONFIG = {
    totalFloors: 15,
    pathsCount: 3, // 地图宽度（路径数）
};

// ========== 游戏状态 ==========
const game = {
    scene: 'main-menu', // 当前场景
    player: {
        class: null,
        hp: 80,
        maxHp: 80,
        gold: 99,
        deck: [],
        relics: [],
        curses: [], // 诅咒列表
        strength: 0,
        armor: 0
    },
    map: [], // 地图节点数据
    currentFloor: 0, // 当前层数 (0-indexed, UI显示+1)
    currentNode: null, // 当前所在节点索引
    act: 1,

    // 战斗状态
    battle: {
        enemy: null,
        turn: 0,
        streak: 0,
        maxStreak: 0,
        totalCorrect: 0,
        questionIndex: 0,
        currentQuestion: null,
        currentChapter: '',
        currentAnswers: [],
        currentBlankIndex: 0,
        totalBlanks: 0,
        blankStates: []
    },

    // 统计数据
    stats: {
        totalBattles: 0,
        totalWins: 0,
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        maxStreak: 0,
        goldEarned: 0,
        enemiesDefeated: 0,
        bossesDefeated: 0,
        highestFloor: 0
    },

    // 成就系统
    achievements: {
        firstWin: false,         // 第一次胜利
        streakMaster: false,     // 连续答对10题
        bossSlayer: false,       // 击败Boss
        goldCollector: false,    // 累计获得500金币
        perfectClear: false      // 无伤通关一场战斗
    }
};

// ========== 场景管理 ==========
game.showScene = function (sceneId) {
    // 隐藏所有场景
    document.querySelectorAll('.scene').forEach(el => {
        el.classList.remove('active');
    });
    // 显示目标场景
    const target = document.getElementById(sceneId);
    if (target) {
        target.classList.add('active');
        this.scene = sceneId;
    } else {
        console.error(`Scene ${sceneId} not found`);
    }
};

game.showMainMenu = () => game.showScene('main-menu');
game.showModeSelect = () => game.showScene('mode-selection');

game.showCharacterSelect = (mode) => {
    // 这里可以根据模式(mode)调整显示，目前默认显示
    game.showScene('character-selection');
};

// ========== 角色选择 ==========
game.selectCharacter = function (classKey) {
    // 更新UI选中状态
    document.querySelectorAll('.char-icon').forEach((el, idx) => {
        el.classList.remove('selected');
        // 根据索引匹配职业
        const classes = ['scholar', 'warrior', 'mage'];
        if (classes[idx] === classKey) {
            el.classList.add('selected');
        }
    });

    const playerData = PLAYERS[classKey];
    if (playerData) {
        document.getElementById('cs-name').textContent = playerData.name;
        document.getElementById('cs-hp').textContent = playerData.hp;
        document.getElementById('cs-gold').textContent = playerData.gold;
        document.getElementById('cs-relic').textContent = playerData.talent;
        document.getElementById('cs-relic-desc').textContent = playerData.talentDesc;
        document.getElementById('cs-desc').innerHTML = playerData.desc;
        document.getElementById('cs-portrait').innerHTML = `<img src="${playerData.image}">`;

        // 临时存储选择
        this.tempClassKey = classKey;
    }
};

game.startGame = function () {
    if (!this.tempClassKey) this.tempClassKey = 'scholar'; // 默认

    // 初始化玩家数据
    const pData = PLAYERS[this.tempClassKey];
    this.player = {
        class: this.tempClassKey,
        name: pData.name,
        image: pData.image,
        hp: pData.hp,
        maxHp: pData.maxHp,
        gold: pData.gold,
        strength: pData.strength,
        armor: 0,
        relics: [pData.talent]
    };

    // 进入涅奥事件
    this.initNeowEvent();
};

// ========== 涅奥事件 ==========
game.initNeowEvent = function () {
    this.showScene('neow-event');
    const optionsContainer = document.getElementById('neow-options');
    optionsContainer.innerHTML = '';

    const options = [
        { text: '获得 100 金币', reward: 'gold', cost: null },
        { text: '获得 1 张随机稀有卡', reward: 'card', cost: 'hp' }, // 占位
        { text: '敌人前3回合只有1点生命', reward: 'neow_lament', cost: null }
    ];

    options.forEach(opt => {
        const btn = document.createElement('div');
        btn.className = 'neow-choice';
        btn.innerHTML = `<span class="choice-reward">[${opt.text}]</span>`;
        btn.onclick = () => {
            // 处理奖励逻辑（简化）
            if (opt.reward === 'gold') this.player.gold += 100;
            if (opt.reward === 'neow_lament') this.player.relics.push('涅奥的悲以此');

            this.generateMap();
            this.enterMap();
        };
        optionsContainer.appendChild(btn);
    });
};

// ========== 地图系统 ==========
game.generateMap = function () {
    this.map = [];
    const floors = 15;
    const width = 3; // 3条路

    // 生成节点
    for (let f = 0; f < floors; f++) {
        const floorNodes = [];
        for (let w = 0; w < width; w++) {
            // 简单逻辑：每层3个节点
            let type = 'enemy';
            if (f === 0) type = 'enemy'; // 第1层固定敌人
            else if (f === 14) type = 'boss'; // 第15层Boss
            else if (f === 8) type = 'treasure'; // 第9层宝箱
            else {
                // 随机类型
                const rand = Math.random();
                if (rand < 0.45) type = 'enemy';
                else if (rand < 0.6) type = 'unknown';
                else if (rand < 0.75) type = 'merchant';
                else if (rand < 0.9) type = 'rest';
                else type = 'elite';
            }

            floorNodes.push({
                id: `${f}-${w}`,
                floor: f,
                index: w,
                type: type,
                next: [], // 连接下一层的哪些节点索引
                state: 'locked' // locked, available, completed
            });
        }
        this.map.push(floorNodes);
    }

    // 生成连线 (简单的向前连接：i -> i-1, i, i+1)
    for (let f = 0; f < floors - 1; f++) {
        for (let w = 0; w < width; w++) {
            const current = this.map[f][w];
            // 随机连接下一层1-2个节点
            const nextFloor = this.map[f + 1];
            // 必定连接同位
            current.next.push(w);
            // 随机连接左或右
            if (w > 0 && Math.random() > 0.5) current.next.push(w - 1);
            if (w < width - 1 && Math.random() > 0.5) current.next.push(w + 1);

            // 去重
            current.next = [...new Set(current.next)].sort();
        }
    }

    // 解锁第一层
    this.map[0].forEach(n => n.state = 'available');
    this.currentFloor = 0;
};

game.enterMap = function () {
    this.showScene('map-screen');
    this.updateHeader();
    this.renderMap();
};

game.renderMap = function () {
    const nodesContainer = document.getElementById('map-nodes');
    const svgContainer = document.getElementById('map-connections');
    nodesContainer.innerHTML = '';
    svgContainer.innerHTML = '';

    const nodeWidth = 40;
    const nodeHeight = 40;
    const xGap = 100; // 横向间距
    const yGap = 100; // 纵向间距 (向上)

    // 居中偏移
    const centerX = window.innerWidth / 2;
    const startY = 1600; // 底部开始

    // 绘制线和点
    this.map.forEach((floor, fIndex) => {
        const y = startY - fIndex * yGap;

        floor.forEach((node, wIndex) => {
            const x = centerX + (wIndex - 1) * xGap; // -1, 0, 1

            // 绘制节点
            const el = document.createElement('div');
            el.className = `map-node ${node.type} ${node.state}`;
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.textContent = this.getNodeIcon(node.type);
            el.onclick = () => this.onNodeClick(node);

            // 只有available的才不需要hover提示? 暂时都这样
            nodesContainer.appendChild(el);

            // 绘制连线 (画到下一层)
            node.next.forEach(nextIndex => {
                const nextY = startY - (fIndex + 1) * yGap;
                const nextX = centerX + (nextIndex - 1) * xGap;

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                // 简单的直线或曲线
                const d = `M ${x} ${y} L ${nextX} ${nextY}`;
                path.setAttribute("d", d);
                path.setAttribute("stroke", "#555");
                path.setAttribute("stroke-width", "3");
                path.setAttribute("stroke-dasharray", "5,5");
                path.setAttribute("fill", "none");

                // 如果当前节点完成，且连向解锁节点，点亮线？(简化略)

                svgContainer.appendChild(path);
            });
        });
    });

    // 自动滚动到底部 (起点)
    setTimeout(() => {
        const container = document.querySelector('.map-scroll-container');
        container.scrollTop = container.scrollHeight;
    }, 100);
};

game.getNodeIcon = function (type) {
    // 图标现在通过 CSS background-image 处理
    return '';
};

// onNodeClick 已移至文件末尾（增强版）

game.completeNode = function () {
    // 标记当前节点完成
    this.currentNode.state = 'completed';

    // 解锁下一层连接的节点
    const nextFloor = this.map[this.currentNode.floor + 1];
    if (nextFloor) {
        this.currentNode.next.forEach(nextIndex => {
            const nextNode = nextFloor[nextIndex];
            // 简单处理：只要连着就解锁，实际上应该是有路径限制
            nextNode.state = 'available';
        });
    }

    // 锁定同层其他节点 (肉鸽塔通常只能走一条路)
    const currentFloorNodes = this.map[this.currentNode.floor];
    currentFloorNodes.forEach(n => {
        if (n !== this.currentNode && n.state === 'available') {
            n.state = 'locked';
        }
    });

    this.enterMap(); // 回到地图
};

// ========== 战斗系统 (复用部分逻辑) ==========
game.startBattle = function (type) {
    this.showScene('battle-scene');

    // 生成敌人
    const enemyData = this.getEnemy(type);
    this.battle.enemy = {
        ...enemyData,
        currentHp: enemyData.hp,
        maxHp: enemyData.hp
    };

    // 重置战斗统计
    this.battle.turn = 0;
    this.battle.streak = 0;
    this.battle.maxStreak = 0;
    this.battle.totalCorrect = 0;
    this.battle.questionIndex = 0;
    this.battle.tookDamage = false;
    this.battle.currentQuestion = null;
    this.battle.currentChapter = '';
    this.battle.currentAnswers = [];
    this.battle.currentBlankIndex = 0;
    this.battle.totalBlanks = 0;
    this.battle.blankStates = [];

    // 渲染战斗UI
    this.initBattleUI();
    this.setBattleQuestion();
    this.loadBattleQuestion();
};

game.getEnemy = function (type) {
    // 复用之前的 ENEMIES 数据 (假设 data.js 还是全局的)
    let list = ENEMIES[type === 'boss' ? 'boss' : (type === 'elite' ? 'elite' : 'normal')];
    return list[Math.floor(Math.random() * list.length)];
};

game.initBattleUI = function () {
    // 头部复用
    const header = document.querySelector('.game-header');
    if (header) {
        document.getElementById('battle-header-placeholder').innerHTML = header.innerHTML;
    }

    // 显示玩家图片
    const playerSpriteEl = document.getElementById('playerSprite');
    if (this.player.image) {
        playerSpriteEl.innerHTML = `<img src="${this.player.image}" alt="${this.player.name}" style="width:100%;height:100%;object-fit:contain;">`;
    }

    // 显示敌人图片
    const enemySpriteEl = document.getElementById('enemySprite');
    if (this.battle.enemy.image) {
        enemySpriteEl.innerHTML = `<img src="${this.battle.enemy.image}" alt="${this.battle.enemy.name}" style="width:100%;height:100%;object-fit:contain;">`;
    } else {
        enemySpriteEl.textContent = this.battle.enemy.sprite;
    }

    this.updateBattleStats();
};

game.updateBattleStats = function () {
    // 更新血条
    document.getElementById('enemyHp').innerText = this.battle.enemy.currentHp;
    document.getElementById('enemyMaxHp').innerText = this.battle.enemy.maxHp;
    const hpPct = (this.battle.enemy.currentHp / this.battle.enemy.maxHp) * 100;
    document.getElementById('enemyHpBar').style.width = `${hpPct}%`;

    // 更新意图
    document.getElementById('intentValue').innerText = this.battle.enemy.attack || 10;
};

game.setBattleQuestion = function () {
    const { question, chapter } = getRandomQuestion();
    const placeholderCount = (question.content.match(/\{\{BLANK\}\}/g) || []).length;
    const blanksCount = placeholderCount || question.blanks || 1;
    const answers = (question.answer || '').split(/[、,，]/).map(a => a.trim()).filter(Boolean);

    this.battle.currentQuestion = question;
    this.battle.currentChapter = chapter;
    this.battle.currentAnswers = answers;
    this.battle.currentBlankIndex = 0;
    this.battle.totalBlanks = blanksCount;
    this.battle.blankStates = Array.from({ length: blanksCount }, () => ({ status: 'pending', value: '' }));
    this.battle.questionIndex++;
};

game.loadBattleQuestion = function () {
    if (!this.battle.currentQuestion) {
        this.setBattleQuestion();
    }

    const question = this.battle.currentQuestion;
    const chapter = this.battle.currentChapter;
    const blankIndex = this.battle.currentBlankIndex;
    const totalBlanks = this.battle.totalBlanks || 1;
    const answers = this.battle.currentAnswers || [];
    const correctAnswer = (answers[blankIndex] || answers[0] || question.answer || '').trim();

    // 清理Markdown格式
    let displayContent = cleanMarkdown(question.content);

    // 格式化显示：在序号处换行，提高可读性
    // 1. 处理 "1. " "2. " 等数字序号
    displayContent = displayContent.replace(/(\d+)\.\s+/g, '<br><strong>$1.</strong> ');
    // 2. 处理 "(1)" "(2)" 等括号序号
    displayContent = displayContent.replace(/\((\d+)\)\s*/g, '<br>　($1) ');
    // 3. 处理 "•" 和 "·" 项目符号
    displayContent = displayContent.replace(/[•·]\s*/g, '<br>　• ');
    // 4. 移除开头的多余换行和空格
    displayContent = displayContent.replace(/^(<br>|　)+/, '');
    // 5. 在分号后换行（中文分号，且后面有内容）
    displayContent = displayContent.replace(/；(?=\S)/g, '；<br>');

    // 标记每个空位，当前空位高亮并显示编号
    let blankCount = 0;
    displayContent = displayContent.replace(/\{\{BLANK\}\}/g, (match) => {
        const num = blankCount + 1;
        let result;
        if (blankCount === blankIndex) {
            // 当前要填的空 - 金色高亮
            result = `<span class="current-blank">空${num}</span>`;
        } else {
            const state = this.battle.blankStates[blankCount];
            if (state && state.status !== 'pending') {
                const label = state.status === 'correct' ? '✔' : '✘';
                const valueText = state.value ? `：${state.value}` : '';
                result = `<span class="answered-blank ${state.status}">${label} 空${num}${valueText}</span>`;
            } else {
                // 其他空位 - 灰色虚线
                result = `<span class="other-blank">空${num}</span>`;
            }
        }
        blankCount++;
        return result;
    });

    // 构建显示内容：章节标签在上方居中 + 正文内容独立一个区块
    let htmlContent = `<div class="chapter-tag">${chapter}</div>`;
    htmlContent += `<div class="question-content-wrapper">${displayContent}`;
    if (totalBlanks > 1) {
        htmlContent += `<br><small style="color:#888;">（当前填写第 ${blankIndex + 1}/${totalBlanks} 空）</small>`;
    }
    htmlContent += `</div>`;

    document.getElementById('questionText').innerHTML = htmlContent;

    // 生成选项：正确答案 + 干扰项，然后打乱
    let distractors = ['选项A', '选项B', '选项C'];
    if (question.distractors && question.distractors[blankIndex]) {
        distractors = question.distractors[blankIndex].slice(0, 3);
    }
    distractors = distractors.filter(opt => opt && opt !== correctAnswer);
    while (distractors.length < 3) {
        distractors.push(`选项${distractors.length + 1}`);
    }
    const options = [...distractors, correctAnswer].sort(() => Math.random() - 0.5);
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';

    options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'card card-pop';
        card.style.animationDelay = `${idx * 0.1}s`;
        card.innerHTML = `
            <div class="card-header">消耗 1</div>
            <div class="card-body">${opt}</div>
            <div class="card-footer">攻击 10</div>
        `;
        card.onclick = () => this.handleCardSelect(opt, correctAnswer, card);
        container.appendChild(card);
    });
};

game.scheduleNextBattleStep = function (delayMs) {
    const totalBlanks = this.battle.totalBlanks || 1;
    setTimeout(() => {
        if (this.battle.currentBlankIndex < totalBlanks - 1) {
            this.battle.currentBlankIndex++;
        } else {
            this.setBattleQuestion();
        }
        this.loadBattleQuestion();
    }, delayMs);
};

game.handleCardSelect = function (selected, correct, cardEl) {
    // 禁用所有卡牌防止重复点击
    document.querySelectorAll('.card').forEach(c => c.style.pointerEvents = 'none');

    const isCorrect = selected === correct;
    const blankIndex = this.battle.currentBlankIndex;
    this.battle.blankStates[blankIndex] = {
        status: isCorrect ? 'correct' : 'wrong',
        value: isCorrect ? selected : correct
    };

    if (isCorrect) {
        // 答对 - 攻击敌人
        const dmg = 10 + this.player.strength;
        this.battle.enemy.currentHp -= dmg;
        this.battle.totalCorrect++;
        this.battle.streak++;
        if (this.battle.streak > this.battle.maxStreak) {
            this.battle.maxStreak = this.battle.streak;
        }
        this.stats.totalCorrectAnswers++;
        if (this.battle.streak > this.stats.maxStreak) {
            this.stats.maxStreak = this.battle.streak;
        }

        // 视觉特效
        cardEl.style.borderColor = '#2ecc71';
        cardEl.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.8)';

        const enemyArea = document.querySelector('.enemy-area');
        enemyArea.classList.add('shake-effect');
        setTimeout(() => enemyArea.classList.remove('shake-effect'), 500);

        // 伤害飘字
        showDamageText(dmg, enemyArea, false);

        playSound('correct');
        this.showBattleLog(`✅ 正确！造成 ${dmg} 伤害!`);

        if (this.battle.enemy.currentHp <= 0) {
            this.endBattle(true);
            return;
        }
    } else {
        // 答错 - 被敌人攻击
        const dmg = this.battle.enemy.attack || 10;
        this.player.hp -= dmg;
        this.battle.streak = 0;
        this.battle.tookDamage = true;
        this.stats.totalWrongAnswers++;

        // 视觉特效
        cardEl.style.borderColor = '#e74c3c';
        cardEl.style.boxShadow = '0 0 20px rgba(231, 76, 60, 0.8)';

        // 显示正确答案
        document.querySelectorAll('.card').forEach(c => {
            if (c.querySelector('.card-body').textContent === correct) {
                c.style.borderColor = '#2ecc71';
            }
        });

        const playerArea = document.querySelector('.player-area');
        playerArea.classList.add('shake-effect');
        playerArea.classList.add('damage-flash');
        setTimeout(() => {
            playerArea.classList.remove('shake-effect');
            playerArea.classList.remove('damage-flash');
        }, 500);

        // 伤害飘字
        showDamageText(dmg, playerArea, false);

        playSound('wrong');
        this.showBattleLog(`❌ 错误！受到 ${dmg} 伤害!`);

        if (this.player.hp <= 0) {
            this.endBattle(false);
            return;
        }
    }

    this.updateBattleStats();
    this.updateHeader();

    // 延迟下一题/下一空
    const delayMs = isCorrect ? 1500 : 10000;
    this.scheduleNextBattleStep(delayMs);
};

game.endPlayerTurn = function () {
    // 结束回合视为放弃作答，敌人行动
    document.querySelectorAll('.card').forEach(c => c.style.pointerEvents = 'none');

    const question = this.battle.currentQuestion;
    const blankIndex = this.battle.currentBlankIndex;
    const answers = this.battle.currentAnswers || [];
    const correctAnswer = (answers[blankIndex] || answers[0] || (question ? question.answer : '') || '').trim();
    this.battle.blankStates[blankIndex] = {
        status: 'wrong',
        value: correctAnswer
    };

    const dmg = this.battle.enemy.attack || 10;
    this.player.hp -= dmg;
    this.battle.streak = 0;
    this.battle.tookDamage = true;
    this.stats.totalWrongAnswers++;

    if (correctAnswer) {
        document.querySelectorAll('.card').forEach(c => {
            if (c.querySelector('.card-body').textContent === correctAnswer) {
                c.style.borderColor = '#2ecc71';
            }
        });
    }

    const playerArea = document.querySelector('.player-area');
    playerArea.classList.add('shake-effect');
    playerArea.classList.add('damage-flash');
    setTimeout(() => {
        playerArea.classList.remove('shake-effect');
        playerArea.classList.remove('damage-flash');
    }, 500);

    showDamageText(dmg, playerArea, false);
    playSound('wrong');
    this.showBattleLog(`? 结束回合，受到 ${dmg} 伤害!`);

    if (this.player.hp <= 0) {
        this.endBattle(false);
        return;
    }

    this.updateBattleStats();
    this.updateHeader();
    this.scheduleNextBattleStep(10000);
};

game.showBattleLog = function (msg) {
    document.getElementById('battleLog').innerText = msg;
};

game.endBattle = function (win) {
    const enemyType = this.currentNode ? this.currentNode.type : 'enemy';
    this.stats.totalBattles++;

    if (win) {
        this.stats.totalWins++;
        this.stats.enemiesDefeated++;

        // 根据敌人类型计算奖励
        let goldReward = 25;
        if (enemyType === 'elite') goldReward = 75;
        if (enemyType === 'boss') {
            goldReward = 150;
            this.stats.bossesDefeated++;
            this.checkAchievement('bossSlayer');
        }

        // 应用遗物效果
        if (this.player.relics.includes('博学')) {
            if (Math.random() < 0.2) goldReward += 5;
        }

        this.player.gold += goldReward;
        this.stats.goldEarned += goldReward;

        // 检查成就
        this.checkAchievement('firstWin');
        if (this.stats.goldEarned >= 500) this.checkAchievement('goldCollector');
        if (!this.battle.tookDamage) this.checkAchievement('perfectClear');

        // 更新最高层数
        if (this.currentFloor + 1 > this.stats.highestFloor) {
            this.stats.highestFloor = this.currentFloor + 1;
        }

        // 显示结果弹窗
        this.showResultModal(true, goldReward);

        playSound('victory');
    } else {
        this.showGameOverModal();
        playSound('wrong');
    }

    // 保存游戏进度
    this.saveGame();
};

game.updateHeader = function () {
    // 更新所有Header (Map和Battle可能都有)
    document.querySelectorAll('#top-hp, #playerHp').forEach(e => e.innerText = this.player.hp);
    document.querySelectorAll('#top-max-hp, #playerMaxHp').forEach(e => e.innerText = this.player.maxHp);
    document.querySelectorAll('#top-gold, #playerGold').forEach(e => e.innerText = this.player.gold);
    document.querySelectorAll('#top-floor').forEach(e => e.innerText = `第 ${this.currentFloor + 1} 层`);
};

// 辅助函数 (需要保留原有的 data.js 和部分辅助函数)
// 确保 index.html 引用了 data.js
// 这里的 getRandomQuestion 需要依赖 data.js

// 启动
window.onload = function () {
    game.showMainMenu();
    // 初始化：默认选中第一个角色
    game.selectCharacter('scholar');
};

/* --- 辅助函数 --- */

// 清理Markdown格式符号
function cleanMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')  // 移除粗体 **text**
        .replace(/\*(.+?)\*/g, '$1')      // 移除斜体 *text*
        .replace(/^\s*\*\s+/gm, '• ')     // 列表项 * -> •
        .replace(/^#+\s*/gm, '')          // 移除标题 # ## ###
        .replace(/\|/g, ' ')              // 移除表格分隔符
        .replace(/^---+$/gm, '')          // 移除分隔线
        .replace(/\n{3,}/g, '\n\n')       // 合并多个换行
        .trim();
}

// 获取一道随机题目
function getRandomQuestion() {
    if (typeof questionsData === 'undefined') {
        return {
            question: { content: '测试题目{{BLANK}}?', answer: 'A', blanks: 1 },
            chapter: '测试'
        };
    }

    const chapters = questionsData.chapters;
    const chapter = chapters[Math.floor(Math.random() * chapters.length)];
    const question = chapter.questions[Math.floor(Math.random() * chapter.questions.length)];

    return {
        question,
        chapter: chapter.name
    };
}

function playSound(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        switch (type) {
            case 'correct':
                oscillator.frequency.value = 880;
                oscillator.type = 'sine';
                break;
            case 'wrong':
                oscillator.frequency.value = 220;
                oscillator.type = 'sawtooth';
                break;
            case 'victory':
                oscillator.frequency.value = 660;
                oscillator.type = 'sine';
                break;
            case 'click':
                oscillator.frequency.value = 440;
                oscillator.type = 'triangle';
                break;
        }

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        // 静默失败，某些浏览器可能不支持
    }
}

// 伤害飘字函数
function showDamageText(amount, targetElement, isHeal = false) {
    const rect = targetElement.getBoundingClientRect();

    const text = document.createElement('div');
    text.className = isHeal ? 'damage-text heal-text' : 'damage-text';
    text.textContent = isHeal ? `+${amount}` : `-${amount}`;
    text.style.left = `${rect.left + rect.width / 2}px`;
    text.style.top = `${rect.top + 50}px`;

    document.body.appendChild(text);
    setTimeout(() => text.remove(), 1000);
}

// ========== 商店系统 ==========
const SHOP_ITEMS = [
    { id: 'heal_potion', name: '治疗药剂', desc: '恢复30点生命', price: 50, effect: () => { game.player.hp = Math.min(game.player.maxHp, game.player.hp + 30); } },
    { id: 'strength_potion', name: '力量药剂', desc: '力量+3', price: 80, effect: () => { game.player.strength += 3; } },
    { id: 'armor_plate', name: '护甲板', desc: '最大生命+10', price: 100, effect: () => { game.player.maxHp += 10; game.player.hp += 10; } },
    { id: 'lucky_coin', name: '幸运硬币', desc: '获得30-80随机金币', price: 25, effect: () => { const bonus = 30 + Math.floor(Math.random() * 51); game.player.gold += bonus; } },
    { id: 'remove_curse', name: '净化卷轴', desc: '移除一个诅咒', price: 150, effect: () => { if (game.player.curses.length > 0) game.player.curses.pop(); } }
];

game.openShop = function () {
    const modal = document.getElementById('shopModal');
    if (!modal) return this.renderShopModal();

    modal.style.display = 'flex';
    this.renderShopItems();
};

game.renderShopModal = function () {
    // 动态创建商店弹窗
    const modal = document.createElement('div');
    modal.id = 'shopModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content shop-content">
            <h2>🛒 商店</h2>
            <div id="shopItems" class="shop-items"></div>
            <div class="shop-footer">
                <span>💰 <span id="shopGold">${this.player.gold}</span></span>
                <button class="modal-btn" onclick="game.closeShop()">离开</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    this.renderShopItems();
};

game.renderShopItems = function () {
    const container = document.getElementById('shopItems');
    container.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item' + (this.player.gold < item.price ? ' disabled' : '');
        div.innerHTML = `
            <span class="item-name">${item.name}</span>
            <span class="item-desc">${item.desc}</span>
            <span class="item-price">💰 ${item.price}</span>
        `;
        div.onclick = () => this.buyItem(item);
        container.appendChild(div);
    });

    document.getElementById('shopGold').textContent = this.player.gold;
};

game.buyItem = function (item) {
    if (this.player.gold < item.price) return;

    this.player.gold -= item.price;
    item.effect();
    playSound('click');
    this.renderShopItems();
    this.updateHeader();
};

game.closeShop = function () {
    document.getElementById('shopModal').style.display = 'none';
    this.completeNode();
};

// ========== 休息点系统 ==========
game.openRestSite = function () {
    const healAmount = Math.floor(this.player.maxHp * 0.3);

    const modal = document.createElement('div');
    modal.id = 'restModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content rest-content">
            <h2>🔥 篝火</h2>
            <p>在这里休息一下...</p>
            <div class="rest-options">
                <button class="rest-btn" onclick="game.restHeal()">
                    <span class="rest-icon">❤️</span>
                    <span>休息</span>
                    <span class="rest-desc">恢复 ${healAmount} 点生命</span>
                </button>
                <button class="rest-btn" onclick="game.restUpgrade()">
                    <span class="rest-icon">⚔️</span>
                    <span>强化</span>
                    <span class="rest-desc">力量 +1</span>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
};

game.restHeal = function () {
    const healAmount = Math.floor(this.player.maxHp * 0.3);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
    playSound('correct');
    this.updateHeader();
    this.closeRestSite();
};

game.restUpgrade = function () {
    this.player.strength += 1;
    playSound('click');
    this.closeRestSite();
};

game.closeRestSite = function () {
    const modal = document.getElementById('restModal');
    if (modal) modal.remove();
    this.completeNode();
};

// ========== 成就系统 ==========
game.checkAchievement = function (key) {
    if (this.achievements[key]) return; // 已解锁

    this.achievements[key] = true;
    this.showAchievementPopup(key);
    this.saveGame();
};

game.showAchievementPopup = function (key) {
    const names = {
        firstWin: '🏆 初次胜利',
        streakMaster: '🔥 连击大师',
        bossSlayer: '👑 弑神者',
        goldCollector: '💰 财富收集者',
        perfectClear: '⭐ 完美通关'
    };

    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `<div class="ach-icon">🎖️</div><div class="ach-text">成就解锁<br><strong>${names[key] || key}</strong></div>`;
    document.body.appendChild(popup);

    setTimeout(() => popup.classList.add('show'), 100);
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 500);
    }, 3000);
};

// ========== 存档系统 ==========
game.saveGame = function () {
    const saveData = {
        player: this.player,
        stats: this.stats,
        achievements: this.achievements,
        currentFloor: this.currentFloor,
        act: this.act
    };
    localStorage.setItem('recitationSpireSave', JSON.stringify(saveData));
};

game.loadGame = function () {
    const saved = localStorage.getItem('recitationSpireSave');
    if (saved) {
        const data = JSON.parse(saved);
        // 只恢复统计和成就，不恢复游戏进度（每次都是新游戏）
        this.stats = { ...this.stats, ...data.stats };
        this.achievements = { ...this.achievements, ...data.achievements };
        return true;
    }
    return false;
};

game.resetSave = function () {
    localStorage.removeItem('recitationSpireSave');
};

// ========== 弹窗系统 ==========
game.showResultModal = function (win, goldReward) {
    const modal = document.getElementById('resultModal');
    document.getElementById('resultTitle').textContent = win ? '🎉 战斗胜利!' : '💀 战斗失败';
    document.getElementById('resultStats').innerHTML = `
        <p>获得金币: +${goldReward} 💰</p>
        <p>答对题目: ${this.battle.totalCorrect}</p>
        <p>最高连击: ${this.battle.maxStreak}</p>
    `;
    document.getElementById('continueBtn').onclick = () => {
        modal.style.display = 'none';
        this.completeNode();
    };
    modal.style.display = 'flex';
};

game.showGameOverModal = function () {
    const modal = document.getElementById('gameOverModal');
    document.getElementById('finalStats').innerHTML = `
        <p>到达层数: ${this.currentFloor + 1}</p>
        <p>击败敌人: ${this.stats.enemiesDefeated}</p>
        <p>获得金币: ${this.stats.goldEarned}</p>
        <p>总答对题: ${this.stats.totalCorrectAnswers}</p>
    `;
    document.getElementById('restartBtn').onclick = () => {
        modal.style.display = 'none';
        this.showMainMenu();
    };
    modal.style.display = 'flex';
};

// ========== 更新节点点击处理 ==========
game.onNodeClick = function (node) {
    if (node.state !== 'available') return;

    // 记录
    this.currentNode = node;
    this.currentFloor = node.floor;

    // 处理节点类型
    if (node.type === 'enemy' || node.type === 'elite' || node.type === 'boss') {
        this.startBattle(node.type);
    } else if (node.type === 'rest') {
        this.openRestSite();
    } else if (node.type === 'merchant') {
        this.openShop();
    } else if (node.type === 'treasure') {
        const goldFound = 50 + Math.floor(Math.random() * 51);
        this.player.gold += goldFound;
        this.stats.goldEarned += goldFound;
        alert(`打开宝箱！获得 ${goldFound} 金币 💰`);
        this.completeNode();
    } else if (node.type === 'unknown') {
        // 随机事件
        this.handleUnknownEvent();
    } else {
        this.completeNode();
    }
};

game.handleUnknownEvent = function () {
    const events = [
        { text: '你发现了一个隐秘宝箱！', effect: () => { this.player.gold += 30; } },
        { text: '一个神秘商人给了你一瓶药剂！', effect: () => { this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20); } },
        { text: '你踩到了陷阱！', effect: () => { this.player.hp -= 10; } },
        { text: '你获得了一本古老的知识！', effect: () => { this.player.strength += 1; } }
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    event.effect();
    alert(event.text);
    this.updateHeader();
    this.completeNode();
};

// 初始化时加载存档
window.onload = function () {
    game.loadGame();
    game.showMainMenu();
    // 初始化：默认选中第一个角色
    game.selectCharacter('scholar');
};

function endPlayerTurn() {
    game.endPlayerTurn();
}

