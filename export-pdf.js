/**
 * Exportação PDF A4 Paisagem — WebGIS AMAE
 * Layout: logo AMAE, título, data/hora, cena do mapa, norte, escala e legenda dinâmica.
 */
(function () {
	const LAYER_LEGEND = [
		{ id: 'geral', label: 'GERAL', color: '#00cc66' },
		{ id: 'agua', label: 'ÁGUA', color: '#0066cc' },
		{ id: 'esgoto', label: 'ESGOTO', color: '#cc6600' },
		{ id: 'bairros', label: 'BAIRROS', color: '#ffeb3b' },
		{ id: 'bacias', label: 'BACIAS DE ABASTECIMENTO', color: '#00aacc' },
		{ id: 'rede-agua', label: 'REDE DE ÁGUA', color: '#0099ff' },
		{ id: 'rede-esgoto', label: 'REDE DE ESGOTO', color: '#ff0000' },
		{ id: 'esgoto-calor', label: 'ESGOTO (Mapa de Calor)', color: '#ff6600' }
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
			if (item.id === 'esgoto-calor') {
				return typeof esgotoHeatLayer !== 'undefined' &&
					esgotoHeatLayer &&
					map.hasLayer(esgotoHeatLayer);
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
			widthPx: px
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

	function parseTranslate(transform) {
		if (!transform || transform === 'none') return { x: 0, y: 0 };
		const m3 = transform.match(/matrix3d\((.+)\)/);
		if (m3) {
			const v = m3[1].split(',').map(Number);
			return { x: v[12] || 0, y: v[13] || 0 };
		}
		const m2 = transform.match(/matrix\((.+)\)/);
		if (m2) {
			const v = m2[1].split(',').map(Number);
			return { x: v[4] || 0, y: v[5] || 0 };
		}
		const t = transform.match(/translate3d\(([^,]+),\s*([^,]+)/);
		if (t) return { x: parseFloat(t[1]) || 0, y: parseFloat(t[2]) || 0 };
		const t2 = transform.match(/translate\(([^,]+),\s*([^)]+)/);
		if (t2) return { x: parseFloat(t2[1]) || 0, y: parseFloat(t2[2]) || 0 };
		return { x: 0, y: 0 };
	}

	/** Converte transform do Leaflet em left/top — necessário para html2canvas */
	function freezeLeafletTransforms(root) {
		const restore = [];
		const selectors = [
			'.leaflet-map-pane',
			'.leaflet-tile-container',
			'.leaflet-overlay-pane',
			'.leaflet-marker-pane',
			'.leaflet-shadow-pane',
			'.leaflet-tooltip-pane',
			'.leaflet-popup-pane'
		];

		root.querySelectorAll(selectors.join(',')).forEach(el => {
			const style = window.getComputedStyle(el);
			const transform = el.style.transform || style.transform;
			if (!transform || transform === 'none') return;

			const { x, y } = parseTranslate(transform);
			restore.push({
				el,
				transform: el.style.transform,
				left: el.style.left,
				top: el.style.top
			});
			el.style.transform = 'none';
			el.style.left = `${(parseFloat(el.style.left) || 0) + x}px`;
			el.style.top = `${(parseFloat(el.style.top) || 0) + y}px`;
		});

		return function unfreeze() {
			restore.forEach(item => {
				item.el.style.transform = item.transform;
				item.el.style.left = item.left;
				item.el.style.top = item.top;
			});
		};
	}

	function walkLatLngs(latlngs, pathCallback) {
		if (!latlngs || !latlngs.length) return;
		if (latlngs[0] instanceof L.LatLng || (latlngs[0] && typeof latlngs[0].lat === 'number')) {
			pathCallback(latlngs);
			return;
		}
		latlngs.forEach(part => walkLatLngs(part, pathCallback));
	}

	function drawPathOnCanvas(ctx, latlngs, options) {
		if (!latlngs || !latlngs.length) return;
		ctx.beginPath();
		latlngs.forEach((ll, index) => {
			const p = map.latLngToContainerPoint(ll);
			if (index === 0) ctx.moveTo(p.x, p.y);
			else ctx.lineTo(p.x, p.y);
		});
		if (options.fill) {
			ctx.closePath();
			ctx.fillStyle = options.fillColor || '#3388ff';
			ctx.globalAlpha = options.fillOpacity != null ? options.fillOpacity : 0.2;
			ctx.fill();
		}
		ctx.strokeStyle = options.color || '#3388ff';
		ctx.lineWidth = options.weight != null ? options.weight : 2;
		ctx.globalAlpha = options.opacity != null ? options.opacity : 0.85;
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	function drawVectorLayer(ctx, layer) {
		if (!layer) return;
		layer.eachLayer(function (featureLayer) {
			if (featureLayer.getLatLng && !featureLayer.getLatLngs) {
				const ll = featureLayer.getLatLng();
				const p = map.latLngToContainerPoint(ll);
				const opt = featureLayer.options || {};
				const radius = opt.radius || 6;
				ctx.beginPath();
				ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = opt.fillColor || '#00cc66';
				ctx.globalAlpha = opt.fillOpacity != null ? opt.fillOpacity : 0.8;
				ctx.fill();
				ctx.strokeStyle = opt.color || '#007a3d';
				ctx.lineWidth = opt.weight != null ? opt.weight : 2;
				ctx.globalAlpha = opt.opacity != null ? opt.opacity : 1;
				ctx.stroke();
				ctx.globalAlpha = 1;
				return;
			}

			if (featureLayer.getLatLngs) {
				const opt = featureLayer.options || {};
				const isPolygon = featureLayer instanceof L.Polygon;
				walkLatLngs(featureLayer.getLatLngs(), path => {
					drawPathOnCanvas(ctx, path, {
						color: opt.color,
						weight: opt.weight,
						opacity: opt.opacity,
						fill: isPolygon,
						fillColor: opt.fillColor,
						fillOpacity: opt.fillOpacity
					});
				});
			}
		});
	}

	function drawHeatCanvases(ctx, mapEl) {
		const canvases = mapEl.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-heatmap-layer');
		canvases.forEach(heatCanvas => {
			try {
				const rect = heatCanvas.getBoundingClientRect();
				const mapRect = mapEl.getBoundingClientRect();
				const x = rect.left - mapRect.left;
				const y = rect.top - mapRect.top;
				ctx.drawImage(heatCanvas, x, y, rect.width, rect.height);
			} catch (e) {
				console.warn('Não foi possível copiar canvas de calor:', e);
			}
		});
	}

	function drawActiveLayersOnCanvas(ctx, mapEl) {
		// Ordem: polígonos/linhas primeiro, depois pontos, depois heat por cima se ativo
		const drawOrder = ['bairros', 'bacias', 'rede-agua', 'rede-esgoto', 'geral', 'agua', 'esgoto'];
		drawOrder.forEach(id => {
			const layer = layerGroups[id];
			if (layer && map.hasLayer(layer)) {
				drawVectorLayer(ctx, layer);
			}
		});

		if (typeof esgotoHeatLayer !== 'undefined' && esgotoHeatLayer && map.hasLayer(esgotoHeatLayer)) {
			drawHeatCanvases(ctx, mapEl);
		}
	}

	function waitFrames(n = 2) {
		return new Promise(resolve => {
			let left = n;
			function tick() {
				left -= 1;
				if (left <= 0) resolve();
				else requestAnimationFrame(tick);
			}
			requestAnimationFrame(tick);
		});
	}

	async function captureMapCanvas() {
		const mapEl = document.getElementById('map');
		const controls = mapEl.querySelector('.leaflet-control-container');
		const previousDisplay = controls ? controls.style.display : '';
		if (controls) controls.style.display = 'none';

		map.invalidateSize({ animate: false });
		await waitFrames(3);

		const unfreeze = freezeLeafletTransforms(mapEl);

		try {
			let baseCanvas;
			try {
				baseCanvas = await html2canvas(mapEl, {
					useCORS: true,
					allowTaint: false,
					logging: false,
					scale: 1,
					backgroundColor: '#111111',
					foreignObjectRendering: false,
					imageTimeout: 15000,
					ignoreElements: (el) =>
						el.classList && (
							el.classList.contains('leaflet-control-container') ||
							el.classList.contains('leaflet-overlay-pane') ||
							el.classList.contains('leaflet-marker-pane')
						)
				});
			} catch (e) {
				console.warn('html2canvas (basemap) falhou, usando fundo sólido:', e);
				baseCanvas = document.createElement('canvas');
				baseCanvas.width = mapEl.clientWidth;
				baseCanvas.height = mapEl.clientHeight;
				const bg = baseCanvas.getContext('2d');
				bg.fillStyle = '#1a1a1a';
				bg.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
			}

			const scale = 2;
			const out = document.createElement('canvas');
			out.width = mapEl.clientWidth * scale;
			out.height = mapEl.clientHeight * scale;
			const ctx = out.getContext('2d');
			ctx.scale(scale, scale);

			// Fundo / tiles
			ctx.drawImage(baseCanvas, 0, 0, mapEl.clientWidth, mapEl.clientHeight);

			// Redesesenha camadas vetoriais e heat (garantia de aparecer no PDF)
			drawActiveLayersOnCanvas(ctx, mapEl);

			return out;
		} finally {
			unfreeze();
			if (controls) controls.style.display = previousDisplay;
		}
	}

	function drawNorthArrow(doc, x, y, size = 12) {
		doc.setDrawColor(30);
		doc.setFillColor(30);
		doc.setLineWidth(0.4);
		doc.triangle(x, y - size, x - size * 0.35, y + size * 0.15, x + size * 0.35, y + size * 0.15, 'F');
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

			doc.setFillColor(248, 248, 248);
			doc.rect(0, 0, pageW, pageH, 'F');

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

			drawNorthArrow(doc, mapX + drawW - 10, mapY + 14, 8);

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
			alert('Não foi possível gerar o PDF. Tente novamente.');
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
