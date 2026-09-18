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

		window.dadosDashboardGeral = records;
		setStatus(`Dados carregados: ${records.length.toLocaleString('pt-BR')} registros da camada GERAL.`);
	} catch (error) {
		console.error(error);
		setStatus(`Erro no Dashboard: ${error.message}`, true);
	}
}

initDashboard();

/* ========== Relatório Executivo PDF ========== */

function loadImageAsDataUrl(url) {
	return fetch(encodeURI(url))
		.then(response => {
			if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
			return response.blob();
		})
		.then(blob => new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		}))
		.catch(() => null);
}

function ensureReportSpace(doc, currentY, needed = 42) {
	const pageH = doc.internal.pageSize.getHeight();
	if (currentY + needed > pageH - 14) {
		doc.addPage();
		return 18;
	}
	return currentY;
}

function addReportSectionTitle(doc, title, y, primaryColor) {
	y = ensureReportSpace(doc, y, 20);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	doc.setTextColor(...primaryColor);
	doc.text(title, 14, y);
	return y + 5;
}

function addReportDescriptiveText(doc, texto, y) {
	doc.setFont('helvetica', 'italic');
	doc.setFontSize(9);
	doc.setTextColor(80, 80, 80);
	const linhas = doc.splitTextToSize(texto, 182);
	y = ensureReportSpace(doc, y, linhas.length * 4 + 6);
	doc.text(linhas, 14, y);
	return y + (linhas.length * 4) + 2;
}

