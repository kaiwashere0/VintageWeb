/**
 * Vintage Club - Developer Portal Engine
 * Chart.js Visualizations + Real-Time Telemetry Filtering & Sorting + API Sandbox
 */

let latencyChart = null;
let statusDoughnutChart = null;
let memoryTimelineChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initDeveloperSidebar();
  initFlushCacheButton();
  initTelemetryCharts();
  initTelemetryFilters();
  initTruckersMPSandbox();
});

/* ========================================================
   1. Sidebar Controls for Mobile
   ======================================================== */
function initDeveloperSidebar() {
  const sidebar = document.getElementById('dev-sidebar');
  const overlay = document.getElementById('dev-sidebar-overlay');
  const openBtn = document.getElementById('open-dev-sidebar-btn');
  const closeBtn = document.getElementById('close-dev-sidebar-btn');

  if (openBtn && sidebar) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.remove('-translate-x-full');
      if (overlay) overlay.classList.remove('hidden');
    });
  }
  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      if (overlay) overlay.classList.add('hidden');
    });
  }
  if (overlay && sidebar) {
    overlay.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    });
  }
}

/* ========================================================
   2. Flush In-Memory Cache
   ======================================================== */
function initFlushCacheButton() {
  const btn = document.getElementById('flush-cache-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const icon = btn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
      const res = await fetch('/developer/api/microservices/flush-cache', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showDevToast('Caches flushed successfully!', 'success');
      }
    } catch (err) {
      showDevToast('Flush failed: ' + err.message, 'error');
    } finally {
      if (icon) icon.classList.remove('fa-spin');
    }
  });
}

/* ========================================================
   3. Telemetry Visual Charts (Chart.js)
   ======================================================== */
async function initTelemetryCharts() {
  const latencyCanvas = document.getElementById('chart-latency');
  const statusCanvas = document.getElementById('chart-status');
  const memoryCanvas = document.getElementById('chart-memory');

  if (!latencyCanvas && !statusCanvas && !memoryCanvas) return;

  try {
    const res = await fetch('/developer/api/telemetry/data?timeRange=1h');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;

    // 1. Latency Time-Series Chart
    if (latencyCanvas && typeof Chart !== 'undefined') {
      const timeLabels = data.charts.latencyTimeSeries.map(d => d.time);
      const latencies = data.charts.latencyTimeSeries.map(d => d.latency);

      latencyChart = new Chart(latencyCanvas, {
        type: 'line',
        data: {
          labels: timeLabels.length ? timeLabels : ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50'],
          datasets: [{
            label: 'Response Time (ms)',
            data: latencies.length ? latencies : [12, 18, 9, 24, 15, 11],
            borderColor: '#D48D66',
            backgroundColor: 'rgba(212, 141, 102, 0.12)',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#8C5137',
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 } } }
          }
        }
      });
    }

    // 2. HTTP Status Code Doughnut
    if (statusCanvas && typeof Chart !== 'undefined') {
      const dist = data.charts.statusDistribution;
      statusDoughnutChart = new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: ['2xx OK', '3xx Redirect', '4xx Client Err', '5xx Server Err'],
          datasets: [{
            data: dist.some(v => v > 0) ? dist : [95, 3, 2, 0],
            backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94A3B8', font: { size: 11 }, boxWidth: 12 }
            }
          },
          cutout: '70%'
        }
      });
    }

    // 3. Memory & CPU Time-Series Chart
    if (memoryCanvas && typeof Chart !== 'undefined') {
      const history = data.charts.systemHistory || [];
      const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());
      const heapData = history.map(h => h.heapUsedMB);
      const rssData = history.map(h => h.rssMB);

      memoryTimelineChart = new Chart(memoryCanvas, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['0s', '10s', '20s', '30s', '40s'],
          datasets: [
            {
              label: 'Heap Used (MB)',
              data: heapData.length ? heapData : [45, 52, 48, 55, 50],
              borderColor: '#38BDF8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3
            },
            {
              label: 'RSS Memory (MB)',
              data: rssData.length ? rssData : [80, 85, 82, 88, 86],
              borderColor: '#A855F7',
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              borderDash: [4, 4]
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94A3B8', font: { size: 10 }, boxWidth: 10 } }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 } } }
          }
        }
      });
    }

  } catch (err) {
    console.error('[Developer] Telemetry chart load error:', err);
  }
}

