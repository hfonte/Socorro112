// MOTOR DE GEOLOCALIZAÇÃO E APOIO DE COMUNICAÇÃO CODU (112)
const GeoManager = {
  currentLocation: {
    lat: null,
    lon: null,
    accuracy: null,
    address: 'A obter localização...',
    landmark: 'A calcular referências...'
  },

  get lastLocation() {
    return this.currentLocation;
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
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.currentLocation.lat}&lon=${this.currentLocation.lon}&zoom=18`, {
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
              this.currentLocation.landmark = addr.suburb || addr.neighbourhood || addr.amenity || 'Junto ao centro da localidade';
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
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`, {
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address;
            const road = addr.road || addr.pedestrian || addr.street || 'Rua sem nome';
            const num = addr.house_number ? `, Nº ${addr.house_number}` : '';
            const locality = addr.city || addr.town || addr.village || addr.municipality || '';
            const district = addr.county || addr.state_district || '';
            
            this.currentLocation.address = `${road}${num} - ${locality} (${district})`;
            this.currentLocation.landmark = addr.suburb || addr.neighbourhood || addr.amenity || 'Junto ao centro da localidade';
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
      landmark: 'Em frente à Estação de Metro dos Aliados e Café Central'
    };
    if (onUpdateCallback) onUpdateCallback(this.currentLocation);
  },

  getCoduSpeechScript(incidentType) {
    const loc = this.currentLocation;
    return `«Estou em ${loc.address}. As coordenadas são ${loc.lat || '--'}, ${loc.lon || '--'}. Estou junto a ${loc.landmark}. A ocorrência é: ${incidentType}.»`;
  }
};

window.GeoManager = GeoManager;
