/* ============================================================
   map.js — Leaflet map rendering and interaction
   ============================================================ */

const MapEngine = {
    map: null,
    geoJsonLayer: null,
    featureLayers: {},       // iso_a2 → Leaflet layer
    countryFeatures: [],     // All feature objects
    featureById: {},         // iso_a2 → feature
    selectedLayer: null,
    targetIso: null,         // Current target country for click modes
    onClickHandler: null,    // External click handler
    isClickable: false,
    dataReady: false,        // True when GeoJSON is loaded and rendered
    tooltipsUserEnabled: true, // User's preference via toggle button

    // 12-color palette (matching CSS variables)
    colors: [
        '#4C9F70', '#D4A76A', '#C7685C',
        '#6B8DBF', '#B89BCC', '#E8915C',
        '#5DA89B', '#CCA373', '#8B6BAE', '#D1697A',
        '#A0C88E', '#D4A0B0',
    ],

    /** Initialize the map */
    init() {
        this.map = L.map('map', {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 8,
            zoomControl: true,
            attributionControl: false,
            worldCopyJump: true,
            maxBounds: [[-90, -220], [90, 220]],
        });

        // No external tiles — use solid dark background
        // The ocean color is set via CSS (.leaflet-container background)

        // Load GeoJSON data
        this.loadData();
    },

    /** Load and render the preprocessed GeoJSON */
    async loadData() {
        try {
            const resp = await fetch('data/world.fixed.json');
            const data = await resp.json();
            this.countryFeatures = data.features;

            // Build feature lookup
            for (const f of data.features) {
                this.featureById[f.properties.iso_a2] = f;
            }

            this.renderGeoJSON(data);
            this.dataReady = true;
            document.getElementById('map-loading').classList.add('hidden');
            console.log(`Map: loaded ${data.features.length} countries`);
        } catch (err) {
            console.error('Map: failed to load data', err);
            document.getElementById('map').innerHTML =
                '<div style="color:#f85149;padding:40px;text-align:center">' +
                'Failed to load map data. Please check the console.</div>';
        }
    },

    /** Render GeoJSON features on the map */
    renderGeoJSON(data) {
        const self = this;

        this.geoJsonLayer = L.geoJSON(data, {
            style: function (feature) {
                // Disputed territories: gray, semi-transparent, dashed border
                if (feature.properties.disputed || feature.properties.color_index === -1) {
                    return {
                        fillColor: '#6b6b6b',
                        fillOpacity: 0.35,
                        color: '#999999',
                        weight: 1.2,
                        opacity: 0.7,
                        dashArray: '5 5',
                    };
                }
                const colorIdx = feature.properties.color_index || 0;
                return {
                    fillColor: self.colors[colorIdx % self.colors.length],
                    fillOpacity: 0.75,
                    color: '#3a3f4b',
                    weight: 0.8,
                    opacity: 1,
                };
            },
            onEachFeature: function (feature, layer) {
                const iso = feature.properties.iso_a2;
                self.featureLayers[iso] = layer;

                layer.on({
                    click: function (e) {
                        L.DomEvent.stopPropagation(e);
                        if (self.isClickable && self.onClickHandler) {
                            self.onClickHandler(iso, feature);
                        }
                    },
                    mouseover: function (e) {
                        if (!self.isClickable || self.targetIso) {
                            // Always show hover effect
                        }
                        layer.setStyle({
                            weight: 2.5,
                            color: '#58a6ff',
                            fillOpacity: 0.9,
                        });
                        layer.bringToFront();
                    },
                    mouseout: function (e) {
                        if (self.selectedLayer !== layer) {
                            if (feature.properties.disputed || feature.properties.color_index === -1) {
                                layer.setStyle({
                                    fillColor: '#6b6b6b',
                                    fillOpacity: 0.35,
                                    color: '#999999',
                                    weight: 1.2,
                                    opacity: 0.7,
                                    dashArray: '5 5',
                                });
                            } else {
                                const colorIdx = feature.properties.color_index || 0;
                                layer.setStyle({
                                    weight: 0.8,
                                    color: '#3a3f4b',
                                    fillColor: self.colors[colorIdx % self.colors.length],
                                    fillOpacity: self.getOpacity(iso),
                                });
                            }
                        }
                    },
                });

                // Tooltip
                const name = feature.properties.disputed
                    ? (I18N.countryName(feature) + ' [Disputed]')
                    : I18N.countryName(feature);
                if (name) {
                    layer.bindTooltip(name, {
                        permanent: false,
                        direction: 'center',
                        className: 'country-tooltip',
                        opacity: 0.85,
                    });
                }
            },
        }).addTo(this.map);
    },

    /** Disable tooltips during gameplay (prevents revealing country names) */
    disableTooltips() {
        for (const layer of Object.values(this.featureLayers)) {
            layer.unbindTooltip();
        }
    },

    /** Re-enable tooltips after gameplay — respects user preference */
    enableTooltips() {
        if (!this.tooltipsUserEnabled) return; // User has tooltips turned off
        this._bindAllTooltips();
    },

    /** Toggle tooltips based on user button press */
    toggleUserTooltips() {
        this.tooltipsUserEnabled = !this.tooltipsUserEnabled;
        if (this.tooltipsUserEnabled) {
            this._bindAllTooltips();
        } else {
            for (const layer of Object.values(this.featureLayers)) {
                layer.unbindTooltip();
            }
        }
        // Save preference
        try {
            localStorage.setItem('world_map_tooltips', this.tooltipsUserEnabled ? '1' : '0');
        } catch (e) {}
        return this.tooltipsUserEnabled;
    },

    /** Internal: bind tooltips to all feature layers */
    _bindAllTooltips() {
        for (const [iso, layer] of Object.entries(this.featureLayers)) {
            const feature = this.featureById[iso];
            if (feature) {
                let name = I18N.countryName(feature);
                if (feature.properties.disputed) {
                    name = name + ' [Disputed]';
                }
                if (name) {
                    layer.unbindTooltip();
                    layer.bindTooltip(name, {
                        permanent: false,
                        direction: 'center',
                        className: 'country-tooltip',
                        opacity: 0.85,
                    });
                }
            }
        }
    },

    /** Get current opacity for a country (handles outline mode) */
    getOpacity(iso) {
        // During outline mode, dim all except target
        if (this._outlineTarget && iso !== this._outlineTarget) {
            return 0.1;
        }
        return 0.75;
    },

    /** Enable click-to-answer mode */
    enableClickMode(targetIso, handler) {
        this.targetIso = targetIso;
        this.isClickable = true;
        this.onClickHandler = handler;
        // Update cursor
        document.getElementById('map').style.cursor = 'pointer';
    },

    /** Disable click-to-answer mode */
    disableClickMode() {
        this.targetIso = null;
        this.isClickable = false;
        this.onClickHandler = null;
        document.getElementById('map').style.cursor = '';
    },

    /** Highlight a specific country */
    highlightCountry(iso) {
        this.resetHighlight();
        const layer = this.featureLayers[iso];
        if (layer) {
            this.selectedLayer = layer;
            layer.setStyle({
                fillColor: '#f85149',
                fillOpacity: 0.9,
                weight: 3,
                color: '#ffffff',
            });
            layer.bringToFront();
        }
    },

    /** Flash a country briefly (for hint zoom) */
    flashCountry(iso, duration = 1500) {
        const layer = this.featureLayers[iso];
        if (!layer) return;
        this.highlightCountry(iso);
        setTimeout(() => {
            if (this.selectedLayer === layer) {
                this.resetHighlight();
            }
        }, duration);
    },

    /** Reset all country highlights */
    resetHighlight() {
        if (this.selectedLayer) {
            // Find the feature for this layer to restore its color
            const iso = this._getIsoByLayer(this.selectedLayer);
            const feature = this.featureById[iso];
            if (feature) {
                const colorIdx = feature.properties.color_index || 0;
                this.selectedLayer.setStyle({
                    fillColor: this.colors[colorIdx % this.colors.length],
                    fillOpacity: this.getOpacity(iso),
                    weight: 0.8,
                    color: '#3a3f4b',
                });
            }
            this.selectedLayer = null;
        }
    },

    /** Fly map view to a country */
    flyToCountry(iso) {
        const layer = this.featureLayers[iso];
        if (layer) {
            try {
                const bounds = layer.getBounds();
                this.map.flyToBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 5,
                    duration: 1.0,
                });
            } catch (e) {
                // Fallback: try to use the feature's bounding box
                const feature = this.featureById[iso];
                if (feature) {
                    // Simple centroid calculation from first polygon ring
                    try {
                        let coords;
                        if (feature.geometry.type === 'Polygon') {
                            coords = feature.geometry.coordinates[0];
                        } else if (feature.geometry.type === 'MultiPolygon') {
                            coords = feature.geometry.coordinates[0][0];
                        }
                        if (coords && coords.length > 0) {
                            let sumLng = 0, sumLat = 0;
                            for (const c of coords) {
                                sumLng += c[0];
                                sumLat += c[1];
                            }
                            const centerLng = sumLng / coords.length;
                            const centerLat = sumLat / coords.length;
                            this.map.flyTo([centerLat, centerLng], 4, { duration: 1.0 });
                        }
                    } catch (e2) {
                        // give up
                    }
                }
            }
        }
    },

    /** Set outline mode — show only target country, dim others */
    setOutlineMode(iso) {
        this._outlineTarget = iso;
        const targetFeature = this.featureById[iso];
        if (!targetFeature) return;

        // Fly to the country
        this.flyToCountry(iso);

        // Update all layer styles
        for (const [layerIso, layer] of Object.entries(this.featureLayers)) {
            const feature = this.featureById[layerIso];
            const colorIdx = feature.properties.color_index || 0;
            if (layerIso === iso) {
                layer.setStyle({
                    fillColor: this.colors[colorIdx % this.colors.length],
                    fillOpacity: 0.9,
                    weight: 3,
                    color: '#ffffff',
                });
                layer.bringToFront();
            } else {
                layer.setStyle({
                    fillColor: '#2a3040',
                    fillOpacity: 0.08,
                    weight: 0.3,
                    color: '#1a2030',
                });
            }
        }
    },

    /** Clear outline mode */
    clearOutlineMode() {
        this._outlineTarget = null;
        for (const [iso, layer] of Object.entries(this.featureLayers)) {
            const feature = this.featureById[iso];
            if (feature) {
                const colorIdx = feature.properties.color_index || 0;
                layer.setStyle({
                    fillColor: this.colors[colorIdx % this.colors.length],
                    fillOpacity: 0.75,
                    weight: 0.8,
                    color: '#3a3f4b',
                });
            }
        }
    },

    /** Get feature by ISO code */
    getFeature(iso) {
        return this.featureById[iso] || null;
    },

    /** Get features filtered by difficulty */
    getFeaturesByDifficulty(difficulty) {
        // Exclude Antarctica and disputed territories
        const features = this.countryFeatures.filter(f =>
            f.properties.iso_a2 !== 'AQ' && !f.properties.disputed
        );
        switch (difficulty) {
            case 'easy':
                return features.filter(f => f.properties.area_rank <= 40);
            case 'medium':
                return features.filter(f => f.properties.area_rank <= 100);
            case 'hard':
                return features;
            default:
                return features;
        }
    },

    /** Get a random country feature filtered by difficulty */
    getRandomCountry(difficulty, excludeList) {
        const pool = this.getFeaturesByDifficulty(difficulty).filter(
            f => !excludeList || !excludeList.has(f.properties.iso_a2)
        );
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    /** Helper: find ISO code from layer reference */
    _getIsoByLayer(layer) {
        for (const [iso, l] of Object.entries(this.featureLayers)) {
            if (l === layer) return iso;
        }
        return null;
    },
};
