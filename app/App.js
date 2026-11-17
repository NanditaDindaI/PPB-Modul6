import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { enableScreens } from "react-native-screens";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { MonitoringScreen } from "./src/screens/MonitoringScreen.js";
import { ControlScreen } from "./src/screens/ControlScreen.js";
import { ProfileScreen } from "./src/screens/ProfileScreen.js";
import { assertConfig } from "./src/services/config.js";
import { tokens } from "./src/theme/tokens.js";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const splashIllustration = require("./assets/splash-illustration.jpg");

// Keep the native splash visible until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const { color } = tokens;

enableScreens(true);

// ── Custom Animated Splash Screen ───────────────────────────────────────────
function CustomSplash({ onFinish }) {
  // Intro entrance animations
  const introScale = useRef(new Animated.Value(0.8)).current;
  const introOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  // Continuous floating / bobbing animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;
  const pulseRing = useRef(new Animated.Value(0.8)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // Hide native splash immediately — custom splash takes over
    SplashScreen.hideAsync().catch(() => {});

    // Floating loop (bobbing phone graphic up and down)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -12,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shadowScale, {
            toValue: 0.85,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 4,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shadowScale, {
            toValue: 1.1,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    floatLoop.start();

    // Pulse ring loop behind the graphic
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseRing, {
            toValue: 1.45,
            duration: 1600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseRing, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();

    // Staggered intro sequence
    Animated.sequence([
      // 1. Graphic pops in with bouncy spring
      Animated.parallel([
        Animated.timing(introOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(introScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      // 2. Title "LiveTemp"
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // 3. Subtitle "IoT Temperature Monitor"
      Animated.timing(tagOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // 4. "Kelompok 22" badge
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Display time for viewer to enjoy the animation
      Animated.delay(1600),
      // Smooth exit
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      floatLoop.stop();
      pulseLoop.stop();
      onFinish?.();
    });
  }, []);

  const graphicSize = Math.min(SCREEN_WIDTH * 0.72, 280);

  return (
    <Animated.View style={[splashStyles.container, { opacity: exitOpacity }]}>
      {/* Background Soft Aura */}
      <View style={splashStyles.glowAura} />

      {/* Graphic Area with Floating Animation */}
      <View style={splashStyles.graphicArea}>
        {/* Pulsing Signal Wave */}
        <Animated.View
          style={[
            splashStyles.pulseRing,
            {
              width: graphicSize * 0.9,
              height: graphicSize * 0.9,
              borderRadius: (graphicSize * 0.9) / 2,
              transform: [{ scale: pulseRing }],
              opacity: pulseOpacity,
            },
          ]}
        />

        {/* Dynamic Shadow underneath */}
        <Animated.View
          style={[
            splashStyles.graphicShadow,
            {
              width: graphicSize * 0.7,
              transform: [{ scaleX: shadowScale }],
            },
          ]}
        />

        {/* Floating Isometric Phone Graphic */}
        <Animated.View
          style={[
            splashStyles.graphicWrap,
            {
              width: graphicSize,
              height: graphicSize,
              opacity: introOpacity,
              transform: [{ scale: introScale }, { translateY: floatAnim }],
            },
          ]}
        >
          <Image
            source={splashIllustration}
            style={splashStyles.graphicImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Typography Section */}
      <View style={splashStyles.textContainer}>
        <Animated.Text
          style={[
            splashStyles.appName,
            {
              opacity: textOpacity,
              transform: [
                {
                  translateY: textOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          LiveTemp
        </Animated.Text>

        <Animated.Text
          style={[
            splashStyles.tagline,
            {
              opacity: tagOpacity,
              transform: [
                {
                  translateY: tagOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          IoT Temperature Monitor
        </Animated.Text>

        <Animated.View
          style={[
            splashStyles.badge,
            {
              opacity: badgeOpacity,
              transform: [
                {
                  scale: badgeOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="people" size={14} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={splashStyles.badgeText}>Kelompok 22</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glowAura: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#EFF6FF",
    opacity: 0.8,
  },
  graphicArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#93C5FD",
    backgroundColor: "transparent",
  },
  graphicShadow: {
    position: "absolute",
    bottom: 6,
    height: 18,
    borderRadius: 10,
    backgroundColor: "rgba(100, 116, 139, 0.18)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  graphicWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  graphicImage: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: "500",
    color: "#475569",
    letterSpacing: 0.2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  badgeText: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
// ────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        assertConfig();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (splashDone) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [splashDone]);

  // Show custom splash until both app ready AND splash animation done
  if (!appIsReady || !splashDone) {
    return (
      <CustomSplash
        onFinish={() => {
          // Hide native splash before transitioning to app
          SplashScreen.hideAsync().catch(() => {});
          setSplashDone(true);
        }}
      />
    );
  }

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: color.bg,
      card: color.surface,
      text: color.text,
      border: color.border,
      primary: color.primary,
    },
  };

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <NavigationContainer theme={theme}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: true,
              headerTitle: "LiveTemp",
              headerTitleAlign: "left",
              headerTintColor: color.text,
              headerStyle: {
                backgroundColor: color.surface,
                borderBottomWidth: 1,
                borderBottomColor: color.border,
              },
              headerTitleStyle: {
                fontWeight: "600",
                fontSize: 17,
                fontFamily: "monospace",
                letterSpacing: -0.5,
              },
              tabBarActiveTintColor: color.primary,
              tabBarInactiveTintColor: color.text2,
              tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
              tabBarStyle: {
                backgroundColor: color.surface,
                borderTopWidth: 1,
                borderTopColor: color.border,
              },
              tabBarHideOnKeyboard: true,
              tabBarIcon: ({ color: iconColor }) => {
                let iconName;
                if (route.name === "Monitoring") iconName = "pulse";
                else if (route.name === "Control") iconName = "options";
                else iconName = "person";
                return <Ionicons name={iconName} size={24} color={iconColor} />;
              },
            })}
          >
            <Tab.Screen name="Monitoring" component={MonitoringScreen} />
            <Tab.Screen name="Control" component={ControlScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