async function gerarRelatorioDashboard(dadosGeral) {
	if (!window.jspdf || !window.jspdf.jsPDF) {
		alert('Biblioteca jsPDF não carregou. Recarregue a página.');
		return;
	}

	const { jsPDF } = window.jspdf;
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

	const primaryColor = [0, 102, 204];
	const textColor = [40, 40, 40];
	const btn = document.getElementById('btn-gerar-relatorio');
	const originalText = btn ? btn.textContent : '';

	if (btn) {
		btn.disabled = true;
		btn.textContent = 'Gerando relatório…';
	}

	try {
		const [logoRioVerde, logoAmae] = await Promise.all([
			loadImageAsDataUrl('LOGO/LOGO RIO VERDE.png'),
			loadImageAsDataUrl('LOGO/AMAEGIS.jpg')
		]);

		// Cabeçalho institucional — logos lado a lado
		if (logoAmae) doc.addImage(logoAmae, 'JPEG', 14, 8, 22, 16);
		if (logoRioVerde) doc.addImage(logoRioVerde, 'PNG', 40, 8, 22, 16);

		doc.setFont('helvetica', 'bold');
		doc.setFontSize(14);
		doc.setTextColor(...textColor);
		doc.text('WebGIS AMAE - Rio Verde/GO', 105, 14, { align: 'center' });

		doc.setFontSize(10);
		doc.setFont('helvetica', 'normal');
		doc.text('Relatório Analítico Executivo com Diagnóstico de Dados', 105, 20, { align: 'center' });
		doc.setFontSize(8);
		doc.setTextColor(100);
		doc.text('Origem dos dados: camada GERAL — Rio Verde/GO', 105, 25, { align: 'center' });

		const dataEmissao = new Date().toLocaleString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
		doc.text(`Gerado em: ${dataEmissao}`, 105, 29, { align: 'center' });

		doc.setDrawColor(200);
		doc.line(14, 32, 196, 32);

		let currentY = 38;

		// Processamento com campos reais do Dashboard
		const bairrosUltimoMes = {};
		const distribuicaoTema = {};
		const registrosAssunto = {};
		const temaXassunto = {};
		const resumoBairro = {};

		const { filtered: registros30dias, start: inicio30, end: fim30 } = filterLast30Days(dadosGeral);

		registros30dias.forEach(props => {
			const bairro = cleanText(props.Bairro);
			bairrosUltimoMes[bairro] = (bairrosUltimoMes[bairro] || 0) + 1;
		});

		dadosGeral.forEach(props => {
			const bairro = cleanText(props.Bairro);
			const tema = cleanText(props.Tema);
			const assunto = cleanText(props.Assunto);

			distribuicaoTema[tema] = (distribuicaoTema[tema] || 0) + 1;
			registrosAssunto[assunto] = (registrosAssunto[assunto] || 0) + 1;

			if (!temaXassunto[tema]) temaXassunto[tema] = {};
			temaXassunto[tema][assunto] = (temaXassunto[tema][assunto] || 0) + 1;

			if (!resumoBairro[bairro]) resumoBairro[bairro] = { total: 0, temas: {} };
			resumoBairro[bairro].total += 1;
			resumoBairro[bairro].temas[tema] = (resumoBairro[bairro].temas[tema] || 0) + 1;
		});

		const totalGeral = dadosGeral.length || 1;
		const periodo30 = `${inicio30.toLocaleDateString('pt-BR')} a ${fim30.toLocaleDateString('pt-BR')}`;

		const tableOptions = {
			headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
			theme: 'striped',
			margin: { left: 14, right: 14 },
			styles: { font: 'helvetica', fontSize: 8, textColor: textColor },
			alternateRowStyles: { fillColor: [245, 248, 252] }
		};

		// 1. Recorrência por Bairro — Último Mês / 30 dias
		currentY = addReportSectionTitle(doc, '1. Recorrência por Bairro — Último Mês', currentY, primaryColor);

		const topBairrosMes = Object.entries(bairrosUltimoMes).sort((a, b) => b[1] - a[1]);
		const nomeTopBairroMes = topBairrosMes[0] ? topBairrosMes[0][0] : 'Nenhum';
		const qtdTopBairroMes = topBairrosMes[0] ? topBairrosMes[0][1] : 0;

		const texto1 = `Análise Temporal (${periodo30}): Nos últimos 30 dias, o bairro com maior incidência de demandas foi ${nomeTopBairroMes}, concentrando ${qtdTopBairroMes} ocorrência(s) de um total de ${registros30dias.length} registro(s) no período. Recomenda-se atenção especial das equipes operacionais a esta localidade.`;
		currentY = addReportDescriptiveText(doc, texto1, currentY);

		doc.autoTable({
			...tableOptions,
			startY: currentY,
			head: [['#', 'Bairro', 'Ocorrências (Últimos 30 dias)']],
			body: topBairrosMes.slice(0, 5).map(([b, c], i) => [(i + 1).toString(), b, c.toString()])
		});
		currentY = doc.lastAutoTable.finalY + 10;

		// 2. Distribuição por Tema
		currentY = addReportSectionTitle(doc, '2. Distribuição por Tema', currentY, primaryColor);

		const temasOrdenados = Object.entries(distribuicaoTema).sort((a, b) => b[1] - a[1]);
		const temaPrincipal = temasOrdenados[0] ? temasOrdenados[0][0] : 'Geral';
		const percTemaPrincipal = temasOrdenados[0]
			? ((temasOrdenados[0][1] / totalGeral) * 100).toFixed(1).replace('.', ',')
			: '0';

		const texto2 = `Diagnóstico Temático: O total de registros analisados é de ${totalGeral.toLocaleString('pt-BR')}. A categoria predominante é "${temaPrincipal}", representando ${percTemaPrincipal}% de todas as chamadas cadastradas na camada GERAL.`;
		currentY = addReportDescriptiveText(doc, texto2, currentY);

		doc.autoTable({
			...tableOptions,
			startY: currentY,
			head: [['Tema', 'Total de Registros', 'Percentual']],
			body: temasOrdenados.map(([t, c]) => [
				t,
				c.toString(),
				`${((c / totalGeral) * 100).toFixed(1).replace('.', ',')}%`
			])
		});
		currentY = doc.lastAutoTable.finalY + 10;

		// 3. Registros por Assunto
		currentY = addReportSectionTitle(doc, '3. Registros por Assunto', currentY, primaryColor);

		const assuntosOrdenados = Object.entries(registrosAssunto).sort((a, b) => b[1] - a[1]);
		const assuntoPrincipal = assuntosOrdenados[0] ? assuntosOrdenados[0][0] : 'Indefinido';
		const qtdAssuntoPrincipal = assuntosOrdenados[0] ? assuntosOrdenados[0][1] : 0;

		const texto3 = `Detalhamento de Demandas: O assunto de maior frequência registrada no sistema é "${assuntoPrincipal}", totalizando ${qtdAssuntoPrincipal.toLocaleString('pt-BR')} solicitação(ões).`;
		currentY = addReportDescriptiveText(doc, texto3, currentY);

		doc.autoTable({
			...tableOptions,
			startY: currentY,
			head: [['Assunto', 'Total']],
			body: assuntosOrdenados.slice(0, 10).map(([a, c]) => [a, c.toString()])
		});

		// Página 2 — seções 4 e 5
		doc.addPage();
		currentY = 20;

		// 4. Cruzamento Tema × Assunto
		currentY = addReportSectionTitle(doc, '4. Cruzamento: Tema × Assunto', currentY, primaryColor);

		const texto4 = 'Matriz de Correlação: Desdobramento das demandas específicas agrupadas dentro de cada tema principal, permitindo identificar as causas específicas dos chamados operacionais e orientar ações de prevenção.';
		currentY = addReportDescriptiveText(doc, texto4, currentY);

		const dataMatriz = [];
		Object.keys(temaXassunto).sort().forEach(tema => {
			Object.entries(temaXassunto[tema])
				.sort((a, b) => b[1] - a[1])
				.forEach(([assunto, count]) => {
					dataMatriz.push([tema, assunto, count.toString()]);
				});
		});

		doc.autoTable({
			...tableOptions,
			startY: currentY,
			head: [['Tema', 'Assunto', 'Quantidade']],
			body: dataMatriz,
			showHead: 'everyPage'
		});
		currentY = doc.lastAutoTable.finalY + 10;

		// 5. Resumo Geral por Bairro
		currentY = ensureReportSpace(doc, currentY, 35);
		currentY = addReportSectionTitle(doc, '5. Resumo Geral por Bairro', currentY, primaryColor);

		const totalBairrosUnicos = Object.keys(resumoBairro).length;
		const texto5 = `Panorama Territorial: Existem registros ativos em ${totalBairrosUnicos} bairro(s) de Rio Verde/GO. A tabela a seguir consolida o volume acumulado e identifica o tema predominante em cada área.`;
		currentY = addReportDescriptiveText(doc, texto5, currentY);

		const dataResumoBairro = Object.entries(resumoBairro)
			.sort((a, b) => b[1].total - a[1].total)
			.map(([bairro, info]) => {
				const temaPredominante = Object.entries(info.temas).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
				return [bairro, info.total.toString(), temaPredominante];
			});

		doc.autoTable({
			...tableOptions,
			startY: currentY,
			head: [['Bairro', 'Total Acumulado', 'Tema Predominante']],
			body: dataResumoBairro,
			showHead: 'everyPage'
		});

		const fileName = `Relatorio_Analitico_AMAE_${new Date().toISOString().slice(0, 10)}.pdf`;
		doc.save(fileName);
	} catch (error) {
		console.error('Erro ao gerar relatório:', error);
		alert('Não foi possível gerar o relatório. Verifique o console para detalhes.');
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = originalText.trim() || 'Gerar Relatório Executivo (PDF)';
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const btnRelatorio = document.getElementById('btn-gerar-relatorio');
	if (btnRelatorio) {
		btnRelatorio.addEventListener('click', () => {
			if (window.dadosDashboardGeral && window.dadosDashboardGeral.length) {
				gerarRelatorioDashboard(window.dadosDashboardGeral);
			} else {
				alert('Aguarde o carregamento dos dados do Dashboard.');
			}
		});
	}
});
