import React, { useEffect, useRef } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import XYZ from "ol/source/XYZ";

const MapComponent = ({ lat, lon, darkMode }) => {
  const mapRef = useRef();
  const mapInstance = useRef(null);
  const darkTileSource = useRef(null);
  const lightTileSource = useRef(null);

  useEffect(() => {
    if (lat && lon && mapRef.current) {
      const coords = fromLonLat([lon, lat]);

      // Create marker
      const marker = new Feature({
        geometry: new Point(coords),
      });

      marker.setStyle(
        new Style({
          image: new Icon({
            anchor: [0.5, 1],
            src: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            scale: 0.05,
          }),
        })
      );

      // Create sources only once
      darkTileSource.current = new XYZ({
        url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
      });

      lightTileSource.current = new OSM();

      // Create map
      mapInstance.current = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: darkMode ? darkTileSource.current : lightTileSource.current,
          }),
          new VectorLayer({
            source: new VectorSource({
              features: [marker],
            }),
          })
        ],
        view: new View({
          center: coords,
          zoom: 11,
        }),
      });

      return () => {
        if (mapInstance.current) {
          mapInstance.current.setTarget(null);
          mapInstance.current = null;
        }
      };
    }
  }, [lat, lon]); // Initial setup only when lat/lon changes

  // Handle dark mode changes
  useEffect(() => {
    if (mapInstance.current && darkTileSource.current && lightTileSource.current) {
      const baseLayer = mapInstance.current.getLayers().item(0);
      baseLayer.setSource(darkMode ? darkTileSource.current : lightTileSource.current);
    }
  }, [darkMode]); // Update when darkMode prop changes

  return (
    <div ref={mapRef} style={{ height: "300px", width: "100%" }} className="rounded-xl overflow-hidden"/>
  );
};

export default MapComponent;