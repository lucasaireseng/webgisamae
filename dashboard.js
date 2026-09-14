const GEOJSON_URL = encodeURI('ARQUIVO JGESON/GERAL.geojson');

const PALETTE = [
	'#00cc66', '#0099ff', '#ffcc00', '#ff6600', '#cc66ff',
	'#66cccc', '#ff3366', '#99cc33', '#3388ff', '#e60000',
	'#00aacc', '#ff9900', '#66ff99', '#aa66ff', '#cccc66'
];

const chartDefaults = {
	color: '#ffffff',
	borderColor: '#444444',
	plugins: {
		legend: {
			labels: {
				color: '#ffffff',
				font: { family: "'Times New Roman', Times, serif", size: 12 }
			}
		},
		tooltip: {
			backgroundColor: 'rgba(26,26,26,0.95)',
			titleColor: '#ffffff',
			bodyColor: '#cccccc',
			borderColor: '#666666',
			borderWidth: 1
		}
	}
};

Chart.defaults.color = '#cccccc';
Chart.defaults.font.family = "'Times New Roman', Times, serif";
Chart.defaults.borderColor = '#444444';

function cleanText(value) {
	if (value === null || value === undefined) return 'Não informado';
	const text = String(value).replace(/\s+/g, ' ').trim();
	return text || 'Não informado';
}

function getDateField(properties) {
	if (!properties) return null;
	if (properties['Data de\nAbertura'] !== undefined) return properties['Data de\nAbertura'];
	if (properties['Data de Abertura'] !== undefined) return properties['Data de Abertura'];
	const key = Object.keys(properties).find(k => /data.*abertura/i.test(k.replace(/\s+/g, ' ')));
	return key ? properties[key] : null;
}

function parseDate(value) {
	const text = String(value || '').trim();
	if (!text || text === '-') return null;
	const formats = [
		/^(\d{4})-(\d{2})-(\d{2})/,
		/^(\d{4})\/(\d{2})\/(\d{2})/,
		/^(\d{2})\/(\d{2})\/(\d{4})/,
		/^(\d{2})-(\d{2})-(\d{4})/
	];

	for (const format of formats) {
		const match = text.match(format);
		if (!match) continue;
		let year;
		let month;
		let day;
		if (format.source.startsWith('^(\\d{4})')) {
			year = Number(match[1]);
			month = Number(match[2]);
			day = Number(match[3]);
		} else {
			day = Number(match[1]);
			month = Number(match[2]);
			year = Number(match[3]);
		}
		const date = new Date(year, month - 1, day);
		if (!Number.isNaN(date.getTime())) return date;
	}
	return null;
}

function getPreviousMonthRange(referenceDate = new Date()) {
	const year = referenceDate.getFullYear();
	const month = referenceDate.getMonth(); // 0-11 current
	const start = new Date(year, month - 1, 1);
	const end = new Date(year, month, 0, 23, 59, 59, 999); // last day of previous month
	return { start, end };
}

function formatMonthLabel(date) {
	const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function filterLastMonth(records) {
	const { start, end } = getPreviousMonthRange(new Date());
	const filtered = records.filter(item => {
		const date = parseDate(getDateField(item));
		return date && date >= start && date <= end;
	});
	return { filtered, start, end };
}

function renderLastMonthAnalysis(records) {
	const { filtered, start } = filterLastMonth(records);
	const periodLabel = formatMonthLabel(start);
	document.getElementById('last-month-period').textContent =
		`Período: ${periodLabel} (mês civil anterior ao atual)`;
	document.getElementById('kpi-last-month').textContent = filtered.length.toLocaleString('pt-BR');

	const entries = sortEntries(countBy(filtered, 'Bairro'));
	const topEntries = entries.slice(0, 15).reverse();
	const total = filtered.length || 1;

	const canvas = document.getElementById('chart-bairro-mes');
	if (!filtered.length) {
		document.querySelector('#table-bairro-mes tbody').innerHTML =
			'<tr><td colspan="4">Nenhum registro encontrado no último mês.</td></tr>';
		new Chart(canvas, {
			type: 'bar',
			data: { labels: ['Sem dados'], datasets: [{ data: [0], backgroundColor: '#444444' }] },
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					x: { beginAtZero: true, ticks: { color: '#cccccc' }, grid: { color: 'rgba(255,255,255,0.08)' } },
					y: { ticks: { color: '#cccccc' }, grid: { color: 'rgba(255,255,255,0.05)' } }
				}
			}
		});
		return;
	}

	new Chart(canvas, {
		type: 'bar',
		data: {
			labels: topEntries.map(([label]) => label),
			datasets: [{
				label: 'Ocorrências',
				data: topEntries.map(([, value]) => value),
				backgroundColor: '#00cc66',
				borderColor: '#007a3d',
				borderWidth: 1
			}]
		},
		options: {
			indexAxis: 'y',
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				...chartDefaults.plugins,
				legend: { display: false }
			},
			scales: {
				x: {
					beginAtZero: true,
					ticks: { color: '#cccccc', precision: 0 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				},
				y: {
					ticks: { color: '#cccccc' },
					grid: { color: 'rgba(255,255,255,0.05)' }
				}
			}
		}
	});

	document.querySelector('#table-bairro-mes tbody').innerHTML = entries.map(([bairro, count], index) => `
		<tr>
			<td>${index + 1}</td>
			<td>${bairro}</td>
			<td>${count}</td>
			<td>${((count / total) * 100).toFixed(1).replace('.', ',')}%</td>
		</tr>
	`).join('');
}

