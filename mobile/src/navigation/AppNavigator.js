import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MyAchievementsScreen from '../screens/MyAchievementsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import RegisterTeamScreen from '../screens/RegisterTeamScreen';
import TeamAreaScreen from '../screens/TeamAreaScreen';
import JudgeDashboardScreen from '../screens/JudgeDashboardScreen';
import JudgeScoringScreen from '../screens/JudgeScoringScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createStackNavigator();

export default function AppNavigator({ initialRoute = 'Welcome' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#f8fafc' }, // Đồng bộ màu nền Light mode toàn app
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="MyAchievements" component={MyAchievementsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="RegisterTeam" component={RegisterTeamScreen} />
      <Stack.Screen name="TeamArea" component={TeamAreaScreen} />
      <Stack.Screen name="JudgeDashboard" component={JudgeDashboardScreen} />
      <Stack.Screen name="JudgeScoring" component={JudgeScoringScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
