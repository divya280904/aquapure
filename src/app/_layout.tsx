import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { CartProvider } from "../context/CartContext";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { registerForPushNotifications } from "../utils/notifications";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        void registerForPushNotifications();
      }
    });

    return unsubscribe;
  }, []);

  return (
    <CartProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />

        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ title: "AquaPure Account" }} />
          <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
          <Stack.Screen name="orders" options={{ title: "My Orders" }} />
          <Stack.Screen name="cart" options={{ title: "My Cart" }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="service-booking" options={{ headerShown: false }} />
          <Stack.Screen name="dealer-bulk-orders" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="admin-products" options={{ title: "Manage Products" }} />
          <Stack.Screen name="admin-orders" options={{ title: "Manage Orders" }} />
          <Stack.Screen name="admin-services" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </CartProvider>
  );
}
