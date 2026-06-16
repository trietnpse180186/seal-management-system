import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import RegisterTeamScreen from '../screens/RegisterTeamScreen';
import TeamAreaScreen from '../screens/TeamAreaScreen';
import JudgeDashboardScreen from '../screens/JudgeDashboardScreen';
import JudgeScoringScreen from '../screens/JudgeScoringScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();

export default function AppNavigator({ initialRoute = 'Login' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a141d' }, // Đồng bộ màu nền tối
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="RegisterTeam" component={RegisterTeamScreen} />
      <Stack.Screen name="TeamArea" component={TeamAreaScreen} />
      <Stack.Screen name="JudgeDashboard" component={JudgeDashboardScreen} />
      <Stack.Screen name="JudgeScoring" component={JudgeScoringScreen} />
    </Stack.Navigator>
  );
}
