export default {
  title: 'YesONo 的准确性如何？',
  nav: {
    overall: '整体准确性',
    expected: '预期 vs 实际',
    brier: '布里尔分数 vs 交易量',
    composition: '结果组成',
    methods: '方法',
  },
  metrics: {
    accuracy4hr: '4 小时准确性',
    accuracy1month: '1 个月准确性',
    brierScore: '布里尔分数',
  },
  sections: {
    overall: {
      title: '解决前的准确性',
      description: '显示 YesONo 赔率在解决前不同时间点的准确性。',
    },
    expected: {
      title: '预期 vs 实际',
      description: '显示市场如何预测不同概率水平下的实际解决率。',
      chart: {
        expected: '预期',
        resolved: '已解决',
        probability: '概率',
      },
    },
    brier: {
      title: '布里尔分数 vs 交易量',
      description: '分数越低越好。布里尔分数显示预测的准确性——不仅仅是预测是否正确，还显示预测与正确结果的接近程度。',
      chart: {
        volume: '交易量',
        score: '布里尔分数',
      },
    },
    composition: {
      title: '结果组成',
      description: '显示所有 yesono 市场最终解决为"是"或"否"的百分比。',
      yes: '是',
      no: '否',
    },
    methods: {
      title: '方法',
      description: '所有指标均从已解决的 yesono 市场计算，使用解决前 1 个月、1 周、1 天、12 小时和 4 小时的价格快照。准确性反映最终领先结果与现实匹配的频率，布里尔分数衡量预测的平均平方误差。',
      dataVia: '数据来源',
      duneDashboards: 'Dune 仪表板',
      faqTitle: '常见问题',
    },
  },
  faq: {
    accuracy: {
      question: '这里的"准确性"是什么意思？',
      answer: '准确性显示市场关闭前主要投票结果最终正确的频率。例如，如果"是的"在解决前12小时以65%的优势领先，而市场解决为"是"，则算作准确。',
    },
    brier: {
      question: '"布里尔分数"是什么？',
      answer: '布里尔分数衡量预测概率与实际结果的接近程度。它是预测内容与实际发生内容之间的平方差的平均值。分数越低，预测越好，0 为完美。',
    },
    improve: {
      question: '为什么准确性在接近解决时会提高？',
      answer: '随着 yesono 市场接近解决，交易者有更多信息可供使用。新的更新和发展被定价，使赔率更准确，并帮助它收敛到正确的结果。',
    },
    moreNo: {
      question: '为什么 yesono 市场解决为"否"比"是"更多？',
      answer: '通常情况下，某事不以一种确切方式发生的方式比以一种确切方式发生的方式更多，因此"否"结果往往更常见。',
    },
    dataSource: {
      question: '这些数据从哪里来？',
      answer: '所有数据均来自可通过 YesONo API 公开访问的已解决 yesono 市场。该分析使用在解决前固定时间间隔拍摄的价格快照。',
    },
  },
  timeFilters: {
    '4hrs': '4 小时',
    '12hrs': '12 小时',
    '1day': '1 天',
    '1week': '1 周',
    '1month': '1 个月',
  },
};