const questions = [
  {
    text: "周末临时被闺蜜约去新开业宠物咖啡馆，你会？",
    options: [
      { text: "马上答应，顺便在群里再约几个人一起热闹", trait: "E" },
      { text: "先确认环境和人数，想和熟人小范围见面", trait: "I" }
    ]
  },
  {
    text: "给猫主子选玩具时你更看重？",
    options: [
      { text: "颜值和风格统一，拍照好看最重要", trait: "N" },
      { text: "耐咬耐抓、材质安全，实用第一", trait: "S" }
    ]
  },
  {
    text: "室友抱怨工作压力大，你的第一反应是？",
    options: [
      { text: "先抱抱她，认真听她讲完并陪伴情绪", trait: "F" },
      { text: "帮她拆解问题，列出可执行的解决方案", trait: "T" }
    ]
  },
  {
    text: "你准备一次短途旅行时通常会？",
    options: [
      { text: "提前两周规划路线和打卡清单", trait: "J" },
      { text: "先订车票，剩下边走边看", trait: "P" }
    ]
  },
  {
    text: "你在社交平台发宠物日常时更像？",
    options: [
      { text: "高频更新，喜欢和评论区互动", trait: "E" },
      { text: "偶尔发精选，偏好记录给自己看", trait: "I" }
    ]
  },
  {
    text: "突然下雨没带伞，你会？",
    options: [
      { text: "观察天气变化，找最近便利店买一次性雨衣", trait: "S" },
      { text: "脑洞大开，用手边物品临时DIY挡雨", trait: "N" }
    ]
  },
  {
    text: "给流浪猫募捐物资时你最关注？",
    options: [
      { text: "每只猫咪的状态和故事，情感共鸣最重要", trait: "F" },
      { text: "渠道透明度和执行效率，确保真正落地", trait: "T" }
    ]
  },
  {
    text: "面对突然多出来的空闲晚上，你会？",
    options: [
      { text: "立刻决定去夜跑/看展，享受随机性", trait: "P" },
      { text: "按既定节奏进行阅读护肤和休息", trait: "J" }
    ]
  },
  {
    text: "部门团建K歌时你通常？",
    options: [
      { text: "主动控场，点气氛歌并带大家合唱", trait: "E" },
      { text: "先观察氛围，熟了再加入", trait: "I" }
    ]
  },
  {
    text: "遇到新宠物护理方法时你更倾向？",
    options: [
      { text: "先看权威资料和真实测评再试", trait: "S" },
      { text: "喜欢研究创新玩法，愿意尝试新思路", trait: "N" }
    ]
  },
  {
    text: "和伴侣讨论未来城市选择时你会？",
    options: [
      { text: "优先评估工作机会、成本与长期规划", trait: "T" },
      { text: "优先考虑生活幸福感与关系质量", trait: "F" }
    ]
  },
  {
    text: "衣柜整理到一半被朋友叫出门，你会？",
    options: [
      { text: "先按计划整理完再出门，避免任务断点", trait: "J" },
      { text: "马上出发，回来再随机应变收拾", trait: "P" }
    ]
  },
  {
    text: "面对新朋友你更容易通过哪种方式熟络？",
    options: [
      { text: "直接分享日常和趣事，快速破冰", trait: "E" },
      { text: "通过共同兴趣慢慢建立信任", trait: "I" }
    ]
  },
  {
    text: "购买宠物用品时你通常？",
    options: [
      { text: "关注成分参数和口碑数据", trait: "S" },
      { text: "被设计理念和品牌故事吸引", trait: "N" }
    ]
  },
  {
    text: "朋友恋爱遇到纠结时你会？",
    options: [
      { text: "帮她梳理边界、风险与行动方案", trait: "T" },
      { text: "先确认她真实感受，再给温柔建议", trait: "F" }
    ]
  },
  {
    text: "新一年目标管理方式你更偏向？",
    options: [
      { text: "做季度计划+每周复盘，稳步推进", trait: "J" },
      { text: "保留弹性空间，按状态动态调整", trait: "P" }
    ]
  }
];

const dimensionPairs = [
  ["E", "I"],
  ["S", "N"],
  ["T", "F"],
  ["J", "P"]
];

const state = {
  current: 0,
  scores: {
    E: 0,
    I: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0
  }
};

const startBtn = document.getElementById("startBtn");
const introCard = document.getElementById("introCard");
const quizCard = document.getElementById("quizCard");
const questionText = document.getElementById("questionText");
const questionTag = document.getElementById("questionTag");
const progressFill = document.getElementById("progressFill");
const optionA = document.getElementById("optionA");
const optionB = document.getElementById("optionB");
const userName = document.getElementById("userName");

function renderQuestion() {
  const q = questions[state.current];
  questionTag.textContent = `Q${state.current + 1} / ${questions.length}`;
  questionText.textContent = q.text;
  optionA.textContent = q.options[0].text;
  optionB.textContent = q.options[1].text;
  progressFill.style.width = `${(state.current / questions.length) * 100}%`;
}

function choose(index) {
  const q = questions[state.current];
  const picked = q.options[index];
  state.scores[picked.trait] += 1;
  state.current += 1;

  if (state.current >= questions.length) {
    finishQuiz();
    return;
  }

  renderQuestion();
}

function finishQuiz() {
  const mbti = dimensionPairs
    .map(([a, b]) => (state.scores[a] >= state.scores[b] ? a : b))
    .join("");

  progressFill.style.width = "100%";

  const resultPayload = {
    nickname: userName.value.trim(),
    mbti,
    scores: state.scores,
    timestamp: Date.now()
  };

  localStorage.setItem("petPersonaResult", JSON.stringify(resultPayload));
  window.location.href = "report.html";
}

startBtn.addEventListener("click", () => {
  introCard.classList.add("hidden");
  quizCard.classList.remove("hidden");
  renderQuestion();
});

optionA.addEventListener("click", () => choose(0));
optionB.addEventListener("click", () => choose(1));
