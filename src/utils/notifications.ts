
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../../firebase";

export async function registerForPushNotifications(): Promise<
  string | null
> {
  try {
    // Push-token registration is for native devices, not the web app.
    if (Platform.OS === "web" || !Device.isDevice) {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "AquaPure Updates",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const user = auth.currentUser;

    if (!user) {
      return null;
    }

    let permission = await Notifications.getPermissionsAsync();

    if (!permission.granted) {
      permission = await Notifications.requestPermissionsAsync();
    }

    if (!permission.granted) {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      throw new Error("EAS project ID is missing.");
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenResult.data;

    await setDoc(
      doc(db, "users", user.uid),
      {
        expoPushToken: token,
        notificationsEnabled: true,
        notificationTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch (error) {
    console.error("AquaPure push registration failed:", error);
    return null;
  }
}
