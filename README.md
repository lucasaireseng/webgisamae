# WebGIS AMAE - Rio Verde/GO

Sistema de Informações Geográficas da AMAE (Agência Municipal de Água e Esgoto) de Rio Verde/GO.

## 🗺️ Funcionalidades

### Camadas Disponíveis
- **GERAL** (201 features) - Pontos de monitoramento geral
- **ÁGUA** (50 features) - Pontos de abastecimento de água
- **ESGOTO** (151 features) - Pontos de coleta de esgoto
- **BAIRROS** (199 features) - Limites dos bairros

> **Nota**: As camadas PV e REDE DE ESGOTO foram removidas para otimizar a performance no GitHub Pages devido ao tamanho dos arquivos.

### Mapas Base
- Google Maps
- Google Satélite
- ESRI World Imagery

### Recursos Interativos
- 📍 **Seu Local** - Geolocalização GPS
- 🏙️ **Centralizar em Rio Verde** - Foco na área urbana
- **Popups Informativos** - Detalhes de cada feature
- **Controles de Camadas** - Ativar/desativar camadas

## 🚀 Como Usar

### Acesso Online
Acesse: [https://seu-usuario.github.io/webgis-amae](https://seu-usuario.github.io/webgis-amae)

### Execução Local
1. Clone o repositório
2. Abra o arquivo `index.html` em um navegador
3. Ou use um servidor local:
   ```bash
   python -m http.server 8000
   ```

## 🛠️ Tecnologias Utilizadas

- **Leaflet.js** - Biblioteca de mapas interativos
- **HTML5/CSS3** - Interface responsiva
- **JavaScript ES6** - Lógica da aplicação
- **GeoJSON** - Formato de dados geográficos

## 📁 Estrutura do Projeto

```
webgis-amae/
├── index.html              # Página principal
├── main.js                 # Lógica JavaScript
├── styles.css              # Estilos CSS
├── server.py               # Servidor local (opcional)
├── ARQUIVO JGESON/         # Dados GeoJSON
│   ├── GERAL.geojson
│   ├── ÁGUA.geojson
│   ├── ESGOTO.geojson
│   ├── BAIRROS.geojson
│   ├── PV.geojson
│   └── REDE.geojson
└── LOGO/                   # Logos da AMAE
    ├── LOGO RIO VERDE.png
    └── AMAEGIS.jpg
```

## 📊 Dados

- **Total de Features**: 601 (otimizado para GitHub Pages)
- **Sistema de Coordenadas**: WGS84 (EPSG:4326)
- **Formato**: GeoJSON
- **Cobertura**: Rio Verde/GO

## 🔧 Configuração

### Para GitHub Pages
1. Faça upload dos arquivos para o repositório
2. Ative o GitHub Pages nas configurações
3. Selecione a branch principal
4. Acesse: `https://seu-usuario.github.io/nome-do-repositorio`

### Para Servidor Próprio
1. Faça upload dos arquivos para o servidor
2. Configure HTTPS (necessário para geolocalização)
3. Acesse via navegador

## 📱 Compatibilidade

- ✅ Chrome, Firefox, Safari, Edge
- ✅ Dispositivos móveis (iOS/Android)
- ✅ Tablets
- ✅ Desktop

## 🎯 Características Técnicas

- **Performance**: Otimizado para grandes volumes de dados
- **Responsivo**: Interface adaptável a diferentes telas
- **Acessível**: Controles intuitivos e navegação fácil
- **Modular**: Fácil adição de novas camadas

## 📞 Suporte

Para dúvidas ou sugestões, entre em contato com a equipe de desenvolvimento da AMAE.

## 📄 Licença

Este projeto é de uso interno da AMAE - Rio Verde/GO.

---

**Desenvolvido para AMAE - Agência Municipal de Água e Esgoto de Rio Verde/GO**