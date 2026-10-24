import React, { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

export type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

type Props = {
  initialCoordinates?: LocationCoordinates | null;
  onLocationSelected: (coords: LocationCoordinates, suggestedAddress?: string) => void;
  selectedCoordinates?: LocationCoordinates | null;
};

// Default center: India central coordinates (or Bengaluru)
const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;

export default function MapAddressPicker({
  initialCoordinates,
  onLocationSelected,
  selectedCoordinates,
}: Props) {
  const webViewRef = useRef<any>(null);
  const [locating, setLocating] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<LocationCoordinates>(
    selectedCoordinates || initialCoordinates || { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG }
  );
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCoordinates) {
      setCurrentCoords(selectedCoordinates);
    }
  }, [selectedCoordinates]);

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== "granted") {
        Alert.alert(
          "Location Permission Denied",
          "Permission to access location was denied. You can manually enter your address or tap on the map to pin your location."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords: LocationCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentCoords(newCoords);

      // Send update to Leaflet map inside WebView
      if (webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "SET_CENTER",
            lat: newCoords.latitude,
            lng: newCoords.longitude,
          })
        );
      }

      // Reverse geocode to get human-readable address
      let formattedAddress = "";
      try {
        const reverseResults = await Location.reverseGeocodeAsync({
          latitude: newCoords.latitude,
          longitude: newCoords.longitude,
        });

        if (reverseResults && reverseResults.length > 0) {
          const item = reverseResults[0];
          const parts = [
            item.name,
            item.street,
            item.district || item.subregion,
            item.city,
            item.region,
            item.postalCode,
          ].filter(Boolean);

          formattedAddress = parts.join(", ");
        }
      } catch (geoError) {
        console.warn("Reverse geocoding error:", geoError);
      }

      onLocationSelected(newCoords, formattedAddress || undefined);
    } catch (error) {
      console.error("Get location error:", error);
      Alert.alert(
        "Location Unavailable",
        "Could not detect your current location. Please verify device GPS is enabled, or type your address manually."
      );
    } finally {
      setLocating(false);
    }
  }

  function handleWebViewMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "PIN_MOVED" && typeof data.lat === "number" && typeof data.lng === "number") {
        const coords: LocationCoordinates = {
          latitude: Number(data.lat.toFixed(6)),
          longitude: Number(data.lng.toFixed(6)),
        };
        setCurrentCoords(coords);
        onLocationSelected(coords);
      }
    } catch (err) {
      console.warn("Map message parsing failed:", err);
    }
  }

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { box-sizing: border-box; }
          body, html { margin: 0; padding: 0; height: 100%; width: 100%; background: #F4FAFC; font-family: sans-serif; }
          #map { height: 100%; width: 100%; }
          .pin-hint {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            background: rgba(23, 59, 69, 0.88);
            color: #FFFFFF;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <div class="pin-hint">Tap map or drag pin to adjust location</div>
        <div id="map"></div>
        <script>
          var lat = ${currentCoords.latitude};
          var lng = ${currentCoords.longitude};
          var map = L.map('map', { zoomControl: true }).setView([lat, lng], 14);

          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          var marker = L.marker([lat, lng], { draggable: true }).addTo(map);

          function postCoords(lat, lng) {
            var payload = JSON.stringify({ type: 'PIN_MOVED', lat: lat, lng: lng });
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(payload);
            }
          }

          marker.on('dragend', function(e) {
            var pos = marker.getLatLng();
            postCoords(pos.lat, pos.lng);
          });

          map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            postCoords(e.latlng.lat, e.latlng.lng);
          });

          window.addEventListener('message', function(event) {
            try {
              var msg = JSON.parse(event.data);
              if (msg.type === 'SET_CENTER') {
                map.setView([msg.lat, msg.lng], 15);
                marker.setLatLng([msg.lat, msg.lng]);
              }
            } catch(e) {}
          });

          document.addEventListener('message', function(event) {
            try {
              var msg = JSON.parse(event.data);
              if (msg.type === 'SET_CENTER') {
                map.setView([msg.lat, msg.lng], 15);
                marker.setLatLng([msg.lat, msg.lng]);
              }
            } catch(e) {}
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          <Text style={styles.sectionLabel}>Pin Service Location on Map</Text>
          <Text style={styles.subLabel}>
            OpenStreetMap Free Service · Drag or tap to pick
          </Text>
        </View>

        <Pressable
          style={[styles.locateButton, locating && styles.disabledButton]}
          onPress={handleUseCurrentLocation}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="navigate" size={14} color="#FFFFFF" />
              <Text style={styles.locateText}>Current GPS</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Interactive Map */}
      <View style={styles.mapFrame}>
        {Platform.OS === "web" ? (
          <iframe
            srcDoc={leafletHtml}
            style={{ width: "100%", height: "100%", border: "none" } as any}
            title="OpenStreetMap Picker"
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: leafletHtml }}
            style={styles.webView}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* Selected Coordinates Status */}
      <View style={styles.coordsFooter}>
        <Ionicons name="location-sharp" size={15} color="#087E8B" />
        <Text style={styles.coordsText}>
          Coordinates: {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleArea: {
    flex: 1,
    marginRight: 8,
  },
  sectionLabel: {
    color: "#173B45",
    fontSize: 13,
    fontWeight: "700",
  },
  subLabel: {
    color: "#58717A",
    fontSize: 11,
    marginTop: 2,
  },
  locateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#087E8B",
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  locateText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  mapFrame: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D4E3E7",
    backgroundColor: "#EBF3F5",
  },
  webView: {
    flex: 1,
    backgroundColor: "#EBF3F5",
  },
  coordsFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "#E8F4F7",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  coordsText: {
    color: "#173B45",
    fontSize: 11,
    fontWeight: "600",
  },
});