/* ========================================================
   4. Telemetry Multi-Dimensional Filtering & Sorting
   ======================================================== */
function initTelemetryFilters() {
  const filterForm = document.getElementById('telemetry-filter-form');
  if (!filterForm) return;

  const runFilter = async () => {
    const service = document.getElementById('filter-service')?.value || 'ALL';
    const level = document.getElementById('filter-level')?.value || 'ALL';
    const timeRange = document.getElementById('filter-timerange')?.value || '1h';
    const statusCode = document.getElementById('filter-status')?.value || 'ALL';
    const sortBy = document.getElementById('filter-sortby')?.value || 'timestamp';
    const sortOrder = document.getElementById('filter-sortorder')?.value || 'desc';
    const search = document.getElementById('filter-search')?.value.trim() || '';

    const params = new URLSearchParams({
      service,
      level,
      timeRange,
      statusCode,
      sortBy,
      sortOrder,
      search
    });

    try {
      const res = await fetch(`/developer/api/telemetry/data?${params.toString()}`);
      const json = await res.json();
      if (!json.success || !json.data) return;

      renderTelemetryTables(json.data);
      updateTelemetryCharts(json.data);
    } catch (err) {
      console.error('[Telemetry] Filter query error:', err);
    }
  };

  // Attach event listeners to all filter inputs
  filterForm.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', runFilter);
    if (el.tagName === 'INPUT') {
      el.addEventListener('input', debounce(runFilter, 300));
    }
  });

  // Clear errors button
  const clearLogsBtn = document.getElementById('clear-error-logs-btn');
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all error logs?')) return;
      try {
        const res = await fetch('/developer/api/telemetry/logs', { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          showDevToast('Error logs cleared', 'success');
          runFilter();
        }
      } catch (err) {
        showDevToast('Clear error logs failed', 'error');
      }
    });
  }
}

