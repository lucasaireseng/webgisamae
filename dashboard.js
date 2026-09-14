const GEOJSON_URL = 'ARQUIVO JGESON/GERAL.geojson';

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

function renderSolicitanteChart(records) {
	const entries = sortEntries(countBy(records, 'Solicitante'));
	new Chart(document.getElementById('chart-solicitante'), {
		type: 'doughnut',
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
			plugins: chartDefaults.plugins,
			cutout: '55%'
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
		renderTemaChart(records);
		renderAssuntoChart(records);
		renderBairroChart(records);
		renderSolicitanteChart(records);
		renderTemaAssuntoChart(records);
		renderBairroTable(records);

		setStatus(`Dados carregados: ${records.length.toLocaleString('pt-BR')} registros da camada GERAL.`);
	} catch (error) {
		console.error(error);
		setStatus('Erro ao carregar a camada GERAL. Verifique o arquivo GeoJSON.', true);
	}
}

initDashboard();
