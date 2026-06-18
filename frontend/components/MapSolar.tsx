"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Map, { MapRef } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

const DRAW_BLUE = "#3bb2d0";
const DRAW_ORANGE = "#fbb03b";
const DRAW_WHITE = "#fff";

// Mirrors the default @mapbox/mapbox-gl-draw theme, but expresses `line-dasharray`
// arrays as ["literal", [...]] so mapbox-gl v2's stricter style validation does not
// read them as expressions (which raises "Expression name must be a string, but found
// number instead"). mapbox-gl is pinned at 2.15.0 — do not change that pin.
const DRAW_STYLES = [
  {
    id: "gl-draw-polygon-fill",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"]],
    paint: {
      "fill-color": ["case", ["==", ["get", "active"], "true"], DRAW_ORANGE, DRAW_BLUE],
      "fill-opacity": 0.1
    }
  },
  {
    id: "gl-draw-lines",
    type: "line",
    filter: ["any", ["==", "$type", "LineString"], ["==", "$type", "Polygon"]],
    layout: {
      "line-cap": "round",
      "line-join": "round"
    },
    paint: {
      "line-color": ["case", ["==", ["get", "active"], "true"], DRAW_ORANGE, DRAW_BLUE],
      "line-dasharray": [
        "case",
        ["==", ["get", "active"], "true"],
        ["literal", [0.2, 2]],
        ["literal", [2, 0]]
      ],
      "line-width": 2
    }
  },
  {
    id: "gl-draw-point-outer",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]],
    paint: {
      "circle-radius": ["case", ["==", ["get", "active"], "true"], 7, 5],
      "circle-color": DRAW_WHITE
    }
  },
  {
    id: "gl-draw-point-inner",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]],
    paint: {
      "circle-radius": ["case", ["==", ["get", "active"], "true"], 5, 3],
      "circle-color": ["case", ["==", ["get", "active"], "true"], DRAW_ORANGE, DRAW_BLUE]
    }
  },
  {
    id: "gl-draw-vertex-outer",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "meta", "vertex"],
      ["!=", "mode", "simple_select"]
    ],
    paint: {
      "circle-radius": ["case", ["==", ["get", "active"], "true"], 7, 5],
      "circle-color": DRAW_WHITE
    }
  },
  {
    id: "gl-draw-vertex-inner",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "meta", "vertex"],
      ["!=", "mode", "simple_select"]
    ],
    paint: {
      "circle-radius": ["case", ["==", ["get", "active"], "true"], 5, 3],
      "circle-color": DRAW_ORANGE
    }
  },
  {
    id: "gl-draw-midpoint",
    type: "circle",
    filter: ["all", ["==", "meta", "midpoint"]],
    paint: {
      "circle-radius": 3,
      "circle-color": DRAW_ORANGE
    }
  }
];

type Props = {
  onPolygonChange: (areaM2: number, centroid: { lat: number; lon: number }) => void;
  flyTo?: { lon: number; lat: number } | null;
};

const MapSolar: React.FC<Props> = ({ onPolygonChange, flyTo }) => {
  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  // Jump to a location chosen in the search bar, at roof-level zoom.
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.getMap().flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 19, duration: 1500 });
  }, [flyTo]);

  const setupDraw = useCallback(() => {
    if (!mapRef.current || drawRef.current) return;

    const map = mapRef.current.getMap();
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      styles: DRAW_STYLES
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
    <div className="w-full h-[500px] rounded-lg overflow-hidden border border-slate-800" style={{ height: 500 }}>
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
