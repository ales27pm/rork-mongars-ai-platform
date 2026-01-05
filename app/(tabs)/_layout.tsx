import { Tabs } from "expo-router";
import React from "react";
import { MessageSquare, Database, Sparkles, Activity, Eye, Brain, Cpu } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: "Memory",
          tabBarIcon: ({ color, size }) => <Database size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="evolution"
        options={{
          title: "Evolution",
          tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="diagnostics"
        options={{
          title: "Diagnostics",
          tabBarIcon: ({ color, size }) => <Activity size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="introspection"
        options={{
          title: "Introspection",
          tabBarIcon: ({ color, size }) => <Eye size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="consciousness"
        options={{
          title: "Consciousness",
          tabBarIcon: ({ color, size }) => <Brain size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: "Models",
          tabBarIcon: ({ color, size }) => <Cpu size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
