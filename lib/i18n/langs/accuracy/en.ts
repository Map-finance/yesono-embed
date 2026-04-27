export default {
  title: 'How accurate is YesONo?',
  nav: {
    overall: 'Overall Accuracy',
    expected: 'Expected vs Actual',
    brier: 'Brier Score vs Volume',
    composition: 'Resolution Composition',
    methods: 'Methods',
  },
  metrics: {
    accuracy4hr: '4 hr accuracy',
    accuracy1month: '1 month accuracy',
    brierScore: 'Brier Score',
  },
  sections: {
    overall: {
      title: 'Accuracy prior to resolution',
      description: 'Shows how accurate YesONo odds were at different points before they resolved.',
    },
    expected: {
      title: 'Expected vs Actual',
      description: 'Shows how well the market predicted the actual resolution rates across different probability levels.',
      chart: {
        expected: 'Expected',
        resolved: 'Resolved',
        probability: 'Probability',
      },
    },
    brier: {
      title: 'Brier Score vs Volume',
      description: 'Lower is better. Brier scores show how accurate predictions really are — not just if they were correct, but how close the prediction was to being right.',
      chart: {
        volume: 'Volume',
        score: 'Brier Score',
      },
    },
    composition: {
      title: 'Resolution Composition',
      description: 'Shows the percentages of all yesono markets that ended up resolving to "Yes" or "No".',
      yes: 'Yes',
      no: 'No',
    },
    methods: {
      title: 'Methods',
      description: 'All metrics are calculated from resolved yesono markets, using price snapshots taken 1 month, 1 week, 1 day, 12 hours, and 4 hours before resolution. Accuracy reflects how often the final leading outcome matched reality, and Brier scores measure the average squared error of predictions.',
      dataVia: 'Data via',
      duneDashboards: 'Dune dashboards',
      faqTitle: 'Frequently Asked Questions',
    },
  },
  faq: {
    accuracy: {
      question: 'What does "accuracy" mean here?',
      answer: 'Accuracy shows how often the top-voted outcome before a market closed ended up being right. For example, if "Yes" was leading at 65% twelve hours before resolution and the market resolved "Yes," that counts as accurate.',
    },
    brier: {
      question: 'What is a "Brier score"?',
      answer: 'The Brier score measures how close predicted probabilities were to the actual outcomes. It\'s the average of the squared differences between what was predicted and what actually happened. Lower scores mean better predictions, with 0 being perfect.',
    },
    improve: {
      question: 'Why does accuracy improve closer to resolution?',
      answer: 'As yesono markets get closer to resolving, traders have more information to work with. New updates and developments are priced in, making the odds more accurate and helping it converge toward the correct outcome.',
    },
    moreNo: {
      question: 'Why do more yesono markets resolve "No" than "Yes"?',
      answer: 'There are usually more ways for something not to happen than to happen in one exact way, thus "No" outcomes tend to occur more often.',
    },
    dataSource: {
      question: 'Where does this data come from?',
      answer: 'All data is sourced from resolved yesono markets, which is publicly accessible through the YesONo API. The analysis uses price snapshots taken at fixed time intervals before resolution.',
    },
  },
  timeFilters: {
    '4hrs': '4 Hrs',
    '12hrs': '12 Hrs',
    '1day': '1 Day',
    '1week': '1 Week',
    '1month': '1 Month',
  },
};