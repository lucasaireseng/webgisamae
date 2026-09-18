// Inicializa os mapas de fundo (basemaps)
// Google Maps
const googleMaps = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
});

// Google Satellite
const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.google.com/maps">Google Satellite</a>'
});

// Google Satellite Hybrid (satélite + nomes de ruas)
const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.google.com/maps">Google Satellite Hybrid</a>'
});

// ESRI World Imagery
const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	maxZoom: 19,
	attribution: '&copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Cria o mapa centralizado no perímetro urbano de Rio Verde, Goiás
const map = L.map('map', {
	center: [-17.7975, -50.9250],
	zoom: 13,
	layers: [googleSatellite]
});

// Controle de camadas para alternar entre os basemaps
const baseMaps = {
	"Google Maps": googleMaps,
	"Google Satélite": googleSatellite,
	"Google Hybrid": googleHybrid,
	"ESRI Satélite": esriImagery
};

// Armazena as camadas para controle da sidebar
let layerGroups = {
	'agua': null,
	'esgoto': null,
	'geral': null,
	'bairros': null,
	'bacias': null,
	'rede-agua': null,
	'rede-esgoto': null
};

// Flag para controlar se as camadas foram carregadas
let layersLoaded = {
	'agua': false,
	'esgoto': false,
	'geral': false,
	'bairros': false,
	'bacias': false,
	'rede-agua': false,
	'rede-esgoto': false
};

// Mapa de calor (Kernel Density) da camada ESGOTO — criado sob demanda
let esgotoHeatLayer = null;

function buildEsgotoHeatLayer(geoJsonLayer) {
	const heatPoints = [];

	geoJsonLayer.eachLayer(function(layer) {
		if (!layer.getLatLng) return;
		const latlng = layer.getLatLng();
		// [lat, lng, intensidade] — intensidade moderada para densidade urbana
		heatPoints.push([latlng.lat, latlng.lng, 0.65]);
	});

	// radius/blur calibrados para Rio Verde em zoom ~13
	return L.heatLayer(heatPoints, {
		radius: 28,
		blur: 22,
		maxZoom: 17,
		max: 1.0,
		minOpacity: 0.2,
		gradient: {
			0.0: 'rgba(0, 0, 255, 0)',
			0.2: 'rgba(0, 80, 255, 0.25)',
			0.4: 'rgba(0, 220, 255, 0.35)',
			0.55: 'rgba(0, 255, 100, 0.4)',
			0.7: 'rgba(255, 255, 0, 0.5)',
			0.85: 'rgba(255, 120, 0, 0.55)',
			1.0: 'rgba(255, 0, 0, 0.65)'
		}
	});
}

function ensureEsgotoHeatLayer() {
	if (esgotoHeatLayer || !layerGroups['esgoto']) {
		return esgotoHeatLayer;
	}
	if (typeof L.heatLayer !== 'function') {
		console.error('Plugin leaflet-heat não carregado.');
		return null;
	}
	esgotoHeatLayer = buildEsgotoHeatLayer(layerGroups['esgoto']);
	console.log('Mapa de calor ESGOTO processado sob demanda');
	return esgotoHeatLayer;
}

function toggleEsgotoHeat(show) {
	if (!layersLoaded['esgoto'] || !layerGroups['esgoto']) {
		console.warn('Camada ESGOTO ainda não foi carregada!');
		return;
	}

	if (show) {
		// Processa e exibe o heat apenas no momento da ativação
		const heat = ensureEsgotoHeatLayer();
		if (heat && !map.hasLayer(heat)) {
			heat.addTo(map);
		}
		if (!map.hasLayer(layerGroups['esgoto'])) {
			map.addLayer(layerGroups['esgoto']);
		}
		console.log('Camada ESGOTO + mapa de calor adicionados ao mapa');
	} else {
		if (esgotoHeatLayer && map.hasLayer(esgotoHeatLayer)) {
			map.removeLayer(esgotoHeatLayer);
		}
		if (map.hasLayer(layerGroups['esgoto'])) {
			map.removeLayer(layerGroups['esgoto']);
		}
		console.log('Camada ESGOTO + mapa de calor removidos do mapa');
	}
}

