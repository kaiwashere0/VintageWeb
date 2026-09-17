/**
 * Vintage Club - Developer Portal Engine
 * Theme Controller (Dark/Light) + Chart.js Visualizations + Real-Time Telemetry + Discord Bot & Voice API
 */

let latencyChart = null;
let statusDoughnutChart = null;
let memoryTimelineChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeController();
  initDeveloperSidebar();
  initFlushCacheButton();
  initTelemetryCharts();
  initTelemetryFilters();
  initTruckersMPSandbox();
  initDiscordBotController();
});

/* ========================================================
   1. Dark / Light Mode Theme Controller
   ======================================================== */
function initThemeController() {
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      
      // Update Chart.js themes dynamically if charts exist
      updateChartsTheme();
    });
  });
}

function updateChartsTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94A3B8' : '#8C5137';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(74,43,29,0.06)';

  [latencyChart, memoryTimelineChart].forEach(chart => {
    if (chart) {
      if (chart.options.scales?.x) {
        chart.options.scales.x.ticks.color = textColor;
        chart.options.scales.x.grid.color = gridColor;
      }
      if (chart.options.scales?.y) {
        chart.options.scales.y.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
      }
      chart.update();
    }
  });

  if (statusDoughnutChart && statusDoughnutChart.options.plugins?.legend) {
    statusDoughnutChart.options.plugins.legend.labels.color = textColor;
    statusDoughnutChart.update();
  }
}

/* ========================================================
   2. Sidebar Controls for Mobile
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
   3. Flush In-Memory Cache
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
        showDevToast('In-memory cache flushed successfully!', 'success');
      }
    } catch (err) {
      showDevToast('Flush failed: ' + err.message, 'error');
    } finally {
      if (icon) icon.classList.remove('fa-spin');
    }
  });
}

/* ========================================================
   4. Telemetry Visual Charts (Chart.js)
   ======================================================== */
async function initTelemetryCharts() {
  const latencyCanvas = document.getElementById('chart-latency');
  const statusCanvas = document.getElementById('chart-status');
  const memoryCanvas = document.getElementById('chart-memory');

  if (!latencyCanvas && !statusCanvas && !memoryCanvas) return;

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94A3B8' : '#8C5137';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(74,43,29,0.06)';

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
            borderColor: '#8C5137',
            backgroundColor: 'rgba(140, 81, 55, 0.12)',
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
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } }
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
          labels: ['2xx Success', '3xx Redirect', '4xx Client Error', '5xx Server Error'],
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
              labels: { color: textColor, font: { size: 11 }, boxWidth: 12 }
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
            legend: { labels: { color: textColor, font: { size: 10 }, boxWidth: 10 } }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } }
          }
        }
      });
    }

  } catch (err) {
    console.error('[Developer] Telemetry chart load error:', err);
  }
}

/* ========================================================
   5. Telemetry Multi-Dimensional Filtering, Sorting & Pagination
   ======================================================== */
let currentTelemetryRequests = [];
let currentTelemetryPage = 1;
let telemetryPageSize = 10;

function initTelemetryFilters() {
  const filterForm = document.getElementById('telemetry-filter-form');
  const pageSizeSelect = document.getElementById('telemetry-page-size');

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      telemetryPageSize = parseInt(e.target.value, 10) || 10;
      renderTelemetryPage(1);
    });
  }

  // If telemetry page loaded with initial rows, extract them
  const initialTableBody = document.getElementById('telemetry-requests-table-body');
  if (initialTableBody && initialTableBody.querySelectorAll('tr').length > 0 && !currentTelemetryRequests.length) {
    // Trigger initial fetch to populate reactive dataset
    fetch('/developer/api/telemetry/data?timeRange=1h')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          renderTelemetryTables(json.data);
        }
      })
      .catch(err => console.error('[Telemetry] Initial fetch error:', err));
  }

  if (!filterForm) return;

  const runFilter = async () => {
    const timeRange = document.getElementById('filter-timerange')?.value || '1h';
    const statusCode = document.getElementById('filter-status')?.value || 'ALL';
    const sortBy = document.getElementById('filter-sortby')?.value || 'timestamp';
    const sortOrder = document.getElementById('filter-sortorder')?.value || 'desc';
    const search = document.getElementById('filter-search')?.value.trim() || '';

    const params = new URLSearchParams({
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
      if (!confirm('Are you sure you want to clear the error log buffer?')) return;
      try {
        const res = await fetch('/developer/api/telemetry/logs', { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          showDevToast('Error log buffer cleared successfully.', 'success');
          runFilter();
        }
      } catch (err) {
        showDevToast('Failed to clear error logs: ' + err.message, 'error');
      }
    });
  }
}

