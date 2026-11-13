// Timestamp: 2026-11-13 17:35
import { SymbolView } from "expo-symbols";
import { Tabs } from "expo-router";

import { colors } from "@/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopColor: colors.borderSubtle,
          backgroundColor: colors.bg
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "house.fill", android: "home", web: "home" }}
              tintColor={color}
              size={24}
            />
          )
        }}
      />
      <Tabs.Screen
        name="watch"
        options={{
          title: "视频",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "play.rectangle.fill", android: "play_circle", web: "play_circle" }}
              tintColor={color}
              size={24}
            />
          )
        }}
      />
      <Tabs.Screen
        name="lectura"
        options={{
          title: "阅读",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "book.fill", android: "menu_book", web: "menu_book" }}
              tintColor={color}
              size={24}
            />
          )
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: "复习",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
              tintColor={color}
              size={24}
            />
          )
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "person.fill", android: "person", web: "person" }}
              tintColor={color}
              size={24}
            />
          )
        }}
      />
    </Tabs>
  );
}