// Função para alternar basemap
function changeBasemap(basemapName) {
	// Remove todas as camadas de basemap
	Object.values(baseMaps).forEach(layer => {
		map.removeLayer(layer);
	});
	
	// Adiciona a camada selecionada
	if (baseMaps[basemapName]) {
		map.addLayer(baseMaps[basemapName]);
	}
}

// Função para alternar camada de dados
function toggleLayer(layerId, show) {
	console.log(`Toggle layer ${layerId}: ${show}`);
	console.log('Layer groups:', layerGroups);
	console.log('Layers loaded:', layersLoaded);

	if (layerId === 'esgoto') {
		toggleEsgotoHeat(show);
		return;
	}
	
	if (!layersLoaded[layerId]) {
		console.warn(`Camada ${layerId} ainda não foi carregada!`);
		return;
	}
	
	if (layerGroups[layerId]) {
		if (show) {
			map.addLayer(layerGroups[layerId]);
			console.log(`Camada ${layerId} adicionada ao mapa`);
		} else {
			map.removeLayer(layerGroups[layerId]);
			console.log(`Camada ${layerId} removida do mapa`);
		}
	} else {
		console.error(`Camada ${layerId} não encontrada!`);
	}
}

// Função para centralizar no perímetro urbano de Rio Verde
function centerOnRioVerde() {
	const rioVerdeBounds = L.latLngBounds(
		[-17.85, -50.98], // Sudoeste
		[-17.75, -50.87]  // Nordeste
	);
	map.fitBounds(rioVerdeBounds);
}

// Função para obter localização atual do usuário
function getCurrentLocation() {
	const locationBtn = document.getElementById('location-btn');
	
	if (!navigator.geolocation) {
		alert('Geolocalização não é suportada por este navegador.');
		return;
	}
	
	// Mostra indicador de carregamento
	locationBtn.innerHTML = '⏳';
	locationBtn.disabled = true;
	
	navigator.geolocation.getCurrentPosition(
		function(position) {
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;
			const accuracy = position.coords.accuracy;
			
			console.log(`Localização obtida: ${lat}, ${lng} (precisão: ${accuracy}m)`);
			
			// Cria marcador da localização atual
			const userLocation = L.marker([lat, lng], {
				icon: L.divIcon({
					className: 'user-location-marker',
					html: '📍',
					iconSize: [30, 30],
					iconAnchor: [15, 30]
				})
			}).addTo(map);
			
			// Adiciona popup com informações
			userLocation.bindPopup(`
				<div style="text-align: center;">
					<h3>📍 Seu Local</h3>
					<p><strong>Latitude:</strong> ${lat.toFixed(6)}</p>
					<p><strong>Longitude:</strong> ${lng.toFixed(6)}</p>
					<p><strong>Precisão:</strong> ${Math.round(accuracy)} metros</p>
				</div>
			`).openPopup();
			
			// Centraliza o mapa na localização do usuário
			map.setView([lat, lng], 16);
			
			// Adiciona círculo de precisão
			L.circle([lat, lng], {
				radius: accuracy,
				color: '#3388ff',
				fillColor: '#3388ff',
				fillOpacity: 0.2,
				weight: 2
			}).addTo(map);
			
			// Restaura o botão
			locationBtn.innerHTML = '📍';
			locationBtn.disabled = false;
			
			console.log('✅ Localização centralizada no mapa');
		},
		function(error) {
			console.error('Erro ao obter localização:', error);
			
			let errorMessage = 'Erro ao obter localização: ';
			switch(error.code) {
				case error.PERMISSION_DENIED:
					errorMessage += 'Permissão negada pelo usuário.';
					break;
				case error.POSITION_UNAVAILABLE:
					errorMessage += 'Localização indisponível.';
					break;
				case error.TIMEOUT:
					errorMessage += 'Tempo limite excedido.';
					break;
				default:
					errorMessage += 'Erro desconhecido.';
					break;
			}
			
			alert(errorMessage);
			
			// Restaura o botão
			locationBtn.innerHTML = '📍';
			locationBtn.disabled = false;
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 60000
		}
	);
}

