import { collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebase-config.js';

const HOUSES = ['Aravali', 'Nilgiri', 'Shivalik', 'Udaigiri'];
const CRITERIA_KEYS = ['decoration', 'items', 'inside_clean', 'fan_tube', 'footpath', 'grass', 'surrounding'];

const housesContainer = document.getElementById('housesContainer');
const averagesTableBody = document.querySelector('#averagesTable tbody');
const alertArea = document.getElementById('alertArea');
const meta = document.getElementById('meta');

// Fetch all scores from Firestore
async function fetchAllScores() {
  const scoresCol = collection(db, 'judges_scores'); // correct collection
  const snapshot = await getDocs(scoresCol);
  return snapshot.docs.map(doc => doc.data());
}

// Calculate averages
function aggregateScores(allScores) {
  const totalScores = {};
  const criteriaTotals = {};
  const judgesCount = allScores.length;

  HOUSES.forEach(house => {
    totalScores[house] = 0;
    criteriaTotals[house] = {};
    CRITERIA_KEYS.forEach(c => criteriaTotals[house][c] = 0);
  });

  allScores.forEach(judgeEntry => {
    const houses = judgeEntry.houses;
    if (!houses) return;
    HOUSES.forEach(house => {
      if (houses[house]) {
        CRITERIA_KEYS.forEach(c => {
          criteriaTotals[house][c] += houses[house][c] || 0;
        });
        totalScores[house] += houses[house].total || 0;
      }
    });
  });

  const averages = {};
  HOUSES.forEach(house => {
    averages[house] = {};
    CRITERIA_KEYS.forEach(c => {
      averages[house][c] = (criteriaTotals[house][c] / judgesCount) || 0;
    });
    averages[house].total = (totalScores[house] / judgesCount) || 0;
  });

  return averages;
}

// Find winner
function findWinner(averages) {
  let winner = null;
  let maxScore = -Infinity;
  for (const house in averages) {
    if (averages[house].total > maxScore) {
      maxScore = averages[house].total;
      winner = house;
    }
  }
  return winner;
}

// Render results in UI
function renderResults(averages, winner) {
  housesContainer.innerHTML = '';
  averagesTableBody.innerHTML = '';

  alertArea.innerHTML = `<div class="alert alert-success" role="alert">
    🏆 Winner: <strong>${winner}</strong> with <strong>${averages[winner].total.toFixed(2)}</strong> average points!
  </div>`;

  for (const house of HOUSES) {
    const card = document.createElement('div');
    card.className = 'col-12 col-md-6 ' + (house === winner ? 'winner' : '');
    card.innerHTML = `
      <div class="card p-3 ${house === winner ? 'winner' : ''}">
        <h5>${house}</h5>
        <ul>
          ${CRITERIA_KEYS.map(c => `<li>${c.replace('_', ' ')}: ${averages[house][c].toFixed(2)}</li>`).join('')}
          <li><strong>Total: ${averages[house].total.toFixed(2)}</strong></li>
        </ul>
      </div>
    `;
    housesContainer.appendChild(card);
  }

  let rank = 1;
  const sortedHouses = Object.keys(averages).sort((a,b) => averages[b].total - averages[a].total);
  for (const house of sortedHouses) {
    const tr = document.createElement('tr');
    tr.className = house === winner ? 'table-success' : '';
    tr.innerHTML = `
      <td>${house}</td>
      <td>${averages[house].decoration.toFixed(2)}</td>
      <td>${averages[house].items.toFixed(2)}</td>
      <td>${averages[house].inside_clean.toFixed(2)}</td>
      <td>${averages[house].fan_tube.toFixed(2)}</td>
      <td>${averages[house].footpath.toFixed(2)}</td>
      <td>${averages[house].grass.toFixed(2)}</td>
      <td>${averages[house].surrounding.toFixed(2)}</td>
      <td><strong>${averages[house].total.toFixed(2)}</strong></td>
      <td>${rank++}</td>
    `;
    averagesTableBody.appendChild(tr);
  }
}

// Main loader
async function loadAndRenderResults() {
  try {
    meta.textContent = 'Loading results...';
    alertArea.innerHTML = '';
    const allScores = await fetchAllScores();
    if (allScores.length === 0) {
      meta.textContent = 'No scores submitted yet.';
      return;
    }
    const averages = aggregateScores(allScores);
    const winner = findWinner(averages);
    renderResults(averages, winner);
    meta.textContent = `Showing results from ${allScores.length} judge(s).`;
  } catch (error) {
    meta.textContent = 'Error loading results.';
    alertArea.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    console.error(error);
  }
}

// Export CSV
function exportResultsToCSV() {
  const table = document.getElementById('averagesTable');
  let csv = [];
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    let cells = row.querySelectorAll('th, td');
    let rowData = [];
    cells.forEach(cell => rowData.push(`"${cell.textContent.trim()}"`));
    csv.push(rowData.join(','));
  });
  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'results.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Hook buttons
const refreshBtn = document.getElementById('refreshBtn');
refreshBtn.textContent = 'Exit';
refreshBtn.addEventListener('click', async () => {
  if (confirm("⚠ This will permanently erase all results. Continue?")) {
    try {
      const batch = writeBatch(db);

      // Delete all judges
      const judgesSnap = await getDocs(collection(db, 'judges'));
      judgesSnap.forEach(doc => batch.delete(doc.ref));

      // Delete all scores
      const scoresSnap = await getDocs(collection(db, 'judges_scores')); // fixed collection
      scoresSnap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      alert("✅ Please re-enter the marks next week again.");
      window.location.href = 'login.html?msg=Please%20re-enter%20the%20marks%20next%20week%20again';
    } catch (error) {
      console.error("Error deleting data:", error);
      alert("❌ Failed to erase data. Check permissions.");
    }
  }
});

document.getElementById('exportCsvBtn').addEventListener('click', exportResultsToCSV);

// Initial load
loadAndRenderResults();
