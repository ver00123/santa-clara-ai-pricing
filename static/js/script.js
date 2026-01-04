let map = L.map('map', { zoomControl: false }).setView([37.3541, -121.9552], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = L.marker([37.3541, -121.9552]).addTo(map);

let isManualMode = false;
let chart1 = null;
let chart2 = null;

const toggleBtn = document.getElementById('toggleMode');
const seasonalContainer = document.getElementById('seasonalContainer');
const autoDisplay = document.getElementById('autoDisplay');
const manualDateInput = document.getElementById('manualDate');

const coords = {
    "Campbell": [37.2872, -121.9443], "Cupertino": [37.3230, -122.0322],
    "Gilroy": [37.0059, -121.5683], "Los Altos": [37.3852, -122.1141],
    "Los Altos Hills": [37.3797, -122.1375], "Los Gatos": [37.2266, -121.9747],
    "Milpitas": [37.4323, -121.8996], "Monte Sereno": [37.2363, -121.9925],
    "Morgan Hill": [37.1305, -121.6544], "Mountain View": [37.3861, -122.0839],
    "Palo Alto": [37.4419, -122.1430], "San Jose": [37.3382, -121.8863],
    "Santa Clara": [37.3541, -121.9552], "Saratoga": [37.2638, -122.0230],
    "Sunnyvale": [37.3688, -122.0363], "Unincorporated Areas": [37.3337, -121.8907]
};

function resetDashboard() {
    document.getElementById('predictionForm').reset();
    document.getElementById('predictedPrice').innerText = "$0.00";
    document.getElementById('subPrices').classList.add('hidden');
    document.getElementById('priceRange').classList.add('hidden'); 
    document.getElementById('aiInsights').classList.add('hidden'); 
    
    map.flyTo([37.3541, -121.9552], 10);
    marker.setLatLng([37.3541, -121.9552]);
    if (marker.getPopup()) marker.closePopup();
    if(chart1) chart1.destroy();
    if(chart2) chart2.destroy();
    isManualMode = false;
    toggleBtn.innerText = "Switch to Manual";
    autoDisplay.classList.remove('hidden');
    manualDateInput.classList.add('hidden');
    updateRealTimeSeason();
}

function updateRealTimeSeason() {
    const now = new Date();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthName = months[now.getMonth()];
    const day = now.getDate().toString().padStart(2, '0');
    const isWeekend = (now.getDay() === 0 || now.getDay() === 6);
    const statusText = isWeekend ? "WEEKEND RATE" : "WEEKDAY RATE";
    const displayElement = document.getElementById('seasonalStatus');
    if (displayElement) {
        displayElement.innerText = `${monthName} ${day} • ${statusText}`;
    }
}

updateRealTimeSeason();

toggleBtn.addEventListener('click', () => {
    isManualMode = !isManualMode;
    if (isManualMode) {
        toggleBtn.innerText = "Switch to Auto";
        autoDisplay.classList.add('hidden');
        manualDateInput.classList.remove('hidden');
        manualDateInput.focus();
        manualDateInput.value = new Date().toISOString().split('T')[0];
    } else {
        toggleBtn.innerText = "Switch to Manual";
        autoDisplay.classList.remove('hidden');
        manualDateInput.classList.add('hidden');
        updateRealTimeSeason(); 
    }
});

function getSeasonalData() {
    let targetDate = (isManualMode && manualDateInput.value) ? new Date(manualDateInput.value) : new Date();
    return {
        month: targetDate.getMonth() + 1,
        day: targetDate.getDate(),
        day_of_week: targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1,
        is_weekend: (targetDate.getDay() === 0 || targetDate.getDay() === 6) ? 1 : 0
    };
}

document.getElementById('predictionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const accInput = document.getElementById('acc');
    const bedInput = document.getElementById('bed');
    const bathInput = document.getElementById('bath');
    const amenInput = document.getElementById('amenities');

    const acc = Math.abs(parseFloat(accInput.value)) || 0;
    const bed = Math.abs(parseFloat(bedInput.value)) || 0;
    const bath = Math.abs(parseFloat(bathInput.value)) || 0;
    const amenities = Math.abs(parseFloat(amenInput.value)) || 0;

    const seasonal = getSeasonalData();
    const data = {
        acc: acc, bed: bed, bath: bath, amenities: amenities,
        neighborhood: document.getElementById('neighborhood').value,
        room_type: document.getElementById('room_type').value,
        available: document.getElementById('available').value, 
        month: seasonal.month, day: seasonal.day,
        day_of_week: seasonal.day_of_week, is_weekend: seasonal.is_weekend
    };

    const response = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
        
        document.getElementById('predictedPrice').innerText = `$${result.price}`;
        document.getElementById('lowVal').innerText = `$${result.range_low}`;
        document.getElementById('highVal').innerText = `$${result.range_high}`;
        document.getElementById('priceRange').classList.remove('hidden');
        document.getElementById('subPrices').classList.remove('hidden');
        document.getElementById('rfVal').innerText = `$${result.rf}`;
        document.getElementById('xgbVal').innerText = result.tier;

        const aiInsights = document.getElementById('aiInsights');
        const insightsList = document.getElementById('insightsList');
        if (result.insights && result.insights.length > 0) {
            aiInsights.classList.remove('hidden');
            insightsList.innerHTML = result.insights.map(text => 
                `<span class="text-[9px] text-slate-400 italic font-medium">" ${text} "</span>`
            ).join('');
        } else {
            aiInsights.classList.add('hidden');
        }

        const loc = data.neighborhood;
        if(coords[loc]) {
            map.flyTo(coords[loc], 13);
            marker.setLatLng(coords[loc]).bindPopup(`<b>${loc}</b>`).openPopup();
        }

        const ctx1 = document.getElementById('modelChart').getContext('2d');
        if(chart1) chart1.destroy();
        const tierValue = result.tier === "Luxury Class" ? 300 : result.tier === "Standard Class" ? 150 : 75;

        chart1 = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['Asset Val', 'Tier Index', 'Final Forecast'],
                datasets: [{
                    data: [result.rf, tierValue, result.price],
                    backgroundColor: ['#cbd5e1', '#6366f1', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        const ctx2 = document.getElementById('impactChart').getContext('2d');
        if(chart2) chart2.destroy();
        chart2 = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Size', 'Beds', 'Baths', 'Amenities'],
                datasets: [{
                    label: 'Impact Score',
                    data: [result.impact.Size, result.impact.Beds, result.impact.Baths, result.impact.Amenities], 
                    backgroundColor: '#ef4444', 
                    borderRadius: 8, barThickness: 15
                }]
            },
            options: {
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: true, grid: { display: false } }, y: { grid: { display: false } } }
            }
        });

        if (window.innerWidth < 1024) { 
            setTimeout(() => {
                document.getElementById('result').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 300);
        }
    }
});