// Função para definir limites do mapa
function setMapLimits() {
	const maxBounds = L.latLngBounds(
		[-17.90, -51.05], // Sudoeste
		[-17.70, -50.80]  // Nordeste
	);
	map.setMaxBounds(maxBounds);
	
	// Adiciona botão para centralizar em Rio Verde
	const centerButton = L.control({position: 'topright'});
	centerButton.onAdd = function(map) {
		const div = L.DomUtil.create('div', 'center-rio-verde-btn');
		div.innerHTML = '<button title="Centralizar em Rio Verde">🏙️</button>';
		div.style.cssText = 'background: white; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); margin-bottom: 5px;';
		
		div.onclick = function() {
			centerOnRioVerde();
		};
		
		return div;
	};
	centerButton.addTo(map);
	
	// Adiciona botão para localização atual
	const locationButton = L.control({position: 'topright'});
	locationButton.onAdd = function(map) {
		const div = L.DomUtil.create('div', 'location-btn');
		div.innerHTML = '<button title="Seu Local" id="location-btn">📍</button>';
		div.style.cssText = 'background: white; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
		
		div.onclick = function() {
			getCurrentLocation();
		};
		
		return div;
	};
	locationButton.addTo(map);
}

// Event listeners para a sidebar
document.addEventListener('DOMContentLoaded', function() {
	const toggleBtn = document.getElementById('toggle-sidebar');
	const mobileMenuBtn = document.getElementById('mobile-menu-btn');
	const sidebar = document.getElementById('sidebar');
	const mapDiv = document.getElementById('map');
	const overlay = document.getElementById('sidebar-overlay');

	function isMobile() {
		return window.matchMedia('(max-width: 768px)').matches;
	}

	function refreshMapSize() {
		requestAnimationFrame(function() {
			map.invalidateSize({ animate: false });
			setTimeout(function() {
				map.invalidateSize({ animate: false });
			}, 50);
			setTimeout(function() {
				map.invalidateSize({ animate: false });
			}, 350);
		});
	}

	function setSidebarOpen(open) {
		if (open) {
			sidebar.classList.remove('collapsed');
			mapDiv.classList.remove('sidebar-collapsed');
			if (overlay) {
				if (isMobile()) {
					overlay.classList.add('visible');
					overlay.setAttribute('aria-hidden', 'false');
				} else {
					overlay.classList.remove('visible');
					overlay.setAttribute('aria-hidden', 'true');
				}
			}
			if (mobileMenuBtn) {
				mobileMenuBtn.style.display = 'none';
			}
		} else {
			sidebar.classList.add('collapsed');
			mapDiv.classList.add('sidebar-collapsed');
			if (overlay) {
				overlay.classList.remove('visible');
				overlay.setAttribute('aria-hidden', 'true');
			}
			if (mobileMenuBtn) {
				mobileMenuBtn.style.display = isMobile() ? 'block' : 'none';
			}
		}
		refreshMapSize();
	}

	function toggleSidebar() {
		const willOpen = sidebar.classList.contains('collapsed');
		setSidebarOpen(willOpen);
	}

	// No celular: menu fechado para o mapa aparecer; no desktop: menu aberto
	if (isMobile()) {
		setSidebarOpen(false);
	} else {
		setSidebarOpen(true);
	}

	toggleBtn.addEventListener('click', toggleSidebar);
	if (mobileMenuBtn) {
		mobileMenuBtn.addEventListener('click', function() {
			setSidebarOpen(true);
		});
	}
	if (overlay) {
		overlay.addEventListener('click', function() {
			setSidebarOpen(false);
		});
	}

	window.addEventListener('resize', function() {
		if (isMobile()) {
			if (!sidebar.classList.contains('collapsed')) {
				// mantém estado, só recalcula mapa
			} else {
				mobileMenuBtn.style.display = 'block';
			}
		} else {
			if (mobileMenuBtn) mobileMenuBtn.style.display = 'none';
			if (overlay) overlay.classList.remove('visible');
		}
		refreshMapSize();
	});

	// Garante que o Leaflet desenhe o mapa após o layout carregar
	refreshMapSize();
	window.addEventListener('load', refreshMapSize);
	
	// Controle de basemaps
		const basemapLabels = {
			google: 'Google Maps',
			satellite: 'Google Satélite',
			hybrid: 'Google Hybrid',
			esri: 'ESRI Satélite'
		};
		document.querySelectorAll('input[name="basemap"]').forEach(radio => {
			radio.addEventListener('change', function() {
				if (this.checked) {
					changeBasemap(basemapLabels[this.value] || 'Google Satélite');
				}
			});
		});
	
	// Controle de camadas de dados
	document.getElementById('layer-agua').addEventListener('change', function() {
		console.log('Checkbox ÁGUA alterado:', this.checked);
		toggleLayer('agua', this.checked);
	});
	
	document.getElementById('layer-esgoto').addEventListener('change', function() {
		console.log('Checkbox ESGOTO alterado:', this.checked);
		toggleLayer('esgoto', this.checked);
	});
	
	document.getElementById('layer-geral').addEventListener('change', function() {
		console.log('Checkbox GERAL alterado:', this.checked);
		toggleLayer('geral', this.checked);
	});
	
	document.getElementById('layer-bairros').addEventListener('change', function() {
		console.log('Checkbox BAIRROS alterado:', this.checked);
		toggleLayer('bairros', this.checked);
	});

	document.getElementById('layer-bacias').addEventListener('change', function() {
		console.log('Checkbox BACIAS alterado:', this.checked);
		toggleLayer('bacias', this.checked);
	});

	document.getElementById('layer-rede-agua').addEventListener('change', function() {
		console.log('Checkbox REDE DE ÁGUA alterado:', this.checked);
		toggleLayer('rede-agua', this.checked);
	});

	document.getElementById('layer-rede-esgoto').addEventListener('change', function() {
		console.log('Checkbox REDE DE ESGOTO alterado:', this.checked);
		toggleLayer('rede-esgoto', this.checked);
	});
});

