/**
 * Exportação PDF A4 Paisagem — WebGIS AMAE
 * Layout: logo AMAE, título, data/hora, cena do mapa, norte, escala e legenda dinâmica.
 */
(function () {
	const LAYER_LEGEND = [
		{ id: 'geral', label: 'GERAL', color: '#00cc66' },
		{ id: 'agua', label: 'ÁGUA', color: '#0066cc' },
		{ id: 'bairros', label: 'BAIRROS', color: '#ffeb3b' },
		{ id: 'bacias', label: 'BACIAS DE ABASTECIMENTO', color: '#00aacc' },
		{ id: 'rede-agua', label: 'REDE DE ÁGUA', color: '#0099ff' },
		{ id: 'rede-esgoto', label: 'REDE DE ESGOTO', color: '#ff0000' },
		{ id: 'esgoto', label: 'ESGOTO (Mapa de Calor)', color: '#ff6600' }
	];

	function getJsPDF() {
		if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
		if (window.jsPDF) return window.jsPDF;
		return null;
	}

	function formatEmissionDate(date = new Date()) {
		return date.toLocaleString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function getActiveLegendItems() {
		return LAYER_LEGEND.filter(item => {
			if (item.id === 'esgoto') {
				const heatOn = typeof esgotoHeatLayer !== 'undefined' &&
					esgotoHeatLayer &&
					map.hasLayer(esgotoHeatLayer);
				const pointsOn = layerGroups['esgoto'] && map.hasLayer(layerGroups['esgoto']);
				return heatOn || pointsOn;
			}
			const layer = layerGroups[item.id];
			return layer && map.hasLayer(layer);
		});
	}

	function niceScaleLength(meters) {
		const candidates = [
			10, 20, 25, 50, 100, 200, 250, 500,
			1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000
		];
		let best = candidates[0];
		for (const value of candidates) {
			if (value <= meters) best = value;
			else break;
		}
		return best;
	}

	function formatScaleLabel(meters) {
		if (meters >= 1000) {
			const km = meters / 1000;
			return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
		}
		return `${meters} m`;
	}

	function getScaleBarInfo(targetPx = 120) {
		const size = map.getSize();
		const y = size.y / 2;
		const left = map.containerPointToLatLng([0, y]);
		const right = map.containerPointToLatLng([targetPx, y]);
		const metersForTarget = map.distance(left, right);
		const niceMeters = niceScaleLength(metersForTarget);
		const px = (niceMeters / metersForTarget) * targetPx;
		return {
			meters: niceMeters,
			label: formatScaleLabel(niceMeters),
			widthPx: px,
			ratioText: `1:${Math.round((metersForTarget / targetPx) * 1000 * 96 / 25.4).toLocaleString('pt-BR')}`
		};
	}

	function loadImageDataUrl(src) {
		return fetch(src)
			.then(response => {
				if (!response.ok) throw new Error(`Falha ao carregar ${src}`);
				return response.blob();
			})
			.then(blob => new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			}));
	}

	function captureMapCanvas() {
		const mapEl = document.getElementById('map');
		const controls = mapEl.querySelector('.leaflet-control-container');
		const previousDisplay = controls ? controls.style.display : '';
		if (controls) controls.style.display = 'none';

		map.invalidateSize({ animate: false });

		return html2canvas(mapEl, {
			useCORS: true,
			allowTaint: false,
			logging: false,
			scale: Math.min(2, window.devicePixelRatio || 1.5),
			backgroundColor: '#111111',
			foreignObjectRendering: false,
			imageTimeout: 15000,
			onclone: (clonedDoc) => {
				const clonedMap = clonedDoc.getElementById('map');
				if (clonedMap) {
					clonedMap.style.left = '0';
					clonedMap.style.top = '0';
					clonedMap.style.width = mapEl.clientWidth + 'px';
					clonedMap.style.height = mapEl.clientHeight + 'px';
					clonedMap.style.position = 'relative';
				}
			}
		}).finally(() => {
			if (controls) controls.style.display = previousDisplay;
		});
	}

	function drawNorthArrow(doc, x, y, size = 12) {
		doc.setDrawColor(30);
		doc.setFillColor(30);
		doc.setLineWidth(0.4);

		// Agulha norte (triângulo)
		doc.triangle(x, y - size, x - size * 0.35, y + size * 0.15, x + size * 0.35, y + size * 0.15, 'F');
		// Base
		doc.setFillColor(220);
		doc.triangle(x, y + size * 0.55, x - size * 0.35, y + size * 0.15, x + size * 0.35, y + size * 0.15, 'FD');

		doc.setFont('helvetica', 'bold');
		doc.setFontSize(9);
		doc.setTextColor(20);
		doc.text('N', x, y - size - 2, { align: 'center' });
	}

	function drawScaleBar(doc, x, y, scaleInfo) {
		const barWidthMm = Math.max(18, Math.min(50, scaleInfo.widthPx * 0.2));
		const barHeight = 2.2;

		doc.setDrawColor(20);
		doc.setFillColor(255);
		doc.rect(x, y, barWidthMm, barHeight, 'FD');
		doc.setFillColor(20);
		doc.rect(x, y, barWidthMm / 2, barHeight, 'F');

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.setTextColor(20);
		doc.text(`Escala: ${scaleInfo.label}`, x, y - 1.5);
		doc.text('0', x, y + barHeight + 3.5);
		doc.text(scaleInfo.label, x + barWidthMm, y + barHeight + 3.5, { align: 'right' });
	}

	function drawLegend(doc, x, y, maxWidth, items) {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(9);
		doc.setTextColor(20);
		doc.text('Legenda (camadas ativas)', x, y);

		let cursorY = y + 5;
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);

		if (!items.length) {
			doc.setTextColor(80);
			doc.text('Nenhuma camada operacional ativa.', x, cursorY);
			return cursorY + 4;
		}

		items.forEach(item => {
			const rgb = hexToRgb(item.color);
			doc.setFillColor(rgb.r, rgb.g, rgb.b);
			doc.setDrawColor(40);
			doc.rect(x, cursorY - 2.2, 4, 3, 'FD');
			doc.setTextColor(20);
			const lines = doc.splitTextToSize(item.label, maxWidth - 7);
			doc.text(lines, x + 6, cursorY);
			cursorY += Math.max(5, lines.length * 3.5);
		});

		return cursorY;
	}

	function hexToRgb(hex) {
		const normalized = hex.replace('#', '');
		const full = normalized.length === 3
			? normalized.split('').map(c => c + c).join('')
			: normalized;
		const num = parseInt(full, 16);
		return {
			r: (num >> 16) & 255,
			g: (num >> 8) & 255,
			b: num & 255
		};
	}

	async function exportMapToPdf() {
		const JsPDF = getJsPDF();
		if (!JsPDF || typeof html2canvas !== 'function') {
			alert('Bibliotecas de exportação PDF não carregaram. Recarregue a página.');
			return;
		}

		const btn = document.getElementById('btn-export-pdf');
		const originalText = btn ? btn.textContent : '';
		if (btn) {
			btn.disabled = true;
			btn.textContent = 'Gerando PDF…';
		}

		try {
			const [logoDataUrl, mapCanvas] = await Promise.all([
				loadImageDataUrl('LOGO/AMAEGIS.jpg'),
				captureMapCanvas()
			]);

			const doc = new JsPDF({
				orientation: 'landscape',
				unit: 'mm',
				format: 'a4'
			});

			const pageW = doc.internal.pageSize.getWidth();
			const pageH = doc.internal.pageSize.getHeight();
			const margin = 10;

			// Fundo do layout
			doc.setFillColor(248, 248, 248);
			doc.rect(0, 0, pageW, pageH, 'F');

			// Cabeçalho
			const headerH = 24;
			doc.setFillColor(26, 26, 26);
			doc.rect(0, 0, pageW, headerH, 'F');

			try {
				doc.addImage(logoDataUrl, 'JPEG', margin, 3.5, 16, 16);
			} catch (e) {
				console.warn('Logo não inserida no PDF:', e);
			}

			doc.setTextColor(255, 255, 255);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(13);
			doc.text(
				'WebGIS AMAE – Sistema de Informações Geográficas (Rio Verde/GO)',
				margin + 20,
				10
			);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.text(`Emissão: ${formatEmissionDate()}`, margin + 20, 16);

			// Área do mapa
			const mapTop = headerH + 6;
			const footerH = 36;
			const mapBottom = pageH - margin - footerH;
			const mapAreaH = mapBottom - mapTop;
			const mapAreaW = pageW - margin * 2;

			const imgW = mapCanvas.width;
			const imgH = mapCanvas.height;
			const imgRatio = imgW / imgH;
			const boxRatio = mapAreaW / mapAreaH;

			let drawW;
			let drawH;
			if (imgRatio > boxRatio) {
				drawW = mapAreaW;
				drawH = mapAreaW / imgRatio;
			} else {
				drawH = mapAreaH;
				drawW = mapAreaH * imgRatio;
			}

			const mapX = margin + (mapAreaW - drawW) / 2;
			const mapY = mapTop + (mapAreaH - drawH) / 2;

			doc.setDrawColor(60);
			doc.setLineWidth(0.3);
			doc.rect(mapX - 0.5, mapY - 0.5, drawW + 1, drawH + 1);

			const mapImg = mapCanvas.toDataURL('image/jpeg', 0.92);
			doc.addImage(mapImg, 'JPEG', mapX, mapY, drawW, drawH);

			// Norte geográfico (canto superior direito do mapa)
			drawNorthArrow(doc, mapX + drawW - 10, mapY + 14, 8);

			// Rodapé cartográfico
			const footerY = pageH - footerH;
			doc.setFillColor(255, 255, 255);
			doc.setDrawColor(180);
			doc.rect(margin, footerY, pageW - margin * 2, footerH - 4, 'FD');

			const scaleInfo = getScaleBarInfo(140);
			drawScaleBar(doc, margin + 4, footerY + 10, scaleInfo);

			const legendItems = getActiveLegendItems();
			drawLegend(doc, margin + 70, footerY + 6, pageW - margin * 2 - 75, legendItems);

			const fileName = `WebGIS_AMAE_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
			doc.save(fileName);
		} catch (error) {
			console.error('Erro ao exportar PDF:', error);
			alert('Não foi possível gerar o PDF. Tente novamente ou use outro mapa de fundo (ESRI).');
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.textContent = originalText || 'Exportar PDF';
			}
		}
	}

	document.addEventListener('DOMContentLoaded', function () {
		const btn = document.getElementById('btn-export-pdf');
		if (btn) {
			btn.addEventListener('click', exportMapToPdf);
		}
	});
})();
