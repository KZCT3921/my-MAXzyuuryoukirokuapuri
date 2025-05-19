const form = document.getElementById('maxForm');
const dateInput = document.getElementById('date');
const weightInput = document.getElementById('weight');
const conditionInput = document.getElementById('condition');

let records = JSON.parse(localStorage.getItem('benchRecords') || '[]');

// 履歴保存用
let weekHistory = JSON.parse(localStorage.getItem('benchWeekHistory') || '[]');

// 記録を絶対消えないように（localStorage.clear()対策は不可、ただし自動消去はされません）

// 履歴ボタン・モーダル
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');
const closeHistory = document.getElementById('closeHistory');

// 週リセット処理（7件で履歴保存＆グラフリセット）
function resetWeekIfNeeded() {
  if (records.length >= 7) {
    const week = {
      start: records[0].date,
      end: records[records.length - 1].date,
      records: [...records]
    };
    weekHistory.push(week);
    localStorage.setItem('benchWeekHistory', JSON.stringify(weekHistory));
    records = [];
    saveRecords();
    updateCharts();
  }
}

// 履歴表示
function showHistory(order = 'recent') {
  historyList.innerHTML = '';

  // 履歴がなければ
  if (weekHistory.length === 0) {
    historyList.innerHTML = '<li>履歴はありません</li>';
    return;
  }

  // 並び替え
  const weeks = order === 'recent'
    ? [...weekHistory].reverse() // 新しい順
    : [...weekHistory];          // 古い順

  // ボタン追加
  historyList.innerHTML = `
    <div style="margin-bottom:12px;">
      <button id="showRecent" style="margin-right:8px;padding:4px 14px;border-radius:6px;background:#6a82fb;color:#fff;border:none;font-weight:600;">最近</button>
      <button id="showOld" style="padding:4px 14px;border-radius:6px;background:#a18cd1;color:#fff;border:none;font-weight:600;">昔</button>
    </div>
  `;

  weeks.forEach((week, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${week.start}〜${week.end}</strong>
      <button class="showGraphBtn" data-idx="${order === 'recent' ? weekHistory.length - 1 - idx : idx}" style="margin-left:8px;padding:4px 12px;border-radius:6px;background:#6a82fb;color:#fff;border:none;font-weight:600;cursor:pointer;">グラフ</button>
      <br>
      <ul style="margin:0 0 8px 0;padding-left:1em;">
        ${week.records.map(r => `<li>${r.date}：${r.weight}kg 調子:${r.condition}</li>`).join('')}
      </ul>`;
    historyList.appendChild(li);
  });

  // ボタンイベント
  document.getElementById('showRecent').onclick = () => showHistory('recent');
  document.getElementById('showOld').onclick = () => showHistory('old');

  // グラフボタンイベント
  document.querySelectorAll('.showGraphBtn').forEach(btn => {
    btn.onclick = function() {
      const idx = Number(this.dataset.idx);
      showSavedGraph(idx);
    };
  });
}

// 履歴グラフ表示
function showSavedGraph(idx) {
  const week = weekHistory[idx];
  if (!week) return;
  // オーバーレイ作成
  let overlay = document.getElementById('graphOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'graphOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = 3000;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = `
      <div style="background:#fff;padding:24px 18px;border-radius:12px;max-width:95vw;max-height:90vh;overflow:auto;position:relative;">
        <button id="closeGraphOverlay" style="position:absolute;top:10px;right:10px;padding:4px 14px;border-radius:6px;background:#6a82fb;color:#fff;border:none;font-weight:600;">閉じる</button>
        <h3 style="margin-top:0;">${week.start}〜${week.end} のグラフ</h3>
        <canvas id="savedProbChart" style="margin-bottom:18px;"></canvas>
        <canvas id="savedConditionChart" style="margin-bottom:18px;"></canvas>
        <canvas id="savedSetsChart"></canvas>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.style.display = 'flex';
    overlay.querySelector('h3').textContent = `${week.start}〜${week.end} のグラフ`;
  }
  // 閉じるボタン
  document.getElementById('closeGraphOverlay').onclick = () => {
    overlay.style.display = 'none';
  };

  // データ準備
  const labels = week.records.map(r => r.date);
  // グラフ用データ再計算
  const probUp = [];
  const conditionArr = [];
  const setsArr = [];
  for (let i = 0; i < week.records.length; i++) {
    if (i === 0) {
      probUp.push(5);
    } else {
      probUp.push(week.records[i].weight > week.records[i - 1].weight ? 10 : 0);
    }
    let avg = 0;
    if (i >= 2) {
      avg = (week.records[i].weight + week.records[i - 1].weight + week.records[i - 2].weight) / 3;
    } else {
      avg = week.records[i].weight;
    }
    conditionArr.push(Number((week.records[i].weight - avg).toFixed(2)));
    setsArr.push(Math.max(1, Math.floor(week.records[i].weight * 0.9 / 10)));
  }

  // 既存グラフ削除
  ['savedProbChart','savedConditionChart','savedSetsChart'].forEach(id=>{
    const old = document.getElementById(id);
    if (old) {
      old.parentNode.replaceChild(old.cloneNode(), old);
    }
  });

  // Chart.jsでグラフ描画
  new Chart(document.getElementById('savedProbChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'MAX上がる確率',
        data: probUp,
        borderColor: 'blue',
        fill: false
      }]
    },
    options: {
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return Number.isInteger(value) && value >= 0 && value <= 10 ? value : '';
            }
          }
        }
      }
    }
  });
  new Chart(document.getElementById('savedConditionChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '主の調子',
        data: conditionArr,
        borderColor: 'orange',
        fill: false
      }]
    }
  });
  new Chart(document.getElementById('savedSetsChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'できるセット回数',
        data: setsArr,
        backgroundColor: 'green'
      }]
    }
  });
}

