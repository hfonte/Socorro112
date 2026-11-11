// MOTOR DE GEOLOCALIZAÇÃO E APOIO DE COMUNICAÇÃO CODU (112)
const _gt = (pt, en) => (typeof window.t === 'function' ? window.t(pt, en) : pt);

const GeoManager = {
  currentLocation: {
    lat: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_lat')) || null,
    lon: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_lon')) || null,
    accuracy: null,
    address: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_address')) || _gt('A obter localização...', 'Getting location...'),
    landmark: (typeof localStorage !== 'undefined' && localStorage.getItem('cached_gps_landmark')) || _gt('A calcular referências...', 'Calculating landmarks...'),
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
      return _gt(`Junto a ${placeName}`, `Next to ${placeName}`);
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
            return _gt(`Perto de ${topPoi.name}${zoneInfo}`, `Near ${topPoi.name}${zoneInfo}`);
          }
        }
      } catch (_) {}
    }

    // 4. Se for uma zona ampla (bairro/subúrbio), identifica-a como tal
    if (addr.neighbourhood || addr.suburb) {
      const zoneName = addr.neighbourhood || addr.suburb;
      return _gt(`Zona de ${zoneName}`, `Area of ${zoneName}`);
    }

    return _gt('Junto ao centro da localidade', 'Near the town center');
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
              const road = addr.road || addr.pedestrian || addr.street || _gt('Rua sem nome', 'Unnamed road');
              const num = addr.house_number ? `, ${_gt('Nº', '#')} ${addr.house_number}` : '';
              const locality = addr.city || addr.town || addr.village || addr.municipality || '';
              const district = addr.county || addr.state_district || '';
              this.currentLocation.address = `${road}${num} - ${locality} (${district})`;
              this.currentLocation.landmark = await this.resolveBestLandmark(data, this.currentLocation.lat, this.currentLocation.lon);
            }
          } catch (_) {
            this.currentLocation.address = `${_gt('Coordenadas', 'Coordinates')}: ${this.currentLocation.lat}, ${this.currentLocation.lon}`;
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
      this.currentLocation.address = _gt('GPS não suportado neste equipamento', 'GPS not supported on this device');
      this.currentLocation.landmark = _gt('Indique referências visuais da rua ao 112', 'Give visual street landmarks to 112');
      if (onUpdateCallback) onUpdateCallback(this.currentLocation);
      return;
    }

    let isResolved = false;
    // Watchdog de 5.5s para garantir que o utilizador nunca fica preso em "A obter..."
    const watchdogTimer = setTimeout(() => {
      if (!isResolved && (!this.currentLocation.lat || this.currentLocation.address.includes('A obter') || this.currentLocation.address.includes('Getting location'))) {
        const cachedAddr = typeof localStorage !== 'undefined' ? localStorage.getItem('cached_gps_address') : null;
        if (cachedAddr) {
          this.currentLocation.address = `${cachedAddr} (${_gt('Última conhecida', 'Last known')})`;
          this.currentLocation.landmark = _gt('Confirme referências visuais da rua com o operador do 112', 'Confirm visual street landmarks with the 112 operator');
        } else {
          this.currentLocation.address = _gt('Sinal GPS fraco ou em busca...', 'Weak GPS signal or searching...');
          this.currentLocation.landmark = _gt('Indique o nome da rua, cruzamentos ou edifícios próximos ao 112', 'Tell 112 the street name, intersections, or nearby buildings');
        }
        if (onUpdateCallback) onUpdateCallback(this.currentLocation);
      }
    }, 5500);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        isResolved = true;
        clearTimeout(watchdogTimer);
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
            const road = addr.road || addr.pedestrian || addr.street || _gt('Rua sem nome', 'Unnamed road');
            const num = addr.house_number ? `, ${_gt('Nº', '#')} ${addr.house_number}` : '';
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
          this.currentLocation.address = `${_gt('Coordenadas fixadas', 'Coordinates fixed')}: ${lat}, ${lon}`;
          this.currentLocation.landmark = _gt('Indique referências visuais da rua ao 112', 'Give visual street landmarks to 112');
        }

        if (onUpdateCallback) onUpdateCallback(this.currentLocation);
      },
      () => {
        isResolved = true;
        clearTimeout(watchdogTimer);
        const cachedAddr = typeof localStorage !== 'undefined' ? localStorage.getItem('cached_gps_address') : null;
        if (cachedAddr) {
          this.currentLocation.address = `${cachedAddr} (${_gt('Última conhecida', 'Last known')})`;
          this.currentLocation.landmark = _gt('Indique o nome da rua, cruzamentos ou edifícios próximos ao 112', 'Tell 112 the street name, intersections, or nearby buildings');
        } else {
          this.currentLocation.address = _gt('Sinal GPS fraco ou não autorizado', 'Weak or unauthorized GPS signal');
          this.currentLocation.landmark = _gt('Indique o nome da rua, cruzamentos ou edifícios próximos ao 112', 'Tell 112 the street name, intersections, or nearby buildings');
        }
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
      landmark: _gt('Em frente ao Café Central e Hotel Aliados', 'Opposite Café Central and Hotel Aliados'),
      nearbyPOIs: [
        { name: 'Café Central', type: 'cafe' },
        { name: 'Hotel Aliados', type: 'hotel' },
        { name: 'Estação de Metro dos Aliados', type: 'subway' }
      ]
    };
    if (onUpdateCallback) onUpdateCallback(this.currentLocation);
  },

  getGreeting() {
    const hour = new Date().getHours();
    const isEn = typeof window !== 'undefined' && window.AppLang === 'en';
    if (hour >= 6 && hour < 12) return isEn ? 'Good morning' : 'Bom dia';
    if (hour >= 12 && hour < 20) return isEn ? 'Good afternoon' : 'Boa tarde';
    return isEn ? 'Good evening' : 'Boa noite';
  },

  getCoduSpeechScript(incidentKey = 'geral') {
    const isEn = typeof window !== 'undefined' && window.AppLang === 'en';
    const loc = this.currentLocation;
    const greeting = this.getGreeting();
    const rawAddr = (loc.address && !loc.address.includes('A obter') && !loc.address.includes('Getting location') && !loc.address.includes('não suportado') && !loc.address.includes('not supported')) 
      ? loc.address 
      : (typeof localStorage !== 'undefined' ? (localStorage.getItem('cached_gps_address') || _gt('a minha localização atual', 'my current location')) : _gt('a minha localização atual', 'my current location'));
    const address = isEn ? rawAddr.replace(/Rua sem nome/g, 'Unnamed road').replace(/, Nº /g, ', #') : rawAddr;
    const refClean = (loc.landmark && !loc.landmark.includes('A calcular') && !loc.landmark.includes('Calculating'))
      ? loc.landmark.replace(/^(junto [aàá]o?s?|perto d[eao]s?|ao lado d[eao]s?|next to|near|area of)\s*/i, '')
      : '';
    const ref = refClean ? (isEn ? `, near ${refClean}` : `, junto a ${refClean}`) : '';
    const gps = (loc.lat && loc.lon) ? ` (GPS: ${loc.lat}, ${loc.lon})` : '';

    const incidentMap = isEn ? {
      geral: {
        text: 'a person requiring urgent medical assistance',
        action: 'I have ensured scene safety and started first aid. Please dispatch an ambulance urgently.'
      },
      inconsciente: {
        text: 'an unconscious person who is not responding',
        action: 'I am checking breathing and ready to start CPR chest compressions. Please send emergency crews with an AED urgently.'
      },
      engasgamento: {
        text: 'a person with severe choking / airway obstruction, unable to cough or speak',
        action: 'I started the 5 back blows and 5 Heimlich abdominal thrusts sequence. Requesting urgent help.'
      },
      hemorragia: {
        text: 'a person with severe, heavy bleeding',
        action: 'I am applying firm direct pressure on the wound with clean cloths. Requesting urgent emergency help.'
      },
      queda: {
        text: 'a person who had a serious fall / trauma and cannot get up',
        action: 'The victim is conscious and kept completely still on the ground without moving. Requesting urgent help.'
      },
      respiratorio: {
        text: 'a person with severe shortness of breath and difficulty breathing',
        action: 'I positioned the victim sitting upright with loosened clothing to ease breathing. Requesting medical help.'
      }
    } : {
      geral: {
        text: 'uma pessoa a necessitar de assistência médica urgente',
        action: 'Já garanti a segurança e iniciei os primeiros socorros. Peço o envio urgente de uma ambulância.'
      },
      inconsciente: {
        text: 'uma pessoa inconsciente que não responde aos estímulos',
        action: 'Estou a verificar a respiração e preparado para iniciar manobras de reanimação (SBV / compressões). Peço envio urgente de meios com DAE.'
      },
      engasgamento: {
        text: 'uma pessoa em engasgamento grave / asfixia total, incapaz de tossir ou falar',
        action: 'Iniciei a sequência de 5 pancadas nas costas e 5 compressões abdominais de Heimlich. Peço apoio urgente.'
      },
      hemorragia: {
        text: 'uma pessoa com hemorragia grave e abundante',
        action: 'Estou a efetuar compressão direta firme no local do sangramento com panos limpos. Peço envio urgente de socorro.'
      },
      queda: {
        text: 'uma pessoa que sofreu uma queda grave / traumatismo e não se consegue levantar',
        action: 'A vítima encontra-se consciente e mantida imóvel no chão sem qualquer mobilização. Peço apoio urgente.'
      },
      respiratorio: {
        text: 'uma pessoa com grande falta de ar e dificuldade em respirar',
        action: 'Posicionei a vítima sentada ereta com roupas desapertadas para ajudar a ventilação. Peço envio de socorro.'
      }
    };

    const inc = incidentMap[incidentKey] || incidentMap.geral;
    return isEn
      ? `"${greeting}, I need help at ${address}${ref}${gps}. I have ${inc.text}. ${inc.action}"`
      : `«${greeting}, preciso de ajuda para ${address}${ref}${gps}. Tenho aqui ${inc.text}. ${inc.action}»`;
  }
};

window.GeoManager = GeoManager;
