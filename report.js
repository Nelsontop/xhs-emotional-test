const petProfiles = {
  ESTJ: {
    pet: "边牧指挥官",
    title: "高效掌控型",
    tags: ["执行力", "责任感", "靠谱", "组织者"],
    desc: "你像边牧一样聪明且有掌控感，擅长把复杂日程安排得井井有条。在团队和关系中，你常是那个能稳住场面的人。",
    advice: {
      love: "关系中适当降低“标准模式”，多表达柔软的一面会更有亲密感。",
      career: "你适合项目管理、运营统筹和需要节奏把控的岗位。",
      stress: "每周安排一次纯放空活动，避免长期处于高压执行状态。"
    }
  },
  ESTP: {
    pet: "柴犬玩家",
    title: "行动冒险型",
    tags: ["冲劲", "临场反应", "社交感", "体验派"],
    desc: "你是热爱新鲜感的柴犬人格，敢于尝试、不怕出错。你在变化中反而更有创造力。",
    advice: {
      love: "热情是优势，记得给关系留稳定承诺与安全感。",
      career: "适合活动策划、内容创意、商务拓展等高动态岗位。",
      stress: "用“短时高效运动”排解焦虑，比如跳操、拳击、夜跑。"
    }
  },
  ESFJ: {
    pet: "金毛治愈师",
    title: "温暖照顾型",
    tags: ["共情", "亲和", "稳定", "关系维护"],
    desc: "你像金毛一样温暖可靠，善于照顾情绪和营造归属感。你在亲密关系和友谊中都很有存在感。",
    advice: {
      love: "别总先满足别人，练习优先表达自己的需求。",
      career: "适合用户运营、教育咨询、客户成功、品牌社区岗位。",
      stress: "设置“情绪边界时间”，避免因过度共情而消耗。"
    }
  },
  ESFP: {
    pet: "布偶猫明星",
    title: "魅力感染型",
    tags: ["感染力", "审美", "即时快乐", "高互动"],
    desc: "你是自带镜头感的布偶猫人格，善于制造快乐氛围。你会把日常过得很有仪式感。",
    advice: {
      love: "保持热情的同时，也可建立长期目标让关系更稳。",
      career: "适合新媒体、直播、活动、品牌视觉相关方向。",
      stress: "通过创作型爱好释放压力，如拍摄、手作、舞蹈。"
    }
  },
  ENTJ: {
    pet: "豹猫战略家",
    title: "目标驱动型",
    tags: ["领导力", "判断力", "果断", "成长导向"],
    desc: "你像豹猫一样敏锐且有野心，善于看到长期路径并推动落地。你对自己和团队都很高标准。",
    advice: {
      love: "用“提问”代替“指挥”，亲密关系会更平衡。",
      career: "适合管理、咨询、商业分析、创业等结果导向角色。",
      stress: "把任务列表分成“必须做/可以延后”，降低持续紧绷。"
    }
  },
  ENTP: {
    pet: "狐獴创意官",
    title: "脑洞探索型",
    tags: ["创意", "辩证思维", "好奇", "突破常规"],
    desc: "你是点子不断的狐獴人格，喜欢挑战旧框架。你擅长在讨论中激发新视角。",
    advice: {
      love: "避免“只讲道理”，把情绪回应放在同等优先级。",
      career: "适合产品创新、策略、广告创意、跨界内容岗位。",
      stress: "给每个灵感设一个最小行动，减少“想太多做太少”。"
    }
  },
  ENFJ: {
    pet: "海豚引导者",
    title: "灵感连接型",
    tags: ["号召力", "洞察", "影响力", "价值感"],
    desc: "你像海豚一样聪明又富有感染力，擅长连接人和资源，让团队看到共同愿景。",
    advice: {
      love: "别只做“情绪管理者”，允许自己偶尔脆弱。",
      career: "适合人才发展、品牌公关、社区主理、咨询顾问。",
      stress: "设定“社交下线时间”，给自己高质量独处恢复。"
    }
  },
  ENFP: {
    pet: "萨摩耶梦想家",
    title: "热情共鸣型",
    tags: ["热情", "想象力", "真诚", "高能量"],
    desc: "你是让人忍不住靠近的萨摩耶人格，带着温暖和创意点亮身边人。你讨厌无意义重复。",
    advice: {
      love: "先确认边界再投入热情，减少关系中的内耗。",
      career: "适合内容策划、品牌故事、心理教育、创意创业。",
      stress: "采用“番茄钟+奖励”机制，帮助灵感稳定落地。"
    }
  },
  ISTJ: {
    pet: "英短管家",
    title: "稳健可靠型",
    tags: ["细致", "守信", "秩序", "长期主义"],
    desc: "你像英短一样沉稳踏实，擅长用耐心把事情做好。你给人强烈的安全感。",
    advice: {
      love: "尝试用行动之外的语言表达爱，会更易被感知。",
      career: "适合财务、审计、法务、流程优化等岗位。",
      stress: "允许自己偶尔“差不多就好”，减轻完美压力。"
    }
  },
  ISTP: {
    pet: "黑猫修理师",
    title: "冷静实干型",
    tags: ["动手力", "独立", "观察", "解决问题"],
    desc: "你像黑猫一样神秘又靠谱，偏好用行动解决问题。你在危机时刻特别稳。",
    advice: {
      love: "适当说明你的想法，别让沉默被误解为冷淡。",
      career: "适合工程技术、摄影后期、产品测试、运营支持。",
      stress: "通过手工/整理/运动释放压力，效果会很快。"
    }
  },
  ISFJ: {
    pet: "兔兔守护者",
    title: "温柔支持型",
    tags: ["细腻", "责任", "耐心", "照料型"],
    desc: "你像兔兔一样温柔谨慎，擅长用细节照顾他人。你在亲密关系中非常有安全感。",
    advice: {
      love: "不必事事懂事，需求被看见同样重要。",
      career: "适合人力行政、护理健康、教育支持、客服管理。",
      stress: "建立“拒绝清单”，为自己保留时间和精力。"
    }
  },
  ISFP: {
    pet: "水豚艺术家",
    title: "疗愈感受型",
    tags: ["审美", "松弛", "真实", "感知力"],
    desc: "你像水豚一样治愈而有松弛感，对美和情绪有天然敏感度。你擅长把生活过成作品。",
    advice: {
      love: "稳定表达需求比“等别人懂你”更有效。",
      career: "适合视觉设计、美妆时尚、手作品牌、内容创作。",
      stress: "音乐+散步+轻记录是你的高效恢复组合。"
    }
  },
  INTJ: {
    pet: "缅因策士",
    title: "系统规划型",
    tags: ["战略", "独立", "深度思考", "高标准"],
    desc: "你像缅因猫一样冷静有主见，擅长从复杂信息中抽丝剥茧。你更看重长期价值。",
    advice: {
      love: "把“我在意你”说出来，比默认对方懂更有效。",
      career: "适合策略规划、数据分析、科研、产品架构。",
      stress: "安排规律运动与睡眠，不要只靠意志硬扛。"
    }
  },
  INTP: {
    pet: "猫头鹰研究员",
    title: "理性洞察型",
    tags: ["逻辑", "好奇", "抽象思维", "独到"],
    desc: "你像猫头鹰一样安静而聪明，善于拆解底层逻辑。你在深度思考时非常有魅力。",
    advice: {
      love: "表达观点之外，也要回应对方的感受需求。",
      career: "适合算法、研究、产品分析、知识型内容岗位。",
      stress: "把想法写成清单，选一件马上执行降低焦虑。"
    }
  },
  INFJ: {
    pet: "白狐洞察者",
    title: "直觉共情型",
    tags: ["深度", "洞察", "理想", "温柔坚定"],
    desc: "你像白狐一样敏锐且有灵性，能快速读懂氛围与人心。你对关系质量要求很高。",
    advice: {
      love: "不要过度猜测，直接沟通会减少误会。",
      career: "适合心理咨询、品牌策略、内容编辑、公益项目。",
      stress: "用“信息减量”保护自己，减少无效社交输入。"
    }
  },
  INFP: {
    pet: "布丁仓鼠诗人",
    title: "理想浪漫型",
    tags: ["真诚", "想象", "共情", "价值驱动"],
    desc: "你像仓鼠一样柔软可爱，却有很坚定的内在价值观。你愿意为热爱的事投入长期耐心。",
    advice: {
      love: "把期待具体化，说清“你希望被怎样爱”。",
      career: "适合文字创作、品牌叙事、教育、人文内容方向。",
      stress: "减少自我否定，给每个进步设置可见奖励。"
    }
  }
};

