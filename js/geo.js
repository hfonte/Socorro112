// MOTOR DE GEOLOCALIZAÇÃO E APOIO DE COMUNICAÇÃO CODU (112)
const GeoManager = {
  currentLocation: {
    lat: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_lat')) || null,
    lon: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_lon')) || null,
    accuracy: null,
    address: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_address')) || 'A obter localização...',
    landmark: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_landmark')) || 'A calcular referências...',
    nearbyPOIs: []
  },

  get lastLocation() {
    return this.currentLocation;
  },

  setCustomLandmark(newLandmark) {
    if (!newLandmark || !newLandmark.trim()) return;
    const clean = newLandmark.trim();
    this.currentLocation.landmark = clean;
    try {
      localStorage.setItem('cached_gps_landmark', clean);
      if (this.currentLocation.lat && this.currentLocation.lon) {
        const coordKey = `custom_ref_${parseFloat(this.currentLocation.lat).toFixed(3)}_${parseFloat(this.currentLocation.lon).toFixed(3)}`;
        localStorage.setItem(coordKey, clean);
      }
    } catch (_) {}
    return this.currentLocation;
  },

  async resolveBestLandmark(data, lat, lon) {
    // 1. Verificar se o utilizador já gravou uma referência para esta área (~100 metros)
    if (lat && lon) {
      const coordKey = `custom_ref_${parseFloat(lat).toFixed(3)}_${parseFloat(lon).toFixed(3)}`;
      try {
        const saved = localStorage.getItem(coordKey);
        if (saved) return saved;
      } catch (_) {}
    }

    const addr = data.address || {};
    const road = addr.road || addr.pedestrian || addr.street || '';
    const locality = addr.city || addr.town || addr.village || addr.municipality || '';

    // 2. Verificar se o próprio ponto no Nominatim é uma entidade / empresa específica com nome
    const directPOI = addr.amenity || addr.shop || addr.building || addr.office || addr.commercial || addr.industrial || addr.company || addr.craft || addr.tourism || addr.leisure || addr.hospital || addr.clinic || addr.pharmacy || addr.school;
    
    let placeName = null;
    if (data.name && data.name !== road && data.name !== addr.suburb && data.name !== addr.neighbourhood) {
      placeName = data.name;
    } else if (directPOI) {
      placeName = directPOI;
    }

    if (placeName) {
      return `Junto a ${placeName}`;
    }

    // 3. Pesquisa secundária ultrarrápida por empresas/estabelecimentos vizinhos (raio ~400m)
    if (lat && lon) {
      try {
        const delta = 0.004; // ~400 metros
        const minLat = (parseFloat(lat) - delta).toFixed(5);
        const maxLat = (parseFloat(lat) + delta).toFixed(5);
        const minLon = (parseFloat(lon) - delta).toFixed(5);
        const maxLon = (parseFloat(lon) + delta).toFixed(5);
        const queryTerm = locality || road || 'Portugal';
        const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&bounded=1&viewbox=${minLon},${maxLat},${maxLon},${minLat}&q=${encodeURIComponent(queryTerm)}&limit=6`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const searchRes = await fetch(searchUrl, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (searchRes.ok) {
          const results = await searchRes.json();
          const poiClasses = ['amenity', 'shop', 'office', 'commercial', 'industrial', 'craft', 'tourism', 'club', 'leisure', 'healthcare', 'emergency'];
          const pois = results.filter(r => r.name && (poiClasses.includes(r.class) || poiClasses.includes(r.addresstype) || r.type === 'company' || r.type === 'social_facility'));
          
          if (pois.length > 0) {
            this.currentLocation.nearbyPOIs = pois.map(p => ({
              name: p.name,
              type: p.type || p.class
            }));
            const topPoi = pois[0];
            const zoneInfo = addr.neighbourhood || addr.suburb ? ` (${addr.neighbourhood || addr.suburb})` : '';
            return `Perto de ${topPoi.name}${zoneInfo}`;
          }
        }
      } catch (_) {}
    }

    // 4. Se for uma zona ampla (bairro/subúrbio), identifica-a como tal
    if (addr.neighbourhood || addr.suburb) {
      const zoneName = addr.neighbourhood || addr.suburb;
      return `Zona de ${zoneName}`;
    }

    return 'Junto ao centro da localidade';
  },

  async getLocationAsync() {
    if (this.currentLocation.lat && this.currentLocation.lon) {
      return this.currentLocation;
    }
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        return resolve(this.currentLocation);
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          this.currentLocation.lat = pos.coords.latitude.toFixed(5);
          this.currentLocation.lon = pos.coords.longitude.toFixed(5);
          this.currentLocation.accuracy = Math.round(pos.coords.accuracy);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.currentLocation.lat}&lon=${this.currentLocation.lon}&zoom=18&addressdetails=1`, {
              headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const road = addr.road || addr.pedestrian || addr.street || 'Rua sem nome';
              const num = addr.house_number ? `, Nº ${addr.house_number}` : '';
              const locality = addr.city || addr.town || addr.village || addr.municipality || '';
              const district = addr.county || addr.state_district || '';
              this.currentLocation.address = `${road}${num} - ${locality} (${district})`;
              this.currentLocation.landmark = await this.resolveBestLandmark(data, this.currentLocation.lat, this.currentLocation.lon);
            }
          } catch (_) {
            this.currentLocation.address = `Coordenadas: ${this.currentLocation.lat}, ${this.currentLocation.lon}`;
          }
          resolve(this.currentLocation);
        },
        () => resolve(this.currentLocation),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
      );
    });
  },

  init(onUpdateCallback) {
    if (!navigator.geolocation) {
      this.currentLocation.address = 'GPS não suportado neste equipamento';
      if (onUpdateCallback) onUpdateCallback(this.currentLocation);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        this.currentLocation.lat = lat;
        this.currentLocation.lon = lon;
        this.currentLocation.accuracy = Math.round(pos.coords.accuracy);

        try {
          localStorage.setItem('cached_gps_lat', lat);
          localStorage.setItem('cached_gps_lon', lon);
        } catch (_) {}

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.pedestrian || addr.street || 'Rua sem nome';
            const num = addr.house_number ? `, Nº ${addr.house_number}` : '';
            const locality = addr.city || addr.town || addr.village || addr.municipality || '';
            const district = addr.county || addr.state_district || '';
            
            this.currentLocation.address = `${road}${num} - ${locality} (${district})`;
            this.currentLocation.landmark = await this.resolveBestLandmark(data, lat, lon);
            try {
              localStorage.setItem('cached_gps_address', this.currentLocation.address);
              localStorage.setItem('cached_gps_landmark', this.currentLocation.landmark);
            } catch (_) {}
          }
        } catch (_) {
          this.currentLocation.address = `Coordenadas fixadas: ${lat}, ${lon}`;
          this.currentLocation.landmark = 'Indique referências visuais da rua ao 112';
        }

        if (onUpdateCallback) onUpdateCallback(this.currentLocation);
      },
      () => {
        this.currentLocation.address = 'Sinal GPS fraco ou não autorizado';
        this.currentLocation.landmark = 'Indique o nome da rua, cruzamentos ou edifícios próximos';
        if (onUpdateCallback) onUpdateCallback(this.currentLocation);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  },

  simulateDemo(onUpdateCallback) {
    this.currentLocation = {
      lat: '41.1472',
      lon: '-8.6111',
      accuracy: 5,
      address: 'Avenida dos Aliados, Nº 142 - Porto',
      landmark: 'Em frente ao Café Central e Hotel Aliados',
      nearbyPOIs: [
        { name: 'Café Central', type: 'cafe' },
        { name: 'Hotel Aliados', type: 'hotel' },
        { name: 'Estação de Metro dos Aliados', type: 'subway' }
      ]
    };
    if (onUpdateCallback) onUpdateCallback(this.currentLocation);
  },

  getCoduSpeechScript(incidentType) {
    const loc = this.currentLocation;
    const ref = loc.landmark ? ` Ponto de referência: ${loc.landmark}.` : '';
    return `«Estou em ${loc.address}.${ref} As coordenadas são ${loc.lat || '--'}, ${loc.lon || '--'}. A ocorrência é: ${incidentType}.»`;
  }
};

window.GeoManager = GeoManager;