// Escala
L.control.scale({ metric: true, imperial: false }).addTo(map);

// Define limites e controles do mapa
setMapLimits();

// Função para criar popup
function createPopup(feature, layer) {
	if (feature.properties) {
		let popupContent = '<div class="popup-content">';
		
		if (feature.properties.tipo) {
			popupContent += `<h3>${feature.properties.tipo}</h3>`;
		} else if (feature.properties.nome) {
			popupContent += `<h3>${feature.properties.nome}</h3>`;
		}
		
		Object.keys(feature.properties).forEach(key => {
			if (key !== 'tipo' && key !== 'nome' && feature.properties[key]) {
				popupContent += `<p><strong>${key}:</strong> ${feature.properties[key]}</p>`;
			}
		});
		
		popupContent += '</div>';
		layer.bindPopup(popupContent);
	}
}

// Função para detectar pontos próximos e criar popup agrupado
function createGroupedPopup(lat, lng, radius = 0.0005) {
	const nearbyFeatures = [];
	
	// Verifica todas as camadas ativas
	Object.values(layerGroups).forEach(layer => {
		if (layer && map.hasLayer(layer)) {
			layer.eachLayer(function(marker) {
				if (marker.getLatLng) {
					const markerPos = marker.getLatLng();
					const distance = Math.sqrt(
						Math.pow(markerPos.lat - lat, 2) + 
						Math.pow(markerPos.lng - lng, 2)
					);
					
					if (distance <= radius) {
						nearbyFeatures.push({
							layer: layer,
							marker: marker,
							feature: marker.feature,
							distance: distance
						});
					}
				}
			});
		}
	});
	
	if (nearbyFeatures.length > 1) {
		// Ordena por distância
		nearbyFeatures.sort((a, b) => a.distance - b.distance);
		
		let popupContent = '<div class="popup-content">';
		popupContent += `<h3>📍 ${nearbyFeatures.length} Pontos Próximos</h3>`;
		popupContent += '<div class="grouped-features">';
		
		nearbyFeatures.forEach((item, index) => {
			const feature = item.feature;
			const layerName = getLayerName(item.layer);
			
			popupContent += `<div class="feature-item">`;
			popupContent += `<h4>${index + 1}. ${layerName}</h4>`;
			
			if (feature.properties) {
				Object.keys(feature.properties).forEach(key => {
					if (feature.properties[key]) {
						popupContent += `<p><strong>${key}:</strong> ${feature.properties[key]}</p>`;
					}
				});
			}
			
			popupContent += `</div>`;
			if (index < nearbyFeatures.length - 1) {
				popupContent += '<hr class="feature-separator">';
			}
		});
		
		popupContent += '</div></div>';
		
		// Cria popup temporário
		const tempPopup = L.popup()
			.setLatLng([lat, lng])
			.setContent(popupContent)
			.openOn(map);
		
		return true;
	}
	
	return false;
}