function normalizeScore(raw) {
  const total = raw.E + raw.I + raw.S + raw.N + raw.T + raw.F + raw.J + raw.P;
  const safeTotal = total || 1;
  return {
    E: Math.round((raw.E / safeTotal) * 100),
    I: Math.round((raw.I / safeTotal) * 100),
    S: Math.round((raw.S / safeTotal) * 100),
    N: Math.round((raw.N / safeTotal) * 100),
    T: Math.round((raw.T / safeTotal) * 100),
    F: Math.round((raw.F / safeTotal) * 100),
    J: Math.round((raw.J / safeTotal) * 100),
    P: Math.round((raw.P / safeTotal) * 100)
  };
}

function metricRow(left, right, ls, rs) {
  const leftRate = Math.max(ls, 6);
  return `
    <div class="metric">
      <div class="metric-label"><span>${left}</span><span>${ls}% / ${rs}%</span><span>${right}</span></div>
      <div class="metric-track"><div class="metric-fill" style="width:${leftRate}%"></div></div>
    </div>
  `;
}

function renderReport() {
  const raw = localStorage.getItem("petPersonaResult");
  const root = document.getElementById("reportRoot");

  if (!raw) {
    root.innerHTML = `
      <section class="report-card">
        <h1>还没有测试记录</h1>
        <p>先完成测试，再查看宠物人格报告。</p>
        <button class="secondary-btn" onclick="window.location.href='index.html'">返回测试</button>
      </section>
    `;
    return;
  }

  const data = JSON.parse(raw);
  const profile = petProfiles[data.mbti] || petProfiles.INFP;
  const score = normalizeScore(data.scores);
  const name = data.nickname || "你";

  root.innerHTML = `
    <section class="report-card">
      <div class="report-header">
        <div>
          <p class="badge">Pet Persona Report</p>
          <h1>${name}的宠物人格：${profile.pet}</h1>
          <p>${profile.title} · 类型编码 <span class="type-chip">${data.mbti}</span></p>
        </div>
      </div>
      <p class="hero-copy">${profile.desc}</p>
      <div class="tags">${profile.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    </section>

    <div class="panel-grid">
      <section class="panel-card">
        <h3>维度数据分析</h3>
        ${metricRow("外向 E", "内向 I", score.E, score.I)}
        ${metricRow("现实 S", "直觉 N", score.S, score.N)}
        ${metricRow("理性 T", "感性 F", score.T, score.F)}
        ${metricRow("计划 J", "灵活 P", score.J, score.P)}
      </section>

      <section class="panel-card">
        <h3>关系与成长建议</h3>
        <p><strong>恋爱模式：</strong>${profile.advice.love}</p>
        <p><strong>职业倾向：</strong>${profile.advice.career}</p>
        <p><strong>压力管理：</strong>${profile.advice.stress}</p>
        <button class="secondary-btn" onclick="window.location.href='index.html'">重新测试</button>
      </section>
    </div>
  `;
}

renderReport();