function saveRecords() {
  localStorage.setItem('benchRecords', JSON.stringify(records));
}

function getRecentRecords() {
  return records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
}

function calcStats(recentRecords) {
  const probUp = [];
  const conditionArr = [];
  const setsArr = [];
  for (let i = 0; i < recentRecords.length; i++) {
    // MAX上がる確率（整数で: 前日より上がっていれば10、下がっていれば0）
    if (i === 0) {
      probUp.push(5); // 初日は中間値
    } else {
      probUp.push(recentRecords[i].weight > recentRecords[i - 1].weight ? 10 : 0);
    }
    // 調子
    let avg = 0;
    if (i >= 2) {
      avg = (recentRecords[i].weight + recentRecords[i - 1].weight + recentRecords[i - 2].weight) / 3;
    } else {
      avg = recentRecords[i].weight;
    }
    conditionArr.push(Number((recentRecords[i].weight - avg).toFixed(2)));
    setsArr.push(Math.max(1, Math.floor(recentRecords[i].weight * 0.9 / 10)));
  }
  return { probUp, conditionArr, setsArr };
}

// Chart.js グラフ初期化
const probChart = new Chart(document.getElementById('probChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'MAX上がる確率',
      data: [],
      borderColor: 'blue',
      fill: false
    }]
  },
  options: {
    scales: {
      y: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 1,
          callback: function(value) {
            // 0〜10のみ表示
            return Number.isInteger(value) && value >= 0 && value <= 10 ? value : '';
          }
        }
      }
    }
  }
});

const conditionChart = new Chart(document.getElementById('conditionChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: '主の調子',
      data: [],
      borderColor: 'orange',
      fill: false
    }]
  }
});

const setsChart = new Chart(document.getElementById('setsChart'), {
  type: 'bar',
  data: {
    labels: [],
    datasets: [{
      label: 'できるセット回数',
      data: [],
      backgroundColor: 'green'
    }]
  }
});

function updateCharts() {
  const recentRecords = getRecentRecords();
  const labels = recentRecords.map(r => r.date);
  const { probUp, conditionArr, setsArr } = calcStats(recentRecords);

  probChart.data.labels = labels;
  probChart.data.datasets[0].data = probUp;
  probChart.update();

  conditionChart.data.labels = labels;
  conditionChart.data.datasets[0].data = conditionArr;
  conditionChart.update();

  setsChart.data.labels = labels;
  setsChart.data.datasets[0].data = setsArr;
  setsChart.update();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const date = dateInput.value;
  const weight = parseFloat(weightInput.value);
  const condition = parseInt(conditionInput.value, 10);
  if (!date || isNaN(weight) || isNaN(condition)) return;
  // 同じ日付は上書き
  const idx = records.findIndex(r => r.date === date);
  if (idx >= 0) {
    records[idx] = { date, weight, condition };
  } else {
    records.push({ date, weight, condition });
  }
  saveRecords();
  updateCharts();
  form.reset();
  resetWeekIfNeeded();
});

// 履歴ボタンイベント
historyBtn.onclick = () => {
  showHistory();
  historyModal.style.display = 'flex';
};
closeHistory.onclick = () => {
  historyModal.style.display = 'none';
};

window.addEventListener('DOMContentLoaded', updateCharts);

// 保存
db.collection("benchRecords").add({
  date: "2025-05-19",
  weight: 80,
  condition: 8
});

// 取得
db.collection("benchRecords").get().then(snapshot => {
  snapshot.forEach(doc => {
    console.log(doc.data());
  });
});