// Função para obter nome da camada
function getLayerName(layer) {
	if (layer === layerGroups['agua']) return 'ÁGUA';
	if (layer === layerGroups['esgoto']) return 'ESGOTO';
	if (layer === layerGroups['geral']) return 'GERAL';
	if (layer === layerGroups['bairros']) return 'BAIRROS';
	if (layer === layerGroups['bacias']) return 'BACIAS DE ABASTECIMENTO';
	if (layer === layerGroups['rede-agua']) return 'REDE DE ÁGUA';
	if (layer === layerGroups['rede-esgoto']) return 'REDE DE ESGOTO';
	return 'Desconhecida';
}

// Função para carregar arquivos GeoJSON
function loadGeoJSON(url, options) {
	console.log(`Carregando: ${url}`);
	return fetch(url)
		.then(response => {
			console.log(`Status: ${response.status}`);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			return response.json();
		})
		.then(data => {
			console.log(`Dados carregados: ${data.features ? data.features.length : 0} features`);
			
			// Corrige coordenadas se necessário
			if (data.features) {
				data.features.forEach(feature => {
					if (feature.geometry && feature.geometry.type === 'Point') {
						const coords = feature.geometry.coordinates;
						if (coords[0] > coords[1]) {
							feature.geometry.coordinates = [coords[1], coords[0]];
							console.log(`Coordenadas corrigidas: [${coords[1]}, ${coords[0]}]`);
						}
					}
				});
			}
			
			const layer = L.geoJSON(data, {
				onEachFeature: createPopup,
				...options
			});
			
			console.log(`Camada criada: ${layer}`);
			return layer;
		})
		.catch(error => {
			console.error(`Erro: ${error.message}`);
			return null;
		});
}

// Carrega as camadas
console.log('Iniciando carregamento...');