function countBy(records, key) {
	const counts = {};
	records.forEach(item => {
		const label = cleanText(item[key]);
		counts[label] = (counts[label] || 0) + 1;
	});
	return counts;
}

function sortEntries(counts, limit) {
	const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	return typeof limit === 'number' ? entries.slice(0, limit) : entries;
}

function colorsFor(n) {
	const colors = [];
	for (let i = 0; i < n; i++) {
		colors.push(PALETTE[i % PALETTE.length]);
	}
	return colors;
}

function setStatus(message, isError) {
	const el = document.getElementById('dashboard-status');
	el.textContent = message;
	el.classList.toggle('error', Boolean(isError));
}

function renderKpis(records) {
	const bairros = new Set(records.map(r => cleanText(r.Bairro)));
	const assuntos = new Set(records.map(r => cleanText(r.Assunto)));
	const solicitantes = new Set(records.map(r => cleanText(r.Solicitante)));

	document.getElementById('kpi-total').textContent = records.length.toLocaleString('pt-BR');
	document.getElementById('kpi-bairros').textContent = bairros.size.toLocaleString('pt-BR');
	document.getElementById('kpi-assuntos').textContent = assuntos.size.toLocaleString('pt-BR');
	document.getElementById('kpi-solicitantes').textContent = solicitantes.size.toLocaleString('pt-BR');
}

