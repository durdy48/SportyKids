import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export const navigationRef = createNavigationContainerRef();
import { Text } from 'react-native';
import { t } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { HomeFeedScreen } from '../screens/HomeFeed';
import { ReelsScreen } from '../screens/Reels';
import { QuizScreen } from '../screens/Quiz';
import { CollectionScreen } from '../screens/Collection';
import { FavoriteTeamScreen } from '../screens/FavoriteTeam';
import { ParentalControlScreen } from '../screens/ParentalControl';
import { OnboardingScreen } from '../screens/Onboarding';
import { RssCatalogScreen } from '../screens/RssCatalog';
import { LoginScreen } from '../screens/Login';
import { RegisterScreen } from '../screens/Register';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { locale } = useUser();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#F1F5F9' },
      }}
    >
      <Tab.Screen
        name="HomeFeed"
        component={HomeFeedScreen}
        options={{
          title: t('nav.news', locale),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📰</Text>,
        }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{
          title: t('nav.reels', locale),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🎬</Text>,
        }}
      />
      <Tab.Screen
        name="Quiz"
        component={QuizScreen}
        options={{
          title: t('nav.quiz', locale),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🧠</Text>,
        }}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{
          title: t('nav.collection', locale),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="FavoriteTeam"
        component={FavoriteTeamScreen}
        options={{
          title: t('nav.my_team', locale),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>⚽</Text>,
        }}
      />
      <Tab.Screen
        name="Parents"
        component={ParentalControlScreen}
        options={{
          title: t('nav.parents', locale),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🔒</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading, locale } = useUser();

  if (loading) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="RssCatalog"
              component={RssCatalogScreen}
              options={{
                headerShown: true,
                title: t('sources.catalog_title', locale),
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