// Carrega ÁGUA (sem adicionar ao mapa inicialmente)
loadGeoJSON('ARQUIVO JGESON/ÁGUA.geojson', {
	pointToLayer: (feature, latlng) => {
		const marker = L.circleMarker(latlng, {
			radius: 8,
			fillColor: '#0066cc',
			color: '#003d7a',
			weight: 2,
			opacity: 1,
			fillOpacity: 0.8
		});
		
		// Adiciona evento de clique para detectar sobreposições
		marker.on('click', function(e) {
			e.originalEvent.stopPropagation();
			const pos = e.latlng;
			
			// Primeiro tenta criar popup agrupado
			if (!createGroupedPopup(pos.lat, pos.lng)) {
				// Se não há sobreposição, mostra popup normal
				marker.openPopup();
			}
		});
		
		return marker;
	}
}).then(layer => {
	if (layer) {
		layerGroups['agua'] = layer;
		layersLoaded['agua'] = true;
		console.log('Camada ÁGUA carregada (não ativa)');
		console.log('Features na camada ÁGUA:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('Falha ao carregar camada ÁGUA');
	}
});

// Carrega ESGOTO (sem adicionar ao mapa inicialmente — heat só no checkbox)
loadGeoJSON('ARQUIVO JGESON/ESGOTO.geojson', {
	pointToLayer: (feature, latlng) => {
		const marker = L.circleMarker(latlng, {
			radius: 5,
			fillColor: '#cc6600',
			color: '#7a3d00',
			weight: 1,
			opacity: 0.55,
			fillOpacity: 0.35
		});
		
		// Adiciona evento de clique para detectar sobreposições
		marker.on('click', function(e) {
			e.originalEvent.stopPropagation();
			const pos = e.latlng;
			
			// Primeiro tenta criar popup agrupado
			if (!createGroupedPopup(pos.lat, pos.lng)) {
				// Se não há sobreposição, mostra popup normal
				marker.openPopup();
			}
		});
		
		return marker;
	}
}).then(layer => {
	if (layer) {
		layerGroups['esgoto'] = layer;
		layersLoaded['esgoto'] = true;
		// Heat NÃO é criado aqui — apenas sob demanda no #layer-esgoto
		console.log('Camada ESGOTO carregada (não ativa; heat sob demanda)');
		console.log('Features na camada ESGOTO:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('Falha ao carregar camada ESGOTO');
	}
});

// Carrega GERAL (ativa por padrão)
console.log('Iniciando carregamento da camada GERAL...');
loadGeoJSON('ARQUIVO JGESON/GERAL.geojson', {
	pointToLayer: (feature, latlng) => {
		const marker = L.circleMarker(latlng, {
			radius: 6,
			fillColor: '#00cc66',
			color: '#007a3d',
			weight: 2,
			opacity: 1,
			fillOpacity: 0.8
		});
		
		// Adiciona evento de clique para detectar sobreposições
		marker.on('click', function(e) {
			e.originalEvent.stopPropagation();
			const pos = e.latlng;
			
			// Primeiro tenta criar popup agrupado
			if (!createGroupedPopup(pos.lat, pos.lng)) {
				// Se não há sobreposição, mostra popup normal
				marker.openPopup();
			}
		});
		
		return marker;
	}
}).then(layer => {
	if (layer) {
		layerGroups['geral'] = layer;
		layersLoaded['geral'] = true;
		layer.addTo(map);
		console.log('✅ Camada GERAL adicionada (ativa)');
		console.log('Features na camada GERAL:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('❌ Falha ao carregar camada GERAL');
	}
}).catch(error => {
	console.error('❌ Erro no carregamento da camada GERAL:', error);
});

// Função para verificar se todas as camadas foram carregadas
function checkAllLayersLoaded() {
	const allLoaded = Object.values(layersLoaded).every(loaded => loaded);
	if (allLoaded) {
		console.log('✅ Todas as camadas foram carregadas com sucesso!');
		console.log('Camadas disponíveis:', Object.keys(layerGroups).filter(key => layerGroups[key]));
	} else {
		console.log('⏳ Aguardando carregamento das camadas...');
		console.log('Status:', layersLoaded);
	}
}

// Carrega BAIRROS (polígonos - sem adicionar ao mapa inicialmente)
loadGeoJSON('ARQUIVO JGESON/BAIRROS.geojson', {
	style: {
		color: '#ffcc00',
		weight: 3,
		opacity: 1,
		fillColor: '#ffeb3b',
		fillOpacity: 0.35
	}
}).then(layer => {
	if (layer) {
		layerGroups['bairros'] = layer;
		layersLoaded['bairros'] = true;
		console.log('Camada BAIRROS carregada (não ativa)');
		console.log('Features na camada BAIRROS:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('Falha ao carregar camada BAIRROS');
	}
});

// Carrega BACIAS DE ABASTECIMENTO (polígonos)
loadGeoJSON('ARQUIVO JGESON/BACIAS DE ABASTECIMENTO.geojson', {
	style: function(feature) {
		return {
			color: '#007a99',
			weight: 2,
			opacity: 0.9,
			fillColor: '#00aacc',
			fillOpacity: 0.25
		};
	}
}).then(layer => {
	if (layer) {
		layerGroups['bacias'] = layer;
		layersLoaded['bacias'] = true;
		console.log('Camada BACIAS DE ABASTECIMENTO carregada (não ativa)');
		console.log('Features na camada BACIAS:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('Falha ao carregar camada BACIAS DE ABASTECIMENTO');
	}
});

// Carrega REDE DE ÁGUA (linhas) — desmarcada por padrão (arquivo grande)
loadGeoJSON('ARQUIVO JGESON/REDE DE ÁGUA.geojson', {
	style: function(feature) {
		return {
			color: '#0099ff',
			weight: 2,
			opacity: 0.85
		};
	}
}).then(layer => {
	if (layer) {
		layerGroups['rede-agua'] = layer;
		layersLoaded['rede-agua'] = true;
		console.log('Camada REDE DE ÁGUA carregada (não ativa)');
		console.log('Features na camada REDE DE ÁGUA:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('Falha ao carregar camada REDE DE ÁGUA');
	}
});

// Carrega REDE DE ESGOTO (linhas) — desmarcada por padrão (arquivo grande)
loadGeoJSON('ARQUIVO JGESON/REDE DE ESGOTO.geojson', {
	style: {
		color: '#ff0000',
		weight: 3,
		opacity: 1
	}
}).then(layer => {
	if (layer) {
		layerGroups['rede-esgoto'] = layer;
		layersLoaded['rede-esgoto'] = true;
		console.log('Camada REDE DE ESGOTO carregada (não ativa)');
		console.log('Features na camada REDE DE ESGOTO:', layer.getLayers().length);
		checkAllLayersLoaded();
	} else {
		console.error('Falha ao carregar camada REDE DE ESGOTO');
	}
});

console.log('Carregamento iniciado');
