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
  initDiscordBotController();
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
   6. Discord Bot Presence & Live Simulator Controller
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
  const saveTopBtn = document.getElementById('save-bot-settings-top-btn');
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
        previewStatusIndicator.className = 'absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#2B2D31] bg-[#593695] flex items-center justify-center text-[10px] text-white';
        previewStatusIndicator.innerHTML = '<i class="fa-solid fa-tower-broadcast text-[8px]"></i>';
      } else if (online === 'online') {
        previewStatusIndicator.className = 'absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#2B2D31] bg-emerald-500';
        previewStatusIndicator.innerHTML = '';
      } else if (online === 'idle') {
        previewStatusIndicator.className = 'absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#2B2D31] bg-amber-500';
        previewStatusIndicator.innerHTML = '';
      } else if (online === 'dnd') {
        previewStatusIndicator.className = 'absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#2B2D31] bg-rose-500';
        previewStatusIndicator.innerHTML = '';
      } else {
        previewStatusIndicator.className = 'absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#2B2D31] bg-slate-500';
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
      previewActivityIconBox.className = `w-9 h-9 rounded-lg ${conf.bg} text-white flex items-center justify-center flex-shrink-0 text-sm shadow-md`;
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
      newRow.className = 'status-row flex items-center gap-2 p-2.5 rounded-xl bg-[#151922] border border-[#1E232E] group animate-fadeIn';
      newRow.innerHTML = `
        <span class="row-index text-[11px] font-mono font-bold text-slate-500 w-6 text-center">#${currentCount + 1}</span>
        <input type="text" name="statusItem" placeholder="e.g. 🚛 Nobility on the Roads" class="status-input flex-1 px-3 py-1.5 rounded-lg bg-[#0F1219] border border-[#1E232E] text-white text-xs font-sans focus:outline-none focus:border-[#8C5137] transition-colors" required />
        <button type="button" class="remove-status-btn w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer" title="Remove Message">
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
        input.addEventListener('input', () => {
          updatePreview();
        });
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
      input.addEventListener('input', () => {
        updatePreview();
      });
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

  // 9. Save Top Button Trigger
  if (saveTopBtn) {
    saveTopBtn.addEventListener('click', () => {
      form.requestSubmit();
    });
  }

  // 10. AJAX Submit Form Handler
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
        showDevToast('Discord Bot presence updated & live broadcast active!', 'success');
        if (feedbackEl) feedbackEl.textContent = `Last saved at ${new Date().toLocaleTimeString()}`;
        updatePreview();
        startPreviewTicker();
      } else {
        showDevToast(json.error || 'Failed to update presence', 'error');
        if (feedbackEl) feedbackEl.textContent = 'Save failed: ' + (json.error || 'Unknown error');
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

  // 11. Voice Channel 24/7 Controller Handlers
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
      voiceStatusBadge.className = 'px-3 py-1 rounded-xl font-mono text-xs font-bold flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      voiceStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Bağlı: #${status.channelName || 'Ses Kanalı'}</span>`;
    } else {
      voiceStatusBadge.className = 'px-3 py-1 rounded-xl font-mono text-xs font-bold flex items-center gap-2 bg-[#151922] text-slate-400 border border-[#1E232E]';
      voiceStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span><span>Ses Bağlantısı Yok</span>`;
    }
  };

  if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener('click', async () => {
      const originalHtml = saveVoiceBtn.innerHTML;
      saveVoiceBtn.disabled = true;
      saveVoiceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlanıyor...';
      if (voiceFeedbackEl) voiceFeedbackEl.textContent = 'Ses kanalına bağlanılıyor...';

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
          showDevToast(json.error || json.message || 'Ses bağlantı hatası', 'error');
          if (voiceFeedbackEl) voiceFeedbackEl.textContent = 'Hata: ' + (json.error || json.message);
        }
      } catch (err) {
        showDevToast('Ağ hatası: ' + err.message, 'error');
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
      disconnectVoiceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ayrılıyor...';

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
          showDevToast('Bot ses kanalından ayrıldı.', 'info');
          if (voiceFeedbackEl) voiceFeedbackEl.textContent = 'Bot ses kanalından ayrıldı.';
          updateVoiceBadge({ connected: false });
        }
      } catch (err) {
        showDevToast('Ayrılma hatası: ' + err.message, 'error');
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
