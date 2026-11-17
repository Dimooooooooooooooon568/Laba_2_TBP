const { fromEvent, interval } = rxjs;

const cryptoSelect = document.getElementById('cryptoSelect');
const addBtn = document.getElementById('addBtn');
const refreshBtn = document.getElementById('refreshBtn');
const cryptoList = document.getElementById('cryptoList');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');

let trackedCoins = JSON.parse(localStorage.getItem('trackedCoins')) || ['bitcoin', 'solana'];
let chartCoins = JSON.parse(localStorage.getItem('chartCoins')) || ['bitcoin', 'solana'];
let lastFetchedData = {};

const COIN_COLORS = {
    bitcoin: '#f7931a',
    ethereum: '#627eea',
    solana: '#14f195',
    cardano: '#0033ad',
    ripple: '#23292f',
    dogecoin: '#c2a633'
};

const ctx = document.getElementById('priceChart').getContext('2d');

const priceChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: []
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                position: 'top',
                labels: { font: { family: 'Arial', size: 12 }, usePointStyle: true }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                padding: 10,
                cornerRadius: 6
            }
        },
        scales: {
            x: {
                grid: { display: false }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                title: { display: true, text: 'Висока ціна (BTC / ETH)' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Нижча ціна (інші монети)' }
            }
        }
    }
});

async function fetchCryptoPrices(coins) {
    if (coins.length === 0) return {};
    const ids = coins.join(',');
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur&include_24hr_change=true`);
    
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Ліміт запитів CoinGecko API (429). Зачекайте хвилину.');
        }
        throw new Error(`Помилка мережі: ${response.status}`);
    }
    return await response.json();
}

function renderCards(data) {
    cryptoList.innerHTML = '';
    for (const coin of trackedCoins) {
        const values = data[coin];
        if (!values) continue;

        const isOnChart = chartCoins.includes(coin);
        const color = COIN_COLORS[coin] || '#007bff';

        const card = document.createElement('div');
        card.className = 'crypto-card';
        card.style.borderLeft = `5px solid ${color}`;
        card.innerHTML = `
            <div>
                <strong>${coin.toUpperCase()}</strong>
                <p>USD: $${values.usd} | EUR: €${values.eur}</p>
                <small>Зміна за 24г: <span style="color: ${values.usd_24h_change >= 0 ? 'green' : 'red'}">${values.usd_24h_change?.toFixed(2)}%</span></small>
            </div>
            <div class="card-actions">
                <button data-chart="${coin}" class="chart-btn ${isOnChart ? 'active' : ''}">
                    ${isOnChart ? 'Прибрати з графіка' : 'Додати на графік'}
                </button>
                <button data-coin="${coin}" class="remove-btn">Видалити</button>
            </div>
        `;
        cryptoList.appendChild(card);
    }
}

function updateChart(data, addNewPoint = true) {
    const timeNow = new Date().toLocaleTimeString();

    if (addNewPoint && Object.keys(data).length > 0) {
        if (priceChart.data.labels.length >= 20) {
            priceChart.data.labels.shift();
            priceChart.data.datasets.forEach(ds => ds.data.shift());
        }
        priceChart.data.labels.push(timeNow);
    }

    priceChart.data.datasets = priceChart.data.datasets.filter(ds => chartCoins.includes(ds.coinId));

    chartCoins.forEach(coin => {
        if (!data[coin]) return;

        let dataset = priceChart.data.datasets.find(ds => ds.coinId === coin);
        const color = COIN_COLORS[coin] || '#007bff';
        const yAxisID = data[coin].usd > 500 ? 'y' : 'y1';

        if (!dataset) {
            dataset = {
                coinId: coin,
                label: `${coin.toUpperCase()} (USD)`,
                data: new Array(Math.max(0, priceChart.data.labels.length - 1)).fill(null),
                borderColor: color,
                backgroundColor: color + '20', // Полупрозрачная заливка под линией
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.35, // Плавные изгибы линии вместо углов
                yAxisID: yAxisID
            };
            priceChart.data.datasets.push(dataset);
        }

        if (addNewPoint) {
            dataset.data.push(data[coin].usd);
        }
    });

    priceChart.update();
}

async function updateDashboard() {
    if (trackedCoins.length === 0) {
        cryptoList.innerHTML = '<p>Список порожній.</p>';
        return;
    }

    loadingDiv.style.display = 'block';
    errorDiv.textContent = '';
    try {
        const data = await fetchCryptoPrices(trackedCoins);
        lastFetchedData = data;
        renderCards(data);
        updateChart(data, true);
    } catch (err) {
        errorDiv.textContent = `Помилка: ${err.message}`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

fromEvent(addBtn, 'click').subscribe(() => {
    const selectedCoin = cryptoSelect.value;
    if (!trackedCoins.includes(selectedCoin)) {
        trackedCoins.push(selectedCoin);
        chartCoins.push(selectedCoin);
        localStorage.setItem('trackedCoins', JSON.stringify(trackedCoins));
        localStorage.setItem('chartCoins', JSON.stringify(chartCoins));
        updateDashboard();
    }
});

fromEvent(refreshBtn, 'click').subscribe(() => {
    updateDashboard();
});

fromEvent(cryptoList, 'click').subscribe((event) => {
    const removeBtn = event.target.closest('.remove-btn');
    const chartBtn = event.target.closest('.chart-btn');

    if (removeBtn) {
        const coin = removeBtn.dataset.coin;
        trackedCoins = trackedCoins.filter(c => c !== coin);
        chartCoins = chartCoins.filter(c => c !== coin);
        localStorage.setItem('trackedCoins', JSON.stringify(trackedCoins));
        localStorage.setItem('chartCoins', JSON.stringify(chartCoins));
        renderCards(lastFetchedData);
        updateChart(lastFetchedData, false);
    }

    if (chartBtn) {
        const coin = chartBtn.dataset.chart;
        if (chartCoins.includes(coin)) {
            chartCoins = chartCoins.filter(c => c !== coin);
        } else {
            chartCoins.push(coin);
        }
        localStorage.setItem('chartCoins', JSON.stringify(chartCoins));
        renderCards(lastFetchedData);
        updateChart(lastFetchedData, false);
    }
});

interval(45000).subscribe(() => {
    updateDashboard();
});

updateDashboard();