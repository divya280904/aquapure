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

    // Watchdog timer: ensure button NEVER stays in loading state for more than 8 seconds
    const watchdog = setTimeout(() => {
      setLocating(false);
      Alert.alert(
        "Location Request Timed Out",
        "Could not detect your GPS location in time. Please check your device location settings, or tap the map directly to place your pin."
      );
    }, 8000);

    try {
      // 1. Check if location services are enabled on the device
      const isServiceEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!isServiceEnabled) {
        clearTimeout(watchdog);
        setLocating(false);
        Alert.alert(
          "Location Services Disabled",
          "Please enable GPS / Location in your device quick settings, or tap directly on the map to pick your address."
        );
        return;
      }

      // 2. Check and request foreground permissions
      let perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm || perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      }

      if (!perm || perm.status !== "granted") {
        clearTimeout(watchdog);
        setLocating(false);
        Alert.alert(
          "Location Permission Required",
          "Permission to access location was not granted. Please enable location permissions in device settings, or tap on the map to pin your location."
        );
        return;
      }

      // 3. Fast-path: Try to get last known location from device cache first (<50ms)
      let location: Location.LocationObject | null = null;
      try {
        location = await Location.getLastKnownPositionAsync({
          maxAge: 300000, // up to 5 minutes old cache
        });
      } catch (cacheErr) {
        console.log("No cached location found:", cacheErr);
      }

      // 4. If no cached location, request fresh position with a strict timeout race (5 seconds)
      if (!location || !location.coords) {
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 5000)
        );

        try {
          location = await Promise.race([positionPromise, timeoutPromise]);
        } catch (err: any) {
          // If Balanced accuracy timed out, quickly try Lowest accuracy (uses cell/Wi-Fi towers, nearly instant)
          try {
            const lowAccPromise = Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Lowest,
            });
            const lowAccTimeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("LOW_ACC_TIMEOUT")), 2500)
            );
            location = await Promise.race([lowAccPromise, lowAccTimeout]);
          } catch (lowErr) {
            console.warn("Lowest accuracy fallback also failed:", lowErr);
          }
        }
      }

      if (!location || !location.coords) {
        clearTimeout(watchdog);
        setLocating(false);
        Alert.alert(
          "GPS Signal Weak",
          "Could not acquire satellite GPS fix in time. Please ensure device location is on, or tap directly on the map to place your pin."
        );
        return;
      }

      const newCoords: LocationCoordinates = {
        latitude: Number(location.coords.latitude.toFixed(6)),
        longitude: Number(location.coords.longitude.toFixed(6)),
      };

      setCurrentCoords(newCoords);

      // Send update to Leaflet map inside WebView
      if (webViewRef.current) {
        try {
          webViewRef.current.postMessage(
            JSON.stringify({
              type: "SET_CENTER",
              lat: newCoords.latitude,
              lng: newCoords.longitude,
            })
          );
        } catch (postErr) {
          console.warn("Map postMessage error:", postErr);
        }
      }

      // Immediately notify parent with coordinates
      onLocationSelected(newCoords);

      // Clear watchdog and stop loading spinner immediately for instant responsiveness!
      clearTimeout(watchdog);
      setLocating(false);

      // 5. Asynchronously reverse geocode in background without blocking button or UI
      (async () => {
        try {
          const geoPromise = Location.reverseGeocodeAsync({
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
          });
          const geoTimeout = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 3500)
          );
          const reverseResults = await Promise.race([geoPromise, geoTimeout]);

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

            const formattedAddress = parts.join(", ");
            if (formattedAddress) {
              onLocationSelected(newCoords, formattedAddress);
            }
          }
        } catch (geoError) {
          console.warn("Background reverse geocode error:", geoError);
        }
      })();

      return;
    } catch (error: any) {
      console.error("Get location error:", error);
      clearTimeout(watchdog);
      setLocating(false);
      Alert.alert(
        "Location Unavailable",
        "Could not detect your current location. Please verify device GPS is enabled, or type your address manually."
      );
    } finally {
      clearTimeout(watchdog);
      setLocating(false);
    }
  }

  function handleWebViewMessage(event: any) {
    try {
      const data = typeof event.nativeEvent.data === "string"
        ? JSON.parse(event.nativeEvent.data)
        : event.nativeEvent.data;

      if (data && data.type === "PIN_MOVED" && typeof data.lat === "number" && typeof data.lng === "number") {
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
          try {
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

            function handleCenterMessage(event) {
              try {
                var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data && data.type === 'SET_CENTER' && map && marker) {
                  map.setView([data.lat, data.lng], 15);
                  marker.setLatLng([data.lat, data.lng]);
                }
              } catch(e) {}
            }

            window.addEventListener('message', handleCenterMessage);
            document.addEventListener('message', handleCenterMessage);
          } catch(initErr) {
            console.warn('Map initialization error:', initErr);
          }
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