function renderTelemetryTables(data) {
  // 1. Store Requests & Paginate
  currentTelemetryRequests = data.requests || [];
  renderTelemetryPage(1);

  // 2. Render Errors Table
  const errContainer = document.getElementById('telemetry-errors-table-body');
  if (errContainer) {
    if (!data.errors || data.errors.length === 0) {
      errContainer.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-mono"><i class="fa-solid fa-circle-check mr-1.5"></i> Zero errors recorded in this scope.</td></tr>`;
    } else {
      errContainer.innerHTML = data.errors.map(e => `
        <tr class="border-b border-[#E1E2E4] dark:border-[#262A36] hover:bg-[#F8F9FA] dark:hover:bg-[#151922] transition-colors font-mono text-xs">
          <td class="py-2.5 px-3 text-[#8C5137] dark:text-slate-400">${new Date(e.time).toLocaleTimeString()}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${e.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : (e.severity === 'WARN' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}">
              ${e.severity}
            </span>
          </td>
          <td class="py-2.5 px-3 font-bold text-[#4A2B1D] dark:text-slate-200">${e.service}</td>
          <td class="py-2.5 px-3 text-[#4A2B1D] dark:text-slate-200">${e.message}</td>
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

function renderTelemetryPage(page = 1) {
  currentTelemetryPage = page;
  const reqContainer = document.getElementById('telemetry-requests-table-body');
  const startIdxEl = document.getElementById('page-start-idx');
  const endIdxEl = document.getElementById('page-end-idx');
  const totalCountEl = document.getElementById('page-total-count');
  const btnContainer = document.getElementById('telemetry-pagination-buttons');

  if (!reqContainer) return;

  const totalItems = currentTelemetryRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / telemetryPageSize));

  if (currentTelemetryPage > totalPages) currentTelemetryPage = totalPages;
  if (currentTelemetryPage < 1) currentTelemetryPage = 1;

  if (totalItems === 0) {
    reqContainer.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-[#8C5137] dark:text-slate-400 font-mono">No matching requests recorded in this scope.</td></tr>`;
    if (startIdxEl) startIdxEl.textContent = '0';
    if (endIdxEl) endIdxEl.textContent = '0';
    if (totalCountEl) totalCountEl.textContent = '0';
    if (btnContainer) btnContainer.innerHTML = '';
    return;
  }

  const startIdx = (currentTelemetryPage - 1) * telemetryPageSize;
  const endIdx = Math.min(startIdx + telemetryPageSize, totalItems);
  const pageItems = currentTelemetryRequests.slice(startIdx, endIdx);

  reqContainer.innerHTML = pageItems.map(r => {
    let statusBadge = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    if (r.status >= 300 && r.status < 400) statusBadge = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    else if (r.status >= 400 && r.status < 500) statusBadge = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    else if (r.status >= 500) statusBadge = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20';

    return `
      <tr class="border-b border-[#E1E2E4] dark:border-[#262A36] hover:bg-[#F8F9FA] dark:hover:bg-[#151922] transition-colors font-mono text-xs">
        <td class="py-2.5 px-3 text-[#8C5137] dark:text-slate-400">${new Date(r.time).toLocaleTimeString()}</td>
        <td class="py-2.5 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.method === 'GET' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'}">${r.method}</span>
        </td>
        <td class="py-2.5 px-3 text-[#4A2B1D] dark:text-slate-200 truncate max-w-[280px]">${r.path}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge}">${r.status}</span>
        </td>
        <td class="py-2.5 px-3 text-right text-[#8C5137] dark:text-[#D48D66] font-bold">${r.durationMs} ms</td>
      </tr>
    `;
  }).join('');

  if (startIdxEl) startIdxEl.textContent = (startIdx + 1).toString();
  if (endIdxEl) endIdxEl.textContent = endIdx.toString();
  if (totalCountEl) totalCountEl.textContent = totalItems.toString();

  // Render pagination buttons
  if (btnContainer) {
    let html = `
      <button type="button" class="telemetry-page-btn px-2.5 py-1 rounded-lg border border-[#E1E2E4] dark:border-[#262A36] bg-white dark:bg-[#13161D] text-[#4A2B1D] dark:text-white hover:bg-[#8C5137]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" data-page="${currentTelemetryPage - 1}" ${currentTelemetryPage <= 1 ? 'disabled' : ''} title="Previous Page">
        <i class="fa-solid fa-chevron-left text-[10px]"></i>
      </button>
    `;

    let startPage = Math.max(1, currentTelemetryPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      html += `<button type="button" class="telemetry-page-btn px-2.5 py-1 rounded-lg border border-[#E1E2E4] dark:border-[#262A36] bg-white dark:bg-[#13161D] text-[#4A2B1D] dark:text-white hover:bg-[#8C5137]/10 transition-colors" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="px-1 text-slate-400">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      const isActive = p === currentTelemetryPage;
      html += `
        <button type="button" class="telemetry-page-btn px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${isActive ? 'bg-[#8C5137] text-white border-[#8C5137] shadow-xs' : 'border-[#E1E2E4] dark:border-[#262A36] bg-white dark:bg-[#13161D] text-[#4A2B1D] dark:text-white hover:bg-[#8C5137]/10'}" data-page="${p}">
          ${p}
        </button>
      `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="px-1 text-slate-400">...</span>`;
      html += `<button type="button" class="telemetry-page-btn px-2.5 py-1 rounded-lg border border-[#E1E2E4] dark:border-[#262A36] bg-white dark:bg-[#13161D] text-[#4A2B1D] dark:text-white hover:bg-[#8C5137]/10 transition-colors" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
      <button type="button" class="telemetry-page-btn px-2.5 py-1 rounded-lg border border-[#E1E2E4] dark:border-[#262A36] bg-white dark:bg-[#13161D] text-[#4A2B1D] dark:text-white hover:bg-[#8C5137]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" data-page="${currentTelemetryPage + 1}" ${currentTelemetryPage >= totalPages ? 'disabled' : ''} title="Next Page">
        <i class="fa-solid fa-chevron-right text-[10px]"></i>
      </button>
    `;

    btnContainer.innerHTML = html;

    // Attach click events
    btnContainer.querySelectorAll('.telemetry-page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage && targetPage !== currentTelemetryPage) {
          renderTelemetryPage(targetPage);
        }
      });
    });
  }
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
   6. Interactive TruckersMP Sandbox
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
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing Sandbox...';
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
        statusBadge.className = `text-[10px] font-mono px-2 py-0.5 rounded font-bold ${res.ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'}`;
      }

      if (responseBox) {
        responseBox.textContent = JSON.stringify(json, null, 2);
      }
    } catch (err) {
      if (responseBox) responseBox.textContent = 'Error executing request: ' + err.message;
      if (statusBadge) {
        statusBadge.textContent = 'FAILED';
        statusBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-600 text-white';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-play"></i> Execute Sandbox Request';
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
   7. Discord Bot Presence & Live Simulator Controller
   ======================================================== */
function initDiscordBotController() {
  const form = document.getElementById('bot-presence-form');
  if (!form) return;

  const statusTypeSelect = document.getElementById('bot-status-type');
  const onlineStatusSelect = document.getElementById('bot-online-status');
  const streamingUrlInput = document.getElementById('bot-streaming-url');
  const streamingUrlContainer = document.getElementById('streaming-url-container');
  const intervalSlider = document.getElementById('bot-rotation-interval');
  const intervalValText = document.getElementById('interval-val-text');
  const statIntervalDisplay = document.getElementById('stat-interval-display');
  const statPresenceMode = document.getElementById('stat-presence-mode');
  const statusContainer = document.getElementById('status-items-container');
  const addStatusBtn = document.getElementById('add-status-item-btn');
  const feedbackEl = document.getElementById('form-status-feedback');

  // Preview elements
  const previewStatusText = document.getElementById('preview-status-text');
  const previewStatusIndicator = document.getElementById('preview-status-indicator');
  const previewActivityTypeLabel = document.getElementById('preview-activity-type-label');
  const previewActivityIcon = document.getElementById('preview-activity-icon');
  const previewActivityIconBox = document.getElementById('preview-activity-icon-box');
  const previewStreamTag = document.getElementById('preview-stream-tag');
  const previewStreamLink = document.getElementById('preview-stream-link');
  const previewTickerLabel = document.getElementById('preview-ticker-label');
  const previewNextBtn = document.getElementById('preview-next-btn');

  let previewIndex = 0;
  let previewTimer = null;

  // 0. Initialize Custom Dropdown Selectors
  const initCustomDropdownSelectors = () => {
    const wrappers = document.querySelectorAll('.custom-dropdown-wrapper');
    if (!wrappers.length) return;

    wrappers.forEach(wrapper => {
      const trigger = wrapper.querySelector('.custom-dropdown-trigger');
      const menu = wrapper.querySelector('.custom-dropdown-menu');
      const dropdownType = wrapper.getAttribute('data-dropdown');

      if (!trigger || !menu) return;

      // Toggle dropdown open/close
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !menu.classList.contains('hidden');
        
        // Close all other dropdowns
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.custom-dropdown-trigger').forEach(t => t.setAttribute('data-open', 'false'));

        if (!isOpen) {
          menu.classList.remove('hidden');
          trigger.setAttribute('data-open', 'true');
        }
      });

      // Handle Option Selection
      menu.querySelectorAll('.custom-dropdown-option').forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = option.getAttribute('data-value');
          const title = option.getAttribute('data-title');
          const desc = option.getAttribute('data-desc');

          if (dropdownType === 'activity-type') {
            const hiddenInput = document.getElementById('bot-status-type');
            if (hiddenInput) {
              hiddenInput.value = val;
              hiddenInput.dispatchEvent(new Event('change'));
            }

            const titleEl = document.getElementById('trigger-activity-title');
            const descEl = document.getElementById('trigger-activity-desc');
            const iconEl = document.getElementById('trigger-activity-icon');
            const iconBox = document.getElementById('trigger-activity-icon-box');

            if (titleEl) titleEl.textContent = title;
            if (descEl) descEl.textContent = desc;
            if (iconEl) iconEl.className = `fa-solid ${option.getAttribute('data-icon')}`;
            if (iconBox) {
              const bg = option.getAttribute('data-icon-bg');
              const border = option.getAttribute('data-icon-border');
              const color = option.getAttribute('data-icon-color');
              iconBox.className = `w-8 h-8 rounded-lg ${bg} border ${border} ${color} flex items-center justify-center text-xs flex-shrink-0`;
            }
          } else if (dropdownType === 'online-status') {
            const hiddenInput = document.getElementById('bot-online-status');
            if (hiddenInput) {
              hiddenInput.value = val;
              hiddenInput.dispatchEvent(new Event('change'));
            }

            const titleEl = document.getElementById('trigger-online-title');
            const descEl = document.getElementById('trigger-online-desc');
            const dotEl = document.getElementById('trigger-online-dot');
            const iconBox = document.getElementById('trigger-online-icon-box');

            if (titleEl) titleEl.textContent = title;
            if (descEl) descEl.textContent = desc;
            if (dotEl) {
              const dotColor = option.getAttribute('data-dot-color');
              const dotRing = option.getAttribute('data-dot-ring');
              dotEl.className = `w-3 h-3 rounded-full ${dotColor} ring-4 ${dotRing}`;
            }
            if (iconBox) {
              const boxBg = option.getAttribute('data-box-bg');
              const boxBorder = option.getAttribute('data-box-border');
              iconBox.className = `w-8 h-8 rounded-lg ${boxBg} border ${boxBorder} flex items-center justify-center flex-shrink-0`;
            }
          }

          // Update checkmarks
          menu.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            const check = opt.querySelector('.option-check');
            if (check) {
              if (opt === option) {
                check.classList.remove('hidden');
                opt.classList.add('bg-[#8C5137]/10', 'dark:bg-[#D48D66]/10');
              } else {
                check.classList.add('hidden');
                opt.classList.remove('bg-[#8C5137]/10', 'dark:bg-[#D48D66]/10');
              }
            }
          });

          // Close dropdown
          menu.classList.add('hidden');
          trigger.setAttribute('data-open', 'false');
        });
      });
    });

    // Close on click outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.add('hidden'));
      document.querySelectorAll('.custom-dropdown-trigger').forEach(t => t.setAttribute('data-open', 'false'));
    });

    // Sync initial selected checkmarks
    const currentStatusType = document.getElementById('bot-status-type')?.value || 'STREAMING';
    const currentOnlineStatus = document.getElementById('bot-online-status')?.value || 'online';

    const activityOpt = document.querySelector(`.custom-dropdown-option[data-value="${currentStatusType}"]`);
    if (activityOpt) {
      activityOpt.querySelector('.option-check')?.classList.remove('hidden');
      activityOpt.classList.add('bg-[#8C5137]/10', 'dark:bg-[#D48D66]/10');
      const titleEl = document.getElementById('trigger-activity-title');
      const descEl = document.getElementById('trigger-activity-desc');
      const iconEl = document.getElementById('trigger-activity-icon');
      const iconBox = document.getElementById('trigger-activity-icon-box');
      if (titleEl) titleEl.textContent = activityOpt.getAttribute('data-title');
      if (descEl) descEl.textContent = activityOpt.getAttribute('data-desc');
      if (iconEl) iconEl.className = `fa-solid ${activityOpt.getAttribute('data-icon')}`;
      if (iconBox) {
        iconBox.className = `w-8 h-8 rounded-lg ${activityOpt.getAttribute('data-icon-bg')} border ${activityOpt.getAttribute('data-icon-border')} ${activityOpt.getAttribute('data-icon-color')} flex items-center justify-center text-xs flex-shrink-0`;
      }
    }

    const onlineOpt = document.querySelector(`.custom-dropdown-option[data-value="${currentOnlineStatus}"]`);
    if (onlineOpt) {
      onlineOpt.querySelector('.option-check')?.classList.remove('hidden');
      onlineOpt.classList.add('bg-[#8C5137]/10', 'dark:bg-[#D48D66]/10');
      const titleEl = document.getElementById('trigger-online-title');
      const descEl = document.getElementById('trigger-online-desc');
      const dotEl = document.getElementById('trigger-online-dot');
      const iconBox = document.getElementById('trigger-online-icon-box');
      if (titleEl) titleEl.textContent = onlineOpt.getAttribute('data-title');
      if (descEl) descEl.textContent = onlineOpt.getAttribute('data-desc');
      if (dotEl) dotEl.className = `w-3 h-3 rounded-full ${onlineOpt.getAttribute('data-dot-color')} ring-4 ${onlineOpt.getAttribute('data-dot-ring')}`;
      if (iconBox) iconBox.className = `w-8 h-8 rounded-lg ${onlineOpt.getAttribute('data-box-bg')} border ${onlineOpt.getAttribute('data-box-border')} flex items-center justify-center flex-shrink-0`;
    }
  };

  initCustomDropdownSelectors();

  // 1. Get current status texts list from DOM inputs
  const getStatusInputs = () => {
    const inputs = statusContainer.querySelectorAll('.status-input');
    return Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
  };

  // 2. Re-index row numbers
  const reindexRows = () => {
    const rows = statusContainer.querySelectorAll('.status-row');
    rows.forEach((row, idx) => {
      const indexEl = row.querySelector('.row-index');
      if (indexEl) indexEl.textContent = `#${idx + 1}`;
    });
  };

  // 3. Update Preview UI based on form values
  const updatePreview = () => {
    const type = statusTypeSelect ? statusTypeSelect.value : 'STREAMING';
    const online = onlineStatusSelect ? onlineStatusSelect.value : 'online';
    const streamUrl = streamingUrlInput ? streamingUrlInput.value.trim() : 'https://twitch.tv/vintageclub';
    const modeRadio = form.querySelector('input[name="statusMode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'ROTATING';
    const intervalSec = intervalSlider ? parseInt(intervalSlider.value, 10) : 15;
    const statuses = getStatusInputs();

    // Stream URL container visibility
    if (streamingUrlContainer) {
      if (type === 'STREAMING') {
        streamingUrlContainer.classList.remove('opacity-60');
      } else {
        streamingUrlContainer.classList.add('opacity-60');
      }
    }

    // Interval display text
    if (intervalValText) intervalValText.textContent = intervalSec;
    if (statIntervalDisplay) statIntervalDisplay.textContent = intervalSec;
    if (statPresenceMode) statPresenceMode.textContent = `${type} (${mode})`;

    // Sync timeline preset buttons active state
    form.querySelectorAll('.timeline-step-btn').forEach(btn => {
      const sec = parseInt(btn.getAttribute('data-seconds'), 10);
      if (sec === intervalSec) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // Online indicator color
    if (previewStatusIndicator) {
      if (type === 'STREAMING') {
        previewStatusIndicator.className = 'absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#232428] bg-[#593695] flex items-center justify-center text-[8px] text-white';
        previewStatusIndicator.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i>';
      } else if (online === 'online') {
        previewStatusIndicator.className = 'absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#232428] bg-emerald-500';
        previewStatusIndicator.innerHTML = '';
      } else if (online === 'idle') {
        previewStatusIndicator.className = 'absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#232428] bg-amber-500';
        previewStatusIndicator.innerHTML = '';
      } else if (online === 'dnd') {
        previewStatusIndicator.className = 'absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#232428] bg-rose-500';
        previewStatusIndicator.innerHTML = '';
      } else {
        previewStatusIndicator.className = 'absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#232428] bg-slate-500';
        previewStatusIndicator.innerHTML = '';
      }
    }

    // Activity type UI
    if (previewActivityTypeLabel) {
      const typeLabels = {
        STREAMING: 'Streaming',
        PLAYING: 'Playing',
        LISTENING: 'Listening to',
        WATCHING: 'Watching',
        COMPETING: 'Competing in'
      };
      previewActivityTypeLabel.textContent = typeLabels[type] || 'Streaming';
    }

    if (previewActivityIcon && previewActivityIconBox) {
      const icons = {
        STREAMING: { icon: 'fa-tower-broadcast', bg: 'bg-[#593695]' },
        PLAYING: { icon: 'fa-gamepad', bg: 'bg-[#5865F2]' },
        LISTENING: { icon: 'fa-headphones', bg: 'bg-emerald-600' },
        WATCHING: { icon: 'fa-tv', bg: 'bg-sky-600' },
        COMPETING: { icon: 'fa-trophy', bg: 'bg-amber-600' }
      };
      const conf = icons[type] || icons.STREAMING;
      previewActivityIcon.className = `fa-solid ${conf.icon}`;
      previewActivityIconBox.className = `w-8 h-8 rounded-lg ${conf.bg} text-white flex items-center justify-center flex-shrink-0 text-xs shadow-md`;
    }

    if (previewStreamTag && previewStreamLink) {
      if (type === 'STREAMING') {
        previewStreamTag.style.display = 'inline';
        previewStreamTag.textContent = streamUrl.includes('youtube') ? 'on YouTube' : 'on Twitch';
        previewStreamLink.style.display = 'block';
        previewStreamLink.textContent = streamUrl;
      } else {
        previewStreamTag.style.display = 'none';
        previewStreamLink.style.display = 'none';
      }
    }

    // Render active status text in preview
    if (statuses.length > 0) {
      const safeIndex = previewIndex % statuses.length;
      if (previewStatusText) {
        previewStatusText.textContent = statuses[safeIndex];
      }
      if (previewTickerLabel) {
        previewTickerLabel.textContent = `${mode === 'ROTATING' ? 'Cycling' : 'Fixed'} (${safeIndex + 1} of ${statuses.length})`;
      }
    } else {
      if (previewStatusText) previewStatusText.textContent = '👑 Vintage Club';
      if (previewTickerLabel) previewTickerLabel.textContent = 'No messages';
    }
  };

  // 4. Start Live Simulation Rotator in Frontend Widget
  const startPreviewTicker = () => {
    if (previewTimer) clearInterval(previewTimer);

    const modeRadio = form.querySelector('input[name="statusMode"]:checked');
    const isRotating = !modeRadio || modeRadio.value === 'ROTATING';
    const intervalSec = intervalSlider ? Math.max(3, parseInt(intervalSlider.value, 10)) : 15;

    if (isRotating) {
      previewTimer = setInterval(() => {
        const statuses = getStatusInputs();
        if (statuses.length > 1) {
          previewIndex = (previewIndex + 1) % statuses.length;
          if (previewStatusText) {
            previewStatusText.style.opacity = '0';
            setTimeout(() => {
              updatePreview();
              previewStatusText.style.opacity = '1';
            }, 150);
          } else {
            updatePreview();
          }
        }
      }, intervalSec * 1000);
    }
  };

  // 5. Add new status row
  if (addStatusBtn) {
    addStatusBtn.addEventListener('click', () => {
      const currentCount = statusContainer.querySelectorAll('.status-row').length;
      const newRow = document.createElement('div');
      newRow.className = 'status-row flex items-center gap-2 p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#13161D] border border-[#E1E2E4] dark:border-[#262A36] group animate-fadeIn';
      newRow.innerHTML = `
        <span class="row-index text-xs font-mono font-bold text-[#8C5137] dark:text-slate-400 w-7 text-center flex-shrink-0">#${currentCount + 1}</span>
        <input type="text" name="statusItem" placeholder="e.g. 🚛 Nobility on the Roads" class="status-input flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#0F1219] border border-[#E1E2E4] dark:border-[#1E232E] text-[#4A2B1D] dark:text-white text-xs font-sans focus:outline-none focus:border-[#8C5137] transition-colors" required />
        <button type="button" class="remove-status-btn w-8 h-8 rounded-lg text-[#8C5137] dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0" title="Remove Message">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      `;

      statusContainer.appendChild(newRow);
      reindexRows();
      updatePreview();
      startPreviewTicker();

      const input = newRow.querySelector('.status-input');
      if (input) {
        input.focus();
        input.addEventListener('input', updatePreview);
      }
    });
  }

  // 6. Handle remove status row delegation
  if (statusContainer) {
    statusContainer.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.remove-status-btn');
      if (removeBtn) {
        const row = removeBtn.closest('.status-row');
        if (statusContainer.querySelectorAll('.status-row').length <= 1) {
          showDevToast('At least one status message is required.', 'error');
          return;
        }
        if (row) {
          row.remove();
          reindexRows();
          updatePreview();
          startPreviewTicker();
        }
      }
    });

    // Handle input change on existing status inputs
    statusContainer.querySelectorAll('.status-input').forEach(input => {
      input.addEventListener('input', updatePreview);
    });
  }

  // 7. Next preview button
  if (previewNextBtn) {
    previewNextBtn.addEventListener('click', () => {
      const statuses = getStatusInputs();
      if (statuses.length > 0) {
        previewIndex = (previewIndex + 1) % statuses.length;
        updatePreview();
      }
    });
  }

  // 8. Event listeners for form inputs
  if (statusTypeSelect) statusTypeSelect.addEventListener('change', updatePreview);
  if (onlineStatusSelect) onlineStatusSelect.addEventListener('change', updatePreview);
  if (streamingUrlInput) streamingUrlInput.addEventListener('input', updatePreview);
  if (intervalSlider) {
    intervalSlider.addEventListener('input', () => {
      updatePreview();
      startPreviewTicker();
    });
  }

  // Timeline preset button clicks
  form.querySelectorAll('.timeline-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = parseInt(btn.getAttribute('data-seconds'), 10);
      if (intervalSlider && sec) {
        intervalSlider.value = sec;
        updatePreview();
        startPreviewTicker();
      }
    });
  });

  form.querySelectorAll('input[name="statusMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updatePreview();
      startPreviewTicker();
    });
  });

  // 9. AJAX Submit Presence Form Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('save-bot-form-btn');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting to Discord...';
    }
    if (feedbackEl) feedbackEl.textContent = 'Broadcasting updates to Discord Gateway...';

    const statusType = statusTypeSelect ? statusTypeSelect.value : 'STREAMING';
    const streamingUrl = streamingUrlInput ? streamingUrlInput.value.trim() : 'https://twitch.tv/vintageclub';
    const onlineStatus = onlineStatusSelect ? onlineStatusSelect.value : 'online';
    const modeRadio = form.querySelector('input[name="statusMode"]:checked');
    const statusMode = modeRadio ? modeRadio.value : 'ROTATING';
    const rotationIntervalSeconds = intervalSlider ? parseInt(intervalSlider.value, 10) : 15;
    const statuses = getStatusInputs();

    if (statuses.length === 0) {
      showDevToast('Please enter at least one status message.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
      return;
    }

    try {
      const res = await fetch('/developer/api/bot/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusType,
          streamingUrl,
          onlineStatus,
          statusMode,
          rotationIntervalSeconds,
          statuses
        })
      });

      const json = await res.json();

      if (json.success) {
        showDevToast('Discord Bot presence broadcasted successfully!', 'success');
        if (feedbackEl) feedbackEl.textContent = `Last broadcasted at ${new Date().toLocaleTimeString()}`;
        updatePreview();
        startPreviewTicker();
      } else {
        showDevToast(json.error || 'Failed to update presence', 'error');
        if (feedbackEl) feedbackEl.textContent = 'Error: ' + (json.error || 'Unknown error');
      }
    } catch (err) {
      showDevToast('Network error: ' + err.message, 'error');
      if (feedbackEl) feedbackEl.textContent = 'Network error occurred.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // 10. Voice Channel 24/7 Controller Handlers
  const voiceEnabledToggle = document.getElementById('bot-voice-enabled');
  const guildIdInput = document.getElementById('bot-voice-guild-id');
  const channelIdInput = document.getElementById('bot-voice-channel-id');
  const selfDeafCheck = document.getElementById('bot-voice-self-deaf');
  const selfMuteCheck = document.getElementById('bot-voice-self-mute');
  const saveVoiceBtn = document.getElementById('save-connect-voice-btn');
  const disconnectVoiceBtn = document.getElementById('disconnect-voice-btn');
  const voiceFeedbackEl = document.getElementById('voice-action-feedback');
  const voiceStatusBadge = document.getElementById('voice-status-badge');
  const voiceStatusText = document.getElementById('voice-status-text');

  const updateVoiceBadge = (status) => {
    if (!voiceStatusBadge || !voiceStatusText) return;
    if (status && status.connected) {
      voiceStatusBadge.className = 'px-3 py-1 rounded-xl font-mono text-xs font-bold flex items-center gap-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      voiceStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>Connected: #${status.channelName || 'Voice Channel'}</span>`;
    } else {
      voiceStatusBadge.className = 'px-3 py-1 rounded-xl font-mono text-xs font-bold flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#13161D] text-[#8C5137] dark:text-slate-400 border border-[#E1E2E4] dark:border-[#262A36]';
      voiceStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span><span>No Voice Connection</span>`;
    }
  };

  if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener('click', async () => {
      const originalHtml = saveVoiceBtn.innerHTML;
      saveVoiceBtn.disabled = true;
      saveVoiceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
      if (voiceFeedbackEl) voiceFeedbackEl.textContent = 'Connecting to Discord voice channel...';

      const enabled = voiceEnabledToggle ? voiceEnabledToggle.checked : true;
      const guildId = guildIdInput ? guildIdInput.value.trim() : '';
      const channelId = channelIdInput ? channelIdInput.value.trim() : '';
      const selfDeaf = selfDeafCheck ? selfDeafCheck.checked : true;
      const selfMute = selfMuteCheck ? selfMuteCheck.checked : true;

      try {
        const res = await fetch('/developer/api/bot/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled,
            guildId,
            channelId,
            selfDeaf,
            selfMute,
            action: 'CONNECT'
          })
        });

        const json = await res.json();
        if (json.success) {
          showDevToast(json.message, 'success');
          if (voiceFeedbackEl) voiceFeedbackEl.textContent = json.message;
          updateVoiceBadge(json.voiceStatus);
        } else {
          showDevToast(json.error || json.message || 'Voice connection error', 'error');
          if (voiceFeedbackEl) voiceFeedbackEl.textContent = 'Error: ' + (json.error || json.message);
        }
      } catch (err) {
        showDevToast('Network error: ' + err.message, 'error');
      } finally {
        saveVoiceBtn.disabled = false;
        saveVoiceBtn.innerHTML = originalHtml;
      }
    });
  }

  if (disconnectVoiceBtn) {
    disconnectVoiceBtn.addEventListener('click', async () => {
      const originalHtml = disconnectVoiceBtn.innerHTML;
      disconnectVoiceBtn.disabled = true;
      disconnectVoiceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Disconnecting...';

      try {
        const res = await fetch('/developer/api/bot/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: false,
            action: 'DISCONNECT'
          })
        });

        const json = await res.json();
        if (json.success) {
          if (voiceEnabledToggle) voiceEnabledToggle.checked = false;
          showDevToast('Bot disconnected from voice channel.', 'info');
          if (voiceFeedbackEl) voiceFeedbackEl.textContent = 'Bot disconnected from voice channel.';
          updateVoiceBadge({ connected: false });
        }
      } catch (err) {
        showDevToast('Disconnection error: ' + err.message, 'error');
      } finally {
        disconnectVoiceBtn.disabled = false;
        disconnectVoiceBtn.innerHTML = originalHtml;
      }
    });
  }

  // Initial Run
  updatePreview();
  startPreviewTicker();
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
