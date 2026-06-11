"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Map, { MapRef } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

type Props = {
  onPolygonChange: (areaM2: number, centroid: { lat: number; lon: number }) => void;
};

const MapSolar: React.FC<Props> = ({ onPolygonChange }) => {
  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const setupDraw = useCallback(() => {
    if (!mapRef.current || drawRef.current) return;

    const map = mapRef.current.getMap();
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      }
    });
    drawRef.current = draw;
    map.addControl(draw, "top-left");

    map.on("draw.create", updateArea);
    map.on("draw.update", updateArea);
    map.on("draw.delete", () => onPolygonChange(0, { lat: 0, lon: 0 }));

    function updateArea() {
      const data = draw.getAll();
      if (data.features.length > 0) {
        const polygon = data.features[0];
        const area = turf.area(polygon); // m²
        const centroid = turf.centroid(polygon);
        const [lon, lat] = centroid.geometry.coordinates as [number, number];
        onPolygonChange(area, { lat, lon });
      }
    }
  }, [onPolygonChange]);

  useEffect(() => {
    setupDraw();
  }, [setupDraw]);

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-800" style={{ height: 500 }}>
      <Map
        ref={mapRef}
        onLoad={() => setupDraw()}
        initialViewState={{
          longitude: -9.142685,
          latitude: 38.736946,
          zoom: 10
        }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      />
    </div>
  );
};

export default MapSolar;