function renderTemaChart(records) {
	const counts = countBy(records, 'Tema');
	const entries = sortEntries(counts);
	new Chart(document.getElementById('chart-tema'), {
		type: 'pie',
		data: {
			labels: entries.map(([label]) => label),
			datasets: [{
				data: entries.map(([, value]) => value),
				backgroundColor: colorsFor(entries.length),
				borderColor: '#1a1a1a',
				borderWidth: 2
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: chartDefaults.plugins
		}
	});
}

function renderAssuntoChart(records) {
	const entries = sortEntries(countBy(records, 'Assunto'));
	new Chart(document.getElementById('chart-assunto'), {
		type: 'bar',
		data: {
			labels: entries.map(([label]) => label),
			datasets: [{
				label: 'Registros',
				data: entries.map(([, value]) => value),
				backgroundColor: '#0099ff',
				borderColor: '#0066cc',
				borderWidth: 1
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				...chartDefaults.plugins,
				legend: { display: false }
			},
			scales: {
				x: {
					ticks: { color: '#cccccc', maxRotation: 45, minRotation: 0 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				},
				y: {
					beginAtZero: true,
					ticks: { color: '#cccccc', precision: 0 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				}
			}
		}
	});
}

function renderBairroChart(records) {
	const entries = sortEntries(countBy(records, 'Bairro'), 15).reverse();
	new Chart(document.getElementById('chart-bairro'), {
		type: 'bar',
		data: {
			labels: entries.map(([label]) => label),
			datasets: [{
				label: 'Registros',
				data: entries.map(([, value]) => value),
				backgroundColor: '#ffcc00',
				borderColor: '#c9a000',
				borderWidth: 1
			}]
		},
		options: {
			indexAxis: 'y',
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				...chartDefaults.plugins,
				legend: { display: false }
			},
			scales: {
				x: {
					beginAtZero: true,
					ticks: { color: '#cccccc', precision: 0 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				},
				y: {
					ticks: { color: '#cccccc' },
					grid: { color: 'rgba(255,255,255,0.05)' }
				}
			}
		}
	});
}

function filterLast30Days(records, referenceDate = new Date()) {
	const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);
	const start = new Date(end);
	start.setDate(start.getDate() - 29);
	start.setHours(0, 0, 0, 0);

	const filtered = records.filter(item => {
		const date = parseDate(getDateField(item));
		return date && date >= start && date <= end;
	});

	return { filtered, start, end };
}

function formatDayLabel(date) {
	return date.toLocaleDateString('pt-BR');
}

function renderLast30DaysBairroChart(records) {
	const { filtered, start, end } = filterLast30Days(records);
	const periodEl = document.getElementById('last30-period');
	if (periodEl) {
		periodEl.textContent =
			`De ${formatDayLabel(start)} a ${formatDayLabel(end)} · ${filtered.length} registro(s)`;
	}

	const entries = sortEntries(countBy(filtered, 'Bairro'), 15).reverse();
	const canvas = document.getElementById('chart-bairro-30dias');

	if (!filtered.length) {
		new Chart(canvas, {
			type: 'bar',
			data: {
				labels: ['Sem dados'],
				datasets: [{ data: [0], backgroundColor: '#444444' }]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					x: { beginAtZero: true, ticks: { color: '#cccccc' }, grid: { color: 'rgba(255,255,255,0.08)' } },
					y: { ticks: { color: '#cccccc' }, grid: { color: 'rgba(255,255,255,0.05)' } }
				}
			}
		});
		return;
	}

	new Chart(canvas, {
		type: 'bar',
		data: {
			labels: entries.map(([label]) => label),
			datasets: [{
				label: 'Ocorrências (30 dias)',
				data: entries.map(([, value]) => value),
				backgroundColor: '#0099ff',
				borderColor: '#0066cc',
				borderWidth: 1
			}]
		},
		options: {
			indexAxis: 'y',
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				...chartDefaults.plugins,
				legend: { display: false }
			},
			scales: {
				x: {
					beginAtZero: true,
					ticks: { color: '#cccccc', precision: 0 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				},
				y: {
					ticks: { color: '#cccccc' },
					grid: { color: 'rgba(255,255,255,0.05)' }
				}
			}
		}
	});
}

function renderTemaAssuntoChart(records) {
	const assuntos = sortEntries(countBy(records, 'Assunto')).map(([label]) => label);
	const temas = sortEntries(countBy(records, 'Tema')).map(([label]) => label);

	const datasets = temas.map((tema, index) => {
		const data = assuntos.map(assunto =>
			records.filter(r => cleanText(r.Tema) === tema && cleanText(r.Assunto) === assunto).length
		);
		return {
			label: tema,
			data,
			backgroundColor: PALETTE[index % PALETTE.length],
			stack: 'tema'
		};
	});

	new Chart(document.getElementById('chart-tema-assunto'), {
		type: 'bar',
		data: {
			labels: assuntos,
			datasets
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: chartDefaults.plugins,
			scales: {
				x: {
					stacked: true,
					ticks: { color: '#cccccc', maxRotation: 45 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				},
				y: {
					stacked: true,
					beginAtZero: true,
					ticks: { color: '#cccccc', precision: 0 },
					grid: { color: 'rgba(255,255,255,0.08)' }
				}
			}
		}
	});
}

function renderBairroTable(records) {
	const byBairro = {};
	records.forEach(r => {
		const bairro = cleanText(r.Bairro);
		const tema = cleanText(r.Tema).toUpperCase();
		if (!byBairro[bairro]) {
			byBairro[bairro] = { total: 0, agua: 0, esgoto: 0 };
		}
		byBairro[bairro].total += 1;
		if (tema.includes('GUA') || tema === 'ÁGUA' || tema === 'AGUA') {
			byBairro[bairro].agua += 1;
		} else if (tema.includes('ESGOTO')) {
			byBairro[bairro].esgoto += 1;
		}
	});

	const rows = Object.entries(byBairro)
		.sort((a, b) => b[1].total - a[1].total)
		.map(([bairro, stats]) => `
			<tr>
				<td>${bairro}</td>
				<td>${stats.total}</td>
				<td>${stats.agua}</td>
				<td>${stats.esgoto}</td>
			</tr>
		`).join('');

	document.querySelector('#table-bairros tbody').innerHTML = rows;
}

async function initDashboard() {
	try {
		const response = await fetch(GEOJSON_URL);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const geojson = await response.json();
		const records = (geojson.features || []).map(f => f.properties || {});

		if (!records.length) {
			setStatus('Nenhum registro encontrado na camada GERAL.', true);
			return;
		}

		renderKpis(records);
		renderLastMonthAnalysis(records);
		renderTemaChart(records);
		renderAssuntoChart(records);
		renderBairroChart(records);
		renderLast30DaysBairroChart(records);
		renderTemaAssuntoChart(records);
		renderBairroTable(records);

		setStatus(`Dados carregados: ${records.length.toLocaleString('pt-BR')} registros da camada GERAL.`);
	} catch (error) {
		console.error(error);
		setStatus(`Erro no Dashboard: ${error.message}`, true);
	}
}

initDashboard();