function renderTelemetryTables(data) {
  // 1. Render Requests Table
  const reqContainer = document.getElementById('telemetry-requests-table-body');
  if (reqContainer) {
    if (!data.requests || data.requests.length === 0) {
      reqContainer.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-xs text-slate-500 font-mono">No matching requests found</td></tr>`;
    } else {
      reqContainer.innerHTML = data.requests.map(r => {
        let statusBadge = 'bg-emerald-500/20 text-emerald-400';
        if (r.status >= 300 && r.status < 400) statusBadge = 'bg-blue-500/20 text-blue-400';
        else if (r.status >= 400 && r.status < 500) statusBadge = 'bg-amber-500/20 text-amber-400';
        else if (r.status >= 500) statusBadge = 'bg-rose-500/20 text-rose-400';

        return `
          <tr class="border-b border-[#1E232E] hover:bg-[#151922] transition-colors font-mono text-xs">
            <td class="py-2.5 px-3 text-slate-400">${new Date(r.time).toLocaleTimeString()}</td>
            <td class="py-2.5 px-3">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.method === 'GET' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'}">${r.method}</span>
            </td>
            <td class="py-2.5 px-3 text-slate-200 truncate max-w-[280px]">${r.path}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge}">${r.status}</span>
            </td>
            <td class="py-2.5 px-3 text-right text-[#D48D66] font-bold">${r.durationMs} ms</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 2. Render Errors Table
  const errContainer = document.getElementById('telemetry-errors-table-body');
  if (errContainer) {
    if (!data.errors || data.errors.length === 0) {
      errContainer.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-xs text-emerald-400 font-mono"><i class="fa-solid fa-circle-check mr-1.5"></i> Zero errors recorded in this scope</td></tr>`;
    } else {
      errContainer.innerHTML = data.errors.map(e => `
        <tr class="border-b border-[#1E232E] hover:bg-[#151922] transition-colors font-mono text-xs">
          <td class="py-2.5 px-3 text-slate-400">${new Date(e.time).toLocaleTimeString()}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${e.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : (e.severity === 'WARN' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400')}">
              ${e.severity}
            </span>
          </td>
          <td class="py-2.5 px-3 font-bold text-slate-300">${e.service}</td>
          <td class="py-2.5 px-3 text-slate-200">${e.message}</td>
        </tr>
      `).join('');
    }
  }

  // 3. Update Stat Numbers
  const totalReqEl = document.getElementById('stat-telemetry-total-req');
  const avgLatEl = document.getElementById('stat-telemetry-avg-lat');
  const totalErrEl = document.getElementById('stat-telemetry-total-err');
  if (totalReqEl) totalReqEl.textContent = data.overview.totalRequests;
  if (avgLatEl) avgLatEl.textContent = `${data.overview.avgLatencyMs} ms`;
  if (totalErrEl) totalErrEl.textContent = data.overview.totalErrors;
}

function updateTelemetryCharts(data) {
  if (latencyChart && data.charts.latencyTimeSeries) {
    latencyChart.data.labels = data.charts.latencyTimeSeries.map(d => d.time);
    latencyChart.data.datasets[0].data = data.charts.latencyTimeSeries.map(d => d.latency);
    latencyChart.update();
  }
  if (statusDoughnutChart && data.charts.statusDistribution) {
    statusDoughnutChart.data.datasets[0].data = data.charts.statusDistribution;
    statusDoughnutChart.update();
  }
}

/* ========================================================
   5. Interactive TruckersMP Sandbox
   ======================================================== */
function initTruckersMPSandbox() {
  const form = document.getElementById('tmp-sandbox-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const endpoint = document.getElementById('sandbox-endpoint').value;
    const targetId = document.getElementById('sandbox-id')?.value.trim() || '';
    const submitBtn = document.getElementById('sandbox-submit-btn');
    const responseBox = document.getElementById('sandbox-response-code');
    const statusBadge = document.getElementById('sandbox-status-badge');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
    }

    const start = Date.now();
    try {
      const res = await fetch('/developer/api/truckersmp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, id: targetId })
      });

      const json = await res.json();
      const duration = Date.now() - start;

      if (statusBadge) {
        statusBadge.textContent = `${res.status} OK (${duration}ms)`;
        statusBadge.className = `text-[10px] font-mono px-2 py-0.5 rounded font-bold ${res.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`;
      }

      if (responseBox) {
        responseBox.textContent = JSON.stringify(json, null, 2);
      }
    } catch (err) {
      if (responseBox) responseBox.textContent = 'Error executing request: ' + err.message;
      if (statusBadge) {
        statusBadge.textContent = 'FAIL';
        statusBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-500 text-white';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Sandbox Test';
      }
    }
  });

  // Toggle ID input visibility based on endpoint
  const endpointSelect = document.getElementById('sandbox-endpoint');
  const idContainer = document.getElementById('sandbox-id-container');
  if (endpointSelect && idContainer) {
    const handleEndpointChange = () => {
      const ep = endpointSelect.value;
      const requiresId = ['player', 'bans', 'event_detail', 'vtc', 'vtc_members', 'vtc_events'].includes(ep);
      idContainer.style.display = requiresId ? 'block' : 'none';
    };
    endpointSelect.addEventListener('change', handleEndpointChange);
    handleEndpointChange();
  }
}

/* ========================================================
   Helpers
   ======================================================== */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showDevToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl font-mono text-xs text-white shadow-2xl transition-all duration-300 transform translate-y-4 opacity-0 ${type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-[#8C5137]')}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check' : 'fa-info'} mr-2"></i> ${msg}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
